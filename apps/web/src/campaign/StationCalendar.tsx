import { useMemo, useState } from 'react'
import { appointmentFor, bookStationAppointment, cancelStationAppointment, stationDate, STATION_MONTHS, STATION_MODULES, STATION_ROOMS, STATION_WORK, WATCHES_PER_DAY,
  type CampaignBook, type Save, type StationAppointment } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { updateSave } from '../save/game'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { advanceStationWatches, stationOf, stationWorkers } from './watch'
import { dateAvailable } from './dates'
import { questAvailable } from './quests'

const ranges = ['Today', 'Next 7 days', 'Month'] as const
const dateLabel = (watch: number) => { const date = stationDate(watch); return `${date.month} ${date.day} · ${date.phase}` }

export default function StationCalendar({ book, save, quarters, openVisit, openCare, observance }: {
  book: CampaignBook; save: Save; quarters: () => void; openVisit: (actor: number) => void
  openCare: (quest: string, missed: boolean) => void
  observance: (scene: string, flag: string) => void
}) {
  const [range, setRange] = useState<typeof ranges[number]>('Today')
  const [actor, setActor] = useState<number>()
  const station = stationOf(save, book)
  const now = station.absoluteWatch
  const date = stationDate(now)
  const dayStart = now - now % WATCHES_PER_DAY
  const monthStart = dayStart - (date.day - 1) * WATCHES_PER_DAY
  const today = range === 'Today', week = range === 'Next 7 days'
  const start = today || week ? dayStart : monthStart
  const slots = Array.from({ length: today ? 1 : week ? 7 : 30 }, (_, index) => start + index * WATCHES_PER_DAY)
  const present = new Set(stationWorkers(save, book))
  const forecast = useMemo(() => {
    const reports = new Map<number, NonNullable<typeof station.report>>()
    if (!week) return reports
    let simulated = save
    if (station.report) reports.set(station.report.at, station.report)
    for (let at = now; at < dayStart + 7 * WATCHES_PER_DAY; at++) {
      simulated = advanceStationWatches(simulated, book, 1)
      const report = simulated.station?.report
      if (report?.at === at) reports.set(at, report)
    }
    return reports
  }, [week, save, book, now, dayStart, station.report])
  const busy = !!save.campaignDay.pending || !!save.pairScene || !!save.mission || !!save.expedition
  const bookings = station.appointments ?? []
  const available = new Set(book.dates?.filter(row => dateAvailable(save, book, row)).map(row => row.companion))
  const booked = actor === undefined ? undefined : appointmentFor(station, { actor })
  const port = save.campaignSupply?.port ?? book.supply?.start
  const annual = (book.stationStory?.observances ?? []).filter(row => date.year >= row.earliestYear).map(row => {
    const due = ((date.year - 1) * 120 + row.month * 30 + row.day - 1) * WATCHES_PER_DAY
    const flag = `calendar-${row.id}-${date.year}`
    const ready = now >= due && now <= due + row.makeupDays * WATCHES_PER_DAY + 2 && date.phase === 'Free'
      && !(row.flag && !save.story.flags.includes(row.flag)) && !save.story.flags.includes(flag)
      && port === (row.port ?? station.anchor) && (row.actor === undefined || present.has(row.actor))
    return { ...row, due, flag, ready }
  })
  function visitLabel(row: StationAppointment) {
    if ('actor' in row) {
      const crew = save.crew.find(member => member.outfit === row.actor)
      return nameOf(book.story, crew?.heroine ?? row.actor)
    }
    return book.quests.find(quest => quest.id === row.quest)?.title ?? 'Rehabilitation'
  }
  function modify(target: { actor: number } | { quest: string }, kind: 'book' | 'cancel') {
    void updateSave(s => {
      if (s.campaignDay.pending || s.pairScene || s.mission || s.expedition) return s
      const state = stationOf(s, book)
      if (kind === 'book' && 'actor' in target && !book.dates?.some(row => row.companion === target.actor && dateAvailable(s, book, row))) return s
      const next = kind === 'cancel' ? cancelStationAppointment(state, target) : bookStationAppointment(state, target)
      return next === state ? s : { ...s, station: next }
    })
  }
  return <section className="space-y-3 rounded-xl border border-cyan-200/20 bg-[#0b1727] p-3" aria-label="Captain’s Calendar">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="font-display text-xl font-bold">Captain’s Calendar</h1>
        <p className="text-sm">{dateLabel(now)} · Charter Year {date.year}</p></div>
      <button type="button" className={campaignPrimary + ' disabled:opacity-40'} disabled={busy}
        onClick={() => void updateSave(s => s.mission || s.pairScene || s.campaignDay.pending || s.expedition ? s : advanceStationWatches(s, book, 1))}>Advance watch</button>
    </header>
    <nav aria-label="Calendar range" className="flex flex-wrap gap-2">
      {ranges.map(item => <button type="button" key={item} className={campaignControl + ' aria-pressed:border-cyan-100'}
        aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}
    </nav>
    {today && <div className="grid gap-2 sm:grid-cols-2">
      <section className="space-y-1" aria-label="Shift coverage">
        <h2 className="font-semibold">Duty assignments</h2>
        {STATION_WORK.map(key => station.shifts[key] === undefined ? null : <p className="text-sm" key={key}>
          {STATION_MODULES[key].label} · {nameOf(book.story, station.shifts[key])} · {station.off.includes(key) ? 'Power paused'
            : present.has(station.shifts[key]) ? 'Ready' : 'Away'}</p>)}
        {station.report && <p className="text-sm text-cyan-100">Last duty · {station.report.workers.length} crew · +{station.report.alloy} alloy · +{station.report.data} data</p>}
      </section>
      <section className="space-y-2" aria-label="Personal appointments">
        <h2 className="font-semibold">Personal appointments</h2>
        {bookings.map(row => {
          const availableNow = 'actor' in row ? available.has(row.actor) : book.quests.some(quest => quest.id === row.quest && questAvailable(save, book, quest, port))
          return <div key={row.at} className="flex flex-wrap items-center gap-2 text-sm">
            <span>{visitLabel(row)} · {dateLabel(row.at)}{row.at < now ? ' · Ready to reschedule' : ''}</span>
            {row.at <= now && ('quest' in row || availableNow) && <button type="button" className={campaignControl} disabled={busy}
              onClick={() => 'actor' in row ? openVisit(row.actor) : openCare(row.quest, !availableNow || row.at < now)}>
              {'quest' in row ? 'Open care appointment' : 'Open visit'}</button>}
            <button type="button" className={campaignControl} disabled={busy} onClick={() => modify(row, 'book')}>Reschedule</button>
            <button type="button" className={campaignControl} disabled={busy} onClick={() => modify(row, 'cancel')}>Cancel</button>
          </div>
        })}
        <div className="flex flex-wrap gap-2">
          <select className="min-h-11 rounded bg-[#24344b] p-2" aria-label="Crew member" value={actor ?? ''}
            onChange={event => setActor(event.currentTarget.value ? Number(event.currentTarget.value) : undefined)}>
            <option value="">Choose resident</option>
            {[...available].map(key => <option value={key} key={key}>{visitLabel({ at: 0, actor: key })}</option>)}
          </select>
          <button type="button" className={campaignControl} disabled={busy || actor === undefined}
            onClick={() => { if (actor !== undefined) modify({ actor }, 'book') }}>
            {booked ? 'Reschedule' : 'Reserve next Free watch'}</button>
          <button type="button" className={campaignControl} onClick={quarters}>Quarters</button>
        </div>
      </section>
    </div>}
    {today && annual.some(row => row.ready) && <section className="space-y-1" aria-label="Observances">
      {annual.filter(row => row.ready).map(row => <button type="button" className={campaignControl} key={row.id} disabled={busy}
        onClick={() => observance(row.scene, row.flag)}>{row.label}</button>)}
    </section>}
    <ol className={'grid gap-1 ' + (today ? '' : week ? 'sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-6')}>
      {slots.map(day => {
        const calendarDay = stationDate(day)
        const projects = STATION_ROOMS.flatMap(key => {
          const left = station.rooms[key]
          return left && now + left >= day && now + left < day + WATCHES_PER_DAY ? [STATION_MODULES[key].label] : []
        })
        const appointments = bookings.filter(row => row.at >= day && row.at < day + WATCHES_PER_DAY)
        const coverage = forecast.get(day)
        return <li key={day} className={'min-h-10 rounded border border-white/15 p-2 text-xs ' + (day === dayStart ? 'bg-cyan-200/10' : '')}>
          <strong>{calendarDay.month} {calendarDay.day}</strong>
          {projects.map(label => <p key={label}>Ready · {label}</p>)}
          {appointments.map(row => <p key={row.at}>Free · {visitLabel(row)}</p>)}
          {station.move && station.move.at >= day && station.move.at < day + WATCHES_PER_DAY && <p>Homestretch arrives</p>}
          {annual.filter(row => row.due === day).map(row => <p key={row.id}>{row.label} · {STATION_MONTHS[row.month]} {row.day}</p>)}
          {coverage && <p>Duty · {coverage.workers.length} crew · +{coverage.alloy} alloy · +{coverage.data} data</p>}
        </li>
      })}
    </ol>
  </section>
}
