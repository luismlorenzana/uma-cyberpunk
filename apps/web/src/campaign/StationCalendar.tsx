import { useMemo, useState } from 'react'
import { appointmentFor, cancelStationAppointment, stationDate, stationRoom, STATION_MONTHS, STATION_MODULES, STATION_ROOMS, STATION_WORK, WATCHES_PER_DAY,
  type CampaignBook, type Save, type StationAppointmentTarget, type StationModule } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { updateSave } from '../save/game'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { advanceStationWatches, cutterRations, stationOf, stationRations, stationWorkers } from './watch'
import { dateEligible } from './dates'
import { appointmentStatus, appointmentTitle, reserveAppointment, watchLabel } from './appointments'

const ranges = ['Today', 'Next 7 days', 'Month'] as const
const statusText = {
  completed: 'Completed', future: 'Reserved', missed: 'Missed', travel: 'At another port', ready: 'Ready', unavailable: 'Crew unavailable',
}

export default function StationCalendar({ book, save, quarters, openVisit, openCare, travel, room, observance }: {
  book: CampaignBook; save: Save; quarters: () => void; openVisit: (actor: number) => void
  openCare: (quest: string, missed: boolean) => void
  travel: (port: string) => void
  room: (module: StationModule) => void
  observance: (scene: string, flag: string) => void
}) {
  const [range, setRange] = useState<typeof ranges[number]>('Today')
  const [displayMonth, setDisplayMonth] = useState<number>()
  const [actor, setActor] = useState<number>()
  const station = stationOf(save, book)
  const now = station.absoluteWatch
  const date = stationDate(now)
  const dayStart = now - now % WATCHES_PER_DAY
  const monthStart = dayStart - (date.day - 1) * WATCHES_PER_DAY
  const today = range === 'Today', week = range === 'Next 7 days'
  const shownMonth = displayMonth ?? monthStart
  const start = today || week ? dayStart : shownMonth
  const period = stationDate(start)
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
  const available = new Set(book.dates?.filter(row => dateEligible(save, book, row)).map(row => row.companion))
  const booked = actor === undefined ? undefined : appointmentFor(station, { actor })
  const port = save.campaignSupply?.port ?? book.supply?.start
  const visibleYears = new Set([date.year - 1, date.year, period.year, stationDate(slots.at(-1) ?? start).year])
  const annual = [...visibleYears].flatMap(year => (book.stationStory?.observances ?? []).filter(row =>
    year >= row.earliestYear).map(row => {
    const due = ((year - 1) * 120 + row.month * 30 + row.day - 1) * WATCHES_PER_DAY
    const flag = `calendar-${row.id}-${year}`
    const ready = now >= due && now <= due + row.makeupDays * WATCHES_PER_DAY + 2 && date.phase === 'Free'
      && !(row.flag && !save.story.flags.includes(row.flag)) && !save.story.flags.includes(flag)
      && port === (row.port ?? station.anchor) && (row.actor === undefined || present.has(row.actor))
    return { ...row, due, flag, ready }
  }))
  function modify(target: StationAppointmentTarget, kind: 'book' | 'cancel') {
    void updateSave(s => {
      if (kind === 'book') return reserveAppointment(s, book, target)
      if (s.campaignDay.pending || s.pairScene || s.mission || s.expedition) return s
      const state = stationOf(s, book)
      const next = cancelStationAppointment(state, target)
      return next === state ? s : { ...s, station: next }
    })
  }
  return <section className="space-y-3 rounded-xl border border-cyan-200/20 bg-[#0b1727] p-3" aria-label="Captain’s Calendar">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="font-display text-xl font-bold">Captain’s Calendar</h1>
        <p className="text-sm">{watchLabel(now)} · Charter Year {date.year}</p>
        {book.stationStory && <p className="text-sm">Dawn rations · Homestretch {stationRations(save, book)} · Cutter {cutterRations(save, book)}</p>}</div>
      <button type="button" className={campaignPrimary + ' disabled:opacity-40'} disabled={busy}
        onClick={() => void updateSave(s => s.mission || s.pairScene || s.campaignDay.pending || s.expedition ? s : advanceStationWatches(s, book, 1))}>Advance watch</button>
    </header>
    <nav aria-label="Calendar range" className="flex flex-wrap gap-2">
      {ranges.map(item => <button type="button" key={item} className={campaignControl + ' aria-pressed:border-cyan-100'}
        aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}
    </nav>
    {!today && !week && <div className="flex flex-wrap items-center gap-2" aria-label="Month navigation">
      <button type="button" className={campaignControl} disabled={!shownMonth}
        onClick={() => setDisplayMonth(shownMonth - 30 * WATCHES_PER_DAY)}>Previous month</button>
      <strong className="text-sm">{period.month} · Charter Year {period.year}</strong>
      <button type="button" className={campaignControl}
        onClick={() => setDisplayMonth(shownMonth + 30 * WATCHES_PER_DAY)}>Next month</button>
      {shownMonth !== monthStart && <button type="button" className={campaignControl}
        onClick={() => setDisplayMonth(undefined)}>Current month</button>}
    </div>}
    {today && <div className="grid gap-2 sm:grid-cols-2">
      <section className="space-y-1" aria-label="Shift coverage">
        <h2 className="font-semibold">Duty assignments</h2>
        {STATION_WORK.map(key => {
          const assigned = station.shifts[key]
          const status = stationRoom(station, key)
          if (status === 'empty') return null
          const coverage = status === 'building' ? 'Building' : status === 'off' ? 'Power paused'
            : assigned === undefined ? station.autoStaff ? 'Automatic cover' : 'Unassigned'
              : present.has(assigned) ? 'Ready' : 'Crew unavailable'
          return <button key={key} type="button" className={campaignControl + ' mr-1 mb-1'} onClick={() => room(key)}>
            {STATION_MODULES[key].label} · {assigned === undefined ? '' : nameOf(book.story, assigned) + ' · '}{coverage}
          </button>
        })}
        {station.report && <p className="text-sm text-cyan-100">Last duty · {station.report.workers.length} crew · +{station.report.alloy} alloy · +{station.report.data} data
          {!!station.report.provisions && ` · +${station.report.provisions} provisions`}
          {!!station.report.supported && ` · ${station.report.supported} supported by last night’s visits`}</p>}
      </section>
      <section className="space-y-2" aria-label="Personal appointments">
        <h2 className="font-semibold">Personal appointments</h2>
        {bookings.map(row => {
          const { venue, state } = appointmentStatus(book, save, row)
          const next = book.supply?.ports.find(port => port.id === venue)
          return <div key={'actor' in row ? row.actor : row.quest} className="flex flex-wrap items-center gap-2 text-sm">
            <span>{appointmentTitle(book, save, row)} · {watchLabel(row.at)} · {next?.name ?? venue} · {statusText[state]}</span>
            {(state === 'ready' || (state === 'missed' && 'quest' in row)) &&
              <button type="button" className={campaignControl} disabled={busy}
                onClick={() => 'actor' in row ? openVisit(row.actor) : openCare(row.quest, state === 'missed')}>
                {'quest' in row ? 'Open care appointment' : 'Open visit'}</button>}
            {port !== venue && state !== 'completed' && <button type="button" className={campaignControl} disabled={busy}
              onClick={() => travel(venue)}>Plot course</button>}
            {state !== 'completed' && <button type="button" className={campaignControl} disabled={busy}
              onClick={() => modify(row, 'book')}>Reschedule</button>}
            <button type="button" className={campaignControl} disabled={busy} onClick={() => modify(row, 'cancel')}>{state === 'completed' ? 'Dismiss' : 'Cancel'}</button>
          </div>
        })}
        <div className="flex flex-wrap gap-2">
          <select className="min-h-11 rounded bg-[#24344b] p-2" aria-label="Crew member" value={actor ?? ''}
            onChange={event => setActor(event.currentTarget.value ? Number(event.currentTarget.value) : undefined)}>
            <option value="">Choose resident</option>
            {[...available].map(key => <option value={key} key={key}>{appointmentTitle(book, save, { at: 0, actor: key })}</option>)}
          </select>
          <button type="button" className={campaignControl} disabled={busy || actor === undefined}
            onClick={() => { if (actor !== undefined) modify({ actor }, 'book') }}>
            {booked ? 'Reschedule' : 'Reserve next Night'}</button>
          <button type="button" className={campaignControl} onClick={quarters}>Quarters</button>
        </div>
      </section>
    </div>}
    {today && annual.some(row => row.ready) && <section className="space-y-1" aria-label="Observances">
      {annual.filter(row => row.ready).map(row => <button type="button" className={campaignControl} key={row.flag} disabled={busy}
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
        const hulls = stationRoom(station, 'shipyard') === 'active' ? Object.values(save.fleet ?? {}).filter(hull =>
          hull.condition === 'commissioning' && hull.watches !== undefined && now + hull.watches >= day
          && now + hull.watches < day + WATCHES_PER_DAY) : []
        return <li key={day} className={'min-h-10 rounded border border-white/15 p-2 text-xs ' + (day === dayStart ? 'bg-cyan-200/10' : '')}>
          <strong>{calendarDay.month} {calendarDay.day}</strong>
          {projects.map(label => <p key={label}>Ready · {label}</p>)}
          {hulls.length > 0 && <p>Shipyard · {hulls.length} ready</p>}
          {appointments.map(row => <p key={'actor' in row ? row.actor : row.quest}>{'actor' in row ? 'Night' : 'Free'} · {appointmentTitle(book, save, row)}</p>)}
          {station.deliveries?.filter(order => Math.max(order.at, now) >= day &&
            Math.max(order.at, now) < day + WATCHES_PER_DAY).map((order, index) => <p key={index}>
            {order.at <= now ? 'Waiting for storage' : 'Delivery'} · {order.amount} {order.kind}
          </p>)}
          {station.move && station.move.at >= day && station.move.at < day + WATCHES_PER_DAY && <p>Homestretch arrives</p>}
          {annual.filter(row => row.due === day).map(row => <p key={row.flag}>{row.label} · {STATION_MONTHS[row.month]} {row.day}</p>)}
          {coverage && <p>Duty · {coverage.workers.length} crew · +{coverage.alloy} alloy · +{coverage.data} data
            {!!coverage.provisions && ` · +${coverage.provisions} provisions`}</p>}
        </li>
      })}
    </ol>
  </section>
}
