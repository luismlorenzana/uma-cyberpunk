import { useState } from 'react'
import { appointmentFor, rehabilitationQuestIds, SECURE_WARD_BERTHS, stationRoom, type CampaignBook, type CampaignQuest, type CampaignReleaseFile, type Save } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { updateSave } from '../save/game'
import { CampaignAvatar } from './CampaignThumbnail'
import { menuPortrait } from './menu-portraits'
import { campaignControl } from './CampaignQuestRow'
import { generalPhase, questAvailable, questComplete } from './quests'
import { stationOf } from './watch'
import { careLeadAway, carePort, reserveAppointment } from './appointments'
import { stationCustody } from './station-custody'

export function StationCare({ book, save, port, open, travel, assets }: {
  book: CampaignBook; save: Save; port?: string; assets: ReadonlyMap<string, CampaignReleaseFile>; open: (quest: CampaignQuest) => void; travel: (port?: string) => void
}) {
  const [filter, setFilter] = useState('')
  const state = stationOf(save, book)
  const openWard = stationRoom(state, 'secure-ward') === 'active'
  const suite = stationRoom(state, 'rehabilitation') === 'active'
  const custody = stationCustody(save, book)
  const places = new Map(custody.map(row => [row.actor, row]))
  const overflow = custody.filter(row => 'port' in row).length
  const quests = new Map(book.quests.map(quest => [quest.id, quest]))
  const records = [...book.fourAct?.arcs.values() ?? []].flatMap(arc => {
    const phase = generalPhase(save, book, arc.outfit)
    if (!phase) return []
    const name = nameOf(book.story, arc.general)
    const next = rehabilitationQuestIds(arc).map(id => quests.get(id)).find(quest => quest && !questComplete(save, quest, book))
    return [{ name, arc, phase, next }]
  })
  const availableBeds = 1 + (openWard ? SECURE_WARD_BERTHS : 0)
  const portName = (id: string) => book.supply?.ports.find(row => row.id === id)?.name ?? 'Local port'
  function location(actor: string) {
    const place = places.get(actor)
    if (!place) return 'Residential quarters'
    return 'port' in place ? 'Guarded transfer · ' + portName(place.port)
      : place.berth === 0 ? 'Secure Intake' : 'Secure Ward · Room ' + place.berth
  }
  if (!book.fourAct) return null
  return <section className="space-y-2 rounded-xl border border-white/15 p-3" aria-label="General records">
    <h2 className="font-display text-lg font-bold">Intake and rehabilitation</h2>
    <p className="text-sm">{custody.length - overflow}/{availableBeds} secure rooms · {overflow} in guarded transfer
      {' · '}{suite ? 'Rehabilitation Suite open' : 'Core care appointments'}</p>
    {records.length === 0 ? <p className="text-sm text-slate-300">No custody records.</p> : <>
      <input type="search" className="min-h-11 rounded bg-[#24344b] p-2" aria-label="Find a General" placeholder="Find a General"
        value={filter} onChange={event => setFilter(event.currentTarget.value)} />
      {records.filter(row => row.name.toLowerCase().includes(filter.trim().toLowerCase())).map(({ arc, name, phase, next }) => {
        const available = next && questAvailable(save, book, next, next.port ?? port)
        const session = next && arc.rehabilitation?.sessions.includes(next.id)
        const appointment = session && appointmentFor(state, { quest: next.id })
        const away = session && careLeadAway(save, book, next.id)
        const venue = session ? carePort(book, save, next.id) ?? state.anchor : next?.port
        return <article key={arc.general} className="space-y-1 rounded border border-white/10 p-2">
          <div className="flex items-center gap-2">
            <CampaignAvatar asset={menuPortrait(book.wardrobe?.members.find(row => row.speaker === arc.general), assets,
              places.has(arc.general) ? ['reform-front', 'combat-station'] : ['quarters-front', 'combat-station'])} name={name} className="size-9 rounded" />
            <div><h3 className="text-sm font-semibold">{name}</h3><p className="text-xs">{phase} · {location(arc.general)}</p></div>
          </div>
          {away && <p className="text-sm text-amber-200">The lead Uma is away on assignment.</p>}
          {next && available && !away && <button type="button" className={campaignControl}
            onClick={() => venue && venue !== port ? travel(venue) : open(next)}>
            {venue && venue !== port ? 'Plot course for ' + next.title : next.title}
          </button>}
          {next && session && available && <button type="button" className={campaignControl}
            onClick={() => void updateSave(current => reserveAppointment(current, book, { quest: next.id }))}>
            {appointment ? 'Reschedule care' : 'Book next Free watch'}</button>}
        </article>
      })}
    </>}
  </section>
}
