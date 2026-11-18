import { campaignSupport, seeScene, setFlag, type CampaignBook, type CampaignDate, type DateVisit, type EffectStep, type Save } from '@cyber/domain'
import { applyBondEffect, giveRapport } from '../bonds/bonds'
import { applyStep } from '../mission/director'
import type { BondEffect } from '../story/runner'
import { questComplete } from './quests'

function cleared(save: Save, book: CampaignBook, id: string): boolean {
  const quest = book.quests.find((entry) => entry.id === id)
  return !!quest && questComplete(save, quest, book)
}

export function dateAvailable(save: Save, book: CampaignBook, date: CampaignDate): boolean {
  if (!cleared(save, book, date.after) || !save.crew.some(({ outfit }) => outfit === date.companion)) return false
  if (!campaignSupport(book, save).ashore.has(date.companion)) return true
  const sector = book.sectors?.find(({ officer }) => officer === date.companion)
  return !!sector && sector.port === (save.campaignSupply?.port ?? book.supply?.start)
}

export function dateProgress(save: Save, book: CampaignBook, date: CampaignDate) {
  const bond = save.crew.find(({ outfit }) => outfit === date.companion)!.bond
  const milestone = date.milestones.find(({ scene }) => !save.story.seen.includes(scene))
  const ready = milestone && bond.rank >= milestone.rank && (!milestone.after || cleared(save, book, milestone.after))
  return { bond, milestone, visit: ready ? milestone : date.regular }
}

/** Credits earlier campaign progress and newly completed quests using the same one-time markers. */
export function creditCampaignDates(save: Save, book: CampaignBook): Save {
  let next = save
  for (const date of book.dates ?? []) {
    if (!cleared(next, book, date.after) || !next.crew.some(({ outfit }) => outfit === date.companion)) continue
    for (const milestone of date.milestones) {
      if (!milestone.legacyFlag || !next.story.flags.includes(milestone.legacyFlag) || next.story.seen.includes(milestone.scene)) continue
      next = giveRapport({ ...next, story: seeScene(next.story, milestone.scene) }, book.story, date.companion, milestone.rapport)
    }
    for (const award of date.awards) {
      const key = `captain-rapport-${date.companion}-${award.quest}`
      if (next.story.flags.includes(key) || !cleared(next, book, award.quest)) continue
      next = giveRapport({ ...next, story: setFlag(next.story, key) }, book.story, date.companion, award.rapport)
    }
  }
  return next
}

export function dateScene(date: CampaignDate, scene: string): DateVisit | undefined {
  return [...date.milestones, date.regular].find((visit) => visit.scene === scene || visit.morning === scene)
}

export function recordDateScene(save: Save, book: CampaignBook, date: CampaignDate, scene: string,
  effects: readonly EffectStep[], bonds: readonly BondEffect[]): Save {
  if (save.story.seen.includes(scene) || !dateScene(date, scene)) return save
  const milestone = date.milestones.find((visit) => visit.scene === scene)
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  const marked = { ...next, story: seeScene(next.story, scene) }
  if (!milestone) return marked
  const rapport = giveRapport(marked, book.story, date.companion, milestone.rapport)
  return bonds.reduce((state, effect) => applyBondEffect(state, book.story, date.companion, effect), rapport)
}
