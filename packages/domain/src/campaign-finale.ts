import { homeOutcome } from './campaign-pair'
import type { CampaignBook } from './story/campaign'
import type { StoryState } from './story/state'

export interface CampaignCase {
  port: string
  title: string
  file: string
  pair?: string
}

export interface CampaignFinale {
  cases: CampaignCase[]
  reveal: string
  approach: string
  breach: string
  ending: string
  preparation: { alloy: number; integrity: number }
}

export function campaignCases(book: CampaignBook, story: StoryState) {
  return book.finale?.cases.map((entry) => {
    const home = book.pairs.find((pair) => pair.home?.port === entry.port && (entry.pair === undefined || pair.id === entry.pair))?.home
    const outcome = home && homeOutcome(home, story)
    const lines = book.story.files[entry.file]?.lines ?? []
    const found = story.files[entry.file] ?? []
    const filed = lines.length > 0 && lines.every((_, index) => found.includes(index))
    return { ...entry, outcome, filed, ready: !!(home && outcome && filed && story.seen.includes(home[outcome].debrief)) }
  }) ?? []
}

export function briefingReady(book: CampaignBook, story: StoryState): boolean {
  const cases = campaignCases(book, story)
  return cases.length > 0 && cases.every(({ ready }) => ready)
}

export function finaleAllies(book: CampaignBook, story: StoryState): number {
  return Math.min(3, campaignCases(book, story).filter(({ ready, outcome }) => ready && outcome === 'resettle').length)
}
