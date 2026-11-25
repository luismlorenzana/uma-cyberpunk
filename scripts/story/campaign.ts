import { documentsInStoryPage } from '../../packages/domain/src/story/campaign'
import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { loadScenarios } from '../../packages/battle/src/scenarios'
import { scenarioInput } from '../../packages/battle/src/scenario'
import { startBattle } from '../../packages/battle/src/battle'
import {
  applyGroundRules, CAMPAIGN_RELEASE_PATH, campaignPreviewIndex, campaignReleasePath, parseCampaignBook, parseCampaignRelease, requireCampaignIdentity,
  type CampaignBook, type CampaignIdentity, type CampaignQuest, type CampaignRelease, type CampaignReleaseFile,
} from '../../packages/domain/src/story/index'
import { readStoryFiles } from './files'
import { derivePortraitCrops } from './portrait-crops'

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

function readJson(file: string): unknown {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (error) { throw new Error(`${file}: ${String(error)}`) }
}

function readReleasePayload(out: string, ref: CampaignReleaseFile): Buffer {
  const bytes = readFileSync(join(out, ref.path))
  if (bytes.length !== ref.bytes || sha(bytes) !== ref.sha256) throw new Error(`${ref.path}: failed integrity check`)
  return bytes
}

function writeAtomic(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, bytes, { flag: 'wx' })
    renameSync(temporary, path)
  } finally {
    rmSync(temporary, { force: true })
  }
}

function writeRelease(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  let fd: number
  try { fd = openSync(path, 'wx') } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if (!readFileSync(path).equals(bytes)) throw new Error(`${path}: a different release already exists`)
    return
  }
  try {
    try { writeFileSync(fd, bytes) } finally { closeSync(fd) }
  } catch (error) {
    rmSync(path, { force: true })
    throw error
  }
}

function packed(bytes: Buffer, extension: string): CampaignReleaseFile {
  const sha256 = sha(bytes)
  return { path: `campaign/files/pack.${sha256}${extension}`, sha256, bytes: bytes.length }
}

function verifiedArt(path: string): Buffer {
  const bytes = readFileSync(path)
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (extname(path) === '.png' ? !isPng : !isWebp) throw new Error(`${path}: image header does not match its extension`)
  return bytes
}

function validatePins(pins: unknown, sources: Record<string, Buffer>) {
  if (!pins || typeof pins !== 'object' || Array.isArray(pins)) throw new Error('Campaign source pins must be a path-to-SHA256 object')
  const expected = new Map(Object.entries(pins))
  for (const [path, bytes] of Object.entries(sources)) {
    if (expected.get(path) !== sha(bytes)) throw new Error(`${path}: missing or mismatched source pin`)
    expected.delete(path)
  }
  if (expected.size) throw new Error(`Unused source pins: ${[...expected.keys()].join(', ')}`)
}

function validateRoute(book: CampaignBook) {
  const quests = new Map(book.quests.map(quest => [quest.id, quest]))
  const byMission = new Map(book.quests.flatMap(quest => quest.encounter ? [[quest.encounter, quest]] as const : []))
  const byScene = new Map(book.quests.flatMap(quest => (quest.sceneWhen ? [quest.scene, quest.sceneWhen.scene] : [quest.scene])
    .map(scene => [scene, quest] as const)))
  const prerequisites = new Map<string, Set<string>>()
  const ancestors = (quest: CampaignQuest): Set<string> => {
    const known = prerequisites.get(quest.id)
    if (known) return known
    const upstream = [quest.after, ...(quest.requires ?? [])].flatMap(id => id ? [id, ...ancestors(quests.get(id)!)] : [])
    const all = new Set(upstream)
    const alternatives = quest.requiresAny?.map(id => new Set([id, ...ancestors(quests.get(id)!)])) ?? []
    for (const id of alternatives[0] ?? []) if (alternatives.every(branch => branch.has(id))) all.add(id)
    prerequisites.set(quest.id, all)
    return all
  }
  const chapters = Object.values(book.story.chapters)
  const routes = new Map(chapters.map(chapter => [chapter.id, [...new Set(chapter.scenes.flatMap(scene => {
    const quest = byScene.get(scene.id)
    return quest ? [quest.id] : []
  }))]]))
  for (const chapter of chapters) for (const scene of chapter.scenes) {
    const quest = byScene.get(scene.id)
    if (!quest) continue
    const upstream = ancestors(quest)
    const dependencies = [...chapter.needs, ...('after' in scene.trigger ? [`mission:${scene.trigger.after}`] : [])]
    for (const need of dependencies) {
      const [kind, id] = need.split(':')
      const required = kind === 'chapter' ? routes.get(id!) : kind === 'mission' && byMission.has(id!) ? [byMission.get(id!)!.id] : []
      if (!required?.length || required.some(key => !upstream.has(key))) {
        throw new Error(`campaign.json: ${quest.id}: no executable route for ${need}`)
      }
    }
    if (!quest.encounter) continue
    const mission = chapter.missions.find(row => row.id === quest.encounter)
    if (!mission || (book.commands.has(mission.id) ? mission.objective.kind !== 'escort'
      : !book.ground.has(mission.id) && mission.scenario !== 'training')) {
      throw new Error(`campaign.json: ${quest.id}: mission has no compatible command, ground or Training binding`)
    }
  }
}

function validateGround(book: CampaignBook): void {
  if (book.ground.size) {
    const { maps, scenarios } = loadScenarios(resolve(import.meta.dirname, '../..'), true)
    const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
    for (const chapter of Object.values(book.story.chapters)) for (const mission of chapter.missions) {
      const ground = book.ground.get(mission.id)
      if (!ground) continue
      for (const id of [mission.scenario, ground.alternate?.scenario]) {
        if (!id) continue
        const scenario = byId.get(id)
        if (!scenario) throw new Error(`campaign.json: ${mission.id}: unknown scenario ${id}`)
        const input = applyGroundRules(scenarioInput(scenario, maps[scenario.map]!, 0), ground)
        if (input.objective.kind.toLowerCase() !== mission.objective.kind.replaceAll('-', '')) {
          throw new Error(`campaign.json: ${mission.id}: ${id} uses a different objective`)
        }
        if (ground.formation && !input.units.some((unit) => unit.side === 'enemy' && unit.leader && unit.ref?.kind === 'heroine'
          && mission.enemies.some((entry) => entry.slot === 'boss' && entry.pool.includes(unit.ref!.id)))) {
          throw new Error(`campaign.json: ${mission.id}: ${id} is missing its authored boss in the formation`)
        }
        if (ground.rescue || ground.talk?.length || ground.formation) startBattle(input)
        if (ground.boss && !scenario.input.units.some((u) => u.id === ground.boss?.unit && u.side === 'enemy' && u.leader)) {
          throw new Error(`campaign.json: ${mission.id}: ${id} is missing the named enemy leader`)
        }
        if (mission.objective.kind === 'hack' && ground.expansion !== 'back-deck') {
          throw new Error(`campaign.json: ${mission.id}: a terminal objective needs the Data Deck`)
        }
      }
    }
  }
}

async function source(dir: string, pins?: unknown, identity: CampaignIdentity = 'current') {
  const story = readStoryFiles(dir)
  if (!story) throw new Error(`${dir}: no story source`)
  if (story.problems.length) throw new Error(story.problems.map((p) => `${p.file}: ${p.message}`).join('\n'))
  const config = readFileSync(join(dir, 'campaign.json'))
  const files = { ...story.files, 'campaign.json': JSON.parse(config.toString('utf8')) as unknown }
  const book = parseCampaignBook(files, identity)
  if (identity !== 'current') validateRoute(book)
  validateGround(book)
  const assets = book.assets.map(({ id, file }) => {
    const bytes = verifiedArt(join(dir, 'art', file))
    return { id, file, bytes, extension: extname(file) }
  })
  const cropPlan = join(dir, 'portrait-crops.json')
  const crops = existsSync(cropPlan) ? readFileSync(cropPlan) : null
  if (pins !== undefined) validatePins(pins, { ...story.raw, 'campaign.json': config,
    ...Object.fromEntries(assets.map(({ file, bytes }) => [`art/${file}`, bytes])), ...(crops ? { 'portrait-crops.json': crops } : {}) })
  if (!crops) return { files, assets }
  const derived = await derivePortraitCrops(files['campaign.json'] as object, book, assets, JSON.parse(crops.toString('utf8')))
  const packedFiles = { ...files, 'campaign.json': derived.config }
  parseCampaignBook(packedFiles, identity)
  return { files: packedFiles, assets: derived.assets }
}

function campaignDocuments(values: Record<string, unknown>, identity: CampaignIdentity) {
  const files = Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => {
    const bytes = Buffer.from(JSON.stringify(value))
    return { bytes, ref: { source: name, ...packed(bytes, '.json') } }
  })
  const storyPages: { ref: ReturnType<typeof packed> & { sources: string[] }; bytes: Buffer }[] = []
  if (identity === 'four-act' && files.length > 300) {
    const documents = files.filter(file => file.ref.source !== 'campaign.json')
    for (let start = 0; start < documents.length; start += 40) {
      const batch = documents.slice(start, start + 40)
      const bytes = Buffer.from(JSON.stringify(Object.fromEntries(batch.map(({ ref }) => [ref.source, values[ref.source]]))))
      storyPages.push({ bytes, ref: { ...packed(bytes, '.json'), sources: batch.map(file => file.ref.source) } })
    }
  }
  return { files, storyPages }
}

/** Assemble an immutable release in the private preview directory. Selecting it is a separate operation. */
export async function packCampaign(dir: string, out: string, release: string, identity: CampaignIdentity = 'current', pins?: unknown): Promise<CampaignRelease> {
  if (identity !== 'current' && pins === undefined) throw new Error(`${identity} packing requires source pins`)
  const path = campaignReleasePath(release, identity)
  if (!CAMPAIGN_RELEASE_PATH.test(path)) throw new Error('Release must be a lowercase slug')
  const input = await source(dir, pins, identity)
  const { files, storyPages } = campaignDocuments(input.files, identity)
  const assets = input.assets.map(({ id, bytes, extension }) => ({ bytes, ref: { id, ...packed(bytes, extension) } }))
  const selected = join(out, campaignPreviewIndex(identity))
  const combatSprites = existsSync(selected)
    ? requireCampaignIdentity(parseCampaignRelease(readJson(selected)), identity).combatSprites : undefined
  const index = parseCampaignRelease({ schemaVersion: 1, release,
    ...(identity === 'four-act' ? { campaign: identity } : {}),
    files: files.map((f) => f.ref), assets: assets.map((a) => a.ref), combatSprites,
    ...(storyPages.length ? { storyPages: storyPages.map(page => page.ref) } : {}) })
  for (const { ref, bytes } of [...files, ...storyPages, ...assets]) writeAtomic(join(out, ref.path), bytes)
  writeRelease(join(out, path), Buffer.from(`${JSON.stringify(index, null, 2)}\n`))
  return index
}

/** Stage a reviewed story/gameplay revision against an intact, already selected private campaign. */
export function stageCampaignRevision(out: string, release: string, base: CampaignRelease,
  values: Record<string, unknown>, identity: CampaignIdentity): CampaignRelease {
  requireCampaignIdentity(base, identity)
  const path = campaignReleasePath(release, identity)
  if (!CAMPAIGN_RELEASE_PATH.test(path)) throw new Error('Release must be a lowercase slug')
  // Artwork gets its own readback and art-only promotion. Revisions may reuse any exact asset in this release.
  const book = parseCampaignBook(values, identity)
  if (identity !== 'current') validateRoute(book)
  validateGround(book)
  const available = new Map(base.assets.map(asset => [asset.id, asset]))
  for (const { id, file } of book.assets) {
    const binding = available.get(id)
    if (!binding || !binding.path.endsWith(extname(file))) throw new Error(`No approved asset pin for ${id}`)
  }
  const { files, storyPages } = campaignDocuments(values, identity)
  const candidate = parseCampaignRelease({ ...base, release, files: files.map(({ ref }) => ref),
    storyPages: storyPages.length ? storyPages.map(({ ref }) => ref) : undefined })
  const old = new Set([...base.files, ...base.storyPages ?? []].map(ref => ref.path))
  for (const { ref, bytes } of [...files, ...storyPages]) if (!old.has(ref.path)) writeRelease(join(out, ref.path), bytes)
  writeRelease(join(out, path), Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`))
  return candidate
}

/** Publish or roll back the preview pointer once all referenced files pass verification. */
export function selectCampaign(out: string, release: string, identity: CampaignIdentity = 'current'): CampaignRelease {
  const { index, bytes } = readCandidate(out, identity, release)
  writeAtomic(join(out, campaignPreviewIndex(identity)), bytes)
  return index
}

function readCandidate(out: string, identity: CampaignIdentity, release?: string) {
  const path = release ? campaignReleasePath(release, identity) : campaignPreviewIndex(identity)
  if (release && !CAMPAIGN_RELEASE_PATH.test(path)) throw new Error('Release must be a lowercase slug')
  const bytes = readFileSync(join(out, path))
  const index = requireCampaignIdentity(parseCampaignRelease(JSON.parse(bytes.toString('utf8')), path), identity)
  if (release && index.release !== release) throw new Error(`${path}: release ID does not match the filename`)
  const files: Record<string, unknown> = {}
  const fileBySource = new Map(index.files.map(file => [file.source, file]))
  if (index.storyPages) {
    for (const page of index.storyPages) {
      const documents = documentsInStoryPage(page, JSON.parse(readReleasePayload(out, page).toString('utf8')))
      for (const [source, value] of Object.entries(documents)) {
        const original = fileBySource.get(source)!
        const bytes = Buffer.from(JSON.stringify(value))
        if (bytes.length !== original.bytes || sha(bytes) !== original.sha256 || !existsSync(join(out, original.path))) {
          throw new Error(`${source}: mismatched or missing story page document`)
        }
        files[source] = value
      }
    }
    files['campaign.json'] = JSON.parse(readReleasePayload(out, fileBySource.get('campaign.json')!).toString('utf8'))
  } else for (const file of index.files) {
    files[file.source] = JSON.parse(readReleasePayload(out, file).toString('utf8'))
  }
  const book = parseCampaignBook(files, identity)
  if (identity !== 'current') validateRoute(book)
  const assets = new Map(index.assets.map(ref => [ref.id, ref]))
  for (const asset of book.assets) {
    const ref = assets.get(asset.id)
    if (!ref || !ref.path.endsWith(extname(asset.file))) throw new Error(`${asset.id}: missing image or mismatched format`)
  }
  const combat = (index.combatSprites ?? []).flatMap(row => [row.manifest, row.placements, ...row.pages])
  const graphics = new Map<string, CampaignReleaseFile>()
  for (const file of [...index.assets, ...combat]) {
    const previous = graphics.get(file.path)
    if (previous) {
      if (previous.bytes !== file.bytes || previous.sha256 !== file.sha256) throw new Error(`${file.path}: conflicting payload pins`)
    } else {
      readReleasePayload(out, file)
      graphics.set(file.path, file)
    }
  }
  return { index, bytes, book, graphics }
}

/** A read-only receipt for the exact selected or staged payload. */
export function inspectCampaign(out: string, identity: CampaignIdentity = 'current', release?: string) {
  const { index, bytes, book, graphics } = readCandidate(out, identity, release)
  const quests = new Map(book.quests.map(quest => [quest.id, quest]))
  const art = new Map(book.art.map(binding => [binding.scene, binding]))
  const sprites = new Set(index.combatSprites?.map(row => row.outfit))
  return { campaign: identity, release: index.release, manifestSha256: sha(bytes), draft: book.draft,
    coverage: { quests: book.quests.length, shipEncounters: book.commands.size, groundEncounters: book.ground.size,
      imageBindings: book.assets.length, spriteBundles: index.combatSprites?.length ?? 0,
      storyFiles: index.files.length, storyRequests: index.storyPages ? index.storyPages.length + 1 : index.files.length,
      storyBytes: index.files.reduce((total, ref) => total + ref.bytes, 0),
      graphicsBytes: [...graphics.values()].reduce((total, ref) => total + ref.bytes, 0),
      systems: book.fourAct?.systems.size ?? 0, duos: book.fourAct?.duos.size ?? 0,
      expeditionRoutes: [...book.fourAct?.duos.values() ?? []].filter(duo => duo.expedition?.route).length,
      capitalRoutes: [...book.fourAct?.systems.values() ?? []].filter(system => system.capital).length,
      rehabilitationRoutes: [...book.fourAct?.arcs.values() ?? []].filter(arc => arc.rehabilitation).length,
      lieutenantRoutes: [...book.fourAct?.duos.values() ?? []].reduce((total, duo) => total + duo.returns.length, 0) },
    routes: book.recruits?.map(recruit => ({
      outfit: recruit.outfit,
      spriteBound: sprites.has(recruit.outfit),
      quests: [recruit.signOn, ...recruit.story].map(id => {
        const quest = quests.get(id)!
        const binding = art.get(quest.scene)
        return { id, scene: quest.scene, ...(quest.sceneWhen ? { alternative: quest.sceneWhen.scene } : {}),
          ...(quest.encounter ? { encounter: quest.encounter } : {}),
          environmentBound: !!(binding?.backdrop || binding?.composition),
          portraitsBound: binding?.portraits.map(({ speaker }) => speaker) ?? [] }
      }),
    })) ?? [],
  }
}

async function main() {
  const [command, release] = process.argv.slice(2)
  const arg = (flag: string) => {
    const index = process.argv.indexOf(flag)
    return index < 0 ? undefined : process.argv[index + 1]
  }
  const dir = resolve(arg('--dir') ?? 'content/campaign')
  const out = resolve(arg('--out') ?? 'content/campaign-release')
  const fourAct = process.argv.includes('--four-act')
  const pilot = process.argv.includes('--pilot')
  const identity: CampaignIdentity = fourAct ? 'four-act' : pilot ? 'pilot' : 'current'
  try {
    if (fourAct && pilot) throw new Error('Select one campaign identity')
    const pinsPath = arg('--pins')
    const pins = pinsPath ? readJson(resolve(pinsPath)) : undefined
    if (command === 'check') {
      if (identity !== 'current' && pins === undefined) throw new Error(`${identity} checking requires source pins`)
      await source(dir, pins, identity)
      console.log('Campaign source and art are valid')
    }
    else if (command === 'pack' && release) { const index = await packCampaign(dir, out, release, identity, pins); console.log(`Packed ${index.release} with ${index.files.length} story files and ${index.assets.length} images`) }
    else if (command === 'select' && release) { selectCampaign(out, release, identity); console.log(`${identity === 'current' ? 'Preview' : identity} now serves ${release}`) }
    else if (command === 'inspect') console.log(JSON.stringify(inspectCampaign(out, identity, release?.startsWith('--') ? undefined : release), null, 2))
    else throw new Error('Use pnpm campaign check, pack <release>, select <release>, or inspect [release]')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) void main()
