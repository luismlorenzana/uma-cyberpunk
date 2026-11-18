import { homeOutcome } from './campaign-pair'
import type { CampaignBook } from './story/campaign'
import type { StoryState } from './story/state'
import { sectorAppointed } from './campaign-sectors'

export interface CampaignCase {
  port: string
  title: string
  file: string
  pair?: string
  fileQuest?: string
}

export interface CampaignFinale {
  cases: CampaignCase[]
  reveal: string
  muster?: string
  approach: string
  breach: string
  ending: string
  lastWatch?: string
  preparation: { alloy: number; integrity: number }
}

export function campaignCases(book: CampaignBook, story: StoryState) {
  return book.finale?.cases.map((entry) => {
    const home = book.pairs.find((pair) => pair.home?.port === entry.port && (entry.pair === undefined || pair.id === entry.pair))?.home
    const outcome = home && homeOutcome(home, story)
    const lines = book.story.files[entry.file]?.lines ?? []
    const found = story.files[entry.file] ?? []
    const filed = lines.length > 0 && lines.every((_, index) => found.includes(index))
    const debrief = entry.fileQuest ? book.quests.find(({ id }) => id === entry.fileQuest)?.scene
      : home && outcome ? home[outcome].debrief : undefined
    return { ...entry, outcome, filed, ready: !!(debrief && filed && story.seen.includes(debrief)) }
  }) ?? []
}

export function fleetMobilized(book: CampaignBook, story: StoryState) {
  return (book.sectors ?? []).filter((sector) => sectorAppointed(book, story, sector))
}

export function briefingReady(book: CampaignBook, story: StoryState): boolean {
  const cases = campaignCases(book, story)
  return cases.length > 0 && cases.every(({ ready }) => ready)
}

export function finaleAllies(book: CampaignBook, story: StoryState): number {
  if (book.finale?.muster) return Math.min(3, fleetMobilized(book, story).length)
  return Math.min(3, campaignCases(book, story).filter(({ ready, outcome }) => ready && outcome === 'resettle').length)
}
