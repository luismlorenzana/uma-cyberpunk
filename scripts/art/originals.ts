import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { P } from '../../packages/domain/src/story/index'
import { concurrent } from './concurrent'
import { sha, type ImageReplacement, type ResolvedArt } from './model'
import { immutable, publishArtCandidate, type SelectedCampaign } from './publish'
import { image } from './sources'
import { GenerationConflict, ORIGINAL_ART_PREFIX, type ArtStorage } from './storage'

const encode = (value: unknown) => Buffer.from(JSON.stringify(value))
const decode = (bytes: Buffer): unknown => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
const sections = [
  { directory: '', key: 'fullBodyAssets', type: 'base' },
  { directory: 'splash-art', key: 'assets', type: 'splash' },
  { directory: 'dialogue-portraits', key: 'assets', type: 'expression' },
  { directory: 'categories/combat-sprites', key: 'fullBodyAssets', type: 'sprite-pose' },
] as const
type ArtType = typeof sections[number]['type']
export interface OriginalImage {
  id: string; actor: string; rank: string; court: string; version: string; type: ArtType; state?: string; variant?: string
  view?: string
  title: string; approvalDate: string; manifestSha256: string; sha256: string; width: number; height: number; bytes: number; path: string
}

function digest(p: P, value: unknown, field: string) {
  const hash = p.text(value, field, 64)
  if (!/^[0-9a-f]{64}$/.test(hash)) p.fail(field, 'expected SHA-256')
  return hash
}

export async function readOriginalAlbum(root: string) {
  root = await realpath(root)
  const pins = new Map<string, string>()
  const inside = async (parent: string, path: string) => {
    const file = await realpath(path)
    const subpath = relative(parent, file)
    if (!subpath || isAbsolute(subpath) || subpath === '..' || /^\.\.[\\/]/.test(subpath)) throw new Error('Original source outside its album: ' + path)
    return file
  }
  const read = async (path: string, parent = root) => {
    const file = await inside(parent, path)
    const bytes = await readFile(file)
    const hash = sha(bytes)
    if (pins.has(file) && pins.get(file) !== hash) throw new GenerationConflict('Original source changed during intake: ' + path)
    pins.set(file, hash)
    return { value: decode(bytes), hash }
  }
  const p = new P('original character registry')
  const registry = (await read(join(root, 'collection.json'))).value as Record<string, unknown>
  if (registry?.schemaVersion !== 1 || registry.kind !== 'original-character-collection') p.fail('collection', 'expected an original character collection')
  const collection = p.slug(registry.id, 'collection.id')
  const registryKeys = (rows: unknown, field: string) => new Set(p.list(rows, field, (raw, path) =>
    p.slug((raw as Record<string, unknown>)?.id, path + '.id'), 128))
  const ranks = registryKeys(registry.ranks, 'ranks'), courts = registryKeys(registry.courts, 'courts')
  const actors = p.list(registry.characters, 'characters', (raw, field) => {
    const row = raw as Record<string, unknown>
    const key = p.slug(row?.id, field + '.id'), rank = p.slug(row.rank, field + '.rank'), court = p.slug(row.court, field + '.court')
    if (!ranks.has(rank) || !courts.has(court)) p.fail(field, 'unknown rank or court')
    const storage = row.storage === undefined ? {} : p.object(row.storage, field + '.storage', ['rank', 'court'], [])
    return { key, rank, court, archived: row.archived === true, actor: `original-${collection}-${key}`, directory: join(root,
      storage.rank === undefined ? rank : p.slug(storage.rank, field + '.storage.rank'),
      storage.court === undefined ? court : p.slug(storage.court, field + '.storage.court'), key) }
  }, 512)
  if (new Set(actors.map(actor => actor.key)).size !== actors.length) p.fail('characters', 'duplicate actor')
  const sources = new Map<string, { entry: OriginalImage; file: string }>()
  await concurrent(actors.filter(actor => !actor.archived), async actor => {
    const directory = await inside(root, actor.directory)
    const identity = (await read(join(directory, 'character.json'), directory)).value as Record<string, unknown>
    if (identity?.id !== actor.actor) throw new Error('Original album identity differs from the registry: ' + actor.actor)
    for (const section of sections) {
      const album = join(directory, section.directory)
      const pointer = (await read(join(album, 'active-study.json'), directory)).value as Record<string, unknown>
      if (pointer?.ownerApproved !== true) continue
      const version = p.text(pointer.activeVersion, 'activeVersion', 7)
      if (!/^v\d{3,6}$/.test(version)) p.fail('activeVersion', 'expected an approved study version')
      const folder = join(album, version)
      const { value, hash: manifestSha256 } = await read(join(folder, 'manifest.json'), directory)
      const manifest = value as Record<string, unknown>
      if (manifest?.schemaVersion !== 1 || manifest.unitId !== actor.actor) throw new Error('Original manifest identity differs from the registry: ' + actor.actor)
      const assets = p.list(manifest[section.key] ?? [], 'assets', (raw, field) => {
        const row = raw as Record<string, unknown>
        const approval = row?.approval as Record<string, unknown> | undefined
        if (approval?.status !== 'approved' || approval.by !== 'owner' || row.image === undefined ||
          (section.type === 'sprite-pose' && row.view === undefined)) return
        const id = p.slug(row.id, field + '.id')
        if (!id.startsWith(actor.actor + '-') || (row.unitId !== undefined && row.unitId !== actor.actor)) p.fail(field, 'source identity differs from approved actor')
        const approvalDate = p.text(approval.on, field + '.approval.on', 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(approvalDate)) p.fail(field, 'expected owner approval date')
        return { id, approvalDate, title: p.text(row.title, field + '.title', 180),
          state: row.state === undefined ? undefined : p.slug(row.state, field + '.state'),
          variant: row.variant === undefined ? undefined : p.slug(row.variant, field + '.variant'),
          view: row.view === undefined ? undefined : p.slug(row.view, field + '.view'),
          name: p.text(row.image, field + '.image', 240), sha256: digest(p, row.sha256, field + '.sha256'),
          width: p.int(row.width, field + '.width', 1, 20000), height: p.int(row.height, field + '.height', 1, 20000) }
      }, 128)
      for (const asset of assets) {
        if (!asset) continue
        const { name, ...metadata } = asset
        // Splash albums may select native files from earlier approved versions of the same tab.
        const file = await inside(await realpath(album), resolve(folder, name))
        const bytes = await readFile(file)
        const approved = await image(asset.id, bytes, metadata)
        const entry: OriginalImage = { ...metadata, actor: actor.actor, rank: actor.rank, court: actor.court, version,
          type: section.type, manifestSha256, bytes: bytes.length, path: `images/${asset.sha256}${approved.extension}` }
        if (sources.has(asset.id)) throw new Error('Duplicate approved original asset: ' + asset.id)
        sources.set(asset.id, { entry, file })
      }
    }
  }, 8)
  const entries = [...sources.values()].map(source => source.entry).sort((a, b) => a.id.localeCompare(b.id))
  if (!entries.length) throw new Error('No active owner-approved original art')
  return { collection, entries, sources, check: async () => {
    await concurrent([...pins], async ([file, expected]) => {
      if (sha(await readFile(file)) !== expected) throw new GenerationConflict('Original album changed: ' + file)
    })
  } }
}

type Album = Awaited<ReturnType<typeof readOriginalAlbum>>
interface Binding { asset: string; source: string; sha256: string; prior: string | null }

export function readOriginalBindings(value: unknown): Binding[] {
  const p = new P('original campaign bindings')
  const root = p.object(value, 'bindings', ['schemaVersion', 'bindings'])
  p.version(root)
  const bindings = p.list(root.bindings, 'bindings', (raw, path) => {
    const b = p.object(raw, path, ['asset', 'source', 'sha256', 'prior'])
    return { asset: p.slug(b.asset, path + '.asset'), source: p.slug(b.source, path + '.source'),
      sha256: digest(p, b.sha256, path + '.sha256'), prior: b.prior === null ? null : digest(p, b.prior, path + '.prior') }
  }, 512)
  if (new Set(bindings.map(binding => binding.asset)).size !== bindings.length) p.fail('bindings', 'duplicate destination asset')
  return bindings
}

export async function publishOriginalImages(storage: ArtStorage, platform: ArtStorage, selected: SelectedCampaign, album: Album,
  bindings: Binding[], options: { dryRun?: boolean; stageOnly?: boolean; expectRelease?: string } = {}) {
  if (selected.campaign !== 'four-act') throw new Error('Original art targets the four-act campaign')
  const prefix = ORIGINAL_ART_PREFIX + album.collection + '/'
  const indexPath = prefix + 'index.json'
  const index = encode({ schemaVersion: 1, kind: 'cyberpunk-original-art', universe: 'cyberpunk', collection: album.collection, assets: album.entries })
  const previous = await platform.read(indexPath)
  const plan = { changes: 0, unchanged: 0 }
  const current = new Map(selected.release.assets.map(asset => [asset.id, asset]))
  const checked = bindings.map(binding => {
    const source = album.sources.get(binding.source)?.entry
    if (!source || source.sha256 !== binding.sha256) throw new Error('Original binding differs from the active approved source: ' + binding.source)
    const actor = source.actor.slice('original-'.length)
    if (!binding.asset.startsWith(actor + '-')) throw new Error('Original binding crosses actor identities: ' + binding.asset)
    const base = source.type === 'base' && !!source.state && binding.asset === `${actor}-${source.state}-base`
    const variant = binding.asset.slice(actor.length + 1, -'-splash'.length)
    const splash = source.type === 'splash' && source.state === 'joined' && variant && binding.asset.endsWith('-splash') &&
      source.id.startsWith(source.actor + '-splash-' + variant + '-')
    const expression = source.type === 'expression' && binding.asset.startsWith(actor + '-expression-')
    if (!base && !splash && !expression) throw new Error('Original binding does not match the approved art type or state: ' + binding.asset)
    const old = current.get(binding.asset)
    if (old?.sha256 !== source.sha256 && (old?.sha256 ?? null) !== binding.prior) {
      throw new GenerationConflict('Original campaign art changed: ' + binding.asset)
    }
    const named = [...selected.book.ground.values()].some(ground => ground.cues?.opponents?.some(row => row.actor === actor))
    if (!old && (!base || source.state !== 'joined' || !named)) {
      throw new Error('New original base requires an existing named encounter: ' + binding.asset)
    }
    if (old?.sha256 === source.sha256) plan.unchanged++
    else plan.changes++
    return { binding, source }
  })
  const checkIndex = async () => {
    const remote = await platform.read(indexPath)
    if (!remote?.bytes.equals(index)) throw new GenerationConflict('Platform original art index changed')
    return remote
  }
  const unique = new Map(album.entries.map(entry => [entry.path, album.sources.get(entry.id)!]))
  const images = new Map<string, ImageReplacement>()
  // Complete the game preflight before changing either selection.
  await concurrent(checked, async ({ binding, source }) => {
    const approved = await image(binding.asset, await readFile(album.sources.get(source.id)!.file), { ...source })
    images.set(binding.asset, approved)
  })
  const resolved: ResolvedArt = { images: checked.map(({ binding }) => images.get(binding.asset)!), portraits: [], skipped: [],
    newAssets: bindings.filter(row => !current.has(row.asset)).map(row => row.asset),
    sourceChecks: [album.check, async () => { await checkIndex() }] }
  const candidate = await publishArtCandidate(storage, selected, resolved, { dryRun: true })
  if (options.expectRelease && candidate.release.release !== options.expectRelease) {
    throw new GenerationConflict('Original art no longer produces the reviewed four-act release')
  }
  if (options.dryRun) return { ...plan, release: candidate.release.release, promoted: false, platformGeneration: previous?.generation }
  await concurrent([...unique], async ([path, { entry, file }]) => {
    const bytes = await readFile(file)
    if (sha(bytes) !== entry.sha256) throw new Error('Approved original image changed: ' + entry.id)
    const remote = await platform.read(prefix + path)
    if (!remote) await immutable(platform, prefix + path, bytes)
    else if (!remote.bytes.equals(bytes)) throw new Error('Platform original image readback failed: ' + entry.id)
  })
  await album.check()
  if (!previous?.bytes.equals(index)) await platform.put(indexPath, index, previous?.generation ?? '0')
  const selection = await checkIndex()
  await concurrent(checked, async ({ binding, source }) => {
    const remote = await platform.read(prefix + source.path)
    if (!remote) throw new Error('Platform original image is missing: ' + source.id)
    images.set(binding.asset, await image(binding.asset, remote.bytes, { ...source }))
  })
  const published = await publishArtCandidate(storage, selected, { ...resolved, images: checked.map(({ binding }) => images.get(binding.asset)!) }, options)
  return { ...plan, release: published.release.release, promoted: published.promoted,
    platformGeneration: selection.generation, indexSha256: sha(index), campaignChanges: published.changes }
}
