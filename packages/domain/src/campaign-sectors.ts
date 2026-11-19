import { campaignHomeSupport } from './campaign-pair'
import type { CampaignBook } from './story/campaign'
import type { Save } from './save/save'
import type { StoryState } from './story/state'
import type { CommandStation } from './ship/command'
import type { CampaignVisit } from './campaign-day'
import { awayMembers } from './crew/squads'

export interface CampaignSector {
  id: string
  title: string
  port: string
  officer: number
  qualification: CommandStation
  liberation: string
  appointment: string
  alloy: number
  contribution: string
  retirement?: string
  former?: { speaker: string; custody: string; released: string; aboard: string; ashore: string }
  shared?: { after: string; visit: string; morning: string }
}

function seenQuest(book: CampaignBook, story: StoryState, id: string) {
  const quest = book.quests.find((entry) => entry.id === id)
  return !!quest && story.seen.includes(quest.scene)
}

export const sectorAppointed = (book: CampaignBook, story: StoryState, sector: CampaignSector): boolean =>
  seenQuest(book, story, sector.appointment)

export function sectorRetired(book: CampaignBook, story: StoryState, sector: CampaignSector): boolean {
  return !!sector.retirement && seenQuest(book, story, sector.retirement)
}

export const fleetDutyFlag = (sector: string): string => `fleet-duty-${sector}`
export const sectorNightId = (sector: CampaignSector): string => `sector-${sector.id}`

export function sectorAssignment(book: CampaignBook, story: StoryState, sector: CampaignSector) {
  if (!sectorAppointed(book, story, sector)) return 'aboard'
  if (sectorRetired(book, story, sector)) return 'retired'
  if (book.finale?.muster && seenQuest(book, story, book.finale.muster) && !seenQuest(book, story, book.finale.ending)
    && story.flags.includes(fleetDutyFlag(sector.id))) return 'assigned'
  return 'command'
}

export function formerDisposition(book: CampaignBook, story: StoryState, sector: CampaignSector) {
  const former = sector.former
  if (!former || !seenQuest(book, story, sector.liberation)) return null
  if (story.flags.includes(former.custody)) return 'In local custody'
  if (story.flags.includes(former.aboard)) return 'Quarters aboard'
  if (story.flags.includes(former.ashore)) return 'Based ashore'
  return story.flags.includes(former.released) ? 'Released under supervision' : 'Awaiting review'
}

export function sectorVisit(book: CampaignBook, save: Save, sector: CampaignSector): Extract<CampaignVisit, { kind: 'pair-visit' }> | null {
  const { shared, former } = sector
  if (!shared || !former || save.story.seen.includes(shared.visit) || !seenQuest(book, save.story, shared.after)
    || awayMembers(save.operations, save.squads).includes(sector.officer)
    || !save.crew.some(({ outfit }) => outfit === sector.officer)) return null
  const assignment = sectorAssignment(book, save.story, sector)
  const togetherAboard = (assignment === 'aboard' || assignment === 'assigned') && save.story.flags.includes(former.aboard)
  const togetherAshore = save.campaignSupply?.port === sector.port && save.story.flags.includes(former.ashore)
    && (assignment === 'command' || assignment === 'retired')
  return togetherAboard || togetherAshore ? { kind: 'pair-visit', pair: sectorNightId(sector), scene: shared.visit, morning: shared.morning } : null
}

export function campaignSupport(book: CampaignBook, save: Pick<Save, 'story'>) {
  const support = campaignHomeSupport(book.pairs, save.story)
  for (const sector of book.sectors ?? []) {
    const assignment = sectorAssignment(book, save.story, sector)
    if (assignment === 'aboard') continue
    support.localAlloy.set(sector.port, (support.localAlloy.get(sector.port) ?? 0) + sector.alloy)
    if (assignment !== 'assigned') support.ashore.add(sector.officer)
  }
  return support
}
