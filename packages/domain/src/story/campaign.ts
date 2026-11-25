import type { HeroineSpriteRole, TalkContact } from '@cyber/battle'
import type { CampaignWardrobe } from '../campaign-wardrobe'
import { parseCampaignWardrobe } from './campaign-wardrobe'
import { parseComposition } from './composition'
import type { CommandCinematics } from '../ship/command-cinema'
import { parseCommandCinematics } from './command-cinematics'
import type { CampaignManagement } from '../campaign-management'
import { parseCampaignManagement } from './campaign-management'
import { checkPack, walkSteps } from './check'
import { P, parsePack } from './parse'
import type { Scene, Speaker, StoryPack } from './types'
import { PORT_STOCK_MAX, SUPPLY_KINDS, type Supplies, type SupplyNetwork } from '../campaign-supply'
import { CAPABILITY_NAME } from '../ship/modules'
import type { CommandEncounter } from '../ship/command'
import { parseCommandEncounter } from '../ship/command-parse'
import { PARTS_BY_ID, RIG_SLOTS, SLOT_KIND, type RigSlot } from '../crew/parts'
import type { Wallet } from '../ship/hull'
import type { CampaignPair } from '../campaign-pair'
import { parseCampaignPairs } from './campaign-pairs'
import { parseCampaignDates, type CampaignDate } from './campaign-dates'
import type { CampaignFinale } from '../campaign-finale'
import type { CampaignWorkshop } from '../campaign-gear'
import { parseCampaignRecruits, type CampaignRecruit } from './campaign-recruits'
import type { CampaignSector } from '../campaign-sectors'
import { parseCampaignSectors } from './campaign-sectors'
import { BASE_PROJECT_SCENES, type PortProject } from '../campaign-projects'
import type { CabinEvening } from '../campaign-cabins'
import { FORMATION_ROLES, type FormationMember, type FormationRole, type GroundCombat } from '../combat-training'
import { parseCabinEvenings } from './campaign-cabins'
import type { GroundRules } from './ground-rules'
import { parseGroundFormation } from './ground-formation'
import { parseCampaignAllies, type CampaignAlly } from './campaign-allies'
import { parseGroundCues, type GroundCues } from './ground-cues'
import { parseGroundSignatures } from './ground-rules'
import { parseCampaignTiers, type CampaignTier } from './campaign-tiers'
import { parseFourActCampaign, type FourActCampaign } from './four-act'

export interface CampaignQuest {
  /** Uma partners whose released, resettled pair may join this named sortie. */
  callUp?: number[]
  id: string
  title: string
  scene: string
  sceneWhen?: { scene: string; flag: string; earlier?: readonly [string, string] }
  after?: string
  requires?: string[]
  /** One completed quest is sufficient for this additional prerequisite. */
  requiresAny?: string[]
  flags?: string[]
  encounter?: string
  port?: string
}

export interface CampaignSceneArt {
  scene: string
  backdrop?: string
  /** Presentation-only cuts at existing script paths, including selected choice branches. */
  backdropCues?: { at: string; asset: string; location?: string }[]
  portraits: { speaker: Speaker; asset: string; emote?: string; profile?: string }[]
  composition?: CampaignComposition
}

export interface CampaignComposition {
  width: number
  height: number
  portraits: 'show' | 'hide'
  layers: { asset: string; x: number; y: number; width: number; height: number; opacity: number; fit: 'contain' | 'cover' }[]
}

export interface CampaignPortraitFace {
  speaker: Speaker
  base: string
  emote: string
  asset: string
  at: { x: number; y: number }
}

export interface CampaignBook {
  fourAct?: FourActCampaign
  combatShift?: string
  wardrobe?: CampaignWardrobe
  commandCinematics?: CommandCinematics
  management?: CampaignManagement
  opening: string
  draft: boolean
  previewEnd?: string
  quests: CampaignQuest[]
  assets: { id: string; file: string }[]
  art: CampaignSceneArt[]
  portraitFaces?: CampaignPortraitFace[]
  story: StoryPack
  scenes: ReadonlyMap<string, Scene>
  recruits?: CampaignRecruit[]
  allies?: CampaignAlly[]
  tiers?: CampaignTier[]
  sectors?: CampaignSector[]
  projects?: PortProject[]
  evening?: { after: string; visits: { companion: number; scene: string; morning: string | null }[] }
  supply?: SupplyNetwork
  commands: ReadonlyMap<string, CommandEncounter>
  commandArt?: ReadonlyMap<string, { backdrop?: string; objective?: string; objectiveLabel?: string }>
  ground: ReadonlyMap<string, GroundEncounter>
  pairs: CampaignPair[]
  dates?: CampaignDate[]
  cabinEvenings?: CabinEvening[]
  workshop?: CampaignWorkshop
  finale?: CampaignFinale
}

export interface GroundEncounter extends GroundRules {
  combat?: GroundCombat
  id: string
  title: string
  alternate?: { flag: string; scenario: string; label: string; closedLabel?: string }
  expansion?: string
  kit?: { weapons: string[]; expansions: string[] }
  boss?: { unit: string; name: string; portrait: string }
  cues?: GroundCues
  win: { flag?: string; file?: string; reward?: Wallet }
}

export interface CampaignReleaseFile {
  path: string
  sha256: string
  bytes: number
}

export type CombatSpriteIdentity = { outfit: number; form?: never; roles?: never }
  | { outfit: string; form: string; roles: HeroineSpriteRole[] }

const heroineSpriteRoles: readonly HeroineSpriteRole[] = ['boss-enemy', 'boss-ally', 'sub-boss']

export interface CombatSpriteLoadout {
  set: string
  rigs: { left: string | null; right: string | null; back?: string | null }[]
  encounters: string[]
  attacks: ('left' | 'right' | 'back')[]
  medic?: true
}

export function parseCombatSpriteLoadouts(p: P, value: unknown, path: string): CombatSpriteLoadout[] {
  const part = (value: unknown, field: string) => value === null ? null : p.slug(value, field)
  const rows = p.list(value, path, (value, field): CombatSpriteLoadout => {
    const row = p.object(value, field, ['set', 'rigs', 'encounters', 'attacks', 'medic'], ['set', 'rigs', 'encounters', 'attacks'])
    const rigs = p.list(row.rigs, field + '.rigs', (value, f) => {
      const rig = p.object(value, f, ['left', 'right', 'back'], ['left', 'right'])
      return { left: part(rig.left, f + '.left'), right: part(rig.right, f + '.right'),
        ...(rig.back === undefined ? {} : { back: part(rig.back, f + '.back') }) }
    }, 40)
    const encounters = p.list(row.encounters, field + '.encounters', (value, f) => p.slug(value, f), 80)
    const attacks = p.list(row.attacks, field + '.attacks', (value, f) =>
      value === 'left' || value === 'right' || value === 'back' ? value : p.fail(f, 'expected a mount'), 3)
    unique(p, field + '.attacks', attacks, mount => mount)
    if (!rigs.length && !encounters.length) p.fail(field, 'expected an actual rig or encounter fitting')
    if (row.medic !== undefined && row.medic !== true) p.fail(field + '.medic', 'expected true')
    return { set: p.slug(row.set, field + '.set'), rigs, encounters, attacks, ...(row.medic === true ? { medic: true } : {}) }
  }, 64)
  if (!rows.length) p.fail(path, 'expected complete loadouts')
  unique(p, path, rows, row => row.set)
  unique(p, path + '.encounters', rows.flatMap(row => row.encounters), fitting => fitting)
  const rigs = rows.flatMap(row => row.rigs.map(rig => ({ ...rig, set: row.set })))
  for (const [index, rig] of rigs.entries()) {
    if (rigs.slice(0, index).some(other => other.set !== rig.set && other.left === rig.left && other.right === rig.right
      && (other.back === undefined || rig.back === undefined || other.back === rig.back))) p.fail(path, 'overlapping rig assignments')
  }
  return rows
}

export type CampaignCombatSprite = CombatSpriteIdentity & {
  manifest: CampaignReleaseFile
  placements: CampaignReleaseFile
  loadouts?: CombatSpriteLoadout[]
  pages: (CampaignReleaseFile & { file: string })[]
}

export function combatSpriteKey(identity: Pick<CombatSpriteIdentity, 'outfit' | 'form'>): string {
  return typeof identity.outfit === 'number' ? String(identity.outfit) : `heroine/${identity.outfit}/${identity.form}`
}

export function parseCombatSpriteIdentity(p: P, row: Record<string, unknown>, path: string): CombatSpriteIdentity {
  if (typeof row.outfit !== 'string') {
    if (row.form !== undefined || row.roles !== undefined) p.fail(path, 'crew sprite has no heroine form or role')
    return { outfit: p.int(row.outfit, path + '.outfit', 1, Number.MAX_SAFE_INTEGER) }
  }
  const roles = p.list(row.roles, path + '.roles', (raw, field) =>
    heroineSpriteRoles.find(role => role === raw) ?? p.fail(field, 'unknown heroine sprite role'), heroineSpriteRoles.length)
  if (!roles.length || new Set(roles).size !== roles.length || (roles.includes('sub-boss') && roles.length > 1)) {
    p.fail(path + '.roles', 'expected distinct boss roles or a sub-boss role')
  }
  return { outfit: p.slug(row.outfit, path + '.outfit'), form: p.slug(row.form, path + '.form'),
    roles: heroineSpriteRoles.filter(role => roles.includes(role)) }
}

/** A transport batch preserves the individual story-document pins used by publishers. */
export interface CampaignStoryPage extends CampaignReleaseFile {
  sources: readonly string[]
}

export interface CampaignRelease {
  schemaVersion: 1
  release: string
  campaign?: 'four-act'
  files: (CampaignReleaseFile & { source: string })[]
  assets: (CampaignReleaseFile & { id: string })[]
  combatSprites?: CampaignCombatSprite[]
  storyPages?: CampaignStoryPage[]
}

export const CAMPAIGN_PREVIEW_INDEX = 'campaign/preview.json'
export const PILOT_PREVIEW_INDEX = 'campaign/pilot.json'
export const FOUR_ACT_PREVIEW_INDEX = 'campaign/four-act.json'
export type CampaignIdentity = 'current' | 'pilot' | 'four-act'
export type CampaignSaveScope = 'legacy' | CampaignIdentity
const previewIndexes: Record<CampaignIdentity, string> = {
  current: CAMPAIGN_PREVIEW_INDEX,
  pilot: PILOT_PREVIEW_INDEX,
  'four-act': FOUR_ACT_PREVIEW_INDEX,
}
export const campaignPreviewIndex = (identity: CampaignIdentity): string => previewIndexes[identity]
export function campaignReleasePath(release: string, identity: CampaignIdentity = 'current'): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(release)) throw new Error('Release must be a lowercase slug')
  return `campaign/releases/${identity === 'current' ? '' : `${identity}/`}${release}.json`
}
export const CAMPAIGN_RELEASE_PATH = /^campaign\/releases\/(?:(?:pilot|four-act)\/)?[a-z0-9][a-z0-9-]{0,63}\.json$/
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
    const port = p.object(value, path, [...fields, 'liberation', 'liberations'], fields)
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
    const benefit = (raw: unknown, field: string) => {
      const x = p.object(raw, field, ['flag', 'alloy'])
      return { flag: p.slug(x.flag, field + '.flag'), alloy: p.int(x.alloy, field + '.alloy', 1, 99) }
    }
    const liberation = port.liberation === undefined ? undefined : benefit(port.liberation, path + '.liberation')
    const liberations = port.liberations === undefined ? undefined : p.list(port.liberations, path + '.liberations', benefit, 12)
    unique(p, path + '.liberations', [...(liberation ? [liberation] : []), ...(liberations ?? [])], row => row.flag)
    return { id, name: p.text(port.name, `${path}.name`, 48), scene, stock: amounts('stock'), produces: amounts('produces'),
      upkeep: amounts('upkeep'), reserve: amounts('reserve'), ...(liberation ? { liberation } : {}), ...(liberations ? { liberations } : {}) }
  }, 24)
  const known = unique(p, 'supply.ports', ports, (port) => port.id)
  if (!known.has(start)) p.fail('supply.start', `unknown port ${start}`)
  const routes = p.list(map.routes, 'supply.routes', (value, path) => {
    const route = p.object(value, path, ['from', 'to', 'fuel', 'needs', 'flag'], ['from', 'to', 'fuel'])
    const from = p.slug(route.from, `${path}.from`)
    const to = p.slug(route.to, `${path}.to`)
    if (from === to || !known.has(from) || !known.has(to)) p.fail(path, 'a route connects two different ports')
    const needs = route.needs === undefined ? undefined : p.slug(route.needs, `${path}.needs`)
    if (needs && !Object.hasOwn(CAPABILITY_NAME, needs)) p.fail(`${path}.needs`, `unknown ship capability ${needs}`)
    const flag = route.flag === undefined ? undefined : p.slug(route.flag, `${path}.flag`)
    return { from, to, fuel: p.int(route.fuel, `${path}.fuel`, 1, 3), ...(needs ? { needs } : {}), ...(flag ? { flag } : {}) }
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
  if (reachable.size !== ports.length) p.fail('supply.routes', 'every landing port must have a path that needs no drive upgrade')
  return { after, start, ports, routes }
}

export function parseCampaignRelease(value: unknown, file = CAMPAIGN_PREVIEW_INDEX): CampaignRelease {
  const p = new P(file)
  const fields = ['schemaVersion', 'release', 'files', 'assets']
  const index = p.object(value, 'release', [...fields, 'combatSprites', 'campaign', 'storyPages'], fields)
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
  }, index.campaign === 'four-act' ? 2048 : 1024)
  const assets = p.list(index.assets, 'assets', (v, path) => {
    const o = p.object(v, path, ['id', 'path', 'sha256', 'bytes'])
    return { id: p.slug(o.id, `${path}.id`), ...entry(o, path, true) }
  }, 4096)
  if (!unique(p, 'files', files, (f) => f.source).has('campaign.json')) p.fail('files', 'campaign.json is missing')
  unique(p, 'assets', assets, (a) => a.id)
  const storyPages = index.storyPages === undefined ? undefined : (() => {
    if (index.campaign !== 'four-act') p.fail('storyPages', 'expected the four-act release')
    const remaining = new Set(files.map(file => file.source))
    remaining.delete('campaign.json')
    const pages = p.list(index.storyPages, 'storyPages', (raw, path): CampaignStoryPage => {
      const o = p.object(raw, path, ['path', 'sha256', 'bytes', 'sources'])
      const sources = p.list(o.sources, path + '.sources', (value, field) => {
        const source = p.text(value, field, 100)
        if (!remaining.delete(source)) p.fail(field, 'expected one unique pinned story document')
        return source
      }, 40)
      if (!sources.length) p.fail(path, 'expected story documents')
      return { ...entry(o, path, false), sources }
    }, 64)
    if (!pages.length || remaining.size) p.fail('storyPages', 'expected complete story coverage')
    return pages
  })()
  const combatSprites = index.combatSprites === undefined ? undefined : p.list(index.combatSprites, 'combatSprites', (value, path) => {
    const row = p.object(value, path, ['outfit', 'manifest', 'placements', 'pages', 'form', 'roles', 'loadouts'], ['outfit', 'manifest', 'placements', 'pages'])
    const reference = (key: 'manifest' | 'placements') => entry(p.object(row[key], path + '.' + key, ['path', 'sha256', 'bytes']), path + '.' + key, false)
    const pages = p.list(row.pages, path + '.pages', (value, field) => {
      const page = p.object(value, field, ['file', 'path', 'sha256', 'bytes'])
      const file = p.text(page.file, field + '.file', 100)
      if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.png$/.test(file)) p.fail(field + '.file', 'expected a sprite page file')
      const ref = entry(page, field, true)
      if (!ref.path.endsWith('.png')) p.fail(field + '.path', 'expected a PNG payload')
      return { file, ...ref }
    }, 96)
    if (!pages.length) p.fail(path + '.pages', 'expected at least one page')
    unique(p, path + '.pages', pages, page => page.file)
    return { ...parseCombatSpriteIdentity(p, row, path),
      manifest: reference('manifest'), placements: reference('placements'), pages,
      ...(row.loadouts === undefined ? {} : { loadouts: parseCombatSpriteLoadouts(p, row.loadouts, path + '.loadouts') }) }
  }, 512)
  if (combatSprites) unique(p, 'combatSprites', combatSprites, combatSpriteKey)
  const campaign = index.campaign
  if (campaign !== undefined && campaign !== 'four-act') return p.fail('release.campaign', 'unknown campaign identity')
  return { schemaVersion: 1, release: p.slug(index.release, 'release'), ...(campaign ? { campaign } : {}),
    files, assets, ...(storyPages ? { storyPages } : {}), ...(combatSprites ? { combatSprites } : {}) }
}

export function documentsInStoryPage(page: CampaignStoryPage, payload: unknown): Record<string, unknown> {
  return new P(page.path).object(payload, 'stories', page.sources)
}

/** Older manifests predate the identity field. The new campaign must carry it in every release. */
export function requireCampaignIdentity(release: CampaignRelease, identity: CampaignIdentity): CampaignRelease {
  if ((release.campaign === 'four-act') !== (identity === 'four-act')) {
    throw new Error(`Release ${release.release} does not belong to the ${identity} campaign`)
  }
  return release
}

export function parseCampaignBook(files: Record<string, unknown>, identity?: CampaignIdentity): CampaignBook {
  const { 'campaign.json': config, ...storyFiles } = files
  const p = new P('campaign.json')
  const fields = ['schemaVersion', 'opening', 'draft', 'quests', 'assets', 'art']
  const o = p.object(config, 'campaign', [...fields, 'evening', 'supply', 'commands', 'commandArt', 'ground', 'pairs', 'finale', 'dates', 'workshop', 'recruits', 'allies', 'tiers', 'sectors', 'projects', 'portraitFaces', 'cabinEvenings', 'management', 'commandCinematics', 'wardrobe', 'previewEnd', 'fourAct', 'combatShift'], fields)
  const combatShift = o.combatShift === undefined ? undefined : p.slug(o.combatShift, 'combatShift')
  p.version(o)
  if ((identity === 'four-act' || o.fourAct !== undefined) && o.tiers !== undefined) p.fail('tiers', 'four-act books cannot use tier progression')
  if (identity === 'four-act' && o.draft === false && o.fourAct === undefined) p.fail('fourAct', 'a production four-act book needs a catalog')
  if (identity && identity !== 'four-act' && o.fourAct !== undefined) p.fail('fourAct', 'expected the four-act release identity')
  if (typeof o.draft !== 'boolean') p.fail('draft', 'expected a boolean')
  const fourActCatalog = o.fourAct !== undefined
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
    const q = p.object(v, path, ['id', 'title', 'scene', 'sceneWhen', 'after', 'encounter', 'port', 'requires', 'requiresAny', 'flags', 'callUp'], ['id', 'title', 'scene'])
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
    const sceneWhen = q.sceneWhen === undefined ? undefined : (() => {
      const field = `${path}.sceneWhen`
      const alt = p.object(q.sceneWhen, field, ['flag', 'earlier', 'scene'], ['flag', 'scene'])
      const next = p.slug(alt.scene, `${field}.scene`)
      const variant = scenes.get(next)
      if (!variant || encounter || [...walkSteps(variant.steps, '')].some(({ step }) => step.kind === 'battle')) {
        p.fail(`${field}.scene`, 'expected a dialogue variant in a dialogue quest')
      }
      const flag = p.slug(alt.flag, field + '.flag')
      if (alt.earlier !== undefined) {
        const prior = p.list(alt.earlier, field + '.earlier', (id, item) => p.slug(id, item), 2)
        if (prior.length !== 2 || prior[0] === prior[1]) p.fail(field, 'expected two distinct prior scene ids')
        if (prior.some(id => !scenes.has(id) || id === scene || id === next)) p.fail(field + '.earlier', 'expected existing upstream scenes')
        return { earlier: [prior[0]!, prior[1]!] as const, flag, scene: next }
      }
      return { flag, scene: next }
    })()
    const alternatives = q.requiresAny === undefined ? undefined : p.list(q.requiresAny, path + '.requiresAny', (id, field) => p.slug(id, field), 25)
    if (alternatives && (!alternatives.length || (identity !== 'four-act' && o.fourAct === undefined))) {
      p.fail(path + '.requiresAny', 'expected one or more alternative prerequisites in a four-act quest')
    }
    return { id: p.slug(q.id, `${path}.id`), title: p.text(q.title, `${path}.title`, 80), scene,
      ...(sceneWhen ? { sceneWhen } : {}),
      ...(q.after === undefined ? {} : { after: p.slug(q.after, `${path}.after`) }), ...(encounter ? { encounter } : {}),
      ...(q.requires === undefined ? {} : { requires: p.list(q.requires, `${path}.requires`, (id, field) => p.slug(id, field), 24) }),
      ...(alternatives ? { requiresAny: alternatives } : {}),
      ...(q.flags === undefined ? {} : { flags: p.list(q.flags, `${path}.flags`, (id, field) => p.slug(id, field), 12) }),
      ...(q.callUp === undefined ? {} : { callUp: p.list(q.callUp, path + '.callUp', (outfit, field) => p.outfit(outfit, field), 50) }),
      ...(q.port === undefined ? {} : { port: p.slug(q.port, `${path}.port`) }) }
  }, fourActCatalog ? 4096 : 1024)
  const byQuest = unique(p, 'quests', quests, (q) => q.id)
  unique(p, 'quest scenes', quests.flatMap(q => q.sceneWhen ? [q.scene, q.sceneWhen.scene] : [q.scene]), scene => scene)
  const opening = p.slug(o.opening, 'opening')
  if (!byQuest.has(opening)) p.fail('opening', `unknown quest ${opening}`)
  const previewEnd = o.previewEnd === undefined ? undefined : p.slug(o.previewEnd, 'previewEnd')
  if (previewEnd && (!o.draft || !byQuest.has(previewEnd))) p.fail('previewEnd', 'expected a quest in a draft campaign')
  const checked = new Set<string>(), visiting = new Set<string>()
  function validateQuest(q: CampaignQuest) {
    if (checked.has(q.id)) return
    const path = `quests.${q.id}`
    if (visiting.has(q.id)) p.fail(path, 'quest prerequisites form a cycle')
    if (q.id === opening ? q.after !== undefined || q.requires?.length || q.requiresAny?.length || q.flags?.length : q.after === undefined) p.fail(path, 'only the opening quest starts without a prerequisite')
    const dependencies = [...(q.after ? [q.after] : []), ...(q.requires ?? []), ...(q.requiresAny ?? [])]
    if (new Set(dependencies).size !== dependencies.length) p.fail(path, 'duplicate quest prerequisite')
    visiting.add(q.id)
    for (const id of dependencies) validateQuest(byQuest.get(id) ?? p.fail(path, `unknown quest ${id}`))
    visiting.delete(q.id)
    checked.add(q.id)
  }
  quests.forEach(validateQuest)
  const assets = p.list(o.assets, 'assets', (v, path) => {
    const a = p.object(v, path, ['id', 'file'])
    const file = p.text(a.file, `${path}.file`, 72)
    if (!ART_FILE.test(file)) p.fail(`${path}.file`, 'expected a PNG or WebP filename under art/')
    return { id: p.slug(a.id, `${path}.id`), file }
  }, 4096)
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
    const a = p.object(v, path, ['scene', 'backdrop', 'portraits', 'composition', 'backdropCues'], ['scene', 'portraits'])
    const scene = p.slug(a.scene, `${path}.scene`)
    const declared = scenes.get(scene)
    if (!declared) return p.fail(`${path}.scene`, `unknown scene ${scene}`)
    const cast = new Set(declared.cast.map((c) => c.outfit ?? c.heroine ?? c.minor))
    const portraits = p.list(a.portraits, `${path}.portraits`, (x, xp) => {
      const portrait = p.object(x, xp, ['speaker', 'asset', 'emote', 'profile'], ['speaker', 'asset'])
      const speaker = p.speaker(portrait.speaker, `${xp}.speaker`)
      if (!cast.has(speaker)) p.fail(`${xp}.speaker`, 'speaker is missing from the scene cast')
      return { speaker, asset: asset(portrait.asset, `${xp}.asset`),
        ...(portrait.emote === undefined ? {} : { emote: p.slug(portrait.emote, `${xp}.emote`) }),
        ...(portrait.profile === undefined ? {} : { profile: asset(portrait.profile, `${xp}.profile`) }) }
    })
    unique(p, `${path}.portraits`, portraits, (portrait) => `${portrait.speaker}:${portrait.emote ?? ''}`)
    const composition = a.composition === undefined ? undefined : parseComposition(p, a.composition, path + '.composition', asset)
    const backdropCues = a.backdropCues === undefined ? undefined : p.list(a.backdropCues, path + '.backdropCues', (value, field) => {
      const cue = p.object(value, field, ['at', 'asset', 'location'], ['at', 'asset'])
      const at = p.text(cue.at, field + '.at', 256)
      if (![...walkSteps(declared.steps, 'steps')].some(step => step.path === at)) p.fail(field + '.at', 'unknown scene step')
      return { at, asset: asset(cue.asset, field + '.asset'), ...(cue.location === undefined ? {} : { location: p.text(cue.location, field + '.location', 80) }) }
    }, 32)
    if (backdropCues) unique(p, path + '.backdropCues', backdropCues, cue => cue.at)
    return { scene, portraits, ...(a.backdrop === undefined ? {} : { backdrop: asset(a.backdrop, `${path}.backdrop`) }), ...(composition ? { composition } : {}),
      ...(backdropCues ? { backdropCues } : {}) }
  }, 4096)
  unique(p, 'art', art, (a) => a.scene)
  const wardrobe = o.wardrobe === undefined ? undefined : parseCampaignWardrobe(o.wardrobe, { assets, scenes, story })
  const portraitFaces = o.portraitFaces === undefined ? undefined : parsePortraitFaces(p, o.portraitFaces, art, asset, wardrobe)
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
  const recruits = o.recruits === undefined ? undefined : parseCampaignRecruits(p, o.recruits, { opening, byQuest, scenes, story, supply })
  const commands = unique(p, 'commands', o.commands === undefined ? [] : p.list(o.commands, 'commands', (v, path) => parseCommandEncounter(p, v, path), fourActCatalog ? 256 : 64), (c) => c.id)
  const commandArt = o.commandArt === undefined ? undefined : unique(p, 'commandArt', p.list(o.commandArt, 'commandArt', (v, path) => {
    const row = p.object(v, path, ['encounter', 'backdrop', 'objective', 'objectiveLabel'], ['encounter'])
    const encounter = p.slug(row.encounter, `${path}.encounter`)
    if (!commands.has(encounter)) p.fail(`${path}.encounter`, 'expected a ship command encounter')
    return { encounter, backdrop: row.backdrop === undefined ? undefined : asset(row.backdrop, `${path}.backdrop`),
      objective: row.objective === undefined ? undefined : asset(row.objective, `${path}.objective`),
      objectiveLabel: row.objectiveLabel === undefined ? undefined : p.text(row.objectiveLabel, `${path}.objectiveLabel`, 32) }
  }), (row) => row.encounter)
  for (const command of commands.values()) {
    const mission = encounters.get(command.id)
    if (!supply || !mission || mission.scenario === 'training' || !quests.some((quest) => quest.encounter === command.id && quest.port)) {
      p.fail('commands', `${command.id} needs a ship mission and a quest at a supply port`)
    }
  }
  const ground = unique(p, 'ground', o.ground === undefined ? [] : p.list(o.ground, 'ground', (v, path): GroundEncounter => {
    const g = p.object(v, path, ['id', 'title', 'alternate', 'expansion', 'kit', 'boss', 'win', 'rescue', 'talk', 'formation', 'cues', 'signatures', 'combat'], ['id', 'title', 'win'])
    const id = p.slug(g.id, `${path}.id`)
    const mission = encounters.get(id)
    if (!mission?.scenario || mission.scenario === 'training' || commands.has(id) || !quests.some((q) => q.encounter === id)) {
      p.fail(`${path}.id`, 'expected a ground quest with its own mission scenario')
    }
    const alternate = g.alternate === undefined ? undefined : (() => {
      const a = p.object(g.alternate, `${path}.alternate`, ['flag', 'scenario', 'label', 'closedLabel'], ['flag', 'scenario', 'label'])
      const flag = p.slug(a.flag, `${path}.alternate.flag`)
      if (![...commands.values()].some((c) => c.assault?.disabledFlag === flag)) p.fail(`${path}.alternate.flag`, 'unknown ship outcome')
      return { flag, scenario: p.slug(a.scenario, `${path}.alternate.scenario`), label: p.text(a.label, `${path}.alternate.label`, 80),
        ...(a.closedLabel === undefined ? {} : { closedLabel: p.text(a.closedLabel, `${path}.alternate.closedLabel`, 80) }) }
    })()
    const expansion = g.expansion === undefined ? undefined : p.slug(g.expansion, `${path}.expansion`)
    if (expansion && PARTS_BY_ID.get(expansion)?.slot !== 'back') p.fail(`${path}.expansion`, 'expected a back unit')
    const kit = g.kit === undefined ? undefined : (() => {
      const k = p.object(g.kit, `${path}.kit`, ['weapons', 'expansions'])
      function loadout(key: 'weapons' | 'expansions'): string[] {
        const field = `${path}.kit.${key}`
        const values = p.list(k[key], field, (raw, where) => {
          const id = p.slug(raw, where)
          const part = PARTS_BY_ID.get(id)
          const fits = key === 'weapons' ? part?.slot === 'hand' && part.item.kind === 'weapon' : part?.slot === 'back'
          return fits ? id : p.fail(where, 'unknown or incompatible part')
        }, 4)
        if (!values.length) p.fail(field, 'expected at least one part')
        unique(p, field, values, (id) => id)
        return values
      }
      const weapons = loadout('weapons'), expansions = loadout('expansions')
      if (expansion && (expansions.length !== 1 || expansions[0] !== expansion)) p.fail(`${path}.kit.expansions`, 'must include only the required expansion')
      return { weapons, expansions }
    })()
    const boss = g.boss === undefined ? undefined : (() => {
      const b = p.object(g.boss, `${path}.boss`, ['unit', 'name', 'portrait'])
      return { unit: p.slug(b.unit, `${path}.boss.unit`), name: p.text(b.name, `${path}.boss.name`, 48), portrait: asset(b.portrait, `${path}.boss.portrait`) }
    })()
    const rescue = g.rescue === undefined ? undefined : (() => {
      const field = `${path}.rescue`
      const r = p.object(g.rescue, field, ['unit', 'heroine', 'label', 'jackOutFlag', 'alternateSpawn', 'spriteForm'], ['unit', 'heroine', 'label'])
      const unit = p.slug(r.unit, `${field}.unit`), heroine = p.slug(r.heroine, `${field}.heroine`)
      if (mission?.objective.kind !== 'free-leader' || !mission.enemies.some((e) => e.slot === 'boss' && e.pool.includes(heroine))) {
        p.fail(field, 'expected the authored boss of a free-leader mission')
      }
      if (boss && boss.unit !== unit) p.fail(`${field}.unit`, 'must match the named boss slot')
      const entry = r.alternateSpawn === undefined ? undefined : {
        flag: alternate?.flag ?? p.fail(field, 'an alternate spawn needs an approach flag'),
        spawn: p.int(r.alternateSpawn, `${field}.alternateSpawn`, 1, 13),
      }
      return { unit, heroine, label: p.text(r.label, `${field}.label`, 48),
        ...(r.spriteForm === undefined ? {} : { spriteForm: p.slug(r.spriteForm, `${field}.spriteForm`) }),
        ...(entry ? { entry } : {}),
        ...(r.jackOutFlag === undefined ? {} : { jackOutFlag: p.slug(r.jackOutFlag, `${field}.jackOutFlag`) }) }
    })()
    const talk = g.talk === undefined ? undefined : p.list<TalkContact>(g.talk, `${path}.talk`, (raw, field) => {
      const contact = p.object(raw, field, ['actor', 'target', 'requires', 'hint', 'outcome', 'brokenOutcome'], ['actor', 'target', 'requires', 'hint', 'outcome'])
      if (contact.requires !== 'active' && contact.requires !== 'actorHit') return p.fail(`${field}.requires`, 'expected active or actorHit')
      return { actor: p.slug(contact.actor, `${field}.actor`), target: p.slug(contact.target, `${field}.target`),
        requires: contact.requires, hint: p.text(contact.hint, `${field}.hint`, 160), outcome: p.slug(contact.outcome, `${field}.outcome`),
        ...(contact.brokenOutcome === undefined ? {} : { brokenOutcome: p.slug(contact.brokenOutcome, `${field}.brokenOutcome`) }) }
    }, 8)
    const formation = g.formation === undefined ? undefined : parseGroundFormation(p, g.formation, `${path}.formation`, story.casting,
      mission?.fixedSquad?.[0] ?? chapters.find((chapter) => chapter.missions.some((m) => m.id === id))?.leads[0])
    if (formation && o.fourAct !== undefined && !formation.advisory) p.fail(`${path}.formation`, 'four-act Boss Allies advise during planetary battles')
    if (formation && !quests.some((q) => q.encounter === id && q.flags?.includes(formation.ally.released))) {
      p.fail(`${path}.formation.ally.released`, 'the quest must require this ally release')
    }
    const combat = g.combat === undefined ? undefined : parseGroundCombat(p, g.combat, `${path}.combat`, story, combatShift)
    if (combat?.kind === 'combined' && (kit || expansion)) p.fail(`${path}.combat`, 'combined formation issues its own rigs')
    const w = p.object(g.win, `${path}.win`, ['flag', 'file', 'reward'], [])
    const flag = w.flag === undefined ? undefined : p.slug(w.flag, `${path}.win.flag`)
    if (rescue && !flag) p.fail(`${path}.win.flag`, 'a rescue needs a capture flag')
    const file = w.file === undefined ? undefined : p.slug(w.file, `${path}.win.file`)
    if (file && !Object.hasOwn(story.files, file)) p.fail(`${path}.win.file`, `unknown file ${file}`)
    const reward = w.reward === undefined ? undefined : (() => {
      const r = p.object(w.reward, `${path}.win.reward`, ['credits', 'alloy', 'data'])
      return { credits: p.int(r.credits, `${path}.win.reward.credits`, 0, 9999), alloy: p.int(r.alloy, `${path}.win.reward.alloy`, 0, 999), data: p.int(r.data, `${path}.win.reward.data`, 0, 999) }
    })()
    const cues = g.cues === undefined ? undefined : parseGroundCues(p, g.cues, `${path}.cues`, scenes, talk ?? [])
    const signatures = g.signatures === undefined ? undefined : parseGroundSignatures(p, g.signatures, `${path}.signatures`)
    return { id, title: p.text(g.title, `${path}.title`, 64), ...(alternate ? { alternate } : {}), ...(expansion ? { expansion } : {}),
      ...(combat ? { combat } : {}), ...(boss ? { boss } : {}), ...(kit ? { kit } : {}), ...(rescue ? { rescue } : {}), ...(talk ? { talk } : {}),
      ...(formation ? { formation } : {}), ...(cues ? { cues } : {}), ...(signatures ? { signatures } : {}), win: { flag, file, reward } }
  }, fourActCatalog ? 512 : 64), (g) => g.id)
  const liberationFlags = new Set([...ground.values()].map(encounter => encounter.win.flag))
  if (o.fourAct !== undefined) {
    for (const quest of quests) {
      if (!quest.encounter) for (const step of scenes.get(quest.scene)!.steps) {
        if (step.kind === 'flag' && step.set) liberationFlags.add(step.flag)
      }
    }
  }
  for (const port of supply?.ports ?? []) {
    const benefits = [...(port.liberation ? [port.liberation] : []), ...(port.liberations ?? [])]
    if (benefits.some(({ flag }) => !liberationFlags.has(flag))) p.fail('supply.ports', `unknown liberation outcome for ${port.id}`)
  }
  const reserved = new Set([...quests.flatMap(q => q.sceneWhen ? [q.scene, q.sceneWhen.scene] : [q.scene]), ...(supply?.ports.map((port) => port.scene) ?? []),
    ...(evening?.visits.flatMap((visit) => visit.morning ? [visit.scene, visit.morning] : [visit.scene]) ?? [])])
  const captureFlags = new Set([...ground.values()].flatMap((g) => g.win.flag ? [g.win.flag] : []))
  const pairs = parseCampaignPairs(o.pairs, story, scenes, { quests: byQuest, reserved, captureFlags, supply, commands })
  if (pairs.length && !evening) p.fail('pairs', 'recovery visits need an evening schedule')
  for (const pair of pairs) {
    const rooms = Object.values(pair.rooms).flatMap(({ move, visit, morning }) => [move, visit, morning])
    const home = pair.home ? [pair.home.scene, pair.home.stayScene, pair.home.resettle.debrief, pair.home.stay.debrief, pair.home.visit] : []
    const shared = pair.sharedEvenings ? Object.values(pair.sharedEvenings).flatMap((route) => route.flatMap(({ visit, morning }) => [visit, morning])) : []
    for (const id of [...pair.recovery, pair.release, pair.bond.scene, pair.residency.scene, ...rooms, ...shared, ...home]) if (id) reserved.add(id)
  }
  const allies = o.allies === undefined ? undefined : parseCampaignAllies(p, o.allies, story, scenes, byQuest, o.fourAct !== undefined)
  for (const q of quests) if (q.callUp) {
    const path = `quests.${q.id}.callUp`
    if (!q.encounter || !q.callUp.length || q.callUp.some(outfit => !allies?.some(ally => ally.partner === outfit))) {
      p.fail(path, 'expected an encounter and registered resettled pairs')
    }
    unique(p, path, q.callUp, String)
  }
  const dates = o.dates === undefined ? undefined : parseCampaignDates(o.dates, story, scenes, new Set(byQuest.keys()), reserved,
    new Set(evening?.visits.map(({ companion }) => companion)), new Set(supply?.ports.map(port => port.id)), allies)
  if (dates?.length && !evening) p.fail('dates', 'relationships need an evening schedule')
  const workshop = o.workshop === undefined ? undefined : (() => {
    const w = p.object(o.workshop, 'workshop', ['after', 'missions', 'recipes'])
    const after = p.slug(w.after, 'workshop.after'), quest = byQuest.get(after)
    const port = quest?.port ?? (after === opening ? supply?.start : undefined)
    if (!port || quest?.encounter) return p.fail('workshop.after', 'expected a local workshop conversation')
    const missions = p.list(w.missions, 'workshop.missions', (value, path) => {
      const id = p.slug(value, path)
      if (!ground.has(id)) p.fail(path, 'expected a ground encounter')
      return id
    }, 24)
    const recipes = p.list(w.recipes, 'workshop.recipes', (value, path) => {
      const r = p.object(value, path, ['part', 'slot', 'alloy', 'icon'])
      const part = p.slug(r.part, `${path}.part`)
      const slot = r.slot as RigSlot
      const definition = PARTS_BY_ID.get(part)
      if (!RIG_SLOTS.includes(slot) || !definition || SLOT_KIND[slot] !== definition.slot) p.fail(path, 'part does not fit the named rig slot')
      return { part, slot, alloy: p.int(r.alloy, `${path}.alloy`, 1, 99), icon: asset(r.icon, `${path}.icon`) }
    }, 32)
    if (!missions.length || !recipes.length) p.fail('workshop', 'expected missions and recipes')
    unique(p, 'workshop.missions', missions, (id) => id)
    unique(p, 'workshop.recipes', recipes, (entry) => entry.part)
    return { after, port, missions, recipes }
  })()
  const sectorReserved = new Set([...reserved, ...(dates?.flatMap((date) => [...date.milestones, date.regular]
    .flatMap(({ scene, morning }) => morning ? [scene, morning] : [scene])) ?? [])])
  const sectors = o.sectors === undefined ? undefined : parseCampaignSectors(o.sectors, byQuest, recruits ?? [], supply, story, scenes, sectorReserved)
  if (sectors?.some((sector) => sector.shared && pairs.some((pair) => pair.id === `sector-${sector.id}`))) p.fail('sectors', 'duplicate saved night id')
  const fourAct = o.fourAct === undefined ? undefined : parseFourActCampaign(p, o.fourAct,
    { opening, draft: o.draft === true, quests, scenes, story, recruits, ground, commands, supply, allies })
  const projects = o.projects === undefined ? undefined : p.list(o.projects, 'projects', (value, path) => {
    const terms = ['id', 'title', 'alloy', 'days', 'production', 'upkeep']
    const row = p.object(value, path, [...terms, 'sector', 'base'], terms)
    let location: Pick<PortProject, 'sector' | 'base'>
    if (row.base !== undefined && row.sector === undefined && fourActCatalog) {
      const rule = p.object(row.base, path + '.base', ['quest', 'port', 'scenes'])
      const quest = p.slug(rule.quest, path + '.base.quest'), port = p.slug(rule.port, path + '.base.port')
      const prerequisite = byQuest.get(quest)
      if (!prerequisite || prerequisite.encounter || (prerequisite.port && prerequisite.port !== port)
        || !supply?.ports.some(row => row.id === port) || ![...fourAct?.duos.values() ?? []].some(duo => duo.local?.base === quest)) {
        p.fail(path + '.base', 'expected a local base quest and supply port')
      }
      const notes = p.object(rule.scenes, path + '.base.scenes', BASE_PROJECT_SCENES)
      const reports = Object.fromEntries(BASE_PROJECT_SCENES.map(key => {
        const field = path + '.base.scenes.' + key, id = p.slug(notes[key], field)
        const scene = scenes.get(id)
        if (!scene || [...walkSteps(scene.steps, '')].some(({ step }) =>
          !['line', 'thought', 'narrate', 'emote', 'wait', 'choice', 'captain', 'slot', 'illustration'].includes(step.kind)
            || step.kind === 'captain' && step.options.some(option => option.rapport))) {
          p.fail(field, 'project reports are dialogue without gameplay effects')
        }
        return [key, id]
      })) as NonNullable<PortProject['base']>['scenes']
      location = { base: { quest, port, scenes: reports } }
    } else {
      if (row.base !== undefined) p.fail(path + '.base', 'expected a four-act base without a legacy sector')
      const sector = p.slug(row.sector, path + '.sector')
      if (!sectors?.some(({ id }) => id === sector)) p.fail(path + '.sector', 'expected a sector command')
      location = { sector }
    }
    const projectSupplies = (key: 'production' | 'upkeep'): Supplies => {
      const values = p.object(row[key], `${path}.${key}`, SUPPLY_KINDS)
      return { fuel: p.int(values.fuel, `${path}.${key}.fuel`, 0, 10), provisions: p.int(values.provisions, `${path}.${key}.provisions`, 0, 10),
        alloy: p.int(values.alloy, `${path}.${key}.alloy`, 0, 10) }
    }
    return { id: p.slug(row.id, `${path}.id`), title: p.text(row.title, `${path}.title`, 56), ...location,
      alloy: p.int(row.alloy, `${path}.alloy`, 1, 99), days: p.int(row.days, `${path}.days`, 1, 30), production: projectSupplies('production'), upkeep: projectSupplies('upkeep') }
  }, 48) as PortProject[]
  if (projects) unique(p, 'projects', projects, ({ id }) => id)
  const finale = o.finale === undefined ? undefined : parseFinale(p, o.finale, byQuest, pairs, sectors ?? [], story, commands, ground)
  const cabinEvenings = o.cabinEvenings === undefined ? undefined : parseCabinEvenings(o.cabinEvenings, { dates, pairs, sectors, scenes, allies },
    new Set([...sectorReserved, ...(sectors?.flatMap(s => s.shared ? [s.shared.visit, s.shared.morning] : []) ?? [])]))
  const commandCinematics = o.commandCinematics === undefined ? undefined : parseCommandCinematics(o.commandCinematics, { assets, commands, scenes, story })
  const management = o.management === undefined ? undefined : parseCampaignManagement(o.management, { quests, projects, scenes, assets, workshop })
  const tiers = o.tiers === undefined ? undefined : parseCampaignTiers(p, o.tiers, byQuest, recruits ?? [], ground, o.draft === true)
  return { opening, draft: o.draft as boolean, ...(fourAct ? { fourAct } : {}), ...(previewEnd ? { previewEnd } : {}), quests, assets, art, story, scenes, commands, ground, pairs,
    ...(combatShift ? { combatShift } : {}),
    ...(wardrobe ? { wardrobe } : {}),
    ...(tiers ? { tiers } : {}),
    ...(management ? { management } : {}),
    ...(commandCinematics ? { commandCinematics } : {}),
    ...(commandArt ? { commandArt } : {}),
    ...(portraitFaces ? { portraitFaces } : {}),
    ...(cabinEvenings ? { cabinEvenings } : {}),
    ...(evening ? { evening } : {}), ...(supply ? { supply } : {}), ...(finale ? { finale } : {}), ...(dates ? { dates } : {}),
    ...(workshop ? { workshop } : {}), ...(recruits ? { recruits } : {}), ...(allies ? { allies } : {}), ...(sectors ? { sectors } : {}), ...(projects ? { projects } : {}) }
}

export function parseGroundCombat(p: P, value: unknown, path: string, story: StoryPack, shift?: string): GroundCombat {
  const combat = p.object(value, path, ['kind', 'members', 'windups'], ['kind'])
  if (combat.kind === 'uma' && combat.members === undefined && combat.windups === undefined) return { kind: 'uma' }
  if (combat.kind !== 'combined' || !shift) return p.fail(path, 'expected a combined formation with a campaign combatShift flag')
  const knownOutfits = new Set([...story.casting.crewOrder, ...story.casting.leads.map((lead) => lead.outfit)])
  const members = p.list(combat.members, `${path}.members`, (raw, here): FormationMember => {
    const row = p.object(raw, here, ['role', 'outfit', 'heroine', 'requires'], ['role'])
    const role = row.role as FormationRole
    if (!FORMATION_ROLES.includes(role)) return p.fail(`${here}.role`, 'unknown formation role')
    if (row.outfit !== undefined && row.heroine === undefined && role !== 'wing') {
      const outfit = p.int(row.outfit, `${here}.outfit`, 1, Number.MAX_SAFE_INTEGER)
      if (!knownOutfits.has(outfit)) return p.fail(`${here}.outfit`, 'unknown crew outfit')
      const requires = row.requires === undefined ? undefined : p.slug(row.requires, `${here}.requires`)
      return { role, outfit, ...(requires ? { requires } : {}) }
    }
    if (row.heroine !== undefined && row.outfit === undefined && role !== 'laser') {
      const heroine = p.slug(row.heroine, `${here}.heroine`)
      if (!story.casting.heroines.some(({ board }) => board === heroine)) return p.fail(`${here}.heroine`, 'unknown heroine')
      return { role, heroine, requires: p.slug(row.requires, `${here}.requires`) }
    }
    return p.fail(here, 'expected a single cast identity compatible with the role')
  }, 10)
  unique(p, path + '.members', members, ({ outfit, heroine }) => outfit === undefined ? `heroine:${heroine}` : `uma:${outfit}`)
  if (FORMATION_ROLES.some((role) => members.filter((member) => member.role === role).length !== 2)) {
    return p.fail(path + '.members', 'expected two members per role')
  }
  const windups = combat.windups === undefined ? [] : p.list(combat.windups, `${path}.windups`, (id, here) => p.slug(id, here), 8)
  unique(p, path + '.windups', windups, (id) => id)
  return { kind: 'combined', members, windups }
}

function parsePortraitFaces(p: P, value: unknown, art: CampaignSceneArt[], asset: (id: unknown, path: string) => string, wardrobe?: CampaignWardrobe): CampaignPortraitFace[] {
  const baseKey = (speaker: Speaker, base: string) => `${speaker}:${base}`
  const bases = new Set(art.flatMap(({ portraits }) =>
    portraits.filter(({ emote }) => emote === undefined).map(({ speaker, asset }) => baseKey(speaker, asset))))
  for (const member of wardrobe?.members ?? []) for (const look of Object.values(member.looks)) {
    bases.add(baseKey(member.speaker, look.asset))
    if (look.dialogue) bases.add(baseKey(member.speaker, look.dialogue))
    if (look.portrait) bases.add(baseKey(member.speaker, look.portrait))
  }
  const faces = p.list(value, 'portraitFaces', (v, path) => {
    const entry = p.object(v, path, ['speaker', 'base', 'emote', 'asset', 'at'])
    const speaker = p.speaker(entry.speaker, `${path}.speaker`)
    const base = asset(entry.base, `${path}.base`)
    if (!bases.has(baseKey(speaker, base))) p.fail(`${path}.base`, 'expected a default scene portrait for this speaker')
    const emote = p.slug(entry.emote, `${path}.emote`)
    if (emote === 'neutral') p.fail(`${path}.emote`, 'neutral uses the base portrait')
    const crop = asset(entry.asset, `${path}.asset`)
    if (crop === base) p.fail(`${path}.asset`, 'expected a separate face crop asset')
    const at = p.object(entry.at, `${path}.at`, ['x', 'y'])
    return { speaker, base, emote, asset: crop, at: {
      x: p.int(at.x, `${path}.at.x`, 0, Number.MAX_SAFE_INTEGER),
      y: p.int(at.y, `${path}.at.y`, 0, Number.MAX_SAFE_INTEGER),
    } }
  }, 8192)
  unique(p, 'portraitFaces', faces, ({ speaker, base, emote }) => `${baseKey(speaker, base)}:${emote}`)
  return faces
}

function parseFinale(p: P, value: unknown, quests: ReadonlyMap<string, CampaignQuest>, pairs: readonly CampaignPair[],
  sectors: readonly CampaignSector[], story: StoryPack, commands: ReadonlyMap<string, CommandEncounter>, ground: ReadonlyMap<string, GroundEncounter>): CampaignFinale {
  const fields = ['cases', 'reveal', 'approach', 'breach', 'ending', 'preparation']
  const f = p.object(value, 'finale', [...fields, 'muster', 'lastWatch'], fields)
  const cases = p.list(f.cases, 'finale.cases', (value, path) => {
    const c = p.object(value, path, ['port', 'title', 'file', 'pair', 'fileQuest'], ['port', 'title', 'file'])
    const port = p.slug(c.port, `${path}.port`), file = p.slug(c.file, `${path}.file`)
    const pair = c.pair === undefined ? undefined : p.slug(c.pair, `${path}.pair`)
    const matches = pairs.filter((candidate) => candidate.home?.port === port && (pair === undefined || candidate.id === pair))
    const fileQuest = c.fileQuest === undefined ? undefined : p.slug(c.fileQuest, `${path}.fileQuest`)
    const debrief = fileQuest ? quests.get(fileQuest) : undefined
    if (fileQuest ? pair !== undefined || debrief?.port !== port || debrief.encounter : matches.length !== 1) {
      p.fail(path, 'name a local case debrief or the pair whose home defense files this case')
    }
    if (!story.files[file]?.lines.length) p.fail(`${path}.file`, 'expected a nonempty evidence file')
    return { port, file, title: p.text(c.title, `${path}.title`, 64), ...(pair === undefined ? {} : { pair }), ...(fileQuest ? { fileQuest } : {}) }
  }, 12)
  if (cases.length < 2) p.fail('finale.cases', 'expected multiple local cases')
  unique(p, 'finale.cases', cases, (entry) => entry.port)
  unique(p, 'finale.cases', cases, (entry) => entry.file)
  function quest(key: string) {
    const id = p.slug(f[key], `finale.${key}`)
    return quests.get(id) ?? p.fail(`finale.${key}`, `unknown quest ${id}`)
  }
  const reveal = quest('reveal'), approach = quest('approach'), breach = quest('breach'), ending = quest('ending')
  const muster = f.muster === undefined ? undefined : quest('muster')
  const lastWatch = f.lastWatch === undefined ? undefined : quest('lastWatch')
  if (muster && (!sectors.length || muster.port !== reveal.port || muster.encounter)) p.fail('finale.muster', 'expected a local fleet briefing with sector commands')
  if (lastWatch && (!muster || lastWatch.after !== ending.id || lastWatch.encounter || sectors.some((sector) => !sector.retirement
    || quests.get(sector.retirement)?.after !== ending.id || !lastWatch.requires?.includes(sector.retirement)))) {
    p.fail('finale.lastWatch', 'expected a dialogue after the fleet ending and every sector handover')
  }
  if (!reveal.port || reveal.encounter || approach.after !== (muster ?? reveal).id || breach.after !== approach.id || ending.after !== breach.id
    || [approach, breach, ending].some((q) => q.port !== reveal.port) || ending.encounter) {
    p.fail('finale', 'expected one local chain from briefing through approach, breach and ending')
  }
  const command = approach.encounter && commands.get(approach.encounter)
  if (!command || !command.assault || !breach.encounter || !ground.has(breach.encounter)) {
    return p.fail('finale', 'expected a ship assault and a ground breach')
  }
  const prep = p.object(f.preparation, 'finale.preparation', ['alloy', 'integrity'])
  const preparation = { alloy: p.int(prep.alloy, 'finale.preparation.alloy', 1, 99),
    integrity: p.int(prep.integrity, 'finale.preparation.integrity', 1, Math.min(10, 96 - command.transport)) }
  return { cases, reveal: reveal.id, approach: approach.id, breach: breach.id, ending: ending.id, preparation,
    ...(muster ? { muster: muster.id } : {}), ...(lastWatch ? { lastWatch: lastWatch.id } : {}) }
}
