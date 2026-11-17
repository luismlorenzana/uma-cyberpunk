import { checkPack, walkSteps } from './check'
import { P, parsePack } from './parse'
import type { Scene, Speaker, StoryPack } from './types'
import { PORT_STOCK_MAX, SUPPLY_KINDS, type Supplies, type SupplyNetwork } from '../campaign-supply'
import { CAPABILITY_NAME } from '../ship/modules'
import type { CommandEncounter } from '../ship/command'
import { parseCommandEncounter } from '../ship/command-parse'
import { PARTS_BY_ID } from '../crew/parts'
import type { Wallet } from '../ship/hull'

export interface CampaignQuest {
  id: string
  title: string
  scene: string
  after?: string
  encounter?: string
  port?: string
}

export interface CampaignSceneArt {
  scene: string
  backdrop?: string
  portraits: { speaker: Speaker; asset: string; emote?: string }[]
}

export interface CampaignBook {
  opening: string
  draft: boolean
  quests: CampaignQuest[]
  assets: { id: string; file: string }[]
  art: CampaignSceneArt[]
  story: StoryPack
  scenes: ReadonlyMap<string, Scene>
  evening?: { after: string; visits: { companion: number; scene: string; morning: string | null }[] }
  supply?: SupplyNetwork
  commands: ReadonlyMap<string, CommandEncounter>
  ground: ReadonlyMap<string, GroundEncounter>
}

export interface GroundEncounter {
  id: string
  title: string
  alternate?: { flag: string; scenario: string; label: string }
  expansion?: string
  boss?: { unit: string; name: string; portrait: string }
  win: { flag?: string; file?: string; reward?: Wallet }
}

export interface CampaignReleaseFile {
  path: string
  sha256: string
  bytes: number
}

export interface CampaignRelease {
  schemaVersion: 1
  release: string
  files: (CampaignReleaseFile & { source: string })[]
  assets: (CampaignReleaseFile & { id: string })[]
}

export const CAMPAIGN_PREVIEW_INDEX = 'campaign/preview.json'
export const campaignReleasePath = (release: string): string => `campaign/releases/${release}.json`
export const CAMPAIGN_RELEASE_PATH = /^campaign\/releases\/[a-z0-9][a-z0-9-]{0,63}\.json$/
export const CAMPAIGN_FILE_PATH = /^campaign\/files\/pack\.[a-f0-9]{64}\.(json|png|webp)$/
const ART_FILE = /^[a-z0-9][a-z0-9-]{0,63}\.(png|webp)$/
const STORY_FILE = /^(campaign\.json|casting\.json|(?:worlds|chapters|log|calls|bonds|events)\/[a-z0-9][a-z0-9-]{0,63}\.json)$/

function unique<T>(p: P, path: string, values: readonly T[], key: (value: T) => string): Map<string, T> {
  const result = new Map<string, T>()
  values.forEach((value, index) => {
    const id = key(value)
    if (result.has(id)) p.fail(`${path}[${index}]`, `duplicate ${id}`)
    result.set(id, value)
  })
  return result
}

function parseSupplyNetwork(p: P, value: unknown, story: StoryPack, quests: ReadonlyMap<string, CampaignQuest>): SupplyNetwork {
  const map = p.object(value, 'supply', ['after', 'start', 'ports', 'routes'])
  const after = p.slug(map.after, 'supply.after')
  if (!quests.has(after)) p.fail('supply.after', `unknown quest ${after}`)
  const start = p.slug(map.start, 'supply.start')
  const ports = p.list(map.ports, 'supply.ports', (value, path) => {
    const fields = ['id', 'name', 'scene', 'stock', 'produces', 'upkeep', 'reserve']
    const port = p.object(value, path, [...fields, 'liberation'], fields)
    const id = p.slug(port.id, `${path}.id`)
    const scene = p.slug(port.scene, `${path}.scene`)
    const entry = Object.values(story.chapters).filter((chapter) => chapter.world === id).flatMap((chapter) => chapter.scenes).find((s) => s.id === scene)
    if (!entry) p.fail(`${path}.scene`, `unknown landing scene ${scene} in ${id}`)
    if ([...walkSteps(entry!.steps, '')].some(({ step }) => step.kind === 'battle')) p.fail(`${path}.scene`, 'landing scenes cannot start a battle')
    function amounts(key: string): Supplies {
      const field = `${path}.${key}`
      const o = p.object(port[key], field, SUPPLY_KINDS)
      return { fuel: p.int(o.fuel, `${field}.fuel`, 0, PORT_STOCK_MAX), provisions: p.int(o.provisions, `${field}.provisions`, 0, PORT_STOCK_MAX),
        alloy: p.int(o.alloy, `${field}.alloy`, 0, PORT_STOCK_MAX) }
    }
    const liberation = port.liberation === undefined ? undefined : (() => {
      const x = p.object(port.liberation, `${path}.liberation`, ['flag', 'alloy'])
      return { flag: p.slug(x.flag, `${path}.liberation.flag`), alloy: p.int(x.alloy, `${path}.liberation.alloy`, 1, 99) }
    })()
    return { id, name: p.text(port.name, `${path}.name`, 48), scene, stock: amounts('stock'), produces: amounts('produces'),
      upkeep: amounts('upkeep'), reserve: amounts('reserve'), ...(liberation ? { liberation } : {}) }
  }, 24)
  const known = unique(p, 'supply.ports', ports, (port) => port.id)
  if (!known.has(start)) p.fail('supply.start', `unknown port ${start}`)
  const routes = p.list(map.routes, 'supply.routes', (value, path) => {
    const route = p.object(value, path, ['from', 'to', 'fuel', 'needs'], ['from', 'to', 'fuel'])
    const from = p.slug(route.from, `${path}.from`)
    const to = p.slug(route.to, `${path}.to`)
    if (from === to || !known.has(from) || !known.has(to)) p.fail(path, 'a route connects two different ports')
    const needs = route.needs === undefined ? undefined : p.slug(route.needs, `${path}.needs`)
    if (needs && !Object.hasOwn(CAPABILITY_NAME, needs)) p.fail(`${path}.needs`, `unknown ship capability ${needs}`)
    return { from, to, fuel: p.int(route.fuel, `${path}.fuel`, 1, 3), ...(needs ? { needs } : {}) }
  }, 100)
  unique(p, 'supply.routes', routes, ({ from, to }) => [from, to].sort().join(':'))
  const reachable = new Set([start])
  for (const port of reachable) {
    for (const route of routes) {
      if (route.needs) continue
      if (port === route.from) reachable.add(route.to)
      if (port === route.to) reachable.add(route.from)
    }
  }
  if (reachable.size !== ports.length) p.fail('supply.routes', 'every landing port must be reachable before upgrades')
  return { after, start, ports, routes }
}

export function parseCampaignRelease(value: unknown, file = CAMPAIGN_PREVIEW_INDEX): CampaignRelease {
  const p = new P(file)
  const index = p.object(value, 'release', ['schemaVersion', 'release', 'files', 'assets'])
  p.version(index)
  function entry(o: Record<string, unknown>, path: string, art: boolean): CampaignReleaseFile {
    const sha256 = p.text(o.sha256, `${path}.sha256`, 64)
    const name = p.text(o.path, `${path}.path`, 100)
    const extension = CAMPAIGN_FILE_PATH.exec(name)?.[1]
    if (!/^[a-f0-9]{64}$/.test(sha256) || !extension || (extension === 'json') === art || name !== `campaign/files/pack.${sha256}.${extension}`) {
      p.fail(`${path}.path`, 'expected the path for this hash and file type')
    }
    return { path: name, sha256, bytes: p.int(o.bytes, `${path}.bytes`, 1, 20 * 1024 * 1024) }
  }
  const files = p.list(index.files, 'files', (v, path) => {
    const o = p.object(v, path, ['source', 'path', 'sha256', 'bytes'])
    const source = p.text(o.source, `${path}.source`, 100)
    if (!STORY_FILE.test(source)) p.fail(`${path}.source`, 'expected a campaign or story source file')
    return { source, ...entry(o, path, false) }
  })
  const assets = p.list(index.assets, 'assets', (v, path) => {
    const o = p.object(v, path, ['id', 'path', 'sha256', 'bytes'])
    return { id: p.slug(o.id, `${path}.id`), ...entry(o, path, true) }
  })
  if (!unique(p, 'files', files, (f) => f.source).has('campaign.json')) p.fail('files', 'campaign.json is missing')
  unique(p, 'assets', assets, (a) => a.id)
  return { schemaVersion: 1, release: p.slug(index.release, 'release'), files, assets }
}

export function parseCampaignBook(files: Record<string, unknown>): CampaignBook {
  const { 'campaign.json': config, ...storyFiles } = files
  const p = new P('campaign.json')
  const fields = ['schemaVersion', 'opening', 'draft', 'quests', 'assets', 'art']
  const o = p.object(config, 'campaign', [...fields, 'evening', 'supply', 'commands', 'ground'], fields)
  p.version(o)
  if (typeof o.draft !== 'boolean') p.fail('draft', 'expected a boolean')
  const parsed = parsePack(storyFiles)
  const story = parsed.pack
  if (parsed.errors.length) throw parsed.errors[0]
  if (!story) return p.fail('campaign', 'expected a story pack')
  const error = checkPack(story).find((f) => f.level === 'error')
  if (error) throw new Error(`${error.file}: ${error.where}: ${error.message}`)
  const chapters = Object.values(story.chapters)
  const scenes = unique(p, 'chapter scenes', chapters.flatMap((c) => c.scenes), (s) => s.id)
  const encounters = unique(p, 'chapter missions', chapters.flatMap((c) => c.missions), (m) => m.id)
  const quests = p.list(o.quests, 'quests', (v, path) => {
    const q = p.object(v, path, ['id', 'title', 'scene', 'after', 'encounter', 'port'], ['id', 'title', 'scene'])
    const scene = p.slug(q.scene, `${path}.scene`)
    const declared = scenes.get(scene)
    if (!declared) return p.fail(`${path}.scene`, `unknown scene ${scene}`)
    const encounter = q.encounter === undefined ? undefined : p.slug(q.encounter, `${path}.encounter`)
    if (encounter && !encounters.has(encounter)) p.fail(`${path}.encounter`, `unknown encounter ${encounter}`)
    const battles = [...walkSteps(declared.steps, '')].flatMap(({ step }) => step.kind === 'battle' ? [step.mission] : [])
    const terminal = declared.steps.at(-1)
    if (encounter ? battles.length !== 1 || terminal?.kind !== 'battle' || terminal.mission !== encounter : battles.length > 0) {
      p.fail(`${path}.encounter`, 'a battle quest must finish with its declared encounter')
    }
    return { id: p.slug(q.id, `${path}.id`), title: p.text(q.title, `${path}.title`, 80), scene,
      ...(q.after === undefined ? {} : { after: p.slug(q.after, `${path}.after`) }), ...(encounter ? { encounter } : {}),
      ...(q.port === undefined ? {} : { port: p.slug(q.port, `${path}.port`) }) }
  })
  const byQuest = unique(p, 'quests', quests, (q) => q.id)
  unique(p, 'quest scenes', quests, (q) => q.scene)
  const opening = p.slug(o.opening, 'opening')
  if (!byQuest.has(opening)) p.fail('opening', `unknown quest ${opening}`)
  quests.forEach((q, i) => {
    const path = `quests[${i}].after`
    if (q.id === opening ? q.after !== undefined : q.after === undefined) p.fail(path, 'only the opening quest starts without a prerequisite')
    const seen = new Set([q.id])
    let parent = q.after
    while (parent !== undefined) {
      const previous = byQuest.get(parent)
      if (!previous) return p.fail(path, `unknown quest ${parent}`)
      if (seen.has(parent)) return p.fail(path, 'quest prerequisites form a cycle')
      seen.add(parent)
      parent = previous.after
    }
  })
  const assets = p.list(o.assets, 'assets', (v, path) => {
    const a = p.object(v, path, ['id', 'file'])
    const file = p.text(a.file, `${path}.file`, 72)
    if (!ART_FILE.test(file)) p.fail(`${path}.file`, 'expected a PNG or WebP filename under art/')
    return { id: p.slug(a.id, `${path}.id`), file }
  })
  const byAsset = unique(p, 'assets', assets, (a) => a.id)
  const asset = (id: unknown, path: string): string => {
    const key = p.slug(id, path)
    if (!byAsset.has(key)) p.fail(path, `unknown asset ${key}`)
    return key
  }
  for (const chapter of chapters) {
    const source = new P(`chapters/${chapter.id}.json`)
    chapter.scenes.forEach((scene, index) => {
      for (const { step, path } of walkSteps(scene.steps, `scenes[${index}].steps`)) {
        if (step.kind === 'illustration' && step.asset && !byAsset.has(step.asset)) source.fail(path, `unknown illustration ${step.asset}`)
      }
    })
  }
  const art = p.list(o.art, 'art', (v, path) => {
    const a = p.object(v, path, ['scene', 'backdrop', 'portraits'], ['scene', 'portraits'])
    const scene = p.slug(a.scene, `${path}.scene`)
    const declared = scenes.get(scene)
    if (!declared) return p.fail(`${path}.scene`, `unknown scene ${scene}`)
    const cast = new Set(declared.cast.map((c) => c.outfit ?? c.heroine ?? c.minor))
    const portraits = p.list(a.portraits, `${path}.portraits`, (x, xp) => {
      const portrait = p.object(x, xp, ['speaker', 'asset', 'emote'], ['speaker', 'asset'])
      const speaker = p.speaker(portrait.speaker, `${xp}.speaker`)
      if (!cast.has(speaker)) p.fail(`${xp}.speaker`, 'speaker is missing from the scene cast')
      return { speaker, asset: asset(portrait.asset, `${xp}.asset`),
        ...(portrait.emote === undefined ? {} : { emote: p.slug(portrait.emote, `${xp}.emote`) }) }
    })
    unique(p, `${path}.portraits`, portraits, (portrait) => `${portrait.speaker}:${portrait.emote ?? ''}`)
    return { scene, portraits, ...(a.backdrop === undefined ? {} : { backdrop: asset(a.backdrop, `${path}.backdrop`) }) }
  })
  unique(p, 'art', art, (a) => a.scene)
  const evening = o.evening === undefined ? undefined : (() => {
    const e = p.object(o.evening, 'evening', ['after', 'visits'])
    const after = p.slug(e.after, 'evening.after')
    if (!byQuest.has(after)) p.fail('evening.after', `unknown quest ${after}`)
    const cast = new Set([...story.casting.crewOrder, ...story.casting.leads.map((l) => l.outfit)])
    const visits = p.list(e.visits, 'evening.visits', (v, path) => {
      const visit = p.object(v, path, ['companion', 'scene', 'morning'], ['companion', 'scene'])
      const companion = p.outfit(visit.companion, `${path}.companion`)
      if (!cast.has(companion)) p.fail(`${path}.companion`, `unknown crew member ${companion}`)
      function sceneRef(value: unknown, key: string): string {
        const id = p.slug(value, key)
        if (!scenes.has(id)) p.fail(key, `unknown scene ${id}`)
        if (quests.some((q) => q.scene === id)) p.fail(key, `scene ${id} is already a quest`)
        return id
      }
      return { companion, scene: sceneRef(visit.scene, `${path}.scene`),
        morning: visit.morning === undefined ? null : sceneRef(visit.morning, `${path}.morning`) }
    })
    unique(p, 'evening.visits', visits, (visit) => String(visit.companion))
    return { after, visits }
  })()
  const supply = o.supply === undefined ? undefined : parseSupplyNetwork(p, o.supply, story, byQuest)
  for (const quest of quests) {
    if (quest.port && !supply?.ports.some((port) => port.id === quest.port)) p.fail('quests', `${quest.id} uses unknown port ${quest.port}`)
  }
  const commands = unique(p, 'commands', o.commands === undefined ? [] : p.list(o.commands, 'commands', (v, path) => parseCommandEncounter(p, v, path), 24), (c) => c.id)
  for (const command of commands.values()) {
    const mission = encounters.get(command.id)
    if (!supply || !mission || mission.scenario === 'training' || !quests.some((quest) => quest.encounter === command.id && quest.port)) {
      p.fail('commands', `${command.id} needs a ship mission and a quest at a supply port`)
    }
  }
  const ground = unique(p, 'ground', o.ground === undefined ? [] : p.list(o.ground, 'ground', (v, path): GroundEncounter => {
    const g = p.object(v, path, ['id', 'title', 'alternate', 'expansion', 'boss', 'win'], ['id', 'title', 'win'])
    const id = p.slug(g.id, `${path}.id`)
    const mission = encounters.get(id)
    if (!mission?.scenario || mission.scenario === 'training' || commands.has(id) || !quests.some((q) => q.encounter === id)) {
      p.fail(`${path}.id`, 'expected a ground quest with its own mission scenario')
    }
    const alternate = g.alternate === undefined ? undefined : (() => {
      const a = p.object(g.alternate, `${path}.alternate`, ['flag', 'scenario', 'label'])
      const flag = p.slug(a.flag, `${path}.alternate.flag`)
      if (![...commands.values()].some((c) => c.assault?.disabledFlag === flag)) p.fail(`${path}.alternate.flag`, 'unknown ship outcome')
      return { flag, scenario: p.slug(a.scenario, `${path}.alternate.scenario`), label: p.text(a.label, `${path}.alternate.label`, 80) }
    })()
    const expansion = g.expansion === undefined ? undefined : p.slug(g.expansion, `${path}.expansion`)
    if (expansion && PARTS_BY_ID.get(expansion)?.slot !== 'back') p.fail(`${path}.expansion`, 'expected a back unit')
    const boss = g.boss === undefined ? undefined : (() => {
      const b = p.object(g.boss, `${path}.boss`, ['unit', 'name', 'portrait'])
      return { unit: p.slug(b.unit, `${path}.boss.unit`), name: p.text(b.name, `${path}.boss.name`, 48), portrait: asset(b.portrait, `${path}.boss.portrait`) }
    })()
    const w = p.object(g.win, `${path}.win`, ['flag', 'file', 'reward'], [])
    const flag = w.flag === undefined ? undefined : p.slug(w.flag, `${path}.win.flag`)
    const file = w.file === undefined ? undefined : p.slug(w.file, `${path}.win.file`)
    if (file && !Object.hasOwn(story.files, file)) p.fail(`${path}.win.file`, `unknown file ${file}`)
    const reward = w.reward === undefined ? undefined : (() => {
      const r = p.object(w.reward, `${path}.win.reward`, ['credits', 'alloy', 'data'])
      return { credits: p.int(r.credits, `${path}.win.reward.credits`, 0, 9999), alloy: p.int(r.alloy, `${path}.win.reward.alloy`, 0, 999), data: p.int(r.data, `${path}.win.reward.data`, 0, 999) }
    })()
    return { id, title: p.text(g.title, `${path}.title`, 64), ...(alternate ? { alternate } : {}), ...(expansion ? { expansion } : {}),
      ...(boss ? { boss } : {}), win: { flag, file, reward } }
  }, 24), (g) => g.id)
  for (const port of supply?.ports ?? []) {
    if (port.liberation && ![...ground.values()].some((g) => g.win.flag === port.liberation?.flag)) p.fail('supply.ports', `unknown liberation outcome for ${port.id}`)
  }
  return { opening, draft: o.draft as boolean, quests, assets, art, story, scenes, commands, ground, ...(evening ? { evening } : {}), ...(supply ? { supply } : {}) }
}
