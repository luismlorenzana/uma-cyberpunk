import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import sharp from 'sharp'
import { type ArtStorage, safeObject } from './storage'
import { sha, type ArtEvent, type ImageReplacement, type PublishConfig, type ResolvedArt, type Selector } from './model'

type Row = Record<string, unknown>
class MissingPublishedIndex extends Error {}
const object = (v: unknown, label: string): Row => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label}: expected an object`)
  return v as Row
}
const rows = (v: unknown, label: string): Row[] => {
  if (!Array.isArray(v)) throw new Error(`${label}: expected a list`)
  return v.map(x => object(x, label))
}
const text = (v: unknown, label: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${label}: expected text`)
  return v
}
const integer = (v: unknown, label: string, min = 0): number => {
  if (!Number.isSafeInteger(v) || Number(v) < min) throw new Error(`${label}: expected an integer`)
  return Number(v)
}
const normalized = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const selected = (row: Row, only: readonly string[]) => !only.length || only.some(key =>
  [row.id, row.character, row.outfit, row.unitId, row.look, row.faction].some(value => value === key || normalized(value) === normalized(key)))
const matches = (row: Row, selector: Selector) => Object.entries(selector).every(([key, value]) => key === 'collection' || row[key] === value)

async function image(asset: string, bytes: Buffer, ref: Row): Promise<ImageReplacement> {
  if (bytes.length > 20 * 1024 * 1024 || sha(bytes) !== ref.sha256 || (ref.bytes !== undefined && bytes.length !== ref.bytes)) {
    throw new Error(`${asset}: published image failed its approved hash/size check`)
  }
  const metadata = await sharp(bytes).metadata()
  if (!['png', 'webp'].includes(metadata.format ?? '') || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) throw new Error(`${asset}: expected a still PNG/WebP`)
  if (ref.width !== undefined && metadata.width !== ref.width || ref.height !== undefined && metadata.height !== ref.height) throw new Error(`${asset}: image dimensions differ from the index`)
  return { asset, bytes, extension: metadata.format === 'png' ? '.png' : '.webp', width: metadata.width, height: metadata.height }
}

/** Reads published Cyberpunk collections only. Local assets require an explicit owner/hash approval. */
export async function resolveArt(storage: ArtStorage, config: PublishConfig, options: {
  event: ArtEvent; only: readonly string[]; contentRoot: string; allowMissing?: boolean; currentImages?: ReadonlyMap<string, string>;
}): Promise<ResolvedArt> {
  const result: ResolvedArt = { images: [], portraits: [], skipped: [], sourceChecks: [], sources: [] }
  const indexes = new Map<string, Promise<Row>>()
  async function index(path: string): Promise<Row> {
    let pending = indexes.get(path)
    if (!pending) {
      pending = (async () => {
        const source = await storage.read(path)
        if (!source) throw new MissingPublishedIndex(`Published Cyberpunk index missing: ${path}`)
        const data = object(JSON.parse(source.bytes.toString('utf8')), path)
        if (data.universe !== 'cyberpunk' && data.game !== 'cyberpunk') throw new Error(`${path}: wrong universe`)
        result.sources!.push({ path, sha256: sha(source.bytes), generation: source.generation })
        result.sourceChecks.push(async () => {
          const now = await storage.read(path)
          if (!now || sha(now.bytes) !== sha(source.bytes)) throw new Error(`${path} changed during publication; retry`)
        })
        return data
      })()
      indexes.set(path, pending)
    }
    return pending
  }
  async function remoteImage(asset: string, root: string, row: Row) {
    const path = safeObject(text(row.path, `${asset}.path`))
    const hash = text(row.sha256, `${asset}.sha256`)
    if (!/^[a-f0-9]{64}$/.test(hash) || !path.includes(`.${hash.slice(0, 16)}.`)) throw new Error(`${asset}: expected a hash-addressed published image`)
    const source = await storage.read(root + path)
    if (!source) throw new Error(`${asset}: published image missing`)
    return image(asset, source.bytes, row)
  }

  for (const binding of config.bindings) {
    const { from } = binding
    if (from.collection === 'local') {
      if (!['all', 'general'].includes(options.event) || !selected(from as unknown as Row, options.only)) continue
      const file = await realpath(resolve(options.contentRoot, binding.file!))
      const rel = relative(await realpath(options.contentRoot), file)
      if (!rel || isAbsolute(rel) || rel.startsWith('..')) throw new Error(`${binding.asset}: local art must stay inside content/`)
      const bytes = await readFile(file)
      result.images.push(await image(binding.asset, bytes, { sha256: binding.approval!.sha256 }))
      result.sourceChecks.push(async () => {
        if (sha(await readFile(file)) !== binding.approval!.sha256) throw new Error(`${binding.asset}: approved local source changed`)
      })
      continue
    }
    const event = from.category ?? from.collection
    if (options.event !== 'all' && options.event !== event) continue
    const root = from.collection === 'enemies' ? 'enemy-art/cyberpunk/' : 'art/universes/cyberpunk/'
    let catalog: Row
    try { catalog = await index(root + 'index.json') }
    catch (error) {
      if (!options.allowMissing || !(error instanceof MissingPublishedIndex)) throw error
      result.skipped.push(`${binding.asset}: not yet published to Platform`)
      continue
    }
    const found = rows(catalog.looks, 'looks').filter(row => matches(row, from) && (from.category ? true : !row.category))
    if (options.only.length && !found.some(row => selected(row, options.only)) && !selected(from as unknown as Row, options.only)) continue
    if (!found.length && options.allowMissing) { result.skipped.push(`${binding.asset}: not yet published to Platform`); continue }
    if (found.length !== 1) throw new Error(`${binding.asset}: expected exactly one published source, found ${found.length}`)
    const row = found[0]!
    if (!selected(row, options.only)) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.approvedOn))) throw new Error(`${binding.asset}: source has no dated approval`)
    if (options.currentImages?.get(binding.asset) === row.sha256) continue
    result.images.push(await remoteImage(binding.asset, root, row))
  }

  if (config.portraits.length && ['all', 'portraits'].includes(options.event)) {
    const root = 'art/universes/cyberpunk/portraits/'
    let catalog: Row
    try { catalog = await index(root + 'index.json') }
    catch (error) {
      if (!options.allowMissing || !(error instanceof MissingPublishedIndex)) throw error
      result.skipped.push('Portrait recipe not yet published to Platform')
      return result
    }
    const bases = rows(catalog.bases, 'bases'), faces = rows(catalog.faces, 'faces'), states = rows(catalog.states, 'states')
    const characters = rows(catalog.characters, 'characters')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(catalog.approvedOn))) throw new Error('Portrait recipe has no dated approval')
    for (const binding of config.portraits) {
      const identity = characters.find(row => row.id === binding.character)
      if (!selected({ id: binding.character, character: identity?.name }, options.only)) continue
      if (!identity) throw new Error(`${binding.base}: portrait identity missing`)
      const neutral = states.filter(row => row.character === binding.character && row.outfit === binding.outfit && row.expression === 'neutral')
      if (neutral.length !== 1 || neutral[0]!.face !== null || neutral[0]!.at !== null) throw new Error(`${binding.base}: invalid neutral recipe`)
      const base = bases.find(row => row.id === neutral[0]!.base && row.character === binding.character && row.outfit === binding.outfit)
      if (!base) throw new Error(`${binding.base}: portrait base missing`)
      const baseImage = await remoteImage(binding.base, root, base)
      const compiled = []
      const tags = new Set<string>()
      for (const state of states.filter(row => row.character === binding.character && row.outfit === binding.outfit && row.expression !== 'neutral')) {
        const emote = text(state.expression, 'expression')
        if (!/^[a-z][a-z0-9-]{0,39}$/.test(emote) || tags.has(emote) || state.base !== base.id || !/^[a-f0-9]{64}$/.test(String(state.approvedSha256))) throw new Error(`${binding.base}: invalid or unapproved expression recipe`)
        tags.add(emote)
        const face = faces.find(row => row.id === state.face && row.character === binding.character && row.expression === emote)
        if (!face) throw new Error(`${binding.base}: face missing for ${emote}`)
        const position = object(state.at, 'face.at')
        const at = { x: integer(position.x, 'face.x'), y: integer(position.y, 'face.y') }
        const asset = `face-${text(face.sha256, 'face.sha256').slice(0, 48)}`
        const faceImage = await remoteImage(asset, root, face)
        if (at.x + faceImage.width > baseImage.width || at.y + faceImage.height > baseImage.height) throw new Error(`${binding.base}: face exceeds its base`)
        compiled.push({ emote, at, image: faceImage })
      }
      if (binding.profile) {
        const { asset, baseSha256, crop } = binding.profile
        if (baseSha256 !== base.sha256) throw new Error(`${binding.base}: profile framing needs review against the new base`)
        if (crop.left + crop.size > baseImage.width || crop.top + crop.size > baseImage.height) throw new Error(`${asset}: profile crop exceeds base`)
        const bytes = await sharp(baseImage.bytes).extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size })
          .resize(192, 192).webp({ quality: 90 }).toBuffer()
        result.images.push({ asset, bytes, extension: '.webp', width: 192, height: 192 })
      }
      result.images.push(baseImage, ...compiled.map(face => face.image))
      result.portraits.push({ base: binding.base, speaker: binding.speaker, faces: compiled, profile: binding.profile?.asset })
    }
  }
  return result
}
