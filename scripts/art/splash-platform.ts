import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { P } from '../../packages/domain/src/story/index'
import { concurrent } from './concurrent'
import { sha } from './model'
import { immutable } from './publish'
import { image } from './sources'
import { SCENE_SPLASH_PREFIX, type ArtStorage } from './storage'

export const SPLASH_ROLES = ['crew', 'boss-ally', 'boss-enemy', 'lieutenant'] as const
export type SplashRole = typeof SPLASH_ROLES[number]
export const SPLASH_INDEX = SCENE_SPLASH_PREFIX + 'index.json'
export const splashPlatformId = (role: SplashRole, id: string) => 'sp-' + sha(Buffer.from(JSON.stringify([role, id]))).slice(0, 40)
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value))
const decode = (value: Buffer) => JSON.parse(value.toString('utf8').replace(/^\uFEFF/, '')) as unknown

export interface PublishedSplash {
  id: string; sourceId: string; role: SplashRole; actor: number | string; outfit: string; variant: string
  sha256: string; path: string; bytes: number; width: number; height: number; manifestSha256: string
}

type Source = Omit<PublishedSplash, 'bytes' | 'path'> & { file: string; manifest: string }

export function splashSourceId(p: P, value: unknown, field: string) {
  const id = p.text(value, field, 128)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return p.fail(field, 'expected a lowercase Art source ID')
  return id
}

function digest(p: P, value: unknown, field: string) {
  const pin = p.text(value, field, 64)
  if (!/^[a-f0-9]{64}$/.test(pin)) return p.fail(field, 'expected SHA-256')
  return pin
}

export function parseSplashIndex(value: unknown): PublishedSplash[] {
  const p = new P(SPLASH_INDEX)
  const data = p.object(value, 'index', ['schemaVersion', 'kind', 'universe', 'assets'])
  p.version(data)
  if (data.kind !== 'cyberpunk-scene-splashes' || data.universe !== 'cyberpunk') p.fail('universe', 'expected Cyberpunk scene splashes')
  const assets = p.list(data.assets, 'assets', (raw, field): PublishedSplash => {
    const item = p.object(raw, field, ['id', 'sourceId', 'role', 'actor', 'outfit', 'variant', 'sha256', 'path', 'bytes', 'width', 'height', 'manifestSha256'])
    const role = SPLASH_ROLES.find(role => role === item.role)
    if (!role) return p.fail(field + '.role', 'unknown role')
    const sourceId = splashSourceId(p, item.sourceId, field + '.sourceId'), id = splashPlatformId(role, sourceId)
    const sha256 = digest(p, item.sha256, field + '.sha256')
    const path = `images/${sha256}.png`
    if (item.id !== id || item.path !== path) p.fail(field, 'source identity or hash-addressed file disagrees')
    return { id, sourceId, role, actor: role === 'crew' ? p.outfit(item.actor, field + '.actor') : p.slug(item.actor, field + '.actor'),
      outfit: p.slug(item.outfit, field + '.outfit'), variant: p.slug(item.variant, field + '.variant'), sha256, path,
      bytes: p.int(item.bytes, field + '.bytes', 1, 20 * 1024 * 1024), width: p.int(item.width, field + '.width', 1, 8192),
      height: p.int(item.height, field + '.height', 1, 8192), manifestSha256: digest(p, item.manifestSha256, field + '.manifestSha256') }
  }, 4096)
  if (new Set(assets.map(item => item.id)).size !== assets.length) p.fail('assets', 'duplicate source ID')
  return assets
}

export async function readSplashAlbums(authoringRoot: string, onlyRole?: SplashRole) {
  const root = await realpath(authoringRoot)
  const universe = join(root, 'character-universes/cyberpunk')
  const manifests = [
    { file: 'splash-art/manifest.json', roles: ['crew'] },
    { file: 'enemies/casual/splash-art/manifest.json', roles: ['boss-ally', 'boss-enemy'] },
    { file: 'enemies/splash-art/manifest.json', roles: ['boss-ally', 'boss-enemy'] },
    { file: 'enemies/lieutenants/splash-art/manifest.json', roles: ['lieutenant'] },
  ]
  const hashes = new Map<string, string>(), sources = new Map<string, Source>()
  for (const album of manifests) {
    if (onlyRole && !album.roles.includes(onlyRole)) continue
    const path = join(universe, album.file)
    const bytes = await readFile(path).catch((error: NodeJS.ErrnoException) => {
      if (!onlyRole && album.roles.includes('lieutenant') && error.code === 'ENOENT') return null
      throw error
    })
    if (!bytes) continue
    const p = new P(path), data = decode(bytes) as { assets?: unknown[] }
    const manifestSha256 = sha(bytes)
    hashes.set(path, manifestSha256)
    if (!Array.isArray(data.assets)) p.fail('assets', 'expected an approved album')
    for (const raw of data.assets ?? []) {
      const row = raw as Record<string, unknown>
      const approval = row.approval as { status?: unknown; by?: unknown; imageSha256?: unknown; sha256?: unknown } | undefined
      if (approval?.status !== 'approved') continue
      const declared = row.role ?? (album.roles.includes('crew') ? 'crew' : undefined)
      const role = SPLASH_ROLES.find(value => value === declared && album.roles.includes(value))
      if (!role) return p.fail('asset.role', 'splash lacks its authored role')
      if (onlyRole && role !== onlyRole) continue
      const sourceId = splashSourceId(p, row.id, 'asset.id'), sha256 = digest(p, row.sha256, 'asset.sha256')
      const approvedHash = role === 'lieutenant' ? approval.imageSha256 ?? approval.sha256 : approval.imageSha256
      if (approval.by !== 'owner' || approvedHash !== sha256 || (role === 'lieutenant' && approval.sha256 !== undefined && approval.sha256 !== sha256)) p.fail(sourceId, 'approved source identity or image pin disagrees')
      const actor = role === 'crew' ? p.outfit(row.outfitId, sourceId + '.outfitId') : p.slug(row.unitId, sourceId + '.unitId')
      const file = join(dirname(path), p.text(row.image, sourceId + '.image', 300))
      const id = splashPlatformId(role, sourceId)
      const entry: Source = { id, sourceId, role, actor, outfit: p.slug(row.outfit, sourceId + '.outfit'), variant: p.slug(row.scene, sourceId + '.scene'), sha256,
        width: p.int(row.width, sourceId + '.width', 1, 8192), height: p.int(row.height, sourceId + '.height', 1, 8192), file, manifest: path, manifestSha256 }
      const prior = sources.get(id)
      if (prior) {
        if (prior.manifest === path || prior.sha256 !== entry.sha256 || prior.actor !== entry.actor || prior.outfit !== entry.outfit || prior.variant !== entry.variant) {
          p.fail(sourceId, 'conflicting duplicate album source')
        }
      } else sources.set(id, entry)
    }
  }
  if (onlyRole && !sources.size) throw new Error('No owner-approved splashes for ' + onlyRole)
  return { sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)), async check() {
    await concurrent([...hashes], async ([path, expected]) => {
      if (sha(await readFile(path)) !== expected) throw new Error('Album changed during splash publication')
    }, 12)
  } }
}

export async function publishSplashAlbums(catalog: Awaited<ReturnType<typeof readSplashAlbums>>, platform: ArtStorage, dryRun = false,
  progress?: (done: number, total: number) => void) {
  const previous = dryRun ? null : await platform.read(SPLASH_INDEX)
  const rows = new Map((previous ? parseSplashIndex(decode(previous.bytes)) : []).map(item => [item.id, item]))
  let done = 0, changes = 0
  await concurrent(catalog.sources, async source => {
    const { manifest, file, ...identity } = source
    const folder = await realpath(dirname(manifest)), absolute = await realpath(file)
    const subpath = relative(folder, absolute)
    if (!subpath || isAbsolute(subpath) || subpath === '..' || /^\.\.[\\/]/.test(subpath)) throw new Error('Splash image outside its album')
    const native = await image(source.id, await readFile(absolute), { ...source })
    if (native.extension !== '.png') throw new Error('Approved splash needs its native PNG')
    const path = `images/${source.sha256}.png`
    const entry = { ...identity, path, bytes: native.bytes.length }
    const prior = rows.get(entry.id)
    if (!prior || (Object.keys(entry) as (keyof PublishedSplash)[]).some(key => prior[key] !== entry[key])) {
      if (!dryRun) await immutable(platform, SCENE_SPLASH_PREFIX + path, native.bytes)
      rows.set(entry.id, entry)
      changes++
    }
    if (++done % 100 === 0) progress?.(done, catalog.sources.length)
  }, 16)
  const index = { schemaVersion: 1, kind: 'cyberpunk-scene-splashes', universe: 'cyberpunk', assets: [...rows.values()].sort((a, b) => a.id.localeCompare(b.id)) }
  // Canonicalize field order so an identical source batch can replay without rewriting the index.
  const next = encoded({ ...index, assets: parseSplashIndex(index) })
  await catalog.check()
  if (!dryRun && !previous?.bytes.equals(next)) {
    await platform.put(SPLASH_INDEX, next, previous?.generation ?? '0')
    if (!(await platform.read(SPLASH_INDEX))?.bytes.equals(next)) throw new Error('Platform splash index readback failed')
  }
  return { total: index.assets.length, checked: done, changes, dryRun }
}
