import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import sharp from 'sharp'
import { type ArtStorage, safeObject } from './storage'
import { sha, type ArtEvent, type ImageReplacement, type PublishConfig, type ResolvedArt, type Selector } from './model'
import type { CampaignWardrobe } from '../../packages/domain/src/campaign-wardrobe'
import { concurrent } from './concurrent'

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
  event: ArtEvent; only: readonly string[]; contentRoot: string; allowMissing?: boolean; currentImages?: ReadonlyMap<string, string>; wardrobe?: CampaignWardrobe;
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
  const remoteImages = new Map<string, Promise<ImageReplacement>>()
  async function remoteImage(asset: string, root: string, row: Row) {
    const path = safeObject(text(row.path, `${asset}.path`))
    const hash = text(row.sha256, `${asset}.sha256`)
    if (!/^[a-f0-9]{64}$/.test(hash) || !path.includes(`.${hash.slice(0, 16)}.`)) throw new Error(`${asset}: expected a hash-addressed published image`)
    const key = root + path
    let pending = remoteImages.get(key)
    if (!pending) {
      pending = (async () => {
        const source = await storage.read(key)
        if (!source) throw new Error(`${asset}: published image missing`)
        return image(asset, source.bytes, row)
      })()
      remoteImages.set(key, pending)
    }
    // Recheck each reference even when two destinations reuse one physical piece.
    const cached = await pending
    return image(asset, cached.bytes, row)
  }

  const bindings = [...config.bindings], portraits = [...config.portraits], wardrobeAssets = new Set<string>()
  if (config.wardrobes?.length && ['all', 'looks', 'enemies', 'portraits'].includes(options.event)) {
    const wardrobe = structuredClone(options.wardrobe ?? { members: [], scenes: [], crops: [] })
    let portraitCatalog: Row | undefined
    try { portraitCatalog = await index('art/universes/cyberpunk/portraits/index.json') }
    catch (error) { if (!(error instanceof MissingPublishedIndex)) throw error; result.skipped.push('Approved portraits not yet published to Platform') }
    for (const actor of config.wardrobes) {
      if (!['all', 'portraits', actor.from.collection].includes(options.event)) continue
      const root = actor.from.collection === 'looks' ? 'art/universes/cyberpunk/' : 'enemy-art/cyberpunk/'
      let catalog: Row
      try { catalog = await index(root + 'index.json') }
      catch (error) {
        if (!(error instanceof MissingPublishedIndex)) throw error
        result.skipped.push(`${actor.character}: native wardrobe not yet published`)
        continue
      }
      const native = rows(catalog.looks, 'looks').filter(row => !row.category && row.kind !== 'splash' && matches(row, actor.from))
      const actorSelected = selected({ id: actor.character, character: actor.from.character, unitId: actor.from.unitId }, options.only)
      if (!actorSelected && !native.some(row => selected(row, options.only))) continue
      const existing = wardrobe.members.find(row => row.speaker === actor.speaker)
      if (!existing && actor.default && !native.some(row => (row.outfit ?? row.look) === actor.default)) {
        result.skipped.push(`${actor.character}: default outfit not yet published`)
        continue
      }
      const member: CampaignWardrobe['members'][number] = existing ?? { speaker: actor.speaker, looks: {}, ...(actor.default ? { default: actor.default } : {}) }
      const memberKey = sha(Buffer.from(JSON.stringify(actor.speaker))).slice(0, 16)
      const outfits = new Set<string>()
      for (const row of native) {
        const outfit = text(row.outfit ?? row.look, 'wardrobe.outfit')
        if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(outfit) || outfits.has(outfit)) throw new Error(`${actor.character}: duplicate or invalid published outfit ${outfit}`)
        outfits.add(outfit)
        if (!actorSelected && !selected(row, options.only)) continue
        const from: Selector = { ...actor.from, [actor.from.collection === 'looks' ? 'outfit' : 'look']: outfit }
        const registered = bindings.filter(binding => matches(row, binding.from) && binding.from.collection === actor.from.collection)
        if (registered.length > 1) throw new Error(`${actor.character}/${outfit}: ambiguous destination bindings`)
        const previous = member.looks[outfit]
        const asset = registered[0]?.asset ?? previous?.asset ?? `wardrobe-${memberKey}-${outfit}`
        if (previous && previous.asset !== asset) throw new Error(`${actor.character}/${outfit}: existing native binding differs`)
        if (!registered.length) bindings.push({ asset, from })
        wardrobeAssets.add(asset)
        member.looks[outfit] = { ...previous, asset, ...(actor.labels?.[outfit] ? { label: actor.labels[outfit] } : {}) }
        const approvedBase = portraitCatalog && rows(portraitCatalog.bases, 'bases').filter(base => base.character === actor.character && base.outfit === outfit)
        if (approvedBase?.length) {
          if (approvedBase.length !== 1) throw new Error(`${actor.character}/${outfit}: duplicate portrait base`)
          const base = `portrait-${memberKey}-${outfit}`
          member.looks[outfit]!.portrait = base
          if (portraits.some(row => row.base === base)) throw new Error(`${base}: duplicate portrait destination`)
          portraits.push({ base, speaker: actor.speaker, character: actor.character, outfit })
          wardrobeAssets.add(base)
        } else {
          result.skipped.push(`${actor.character}/${outfit}: approved expression recipe not yet published`)
          if (portraitCatalog && previous?.portrait) {
            delete member.looks[outfit]!.portrait
            result.retiredPortraits ??= []
            result.retiredPortraits.push(previous.portrait)
          }
        }
      }
      if (!Object.keys(member.looks).length) { result.skipped.push(`${actor.character}: no published wardrobe`); continue }
      if (actor.default) member.default = actor.default
      if (actor.after) member.after = actor.after
      if (actor.requiresFlag) member.requiresFlag = actor.requiresFlag
      if (!existing) wardrobe.members.push(member)
      for (const route of actor.routes ?? []) {
        // A later outfit can be authored without blocking this actor's approved subset.
        if (!member.looks[route.outfit]) continue
        let scene = wardrobe.scenes.find(row => row.scene === route.scene)
        if (!scene) { scene = { scene: route.scene, context: 'ship' }; wardrobe.scenes.push(scene) }
        scene.outfits = (scene.outfits ?? []).filter(row => row.speaker !== actor.speaker).concat({ speaker: actor.speaker, look: route.outfit })
      }
    }
    result.wardrobe = wardrobe
    result.newAssets = [...wardrobeAssets]
  }

  await concurrent(bindings, async (binding) => {
    const { from } = binding
    if (from.collection === 'local') {
      if (!['all', 'general'].includes(options.event) || !selected(from as unknown as Row, options.only)) return
      const file = await realpath(resolve(options.contentRoot, binding.file!))
      const rel = relative(await realpath(options.contentRoot), file)
      if (!rel || isAbsolute(rel) || rel.startsWith('..')) throw new Error(`${binding.asset}: local art must stay inside content/`)
      const bytes = await readFile(file)
      result.images.push(await image(binding.asset, bytes, { sha256: binding.approval!.sha256 }))
      result.sourceChecks.push(async () => {
        if (sha(await readFile(file)) !== binding.approval!.sha256) throw new Error(`${binding.asset}: approved local source changed`)
      })
      return
    }
    const event = from.category ?? from.collection
    if (options.event !== 'all' && options.event !== event && !wardrobeAssets.has(binding.asset)) return
    const root = from.collection === 'enemies' ? 'enemy-art/cyberpunk/' : 'art/universes/cyberpunk/'
    let catalog: Row
    try { catalog = await index(root + 'index.json') }
    catch (error) {
      if (!options.allowMissing || !(error instanceof MissingPublishedIndex)) throw error
      result.skipped.push(`${binding.asset}: not yet published to Platform`)
      return
    }
    const found = rows(catalog.looks, 'looks').filter(row => matches(row, from) && (from.category || from.id ? true : !row.category && row.kind !== 'splash'))
    if (options.only.length && !wardrobeAssets.has(binding.asset) && !found.some(row => selected(row, options.only)) && !selected(from as unknown as Row, options.only)) return
    if (!found.length && options.allowMissing) { result.skipped.push(`${binding.asset}: not yet published to Platform`); return }
    if (found.length !== 1) throw new Error(`${binding.asset}: expected exactly one published source, found ${found.length}`)
    const row = found[0]!
    if (!selected(row, options.only) && !wardrobeAssets.has(binding.asset)) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.approvedOn))) throw new Error(`${binding.asset}: source has no dated approval`)
    if (options.currentImages?.get(binding.asset) === row.sha256) return
    result.images.push(await remoteImage(binding.asset, root, row))
  })

  if (portraits.length && (['all', 'portraits'].includes(options.event) || wardrobeAssets.size)) {
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
    await concurrent(portraits, async (binding) => {
      const identity = characters.find(row => row.id === binding.character)
      if (!selected({ id: binding.character, character: identity?.name, outfit: binding.outfit }, options.only) && !wardrobeAssets.has(binding.base)) return
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
    })
  }
  result.images.sort((a, b) => a.asset.localeCompare(b.asset))
  result.portraits.sort((a, b) => a.base.localeCompare(b.base))

  return result
}
