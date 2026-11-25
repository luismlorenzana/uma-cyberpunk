import { campaignPreviewIndex, campaignReleasePath, documentsInStoryPage, parseCampaignBook, parseCampaignRelease, requireCampaignIdentity,
  type CampaignIdentity, type CampaignRelease, type CampaignReleaseFile } from '../../packages/domain/src/story/index'
import { sha, type ImageReplacement, type ResolvedArt } from './model'
import { CAMPAIGN_PREFIX, GenerationConflict, type ArtStorage } from './storage'
import { refreshWardrobeImages } from './derivations'
import { concurrent } from './concurrent'

const json = (bytes: Buffer): unknown => JSON.parse(bytes.toString('utf8'))
const bytesOf = (value: unknown) => Buffer.from(JSON.stringify(value))
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
  return value
}
export function gameplayFingerprint(files: Record<string, unknown>): string {
  const config = { ...files['campaign.json'] as Record<string, unknown> }
  delete config.assets; delete config.art; delete config.portraitFaces; delete config.wardrobe
  return sha(bytesOf(canonical({ ...files, 'campaign.json': config })))
}
export function verify(ref: CampaignReleaseFile, bytes: Buffer): void {
  if (bytes.length !== ref.bytes || sha(bytes) !== ref.sha256) throw new Error(`${ref.path}: integrity check failed`)
}
export async function loadSelected(storage: ArtStorage, campaign: CampaignIdentity = 'current') {
  const pointer = await storage.read(CAMPAIGN_PREFIX + campaignPreviewIndex(campaign))
  if (!pointer) throw new Error('No selected Cyberpunk campaign; select a reviewed campaign first')
  const release = requireCampaignIdentity(parseCampaignRelease(json(pointer.bytes)), campaign)
  const files: Record<string, unknown> = {}
  const read = async (ref: CampaignReleaseFile) => {
    const payload = await storage.read(CAMPAIGN_PREFIX + ref.path)
    if (!payload) throw new Error(`Selected campaign file missing: ${ref.path}`)
    verify(ref, payload.bytes)
    return json(payload.bytes)
  }
  const originals = new Map(release.files.map(ref => [ref.source, ref]))
  if (release.storyPages) {
    await concurrent(release.storyPages, async page => {
      for (const [source, value] of Object.entries(documentsInStoryPage(page, await read(page)))) {
        verify(originals.get(source)!, bytesOf(value))
        files[source] = value
      }
    })
    files['campaign.json'] = await read(originals.get('campaign.json')!)
  } else {
    await concurrent(release.files, async ref => { files[ref.source] = await read(ref) })
  }
  const book = parseCampaignBook(files, campaign)
  const assetRefs = new Map(release.assets.map(asset => [asset.id, asset]))
  for (const asset of book.assets) {
    const ref = assetRefs.get(asset.id)
    if (!ref || !ref.path.endsWith(asset.file.endsWith('.png') ? '.png' : '.webp')) throw new Error(`Selected asset missing or wrong format: ${asset.id}`)
  }
  return { campaign, pointer, release, files, book }
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
  if (resolved.wardrobe) config.wardrobe = resolved.wardrobe
  const assets = (config.assets as { id: string; file: string }[])
  const art = config.art as { scene: string; backdrop?: string; portraits: { speaker: string | number; asset: string; emote?: string; profile?: string }[];
    backdropCues?: { at: string; asset: string; location?: string }[]; composition?: unknown }[]
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
    install(image, profiles.has(image.asset) || resolved.newAssets?.includes(image.asset))
  }
  for (const { scene, asset, replaces } of resolved.sceneBackdrops ?? []) {
    const entry = art.find(row => row.scene === scene)
    if (!entry || entry.composition || entry.backdropCues?.length || !definitions.has(asset) || (entry.backdrop !== replaces && entry.backdrop !== asset)) {
      throw new Error(`${scene}: backdrop destination no longer matches its reviewed scene`)
    }
    entry.backdrop = asset
  }
  for (const { scene, speaker, asset } of resolved.scenePortraits ?? []) {
    const cast = selected.book.scenes.get(scene)?.cast
    if (!definitions.has(asset) || !cast?.some(row => (row.outfit ?? row.heroine ?? row.minor) === speaker)) {
      throw new Error(`${scene}: portrait requires a matching cast member and approved image`)
    }
    let entry = art.find(row => row.scene === scene)
    if (!entry) { entry = { scene, portraits: [] }; art.push(entry) }
    const previous = entry.portraits.find(row => row.speaker === speaker && row.emote === undefined)
    if (previous && previous.asset !== asset) throw new Error(`${scene}: portrait would replace an existing pose`)
    if (!previous) entry.portraits.push({ speaker, asset })
  }
  for (const splash of resolved.sceneSplashes ?? []) {
    let entry = art.find(row => row.scene === splash.scene)
    if (!entry) { entry = { scene: splash.scene, portraits: [] }; art.push(entry) }
    if (splash.at) {
      const cues = entry.backdropCues ??= []
      if (!cues.some(cue => cue.at === splash.at)) cues.push({ at: splash.at, asset: splash.asset })
    } else {
      entry.composition = { width: splash.width, height: splash.height, portraits: splash.portraits,
        layers: [{ asset: splash.asset, x: 0, y: 0, width: splash.width, height: splash.height }] }
    }
  }
  type Face = { speaker: string | number; base: string; emote: string; asset: string; at: { x: number; y: number } }
  let faces = ((config.portraitFaces ?? []) as Face[]).filter(face => !resolved.retiredPortraits?.includes(face.base))
  for (const portrait of resolved.portraits) {
    if (!definitions.has(portrait.base)) { skipped.push(`${portrait.base}: portrait not bound`); continue }
    if (!art.some(scene => scene.portraits.some(p => p.asset === portrait.base && p.speaker === portrait.speaker && p.emote === undefined))
      && !(resolved.wardrobe ?? selected.book.wardrobe)?.members.some(member => member.speaker === portrait.speaker && Object.values(member.looks).some(look => look.asset === portrait.base || look.dialogue === portrait.base || look.portrait === portrait.base))) throw new Error(`${portrait.base}: not this speaker's neutral base`)
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
  if (resolved.portraits.length || resolved.retiredPortraits?.length) config.portraitFaces = faces
  if (JSON.stringify(canonical(selected.files['campaign.json'])) !== JSON.stringify(canonical(config))) changed.add('campaign:presentation')
  const files = { ...selected.files, 'campaign.json': config }
  parseCampaignBook(files, selected.campaign)
  if (gameplayFingerprint(files) !== gameplayFingerprint(selected.files)) throw new Error('Art candidate changed campaign gameplay or story')
  if (!changed.size) return { release: selected.release, payloads: new Map(), changes: [], skipped }
  const storyBytes = bytesOf(config)
  const bookRef = { source: 'campaign.json', path: `campaign/files/pack.${sha(storyBytes)}.json`, sha256: sha(storyBytes), bytes: storyBytes.length }
  const presentationChanged = sha(bytesOf(selected.files['campaign.json'])) !== bookRef.sha256
  const fileRefs = selected.release.files.map(file => file.source === 'campaign.json' && presentationChanged ? bookRef : file)
  if (presentationChanged) payloads.set(bookRef.path, storyBytes)
  const fingerprint = sha(bytesOf({ files: fileRefs, assets: [...byAsset.values()], combatSprites: selected.release.combatSprites })).slice(0, 20)
  const release = parseCampaignRelease({ ...selected.release, release: changed.size ? `art-${fingerprint}` : selected.release.release,
    files: fileRefs, assets: [...byAsset.values()] })
  return { release, payloads, changes: [...changed], skipped }
}

export async function immutable(storage: ArtStorage, path: string, bytes: Buffer) {
  try { await storage.put(path, bytes, '0', true) }
  catch (error) {
    if (!(error instanceof GenerationConflict)) throw error
  }
  const remote = await storage.read(path)
  if (!remote || !remote.bytes.equals(bytes)) throw new Error(`Readback failed: ${path}`)
}

export async function publishArtCandidate(storage: ArtStorage, selected: SelectedCampaign, resolved: ResolvedArt,
  options: { dryRun?: boolean; stageOnly?: boolean } = {}) {
  const candidate = buildArtCandidate(selected, await refreshWardrobeImages(selected, resolved))
  if (options.dryRun || !candidate.changes.length) return { ...candidate, promoted: false }
  for (const check of resolved.sourceChecks) await check()
  await concurrent([...candidate.payloads], async ([path, bytes]) => { await immutable(storage, CAMPAIGN_PREFIX + path, bytes) })
  const manifest = bytesOf(candidate.release)
  await immutable(storage, CAMPAIGN_PREFIX + campaignReleasePath(candidate.release.release, selected.campaign), manifest)
  // A new candidate retains the exact unchanged story and assets from its verified base.
  for (const file of candidate.release.files) {
    if (candidate.payloads.has(file.path)) continue
    const source = selected.release.files.find(previous => previous.path === file.path)
    if (!source || source.sha256 !== file.sha256 || source.bytes !== file.bytes) throw new Error('Art candidate changed an unrelated story file')
  }
  for (const check of resolved.sourceChecks) await check()
  const selection = CAMPAIGN_PREFIX + campaignPreviewIndex(selected.campaign)
  const current = await storage.read(selection)
  if (!current || current.generation !== selected.pointer.generation || !current.bytes.equals(selected.pointer.bytes)) throw new GenerationConflict('Campaign selection moved; rebuild on the new release')
  if (!options.stageOnly) {
    await storage.put(selection, manifest, selected.pointer.generation)
    const readback = await storage.read(selection)
    if (!readback || !readback.bytes.equals(manifest)) throw new Error('Selection readback failed; inspect the current pointer before retrying')
  }
  return { ...candidate, promoted: !options.stageOnly }
}

/** A reviewed immutable release can be restored without rewriting saves or touching the master-data channel. */
export async function rollbackArt(storage: ArtStorage, release: string, dryRun = false, campaign: CampaignIdentity = 'current') {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(release)) throw new Error('Invalid rollback release')
  const current = await loadSelected(storage, campaign)
  const selection = CAMPAIGN_PREFIX + campaignPreviewIndex(campaign)
  const prior = await storage.read(CAMPAIGN_PREFIX + campaignReleasePath(release, campaign))
  if (!prior) throw new Error('Rollback release missing')
  const parsed = requireCampaignIdentity(parseCampaignRelease(json(prior.bytes)), campaign)
  if (parsed.release !== release) throw new Error('Rollback release identity mismatch')
  const files: Record<string, unknown> = {}
  const combat = (parsed.combatSprites ?? []).flatMap(row => [row.manifest, row.placements, ...row.pages])
  for (const ref of [...parsed.files, ...parsed.storyPages ?? [], ...parsed.assets, ...combat]) {
    const object = await storage.read(CAMPAIGN_PREFIX + ref.path)
    if (!object) throw new Error(`Rollback file missing: ${ref.path}`)
    verify(ref, object.bytes)
    if ('source' in ref) files[String(ref.source)] = json(object.bytes)
  }
  parseCampaignBook(files, campaign)
  if (gameplayFingerprint(files) !== gameplayFingerprint(current.files)) throw new Error('Art selection cannot replace a different story/gameplay release')
  if (!dryRun) {
    await storage.put(selection, prior.bytes, current.pointer.generation)
    const readback = await storage.read(selection)
    if (!readback || !readback.bytes.equals(prior.bytes)) throw new Error('Selection readback failed; inspect the current pointer before retrying')
  }
  return { release, promoted: !dryRun }
}
