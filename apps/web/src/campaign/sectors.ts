import { fleetDutyFlag, sectorAssignment, setFlag, type CampaignBook, type CampaignSector, type Save } from '@cyber/domain'
import { clearCampaignPosts } from './pair'
import { questComplete } from './quests'

export function canAssignFleet(save: Save, book: CampaignBook): boolean {
  const finale = book.finale
  const muster = book.quests.find(({ id }) => id === finale?.muster)
  const approach = book.quests.find(({ id }) => id === finale?.approach)
  return !!muster && !!approach && save.campaignSupply?.port === muster.port && !save.mission && !save.pairScene && !save.campaignDay.pending
    && questComplete(save, muster, book) && !questComplete(save, approach, book)
}

export function assignFleetDuty(save: Save, book: CampaignBook, sector: CampaignSector, selected: boolean): Save {
  if (!canAssignFleet(save, book) || !save.crew.some(({ outfit }) => outfit === sector.officer)) return save
  const assignment = sectorAssignment(book, save.story, sector)
  if (assignment !== 'command' && assignment !== 'assigned') return save
  if (selected && assignment !== 'assigned' && (book.sectors ?? []).filter((row) => sectorAssignment(book, save.story, row) === 'assigned').length >= 4) return save
  const story = setFlag(save.story, fleetDutyFlag(sector.id), selected)
  if (story === save.story) return save
  const next = { ...save, story }
  return selected ? next : clearCampaignPosts(next, new Set([sector.officer]))
}
