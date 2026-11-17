import { fillFile, pairProgress, seeScene, type CampaignBook, type CampaignPair, type EffectStep, type Save } from '@cyber/domain'
import { applyStep } from '../mission/director'

export function pairAvailable(save: Save, book: CampaignBook, pair: CampaignPair): boolean {
  const after = book.quests.find((quest) => quest.id === pair.after)
  return !!after && save.story.flags.includes(pair.capture) && save.story.seen.includes(after.scene)
    && (!after.encounter || save.worlds.missions.includes(after.encounter))
    && save.crew.some(({ outfit }) => outfit === pair.members[0].outfit)
}

export function openPairScene(save: Save, book: CampaignBook, pair: CampaignPair, scene: string): Save {
  if (save.pairScene || save.campaignDay.pending || save.mission || !pairAvailable(save, book, pair) || pairProgress(pair, save.story).next !== scene) return save
  return { ...save, pairScene: { pair: pair.id, scene } }
}

/** Finishing a pair scene commits any choices and its milestone together. Returning to a room still uses the night clock. */
export function recordPairScene(save: Save, book: CampaignBook, pair: CampaignPair, scene: string, effects: readonly EffectStep[]): Save {
  if (save.story.seen.includes(scene)) return save
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  let story = seeScene(next.story, scene)
  if (scene === pair.recovery[1]) {
    book.story.files[pair.testimony]?.lines.forEach((_, index) => { story = fillFile(story, pair.testimony, index) })
  }
  return { ...next, story }
}

export function closePairScene(save: Save, book: CampaignBook, pair: CampaignPair, scene: string, effects: readonly EffectStep[]): Save {
  if (save.pairScene?.pair !== pair.id || save.pairScene.scene !== scene || pairProgress(pair, save.story).next !== scene) return save
  return { ...recordPairScene(save, book, pair, scene, effects), pairScene: null }
}
