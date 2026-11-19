import type { CampaignPortraitFace, CampaignSceneArt } from '@cyber/domain'
import type { ScenePortraitImage } from '../story/ScenePortrait'

/** Read the placements for each scene's default outfit. A missing crop leaves the portrait playable. */
export function loadScenePortraits(portraits: CampaignSceneArt['portraits'], placements: readonly CampaignPortraitFace[],
  read: (asset: string) => Promise<string>, fallbacks: (speaker: string | number, asset: string) => readonly string[] = () => []): Promise<ScenePortraitImage[]> {
  return Promise.all(portraits.map(async ({ speaker, asset, emote }) => {
    let url: string
    try { url = await read(asset) } catch {
      for (const fallback of fallbacks(speaker, asset)) {
        try { return [{ speaker, url: await read(fallback), ...(emote === undefined ? {} : { emote }) }] } catch { /* Try the next known neutral. */ }
      }
      return []
    }
    if (emote !== undefined) return [{ speaker, url, emote }]
    const matching = placements.filter(({ speaker: actor, base }) => actor === speaker && base === asset)
    const crops = await Promise.all(matching.map(async ({ emote, asset, at }) => {
        try { return [{ emote, url: await read(asset), at }] } catch { return [] }
      }))
    const faces = crops.flat()
    return [{ speaker, url, ...(faces.length ? { faces } : {}) }]
  })).then(rows => rows.flat())
}
