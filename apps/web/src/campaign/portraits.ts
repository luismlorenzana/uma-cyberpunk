import type { CampaignPortraitFace, CampaignSceneArt } from '@cyber/domain'
import type { ScenePortraitImage } from '../story/ScenePortrait'

/** Read the placements for each scene's default outfit. A missing crop leaves the portrait playable. */
export function loadScenePortraits(portraits: CampaignSceneArt['portraits'], placements: readonly CampaignPortraitFace[],
  read: (asset: string) => Promise<string>): Promise<ScenePortraitImage[]> {
  return Promise.all(portraits.map(async ({ speaker, asset, emote }) => {
    if (emote !== undefined) return { speaker, url: await read(asset), emote }
    const matching = placements.filter(({ speaker: actor, base }) => actor === speaker && base === asset)
    const [url, crops] = await Promise.all([
      read(asset),
      Promise.all(matching.map(async ({ emote, asset, at }) => {
        try { return [{ emote, url: await read(asset), at }] } catch { return [] }
      })),
    ])
    const faces = crops.flat()
    return { speaker, url, ...(faces.length ? { faces } : {}) }
  }))
}
