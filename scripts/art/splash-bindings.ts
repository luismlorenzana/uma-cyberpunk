import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { P, walkSteps } from '../../packages/domain/src/story/index'
import { sha, type ResolvedArt } from './model'
import type { SelectedCampaign } from './publish'
import { image } from './sources'
import { concurrent } from './concurrent'
import { parseSplashIndex, splashPlatformId, splashSourceId, SPLASH_INDEX, type PublishedSplash } from './splash-platform'
import { CAMPAIGN_PREFIX, SCENE_SPLASH_PREFIX, safeObject, type ArtStorage } from './storage'

const hash = /^[a-f0-9]{64}$/
const json = (bytes: Buffer): unknown => JSON.parse(bytes.toString('utf8'))
const stableBytes = (value: unknown) => Buffer.from(JSON.stringify(value))
const roles = ['crew', 'boss-ally', 'boss-enemy'] as const
type Row = Record<string, unknown>

function list(value: unknown, field: string): Row[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error(field + ': expected rows')
  return value as Row[]
}

/** Local Platform mapping is for offline review only. Cloud mode always reads actual Platform bytes. */
export function readLocalSplashRelease(root: string): ArtStorage {
  return {
    async read(path) {
      if (!path.startsWith(CAMPAIGN_PREFIX)) throw new Error('Local review needs Art manifests for source bytes')
      const file = safeObject(path.slice(CAMPAIGN_PREFIX.length))
      try { return { bytes: await readFile(resolve(root, file)), generation: '0' } }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
    },
    async put() { throw new Error('Local splash release review is read-only') },
  }
}

export async function resolveSplashBindings(file: string, selected: SelectedCampaign, platform: ArtStorage,
  options: { localAssets: boolean; dryRun: boolean; only: readonly string[] }): Promise<ResolvedArt> {
  const registry = await readFile(file)
  const p = new P(file)
  const root = p.object(json(registry), 'splash bindings', ['schemaVersion', 'campaign', 'bindings'])
  p.version(root)
  if (root.campaign !== 'cyberpunk') p.fail('campaign', 'expected current Cyberpunk campaign')
  const digest = (value: unknown, field: string) => {
    const pin = p.text(value, field, 64)
    if (!hash.test(pin)) p.fail(field, 'expected SHA-256')
    return pin
  }
  const choice = <T extends string>(value: unknown, field: string, options: readonly T[]): T => {
    if (typeof value !== 'string' || !options.some(option => option === value)) p.fail(field, 'expected ' + options.join(', '))
    return value as T
  }
  const bindings = p.list(root.bindings, 'bindings', (value, field) => {
    const fields = ['scene', 'chapter', 'chapterSha256', 'place', 'review', 'from']
    const row = p.object(value, field, [...fields, 'at', 'portraits', 'replacesCompositionSha256'], fields)
    const from = p.object(row.from, field + '.from', ['manifest', 'id', 'platformId', 'actor', 'role', 'outfit', 'variant', 'sha256'],
      ['id', 'actor', 'role', 'outfit', 'variant', 'sha256'])
    const role = choice(from.role, field + '.role', roles)
    const actor = role === 'crew' ? p.outfit(from.actor, field + '.actor') : p.slug(from.actor, field + '.actor')
    const portraits = row.portraits === undefined ? 'show' : choice(row.portraits, field + '.portraits', ['show', 'hide'] as const)
    const at = row.at === undefined ? undefined : p.text(row.at, field + '.at', 256)
    if (at && portraits === 'hide') p.fail(field, 'script cuts retain the existing portrait overlay')
    return { scene: p.slug(row.scene, field + '.scene'), chapter: safeObject(p.text(row.chapter, field + '.chapter', 180)),
      chapterSha256: digest(row.chapterSha256, field + '.chapterSha256'), place: p.slug(row.place, field + '.place'),
      review: choice(row.review, field + '.review', ['review', 'approved'] as const), at, portraits,
      replacesCompositionSha256: row.replacesCompositionSha256 === undefined ? undefined : digest(row.replacesCompositionSha256, field + '.replacesCompositionSha256'),
      actor, role, id: splashSourceId(p, from.id, field + '.id'), outfit: p.slug(from.outfit, field + '.outfit'), variant: p.slug(from.variant, field + '.variant'),
      platformId: from.platformId === undefined ? undefined : p.slug(from.platformId, field + '.platformId'),
      manifest: from.manifest === undefined ? undefined : resolve(dirname(file), p.text(from.manifest, field + '.manifest', 1024)), sha256: digest(from.sha256, field + '.sha256') }
  }, 4096)
  const matches = (row: typeof bindings[number], selector: string) => [row.id, row.scene, String(row.actor), row.platformId].includes(selector)
  for (const selector of options.only) if (!bindings.some(row => matches(row, selector))) throw new Error('Unknown splash scope: ' + selector)
  const scoped = bindings.filter(row => !options.only.length || options.only.some(selector => matches(row, selector)))
  if (!scoped.length) throw new Error('No reviewed splash bindings in scope')
  const fullScenes = new Set(scoped.filter(row => !row.at).map(row => row.scene))
  if (new Set(scoped.map(row => row.scene + ':' + (row.at ?? ''))).size !== scoped.length ||
    scoped.some(row => row.at && fullScenes.has(row.scene))) throw new Error('Conflicting splash scene destinations')

  const result: ResolvedArt = { images: [], newAssets: [], portraits: [], skipped: [], sceneSplashes: [],
    sourceChecks: [async () => { if (!(await readFile(file)).equals(registry)) throw new Error('Splash binding registry changed during publication') }],
    sources: [{ path: file, sha256: sha(registry), generation: 'local' }] }
  const assetRows = new Map<string, Row[]>()
  const platformRows = new Map<string, Row[]>()
  let sceneIndex: Promise<Map<string, PublishedSplash>> | undefined
  const official = () => sceneIndex ??= (async () => {
    const published = await platform.read(SPLASH_INDEX)
    if (!published) throw new Error('The Cyberpunk Platform splash catalog is missing')
    result.sources!.push({ path: SPLASH_INDEX, sha256: sha(published.bytes), generation: published.generation })
    result.sourceChecks.push(async () => {
      if (!(await platform.read(SPLASH_INDEX))?.bytes.equals(published.bytes)) throw new Error('Platform splash catalog moved during publication')
    })
    return new Map(parseSplashIndex(json(published.bytes)).map(item => [item.id, item]))
  })()
  const register = (row: typeof bindings[number], replacement: Awaited<ReturnType<typeof image>>) => {
    result.images.push(replacement)
    result.newAssets!.push(replacement.asset)
    result.sceneSplashes!.push({ scene: row.scene, asset: replacement.asset, at: row.at,
      width: replacement.width, height: replacement.height, portraits: row.portraits })
  }
  await concurrent(scoped, async row => {
    if (!options.dryRun && row.review !== 'approved') throw new Error(row.scene + ': scene destination approval is pending')
    const story = selected.release.files.find(ref => ref.source === row.chapter)
    const chapter = selected.files[row.chapter] as { scenes?: { id: string }[] } | undefined
    const scene = selected.book.scenes.get(row.scene)
    if (!story || story.sha256 !== row.chapterSha256 || !chapter?.scenes?.some(scene => scene.id === row.scene) || scene?.place !== row.place) {
      throw new Error(row.scene + ': Story source or setting differs from the reviewed binding')
    }
    if (!scene.cast.some(member => (member.outfit ?? member.heroine) === row.actor)) throw new Error(row.scene + ': splash actor is not in this Story scene')

    const asset = 'splash-' + row.sha256.slice(0, 48)
    const current = selected.book.art.find(art => art.scene === row.scene)
    if (row.at) {
      if (current?.composition || ![...walkSteps(scene.steps, 'steps')].some(step => step.path === row.at)) throw new Error(row.scene + ': splash cut requires a valid step without a full composition')
      const prior = current?.backdropCues?.find(cue => cue.at === row.at)
      if (prior && prior.asset !== asset) throw new Error(row.scene + ': splash cut would replace an existing visual cue')
    } else if (current?.composition && !(current.composition.layers.length === 1 && current.composition.layers[0]?.asset === asset) &&
      sha(stableBytes(current.composition)) !== row.replacesCompositionSha256) {
      throw new Error(row.scene + ': replacing a composition requires its existing layout hash')
    }

    if (!row.manifest) {
      const id = splashPlatformId(row.role, row.id)
      const source = (await official()).get(id)
      if ((row.platformId && row.platformId !== id) || !source || source.sourceId !== row.id || source.actor !== row.actor ||
        source.role !== row.role || source.outfit !== row.outfit || source.variant !== row.variant || source.sha256 !== row.sha256) {
        throw new Error(row.id + ': approved Platform role, scene variant or image pin disagrees')
      }
      const payload = await platform.read(SCENE_SPLASH_PREFIX + source.path)
      if (!payload) throw new Error('Approved splash payload is missing: ' + row.id)
      register(row, await image(asset, payload.bytes, { ...source }))
      return
    }
    const manifest = row.manifest
    let rows = assetRows.get(manifest)
    if (!rows) {
      const source = await readFile(manifest)
      rows = list((json(source) as Row).assets, row.manifest)
      assetRows.set(row.manifest, rows)
      result.sources!.push({ path: row.manifest, sha256: sha(source), generation: 'local' })
      result.sourceChecks.push(async () => { if (!(await readFile(manifest)).equals(source)) throw new Error('Splash catalog changed during publication') })
    }
    const matches = rows.filter(source => source.id === row.id)
    const source = matches[0]
    const approved = source?.approval as Row | undefined
    const actor = row.role === 'crew' ? source?.outfitId : source?.unitId
    if (matches.length !== 1 || actor !== row.actor || source?.outfit !== row.outfit || source?.scene !== row.variant ||
      (row.role !== 'crew' && source?.role !== row.role) || source?.sha256 !== row.sha256 || approved?.status !== 'approved' ||
      approved.by !== 'owner' || approved.imageSha256 !== row.sha256) throw new Error(row.id + ': approved source identity, outfit, variant or hash disagrees')

    let bytes: Buffer
    if (options.localAssets) {
      if (!options.dryRun) throw new Error('Local splash art can only be reviewed in a dry run')
      const folder = await realpath(dirname(manifest))
      const absolute = await realpath(resolve(folder, p.text(source.image, 'source.image', 300)))
      const path = relative(folder, absolute)
      if (!path || isAbsolute(path) || path === '..' || /^\.\.[\\/]/.test(path)) throw new Error('Splash image outside its catalog')
      bytes = await readFile(absolute)
    } else {
      const prefix = row.role === 'crew' ? 'art/universes/cyberpunk/' : 'enemy-art/cyberpunk/'
      const path = prefix + 'index.json'
      let published = platformRows.get(path)
      if (!published) {
        const index = await platform.read(path)
        if (!index) throw new Error('Platform splash index missing: ' + path)
        const raw = json(index.bytes) as Row
        if (raw.universe !== 'cyberpunk' && raw.game !== 'cyberpunk') throw new Error('Platform splash index belongs to another universe')
        published = list(raw.looks, path)
        platformRows.set(path, published)
        result.sources!.push({ path, sha256: sha(index.bytes), generation: index.generation })
        result.sourceChecks.push(async () => {
          if (!(await platform.read(path))?.bytes.equals(index.bytes)) throw new Error('Platform splash index changed during publication')
        })
      }
      const hits = published.filter(source => row.platformId && source.id === row.platformId)
      const remote = hits[0]
      if (hits.length !== 1 || remote?.kind !== 'splash' || remote.sha256 !== row.sha256 ||
        (row.role === 'crew' ? remote.character !== source.character || remote.outfit !== row.outfit : remote.unitId !== row.actor || remote.role !== row.role)) {
        throw new Error(row.id + ': matching approved splash is missing on Platform')
      }
      const remotePath = safeObject(p.text(remote.path, 'Platform splash path', 250))
      if (!remotePath.includes('.' + row.sha256.slice(0, 16) + '.')) throw new Error('Expected a hash-addressed Platform splash')
      const payload = await platform.read(prefix + remotePath)
      if (!payload || payload.bytes.length !== remote.bytes) throw new Error('Missing or invalid Platform splash bytes')
      bytes = payload.bytes
    }
    register(row, await image(asset, bytes, { ...source, sha256: row.sha256 }))
  })
  result.images.sort((a, b) => a.asset.localeCompare(b.asset))
  result.sceneSplashes!.sort((a, b) => a.scene.localeCompare(b.scene) || (a.at ?? '').localeCompare(b.at ?? ''))
  return result
}
