import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { campaignPreviewIndex, campaignReleasePath, parseCampaignRelease, requireCampaignIdentity,
  type CampaignReleaseFile } from '../../packages/domain/src/story/index'
import { concurrent } from '../art/concurrent'
import { immutable, loadSelected, verify } from '../art/publish'
import { readLocalSplashRelease } from '../art/splash-bindings'
import { CAMPAIGN_PREFIX, GcsArtStorage, type ArtStorage } from '../art/storage'

const campaign = 'four-act' as const
const pointer = CAMPAIGN_PREFIX + campaignPreviewIndex(campaign)

function payloads(manifest: ReturnType<typeof parseCampaignRelease>) {
  const files = new Map<string, CampaignReleaseFile>()
  const sprites = (manifest.combatSprites ?? []).flatMap(row => [row.manifest, row.placements, ...row.pages])
  for (const ref of [...manifest.files, ...manifest.storyPages ?? [], ...manifest.assets, ...sprites]) {
    const existing = files.get(ref.path)
    if (existing && (existing.sha256 !== ref.sha256 || existing.bytes !== ref.bytes)) throw new Error(`Conflicting pins for ${ref.path}`)
    files.set(ref.path, ref)
  }
  return [...files.values()]
}

export async function stageHostedCampaign(local: ArtStorage, hosted: ArtStorage, progress?: (completed: number, total: number) => void) {
  const selected = await loadSelected(local, campaign)
  if (!selected.book.fourAct) throw new Error('The four-act release has no playable campaign')
  const refs = payloads(selected.release)
  let complete = 0
  await concurrent(refs, async ref => {
    const key = CAMPAIGN_PREFIX + ref.path
    const source = await local.read(key)
    if (!source) throw new Error(`Missing private payload ${ref.path}`)
    verify(ref, source.bytes)
    const existing = await hosted.read(key)
    if (existing) verify(ref, existing.bytes)
    else await immutable(hosted, key, source.bytes)
    if (++complete % 200 === 0) progress?.(complete, refs.length)
  }, 16)
  const target = CAMPAIGN_PREFIX + campaignReleasePath(selected.release.release, campaign)
  await immutable(hosted, target, selected.pointer.bytes)
  return { release: selected.release.release, files: refs.length }
}

/** Only a staged, verified manifest can become the starting campaign. Other game and save pointers stay independent. */
export async function selectHostedCampaign(hosted: ArtStorage, release: string, expectedCurrent: string | null) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(release)) throw new Error('Invalid hosted release ID')
  const previous = await hosted.read(pointer)
  const current = previous ? requireCampaignIdentity(parseCampaignRelease(JSON.parse(previous.bytes.toString())), campaign).release : null
  if (current === release) return { release, previous: current, selected: false }
  if (current !== expectedCurrent) throw new Error(`Four-act selection changed to ${current ?? 'empty'}`)
  const exact = await hosted.read(CAMPAIGN_PREFIX + campaignReleasePath(release, campaign))
  if (!exact) throw new Error(`Stage ${release} and verify the payloads before selecting it`)
  const manifest = requireCampaignIdentity(parseCampaignRelease(JSON.parse(exact.bytes.toString())), campaign)
  if (manifest.release !== release) throw new Error('Staged manifest ID differs from the selected release')
  await loadSelected({ ...hosted, read: path => path === pointer ? Promise.resolve(exact) : hosted.read(path) }, campaign)
  await hosted.put(pointer, exact.bytes, previous?.generation ?? '0')
  const verified = await hosted.read(pointer)
  if (!verified?.bytes.equals(exact.bytes)) throw new Error('Four-act selection readback failed')
  return { release, previous: current, selected: true }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [action, value, expected] = process.argv.slice(2)
  const result = async () => {
    const cloud = new GcsArtStorage()
    if (action === 'stage' && value && expected === undefined) {
      const root = resolve(value)
      await readFile(resolve(root, campaignPreviewIndex(campaign)))
      return stageHostedCampaign(readLocalSplashRelease(root), cloud, (done, total) => console.log(`Verified ${done}/${total} hosted payloads`))
    }
    if (action === 'select' && value && expected) return selectHostedCampaign(cloud, value, expected === 'empty' ? null : expected)
    throw new Error('Use stage <local-release-root> or select <staged-release-id> <current-id|empty>')
  }
  void result().then(out => console.log(JSON.stringify(out)), (error: Error) => { console.error(error.message); process.exitCode = 1 })
}
