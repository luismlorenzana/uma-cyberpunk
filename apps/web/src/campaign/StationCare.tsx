import { useState } from 'react'
import { appointmentFor, bookStationAppointment, rehabilitationQuestIds, stationRoom, type CampaignBook, type CampaignQuest, type Save } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { updateSave } from '../save/game'
import { campaignControl } from './CampaignQuestRow'
import { generalPhase, questAvailable, questComplete } from './quests'
import { stationOf } from './watch'

export function StationCare({ book, save, port, open, travel }: {
  book: CampaignBook; save: Save; port?: string; open: (quest: CampaignQuest) => void; travel: (port?: string) => void
}) {
  const [filter, setFilter] = useState('')
  const state = stationOf(save, book)
  const ward = stationRoom(state, 'secure-ward') === 'active'
  const suite = stationRoom(state, 'rehabilitation') === 'active'
  const custodyOrder = new Map(save.story.seen.map((scene, index) => [scene, index]))
  const quests = new Map(book.quests.map(quest => [quest.id, quest]))
  const records = [...book.fourAct?.arcs.values() ?? []].flatMap(arc => {
    const phase = generalPhase(save, book, arc.outfit)
    if (!phase) return []
    const name = nameOf(book.story, arc.general)
    const inCare = phase === 'In custody' || phase === 'Rehabilitation'
    const custody = arc.capture && quests.get(arc.capture.custody)
    const order = custody ? custodyOrder.get(custody.scene) ?? custodyOrder.get(custody.sceneWhen?.scene ?? '') : undefined
    const next = rehabilitationQuestIds(arc).map(id => quests.get(id)).find(quest => quest && !questComplete(save, quest, book))
    return [{ name, arc, phase, inCare, order: order ?? Infinity, next }]
  }).sort((a, b) => a.order - b.order)
  const held = records.filter(row => row.inCare)
  const availableBeds = ward ? 13 : 1
  const placements = new Map(held.map((row, index) => [row.arc.general, index === 0 ? 'Secure Intake'
    : index < availableBeds ? `Secure Ward · Room ${index}` : 'Guarded transfer']))
  if (!book.fourAct) return null
  return <section className="space-y-2 rounded-xl border border-white/15 p-3" aria-label="General records">
    <h2 className="font-display text-lg font-bold">Intake and rehabilitation</h2>
    <p className="text-sm">{Math.min(held.length, availableBeds)}/{availableBeds} secure rooms · {Math.max(0, held.length - availableBeds)} in guarded transfer
      {' · '}{suite ? 'Rehabilitation Suite open' : 'Core care appointments'}</p>
    {records.length === 0 ? <p className="text-sm text-slate-300">No custody records.</p> : <>
      <input type="search" className="min-h-11 rounded bg-[#24344b] p-2" aria-label="Find a General" placeholder="Find a General"
        value={filter} onChange={event => setFilter(event.currentTarget.value)} />
      {records.filter(row => row.name.toLowerCase().includes(filter.trim().toLowerCase())).map(({ arc, name, phase, next }) => {
        const available = next && questAvailable(save, book, next, next.port ?? port)
        const session = next && arc.rehabilitation?.sessions.includes(next.id)
        const appointment = session && appointmentFor(state, { quest: next.id })
        return <article key={arc.general} className="space-y-1 rounded border border-white/10 p-2">
          <h3 className="text-sm font-semibold">{name}</h3>
          <p className="text-xs">{phase} · {placements.get(arc.general) ?? 'Residential quarters'}</p>
          {next && available && <button type="button" className={campaignControl}
            onClick={() => next.port && next.port !== port ? travel(next.port) : open(next)}>
            {next.port && next.port !== port ? 'Plot course for ' + next.title : next.title}
          </button>}
          {next && session && available && <button type="button" className={campaignControl}
            onClick={() => void updateSave(current => {
              if (current.mission || current.expedition || current.pairScene || current.campaignDay.pending
                || !questAvailable(current, book, next, next.port ?? current.campaignSupply?.port)) return current
              return { ...current, station: bookStationAppointment(stationOf(current, book), { quest: next.id }) }
            })}>{appointment ? 'Reschedule care' : 'Book next Free watch'}</button>}
        </article>
      })}
    </>}
  </section>
}
