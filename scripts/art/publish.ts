import { CAMPAIGN_PREVIEW_INDEX, campaignReleasePath, parseCampaignBook, parseCampaignRelease,
  type CampaignRelease, type CampaignReleaseFile } from '../../packages/domain/src/story/index'
import { sha, type ImageReplacement, type ResolvedArt } from './model'
import { CAMPAIGN_PREFIX, GenerationConflict, type ArtStorage } from './storage'
import { refreshWardrobeImages } from './derivations'

const json = (bytes: Buffer): unknown => JSON.parse(bytes.toString('utf8'))
const bytesOf = (value: unknown) => Buffer.from(JSON.stringify(value))
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
  return value
}
export function gameplayFingerprint(files: Record<string, unknown>): string {
  const config = { ...files['campaign.json'] as Record<string, unknown> }
  delete config.assets; delete config.art; delete config.portraitFaces
  return sha(bytesOf(canonical({ ...files, 'campaign.json': config })))
}
export function verify(ref: CampaignReleaseFile, bytes: Buffer): void {
  if (bytes.length !== ref.bytes || sha(bytes) !== ref.sha256) throw new Error(`${ref.path}: integrity check failed`)
}
export async function loadSelected(storage: ArtStorage) {
  const pointer = await storage.read(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX)
  if (!pointer) throw new Error('No selected Cyberpunk campaign; select a reviewed campaign first')
  const release = parseCampaignRelease(json(pointer.bytes))
  const files: Record<string, unknown> = {}
  // Limit concurrent cloud reads; unchanged art remains referenced without downloading the full image library.
  let at = 0
  await Promise.all(Array.from({ length: Math.min(6, release.files.length) }, async () => {
    while (at < release.files.length) {
      const ref = release.files[at++]!
      const read = await storage.read(CAMPAIGN_PREFIX + ref.path)
      if (!read) throw new Error(`Selected campaign file missing: ${ref.path}`)
      verify(ref, read.bytes)
      files[ref.source] = json(read.bytes)
    }
  }))
  const book = parseCampaignBook(files)
  const assetRefs = new Map(release.assets.map(asset => [asset.id, asset]))
  for (const asset of book.assets) {
    const ref = assetRefs.get(asset.id)
    if (!ref || !ref.path.endsWith(asset.file.endsWith('.png') ? '.png' : '.webp')) throw new Error(`Selected asset missing or wrong format: ${asset.id}`)
  }
  return { pointer, release, files, book }
}
export type SelectedCampaign = Awaited<ReturnType<typeof loadSelected>>
export interface ArtCandidate {
  release: CampaignRelease
  payloads: Map<string, Buffer>
  changes: string[]
  skipped: string[]
}

/** The selected story/rules are immutable inputs. Only asset bytes and declared presentation fields can change. */
export function buildArtCandidate(selected: SelectedCampaign, resolved: ResolvedArt): ArtCandidate {
  const config = structuredClone(selected.files['campaign.json']) as Record<string, unknown>
  const assets = (config.assets as { id: string; file: string }[])
  const art = config.art as { scene: string; portraits: { speaker: string | number; asset: string; emote?: string; profile?: string }[] }[]
  const byAsset = new Map(selected.release.assets.map(asset => [asset.id, asset]))
  const definitions = new Map(assets.map(asset => [asset.id, asset]))
  const payloads = new Map<string, Buffer>()
  const changed = new Set<string>(), skipped = [...resolved.skipped]
  const replacementIds = new Map<string, string>()
  const install = (image: ImageReplacement, allowNew = false) => {
    const digest = sha(image.bytes)
    const priorReplacement = replacementIds.get(image.asset)
    if (priorReplacement) {
      if (priorReplacement !== digest) throw new Error(`Conflicting replacement for ${image.asset}`)
      return
    }
    replacementIds.set(image.asset, digest)
    const definition = definitions.get(image.asset)
    if (!definition && !allowNew) { skipped.push(`${image.asset}: not bound in selected campaign`); return }
    const path = `campaign/files/pack.${digest}${image.extension}`
    const previous = byAsset.get(image.asset)
    if (previous?.path === path && previous.bytes === image.bytes.length) return
    const name = image.asset + image.extension
    if (definition) definition.file = name
    else { const entry = { id: image.asset, file: name }; assets.push(entry); definitions.set(image.asset, entry) }
    byAsset.set(image.asset, { id: image.asset, path, sha256: digest, bytes: image.bytes.length })
    payloads.set(path, image.bytes)
    changed.add(image.asset)
  }
  const faceIds = new Set(resolved.portraits.flatMap(portrait => portrait.faces.map(face => face.image.asset)))
  const profiles = new Set(resolved.portraits.flatMap(portrait => portrait.profile ? [portrait.profile] : []))
  for (const image of resolved.images) if (!faceIds.has(image.asset)) {
    const existingFaces = selected.book.portraitFaces?.some(face => face.base === image.asset)
    if (existingFaces && byAsset.get(image.asset)?.sha256 !== sha(image.bytes) && !resolved.portraits.some(p => p.base === image.asset)) {
      throw new Error(`${image.asset}: replace its base and expression recipe together`)
    }
    install(image, profiles.has(image.asset))
  }
  type Face = { speaker: string | number; base: string; emote: string; asset: string; at: { x: number; y: number } }
  let faces = (config.portraitFaces ?? []) as Face[]
  for (const portrait of resolved.portraits) {
    if (!definitions.has(portrait.base)) { skipped.push(`${portrait.base}: portrait not bound`); continue }
    if (!art.some(scene => scene.portraits.some(p => p.asset === portrait.base && p.speaker === portrait.speaker && p.emote === undefined))
      && !selected.book.wardrobe?.members.some(member => member.speaker === portrait.speaker && Object.values(member.looks).some(look => look.asset === portrait.base || look.dialogue === portrait.base))) throw new Error(`${portrait.base}: not this speaker's neutral base`)
    const old = faces.filter(face => face.base === portrait.base && face.speaker === portrait.speaker)
    const next = portrait.faces.map(face => ({ speaker: portrait.speaker, base: portrait.base, emote: face.emote, asset: face.image.asset, at: face.at }))
    faces = faces.filter(face => !(face.base === portrait.base && face.speaker === portrait.speaker)).concat(next)
    for (const face of portrait.faces) install(face.image, true)
    if (JSON.stringify(old) !== JSON.stringify(next)) changed.add(`${portrait.base}:faces`)
    if (portrait.profile) for (const scene of art) for (const entry of scene.portraits) {
      if (entry.asset === portrait.base && entry.speaker === portrait.speaker && entry.emote === undefined && entry.profile !== portrait.profile) {
        entry.profile = portrait.profile
        changed.add(`${portrait.base}:profile`)
      }
    }
  }
  if (resolved.portraits.length) config.portraitFaces = faces
  const files = { ...selected.files, 'campaign.json': config }
  parseCampaignBook(files)
  if (gameplayFingerprint(files) !== gameplayFingerprint(selected.files)) throw new Error('Art candidate changed campaign gameplay or story')
  const storyBytes = bytesOf(config)
  const bookRef = { source: 'campaign.json', path: `campaign/files/pack.${sha(storyBytes)}.json`, sha256: sha(storyBytes), bytes: storyBytes.length }
  const presentationChanged = sha(bytesOf(selected.files['campaign.json'])) !== bookRef.sha256
  const fileRefs = selected.release.files.map(file => file.source === 'campaign.json' && presentationChanged ? bookRef : file)
  if (presentationChanged) payloads.set(bookRef.path, storyBytes)
  const fingerprint = sha(bytesOf({ files: fileRefs, assets: [...byAsset.values()] })).slice(0, 20)
  const release = parseCampaignRelease({ schemaVersion: 1, release: changed.size ? `art-${fingerprint}` : selected.release.release,
    files: fileRefs, assets: [...byAsset.values()] })
  return { release, payloads, changes: [...changed], skipped }
}

async function immutable(storage: ArtStorage, path: string, bytes: Buffer) {
  try { await storage.put(CAMPAIGN_PREFIX + path, bytes, '0', true) }
  catch (error) {
    if (!(error instanceof GenerationConflict)) throw error
    const previous = await storage.read(CAMPAIGN_PREFIX + path)
    if (!previous || !previous.bytes.equals(bytes)) throw new Error(`Immutable collision: ${path}`)
  }
  const remote = await storage.read(CAMPAIGN_PREFIX + path)
  if (!remote || !remote.bytes.equals(bytes)) throw new Error(`Readback failed: ${path}`)
}

export async function publishArtCandidate(storage: ArtStorage, selected: SelectedCampaign, resolved: ResolvedArt,
  options: { dryRun?: boolean; stageOnly?: boolean } = {}) {
  const candidate = buildArtCandidate(selected, await refreshWardrobeImages(selected, resolved))
  if (options.dryRun || !candidate.changes.length) return { ...candidate, promoted: false }
  for (const check of resolved.sourceChecks) await check()
  for (const [path, bytes] of candidate.payloads) await immutable(storage, path, bytes)
  const manifest = bytesOf(candidate.release)
  await immutable(storage, campaignReleasePath(candidate.release.release), manifest)
  // A new candidate retains the exact unchanged story and assets from its verified base.
  for (const file of candidate.release.files) {
    if (candidate.payloads.has(file.path)) continue
    const source = selected.release.files.find(previous => previous.path === file.path)
    if (!source || source.sha256 !== file.sha256 || source.bytes !== file.bytes) throw new Error('Art candidate changed an unrelated story file')
  }
  for (const check of resolved.sourceChecks) await check()
  const current = await storage.read(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX)
  if (!current || current.generation !== selected.pointer.generation || !current.bytes.equals(selected.pointer.bytes)) throw new GenerationConflict('Campaign selection moved; rebuild on the new release')
  if (!options.stageOnly) {
    await storage.put(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX, manifest, selected.pointer.generation)
    const readback = await storage.read(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX)
    if (!readback || !readback.bytes.equals(manifest)) throw new Error('Selection readback failed; inspect the current pointer before retrying')
  }
  return { ...candidate, promoted: !options.stageOnly }
}

/** A reviewed immutable release can be restored without rewriting saves or touching the master-data channel. */
export async function rollbackArt(storage: ArtStorage, release: string, dryRun = false) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(release)) throw new Error('Invalid rollback release')
  const current = await loadSelected(storage)
  const prior = await storage.read(CAMPAIGN_PREFIX + campaignReleasePath(release))
  if (!prior) throw new Error('Rollback release missing')
  const parsed = parseCampaignRelease(json(prior.bytes))
  if (parsed.release !== release) throw new Error('Rollback release identity mismatch')
  const files: Record<string, unknown> = {}
  for (const ref of [...parsed.files, ...parsed.assets]) {
    const object = await storage.read(CAMPAIGN_PREFIX + ref.path)
    if (!object) throw new Error(`Rollback file missing: ${ref.path}`)
    verify(ref, object.bytes)
    if ('source' in ref) files[String(ref.source)] = json(object.bytes)
  }
  parseCampaignBook(files)
  if (gameplayFingerprint(files) !== gameplayFingerprint(current.files)) throw new Error('Art selection cannot replace a different story/gameplay release')
  if (!dryRun) {
    await storage.put(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX, prior.bytes, current.pointer.generation)
    const readback = await storage.read(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX)
    if (!readback || !readback.bytes.equals(prior.bytes)) throw new Error('Selection readback failed; inspect the current pointer before retrying')
  }
  return { release, promoted: !dryRun }
}
