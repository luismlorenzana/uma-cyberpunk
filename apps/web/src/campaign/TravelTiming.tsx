import type { CampaignBook, Save } from '@cyber/domain'
import { appointmentTitle, travelAppointmentConflicts, watchLabel } from './appointments'

export function TravelTiming({ save, book, destination, departure, arrival }: {
  save: Save; book: CampaignBook; destination: string; departure: number; arrival: number
}) {
  if (departure === arrival) return null
  const conflicts = travelAppointmentConflicts(book, save, destination, arrival)
  return <div className="space-y-1 text-sm">
    <p>Depart {watchLabel(departure)} · Arrive {watchLabel(arrival)}</p>
    {conflicts.length > 0 && <div className="rounded border border-amber-300/50 bg-amber-300/5 p-2" aria-label="Appointment conflicts">
      <p className="font-semibold text-amber-200">This trip overlaps your appointments.</p>
      <ul>{conflicts.map(row => <li key={'actor' in row ? row.actor : row.quest}>{appointmentTitle(book, save, row)} · {watchLabel(row.at)}</li>)}</ul>
    </div>}
  </div>
}
