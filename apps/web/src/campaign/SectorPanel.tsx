import { formerDisposition, sectorAssignment, sectorAppointed, type CampaignBook, type Save } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { assignFleetDuty, canAssignFleet } from './sectors'

export const sectorStatus = { aboard: 'Aboard', command: 'At sector command', assigned: 'On fleet assignment', retired: 'Retired' }

export function SectorPanel({ book, save }: { book: CampaignBook; save: Save }) {
  const fleet = canAssignFleet(save, book)
  const sectors = book.sectors?.filter((sector) => (fleet || sector.port === save.campaignSupply?.port) && sectorAppointed(book, save.story, sector)) ?? []
  if (!sectors.length) return null
  const assigned = sectors.filter((sector) => sectorAssignment(book, save.story, sector) === 'assigned').length
  return <section aria-label={fleet ? 'Fleet assignments' : 'Sector commands'} className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3">
    <h2 className="font-display text-lg font-bold">{fleet ? 'Fleet assignments' : 'Sector commands'}</h2>
    {fleet && <p className="text-sm">Select up to four officers for boarding · {assigned}/4</p>}
    <ul className="divide-y divide-white/15">
      {sectors.map((sector) => {
        const assignment = sectorAssignment(book, save.story, sector)
        const disposition = formerDisposition(book, save.story, sector)
        return <li key={sector.id} className="space-y-1 py-2 text-sm">
          <p className="font-semibold">{sector.title} · {nameOf(book.story, sector.officer)}</p>
          <p>{sectorStatus[assignment]} · {sector.contribution}</p>
          {disposition && sector.former && <p>{nameOf(book.story, sector.former.speaker)} · {disposition}</p>}
          {fleet && (assignment === 'command' || assignment === 'assigned') && <button type="button" className="min-h-11 rounded-lg bg-white/10 px-3 disabled:opacity-50"
            disabled={assigned >= 4 && assignment !== 'assigned'}
            onClick={() => void updateSave((current) => assignFleetDuty(current, book, sector, assignment !== 'assigned'))}>
            {assignment === 'assigned' ? 'Return to sector' : 'Assign to boarding'}
          </button>}
        </li>
      })}
    </ul>
  </section>
}
