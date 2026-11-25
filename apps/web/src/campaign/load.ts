import {
  campaignPreviewIndex, documentsInStoryPage, parseCampaignBook, parseCampaignRelease, requireCampaignIdentity,
  type CampaignBook, type CampaignIdentity, type CampaignRelease, type CampaignReleaseFile,
} from '@cyber/domain'
import { fourActLocations } from './four-act-locations'
import { CONTENT } from '../content/client'

const decode = (data: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(data))

export interface LoadedCampaign {
  book: CampaignBook
  release: CampaignRelease
  assets: ReadonlyMap<string, CampaignReleaseFile>
}

/** The mutable index is read at entry and whenever the Captain checks for a release. Every payload is verified by hash. */
export async function loadCampaign(content: Pick<typeof CONTENT, 'pack'> = CONTENT, owner?: string, identity: CampaignIdentity = 'current'): Promise<LoadedCampaign> {
  const key = { current: 'cyber-campaign-release', pilot: 'cyber-pilot-release', 'four-act': 'cyber-four-act-release' }[identity]
  const storageKey = owner ? `${key}:${owner}` : undefined
  const index = campaignPreviewIndex(identity)
  try {
    const release = requireCampaignIdentity(parseCampaignRelease(decode(await content.pack(index)), index), identity)
    const loaded = await loadRelease(content, release, identity)
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(release)) } catch { /* The current session can still play. */ }
    }
    return loaded
  } catch (error) {
    if (!storageKey || !interrupted(error)) throw error
    const saved = readCachedRelease(storageKey)
    if (!saved) throw error
    return loadRelease(content, requireCampaignIdentity(saved, identity), identity)
  }
}

function interrupted(error: unknown): boolean {
  if (error instanceof Error && 'status' in error) {
    const { status } = error
    return status === null || (typeof status === 'number' && status >= 500)
  }
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function readCachedRelease(key: string): CampaignRelease | undefined {
  try {
    const saved = localStorage.getItem(key)
    return saved ? parseCampaignRelease(JSON.parse(saved)) : undefined
  } catch {
    return undefined
  }
}

async function loadRelease(content: Pick<typeof CONTENT, 'pack'>, release: CampaignRelease, identity: CampaignIdentity): Promise<LoadedCampaign> {
  const fetchDocument = async (ref: CampaignReleaseFile) => decode(await content.pack(ref.path, ref))
  const read = async (refs: CampaignRelease['files']) => Object.fromEntries(await Promise.all(
    refs.map(async ref => [ref.source, await fetchDocument(ref)] as const)))
  const files = release.storyPages
    ? Object.assign(await read(release.files.filter(ref => ref.source === 'campaign.json')), ...await Promise.all(
      release.storyPages.map(async page => documentsInStoryPage(page, await fetchDocument(page)))))
    : await read(release.files)
  const book = parseCampaignBook(files, identity)
  const assets = new Map(release.assets.map((asset) => [asset.id, asset]))
  for (const { id, file } of book.assets) {
    const ref = assets.get(id)
    if (!ref || !ref.path.endsWith(file.endsWith('.png') ? '.png' : '.webp')) {
      throw new Error(`campaign.json: assets: ${id} is missing or has a different format in the release`)
    }
  }
  return { book: fourActLocations(book, assets), release, assets }
}

export async function campaignImage(ref: CampaignReleaseFile): Promise<string> {
  const data = await CONTENT.pack(ref.path, ref)
  return URL.createObjectURL(new Blob([Uint8Array.from(data)], { type: ref.path.endsWith('.png') ? 'image/png' : 'image/webp' }))
}
