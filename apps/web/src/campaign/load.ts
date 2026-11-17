import {
  CAMPAIGN_PREVIEW_INDEX, parseCampaignBook, parseCampaignRelease,
  type CampaignBook, type CampaignRelease, type CampaignReleaseFile,
} from '@cyber/domain'
import { CONTENT } from '../content/client'

const decode = (data: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(data))

export interface LoadedCampaign {
  book: CampaignBook
  release: CampaignRelease
  assets: ReadonlyMap<string, CampaignReleaseFile>
}

/** The mutable index is read at entry and whenever the Captain checks for a release. Every payload is verified by hash. */
export async function loadCampaign(content: Pick<typeof CONTENT, 'pack'> = CONTENT): Promise<LoadedCampaign> {
  const release = parseCampaignRelease(decode(await content.pack(CAMPAIGN_PREVIEW_INDEX)))
  const files = await Promise.all(release.files.map(async (ref) => [ref.source, decode(await content.pack(ref.path, ref))] as const))
  const book = parseCampaignBook(Object.fromEntries(files))
  const assets = new Map(release.assets.map((asset) => [asset.id, asset]))
  for (const { id, file } of book.assets) {
    const ref = assets.get(id)
    if (!ref || !ref.path.endsWith(file.endsWith('.png') ? '.png' : '.webp')) {
      throw new Error(`campaign.json: assets: ${id} is missing or has a different format in the release`)
    }
  }
  return { book, release, assets }
}

export async function campaignImage(ref: CampaignReleaseFile): Promise<string> {
  const data = await CONTENT.pack(ref.path, ref)
  return URL.createObjectURL(new Blob([Uint8Array.from(data)], { type: ref.path.endsWith('.png') ? 'image/png' : 'image/webp' }))
}
