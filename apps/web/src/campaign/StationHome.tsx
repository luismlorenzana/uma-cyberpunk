import { useMemo, useRef, type Dispatch, type SetStateAction, type PointerEvent } from 'react'
import {
  assignStationShift, buildStationRoom, cancelStationRoom, rerouteStationPower, setStationPower, stationCapacity, stationDate, stationPower, stationPowerDonors, stationPowerShortfall, stationRoom,
  STARTER_CUTTER, STATION_DECKS, STATION_MODULES, STATION_ROOMS, STATION_WORK, TEMPORARY_BERTHS,
  type CampaignBook, type Save, type StationModule,
} from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { watchLabel } from './appointments'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { stationBuildForecast } from './station-forecast'
import { advanceStationWatches, stationOf, stationRations, stationResidentCount, stationWorkers } from './watch'
import type { HomeArea } from './ShipHome'

const destinations: Partial<Record<StationModule, HomeArea>> = {
  bridge: 'Bridge', quarters: 'Quarters', reactor: 'Engineering', cargo: 'Cargo', cutter: 'Hangar',
  'habitat-a': 'Quarters', 'habitat-b': 'Quarters', fabrication: 'Hangar', 'reactor-bank': 'Engineering',
  'life-support': 'Cargo', 'jump-ring': 'Navigation', 'secure-ward': 'Quarters', rehabilitation: 'Quarters',
  shipyard: 'Hangar', infirmary: 'Quarters',
}
const condition = { active: 'Operational', off: 'Power paused', building: 'Building', empty: 'Empty socket' }
const socket = {
  active: 'border-cyan-200/70 bg-cyan-300/30', off: 'border-rose-200/60 bg-rose-300/20',
  building: 'border-amber-200/60 bg-amber-300/25', empty: 'border-dashed border-slate-500',
}
const deckPosition = {
  Command: 'col-start-2 row-start-1', Habitation: 'col-start-1 row-start-2',
  Engineering: 'col-start-3 row-start-2', Flight: 'col-start-2 row-start-3',
}
const unavailable = (save: Save) => !!(save.mission || save.campaignDay.pending || save.pairScene || save.expedition)

type StationFocus = { deck?: typeof STATION_DECKS[number]; room?: StationModule; zoom: number }

export default function StationHome({ book, save, open, recruit, calendar, returnHome, relocation, focus, onFocus }: {
  focus: StationFocus; onFocus: Dispatch<SetStateAction<StationFocus>>
  book: CampaignBook; save: Save; open: (area: HomeArea) => void
  recruit: () => void; calendar: () => void; returnHome: () => void
  relocation: (delayed: boolean) => void
}) {
  const { deck, room, zoom } = focus
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef(0)
  const gestureDistance = useRef(0)
  const scroll = useRef<HTMLDivElement>(null)
  const state = stationOf(save, book)
  const date = stationDate(state.absoluteWatch)
  const anchor = book.supply?.ports.find(port => port.id === state.anchor)
  const port = save.campaignSupply?.port ?? anchor?.id
  const power = stationPower(state)
  const capacity = stationCapacity(state)
  const current = room ? STATION_MODULES[room] : undefined
  const status = room ? stationRoom(state, room) : undefined
  const buildForecast = useMemo(() => room && stationBuildForecast(save, book, room), [book, room, save])
  const shortfall = room && status === 'off' ? stationPowerShortfall(state, room) : 0
  const protectedJump = room === 'jump-ring' && state.move
  const duty = room && STATION_WORK.find(key => key === room)
  const assigned = duty ? state.shifts[duty] : undefined
  const available = stationWorkers(save, book)
  const route = room && destinations[room]
  const building = Object.values(state.rooms).filter(left => left > 0).length
  const missingHabitatA = room === 'habitat-b' && stationRoom(state, 'habitat-a') !== 'active'
  const settlement = book.fourAct?.systems.get('nacre')?.capital?.settlement
  const recognized = settlement && book.quests.find(quest => quest.id === settlement)
  const mayRelocate = !!recognized && save.story.seen.includes(recognized.scene) && state.anchor !== 'orla'
    && book.supply?.ports.some(row => row.id === 'orla')
  function adjust(change: number) {
    onFocus(current => ({ ...current, zoom: Math.max(1, Math.min(2, current.zoom + change)) }))
  }
  function handlePointer(event: PointerEvent<HTMLDivElement>) {
    const prior = pointers.current.get(event.pointerId)
    const viewport = scroll.current
    if (!prior || !viewport) return
    const dx = prior.x - event.clientX
    const dy = prior.y - event.clientY
    gestureDistance.current += Math.hypot(dx, dy)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b) return
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current) adjust((distance - pinch.current) / 140)
      pinch.current = distance
    } else if (gestureDistance.current > 6) {
      viewport.scrollLeft += dx
      viewport.scrollTop += dy
    }
  }
  return <section className="space-y-3 rounded-xl border border-cyan-200/25 bg-[#0b1727] p-3" aria-label="Homestretch station" data-station-home>
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div><h1 className="font-display text-2xl font-bold">Homestretch</h1>
        <p className="text-sm text-cyan-100">Anchor · {anchor?.name ?? state.anchor}</p>
        <p className="text-sm">{capacity} permanent berths · {TEMPORARY_BERTHS} reserve · Power {power.used}/{power.supply}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={campaignPrimary} onClick={recruit}>Recruit crew</button>
        <button type="button" className={campaignControl} onClick={calendar}>{date.month} {date.day} · {date.phase} {date.hour}</button>
      </div>
    </header>
    {state.move && <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-cyan-100">Relocation to {book.supply?.ports.find(row => row.id === state.move?.to)?.name} · {state.move.at - state.absoluteWatch} watches</p>
      <button type="button" className={campaignControl} disabled={unavailable(save)}
        onClick={() => void updateSave(s => {
          if (unavailable(s) || !s.station?.move) return s
          return { ...s, station: { ...s.station, move: { ...s.station.move, at: s.station.move.at + 1 } } }
        }).then(() => relocation(true))}>Delay relocation · 1 watch</button>
    </div>}
    {port !== state.anchor && <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{STARTER_CUTTER.name} · {book.supply?.ports.find(row => row.id === port)?.name ?? port}</span>
      <button type="button" className={campaignControl} onClick={returnHome}>Plot return to Homestretch</button>
    </div>}
    <div className="flex flex-wrap gap-1" aria-label="Station camera">
      <button type="button" className={campaignControl} onClick={() => onFocus({ zoom: 1 })}>Overview</button>
      {STATION_DECKS.map(key => <button key={key} type="button" className={campaignControl + ' aria-pressed:border-cyan-100'} aria-pressed={deck === key}
        onClick={() => onFocus({ deck: key, zoom: 1 })}>{key}</button>)}
      <button type="button" className={campaignControl} onClick={() => adjust(-.25)} disabled={zoom === 1}>Zoom out</button>
      <button type="button" className={campaignControl} onClick={() => adjust(.25)} disabled={zoom === 2}>Zoom in</button>
    </div>
    <div className={'grid gap-3 ' + (room ? 'sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : '')}>
      <div ref={scroll} className="max-h-80 min-w-0 overflow-auto rounded-lg border border-cyan-100/20 bg-[#0a111f] p-2"
        style={{ touchAction: 'none' }} onPointerMove={handlePointer}
        onPointerDown={event => {
          if (pointers.current.size === 0) gestureDistance.current = 0
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        }}
        onPointerUp={event => { pointers.current.delete(event.pointerId); pinch.current = 0 }}
        onPointerCancel={event => { pointers.current.delete(event.pointerId); pinch.current = 0 }}
        onPointerLeave={event => { pointers.current.delete(event.pointerId); pinch.current = 0 }}
        onClickCapture={event => {
          if (event.detail > 0 && gestureDistance.current > 6) event.stopPropagation()
        }}>
        <div className={'relative ' + (deck ? 'space-y-1 rounded-[2rem] border-[3px] border-slate-600 bg-[#152236] p-3' : 'grid grid-cols-3 grid-rows-3 gap-x-2')}
          style={{ width: `${zoom * 100}%` }}>
          {!deck && <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[calc(50%-0.875rem)] h-7 border-y-2 border-slate-600 bg-[#283a51]" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-[calc(50%-1.15rem)] w-9 border-x-2 border-slate-600 bg-[#283a51]" />
            <div aria-hidden="true" className="pointer-events-none relative col-start-2 row-start-2 justify-self-center self-center size-10 rotate-45 rounded-md border-2 border-cyan-100/60 bg-[#12253b] shadow-[0_0_18px_#35647a]" />
            {STATION_DECKS.map(key => <button key={key} type="button" aria-label={key + ' deck on cutaway'}
              onClick={() => onFocus({ deck: key, zoom: 1 })}
              className={'relative min-h-11 rounded-xl border-2 border-slate-500 bg-[#102036] px-2 py-1 text-xs text-cyan-50 hover:border-cyan-200 ' + deckPosition[key]}>
              <strong>{key}</strong>
              <div aria-hidden="true" className="mt-0.5 flex justify-center gap-1">
                {STATION_ROOMS.filter(id => STATION_MODULES[id].deck === key).map(id =>
                  <span key={id} className={'h-2.5 w-4 rounded-sm border ' + socket[stationRoom(state, id)]} />)}
              </div>
            </button>)}
          </>}
          {STATION_DECKS.filter(key => key === deck).map(key => <section key={key} aria-label={key + ' deck'}
            className="relative rounded-lg border border-slate-600/80 bg-[#0c1828] p-1">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-cyan-100">{key}</h2>
            <div className="grid grid-cols-2 gap-1 border-t border-cyan-100/20 pt-1 lg:grid-cols-4">
              {STATION_ROOMS.filter(id => STATION_MODULES[id].deck === key).map(id => {
                const module = STATION_MODULES[id], mode = stationRoom(state, id)
                return <button key={id} type="button" data-station-room={id} data-condition={mode} aria-pressed={room === id}
                  className={'flex min-h-12 min-w-0 flex-col items-start justify-center rounded-md border px-2 py-1 text-left text-xs aria-pressed:border-cyan-200 '
                    + socket[mode] + (mode === 'empty' ? ' text-slate-300' : ' text-white')}
                  onClick={() => onFocus(current => ({ ...current, deck: key, room: id }))}><strong>{module.label}</strong><span>{condition[mode]}</span></button>
              })}
            </div>
          </section>)}
        </div>
      </div>
      {room && current && status && <section className="space-y-2 rounded-lg border border-white/15 bg-[#111e2e] p-3" aria-label={current.label}>
        <h2 className="font-semibold">{current.label}</h2>
        <div aria-hidden="true" className="grid grid-cols-4 gap-2 rounded border border-cyan-100/20 bg-[#0a1322] p-3">
          {Array.from({ length: current.berths > 20 ? current.berths / 10 : 4 }, (_, index) =>
            <span key={index} className={'h-4 rounded-sm border border-cyan-100/25 ' + (status === 'active' ? 'bg-cyan-200/20' : 'border-dashed')} />)}
        </div>
        <p className="text-sm">{condition[status]}{status === 'building' && ` · ${state.rooms[room]} watches left`}</p>
        {!!current.berths && <p className="text-sm">{current.berths} permanent cabins</p>}
        {buildForecast && <div className="space-y-1 text-sm" aria-label="Build forecast">
          <p>Completes {watchLabel(buildForecast.at)} · Power {buildForecast.power.used}/{buildForecast.power.supply}</p>
          <p>{buildForecast.berths} permanent berths · {buildForecast.stock} Ship Alloy projected</p>
          {!buildForecast.powered && <p className="text-amber-200">Opens with power paused. Expand the Reactor or free power to use this room.</p>}
          {duty && <p>Duty output starts when staffed and powered.</p>}
        </div>}
        {status === 'empty' && <>
          <p className="text-sm">{current.cost} alloy · {current.watches} watches{current.draw ? ` · ${current.draw} power` : ''}</p>
          <button type="button" className={campaignPrimary + ' disabled:opacity-40'}
            disabled={unavailable(save) || missingHabitatA || building >= 2 || save.wallet.alloy < current.cost}
            onClick={() => void updateSave(s => {
              if (unavailable(s)) return s
              const build = buildStationRoom(stationOf(s, book), s.wallet, room)
              return build ? { ...s, ...build } : s
            })}>Build {current.label}</button>
          {missingHabitatA && <p className="text-sm">Complete Habitat A to extend the residential deck.</p>}
          {building >= 2 && <p className="text-sm">Both construction crews are occupied.</p>}
          {save.wallet.alloy < current.cost && <p className="text-sm">Assign a crew member in the Reactor to recover alloy each Duty watch.</p>}
        </>}
        {status === 'building' && <button type="button" className={campaignControl} disabled={unavailable(save)}
          onClick={() => void updateSave(s => {
            const cancelled = unavailable(s) ? null : cancelStationRoom(stationOf(s, book), s.wallet, room)
            return cancelled ? { ...s, ...cancelled } : s
          })}>Cancel build · recover {Math.floor(current.cost / 2)} alloy</button>}
        {!!current.draw && (status === 'active' || status === 'off') &&
          <button type="button" className={campaignControl + ' disabled:opacity-40'}
            disabled={unavailable(save) || !!protectedJump || shortfall > 0}
            onClick={() => void updateSave(s => unavailable(s) ? s : { ...s, station: setStationPower(stationOf(s, book), room) })}>
            {status === 'active' ? 'Pause power' : 'Restore power'}</button>}
        {protectedJump && <p className="text-sm">Power reserved for the scheduled relocation.</p>}
        {shortfall > 0 && <div className="space-y-2">
          <p className="text-sm text-amber-200">Needs {shortfall} more power. Pause another facility or expand the Reactor.</p>
          {stationPowerDonors(state, room).map(donor => <button key={donor} type="button" className={campaignControl}
            disabled={unavailable(save)}
            onClick={() => void updateSave(s => {
              if (unavailable(s)) return s
              const station = stationOf(s, book)
              const next = rerouteStationPower(station, room, donor)
              return next === station ? s : { ...s, station: next }
            })}>Transfer power from {STATION_MODULES[donor].label}</button>)}
        </div>}
        {room === 'reactor' && <p className="text-sm text-cyan-100">A staffed Duty watch recovers 1 alloy and 1 data.</p>}
        {room === 'life-support' && <p className="text-sm text-cyan-100">A staffed Duty watch adds {2 + Math.floor(stationResidentCount(save, book) / 40)} provisions to station reserves.</p>}
        {room === 'cargo' && book.stationStory && <p className="text-sm">Station upkeep · {stationRations(save, book)} provisions at dawn</p>}
        {!!state.rationShortfall && (room === 'fabrication' || room === 'shipyard') &&
          <p className="text-sm text-amber-200">Optional duty output paused after a ration shortfall.</p>}
        {room === 'infirmary' && <p className="text-sm text-cyan-100">A staffed Duty watch treats the most strained resident aboard.</p>}
        {status === 'active' && duty && <label className="flex flex-wrap items-center gap-2 text-sm">Duty assignment
          <select className="min-h-11 rounded bg-[#24344b] p-2" value={assigned ?? ''} disabled={unavailable(save)}
            onChange={event => {
              const actor = event.currentTarget.value ? Number(event.currentTarget.value) : null
              void updateSave(s => unavailable(s) || (actor !== null && !stationWorkers(s, book).includes(actor)) ? s
                : { ...s, station: assignStationShift(stationOf(s, book), duty, actor) })
            }}>
            <option value="">Unassigned</option>
            {assigned !== undefined && !available.includes(assigned) && <option value={assigned}>{nameOf(book.story, assigned)} · Away</option>}
            {available.map(actor => <option key={actor} value={actor}>{nameOf(book.story, actor)}</option>)}
          </select>
        </label>}
        {status === 'active' && route && <button type="button" className={campaignControl} onClick={() => open(route)}>
          {room === 'cutter' ? `Board ${STARTER_CUTTER.name}` : `Open ${route}`}
        </button>}
        {room === 'reactor' && <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={state.autoStaff === true} disabled={unavailable(save)} onChange={event => {
            const enabled = event.currentTarget.checked
            void updateSave(s => {
              if (unavailable(s)) return s
              const { autoStaff: _autoStaff, ...station } = stationOf(s, book)
              return { ...s, station: { ...station, ...(enabled ? { autoStaff: true as const } : {}) } }
            })
          }} />Automatically cover vacant shifts
        </label>}
        {room === 'jump-ring' && status === 'active' && mayRelocate && !state.move && <button type="button" className={campaignControl}
          disabled={unavailable(save) || port !== state.anchor} onClick={() => void updateSave(s => {
            const now = stationOf(s, book)
            if (unavailable(s) || now.move || s.campaignSupply?.port !== now.anchor || stationRoom(now, 'jump-ring') !== 'active'
              || !s.story.seen.includes(recognized!.scene) || now.anchor === 'orla') return s
            return { ...s, station: { ...now, move: { to: 'orla', at: now.absoluteWatch + 2 } } }
          }).then(() => relocation(false))}>Schedule Orla relocation · 2 watches</button>}
        <button type="button" className={campaignControl} onClick={calendar}>View schedule</button>
      </section>}
    </div>
    <button type="button" className={campaignControl + ' disabled:opacity-40'} disabled={unavailable(save)}
      onClick={() => void updateSave(s => unavailable(s) ? s : advanceStationWatches(s, book, 1))}>Advance watch</button>
  </section>
}
