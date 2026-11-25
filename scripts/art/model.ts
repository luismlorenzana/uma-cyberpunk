import { createHash } from 'node:crypto'
import { P, type Speaker } from '../../packages/domain/src/story/index'
import type { CampaignWardrobe } from '../../packages/domain/src/campaign-wardrobe'

export const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
export const EVENTS = ['all', 'looks', 'portraits', 'enemies', 'weapons', 'combat-sprites', 'splashes', 'general'] as const
export type ArtEvent = typeof EVENTS[number]
export type ArtCollection = 'looks' | 'enemies' | 'local'
export interface Selector { collection: ArtCollection; id?: string; character?: string; outfit?: string; unitId?: string; look?: string; category?: string }
export interface AssetBinding {
  asset: string
  from: Selector
  file?: string
  approval?: { by: 'owner'; sha256: string }
}
export interface PortraitBinding {
  base: string; speaker: Speaker; character: string; outfit: string
  profile?: { asset: string; baseSha256: string; crop: { left: number; top: number; size: number } }
}
export interface WardrobeImport {
  speaker: Speaker; character: string; from: { collection: 'looks' | 'enemies'; character?: string; unitId?: string }
  default?: string; after?: string; requiresFlag?: string; labels?: Record<string, string>; routes?: { scene: string; outfit: string }[]
  visibleLooks?: string[]
}
export interface PublishConfig { schemaVersion: 1; bindings: AssetBinding[]; portraits: PortraitBinding[]; wardrobes?: WardrobeImport[]; authoringRoot?: string }

export function parsePublishConfig(value: unknown): PublishConfig {
  const p = new P('art-publish.json')
  const root = p.object(value, 'publish', ['schemaVersion', 'bindings', 'portraits', 'wardrobes', 'authoringRoot'], ['schemaVersion', 'bindings'])
  p.version(root)
  const ids = new Set<string>()
  const bindings = p.list(root.bindings, 'bindings', (value, field): AssetBinding => {
    const b = p.object(value, field, ['asset', 'from', 'file', 'approval'], ['asset', 'from'])
    const asset = p.slug(b.asset, `${field}.asset`)
    if (ids.has(asset)) p.fail(field, 'duplicate destination asset')
    ids.add(asset)
    const raw = p.object(b.from, `${field}.from`, ['collection', 'id', 'character', 'outfit', 'unitId', 'look', 'category'], ['collection'])
    if (!['looks', 'enemies', 'local'].includes(String(raw.collection))) p.fail(field, 'expected Cyberpunk looks, enemies or approved local art')
    const from: Selector = { collection: raw.collection as ArtCollection }
    for (const key of ['id', 'character', 'outfit', 'unitId', 'look', 'category'] as const) {
      if (raw[key] !== undefined) from[key] = p.text(raw[key], `${field}.from.${key}`, 120)
    }
    if (!from.id && !(from.character && from.outfit) && !(from.unitId && from.look)) p.fail(field, 'expected a stable source identity and look')
    if (from.collection !== 'local') {
      if (b.file !== undefined || b.approval !== undefined) p.fail(field, 'remote approvals come from the published index')
      return { asset, from }
    }
    const a = p.object(b.approval, `${field}.approval`, ['by', 'sha256'])
    if (a.by !== 'owner' || !/^[a-f0-9]{64}$/.test(String(a.sha256))) p.fail(field, 'local art needs owner approval bound to its SHA-256')
    return { asset, from, file: p.text(b.file, `${field}.file`, 300), approval: { by: 'owner', sha256: String(a.sha256) } }
  }, 4096)
  const portraits = root.portraits === undefined ? [] : p.list(root.portraits, 'portraits', (value, field): PortraitBinding => {
    const b = p.object(value, field, ['base', 'speaker', 'character', 'outfit', 'profile'], ['base', 'speaker', 'character', 'outfit'])
    const base = p.slug(b.base, `${field}.base`)
    if (ids.has(base)) p.fail(field, 'portrait base also has another binding')
    ids.add(base)
    const profile = b.profile === undefined ? undefined : (() => {
      const x = p.object(b.profile, `${field}.profile`, ['asset', 'baseSha256', 'crop'])
      const c = p.object(x.crop, `${field}.profile.crop`, ['left', 'top', 'size'])
      const baseSha256 = p.text(x.baseSha256, `${field}.profile.baseSha256`, 64)
      if (!/^[a-f0-9]{64}$/.test(baseSha256)) p.fail(field, 'profile crop must be bound to its reviewed base hash')
      return { asset: p.slug(x.asset, `${field}.profile.asset`), baseSha256, crop: {
        left: p.int(c.left, `${field}.profile.left`, 0, 20000), top: p.int(c.top, `${field}.profile.top`, 0, 20000), size: p.int(c.size, `${field}.profile.size`, 1, 20000) } }
    })()
    return { base, speaker: p.speaker(b.speaker, `${field}.speaker`), character: p.text(b.character, `${field}.character`, 120),
      outfit: p.slug(b.outfit, `${field}.outfit`), ...(profile ? { profile } : {}) }
  }, 1024)
  const wardrobes = root.wardrobes === undefined ? undefined : p.list(root.wardrobes, 'wardrobes', (v, field): WardrobeImport => {
    const row = p.object(v, field, ['speaker', 'character', 'from', 'default', 'after', 'requiresFlag', 'labels', 'routes', 'visibleLooks'], ['speaker', 'character', 'from'])
    const from = p.object(row.from, field + '.from', ['collection', 'character', 'unitId'], ['collection'])
    if (from.collection !== 'looks' && from.collection !== 'enemies') p.fail(field, 'expected Cyberpunk looks or enemies')
    const key = from.collection === 'looks' ? 'character' : 'unitId'
    if (Object.keys(from).some(k => k !== 'collection' && k !== key)) p.fail(field, 'wrong source identity key')
    const labels = row.labels === undefined ? undefined : p.object(row.labels, field + '.labels', Object.keys((row.labels ?? {}) as object), [])
    const visibleLooks = row.visibleLooks === undefined ? undefined : p.list(row.visibleLooks, field + '.visibleLooks', (value, path) => p.slug(value, path), 32)
    if (visibleLooks && new Set(visibleLooks).size !== visibleLooks.length) p.fail(field + '.visibleLooks', 'duplicate visible look')
    return { speaker: p.speaker(row.speaker, field), character: p.slug(row.character, field), from: { collection: from.collection as 'looks' | 'enemies', [key]: p.text(from[key], field, 120) },
      ...(row.default === undefined ? {} : { default: p.slug(row.default, field) }),
      ...(row.after === undefined ? {} : { after: p.slug(row.after, field) }),
      ...(row.requiresFlag === undefined ? {} : { requiresFlag: p.slug(row.requiresFlag, field) }),
      ...(visibleLooks ? { visibleLooks } : {}),
      ...(labels ? { labels: Object.fromEntries(Object.entries(labels).map(([k, v]) => [p.slug(k, field), p.text(v, field, 64)])) } : {}),
      ...(row.routes === undefined ? {} : { routes: p.list(row.routes, field + '.routes', (v, f) => {
        const route = p.object(v, f, ['scene', 'outfit'])
        return { scene: p.slug(route.scene, f), outfit: p.slug(route.outfit, f) }
      }, 4096) }) }
  }, 200)
  if (wardrobes && (new Set(wardrobes.map(row => row.speaker)).size !== wardrobes.length || new Set(wardrobes.map(row => row.character)).size !== wardrobes.length)) p.fail('wardrobes', 'duplicate cast identity')
  return { schemaVersion: 1, bindings, portraits, ...(wardrobes ? { wardrobes } : {}), ...(root.authoringRoot === undefined ? {} : { authoringRoot: p.text(root.authoringRoot, 'authoringRoot', 300) }) }
}

export interface ImageReplacement { asset: string; bytes: Buffer; extension: '.png' | '.webp'; width: number; height: number }
export interface PortraitReplacement { base: string; speaker: Speaker; faces: { emote: string; image: ImageReplacement; at: { x: number; y: number } }[]; profile?: string }
export interface SceneSplash { scene: string; asset: string; at?: string; width: number; height: number; portraits: 'show' | 'hide' }
export interface ResolvedArt {
  images: ImageReplacement[]; portraits: PortraitReplacement[]; skipped: string[]; sourceChecks: (() => Promise<void>)[]
  sources?: { path: string; sha256: string; generation: string }[]
  wardrobe?: CampaignWardrobe
  newAssets?: string[]
  retiredPortraits?: string[]
  sceneSplashes?: SceneSplash[]
  sceneBackdrops?: { scene: string; asset: string; replaces: string }[]
  scenePortraits?: { scene: string; speaker: Speaker; asset: string }[]
}
