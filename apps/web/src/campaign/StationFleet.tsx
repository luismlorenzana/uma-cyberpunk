import { COMMAND_HULL, expeditionReadiness, STARTER_CUTTER, stationRoom, type CampaignBook, type Save } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { watchLabel } from './appointments'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { COMMISSIONING_BERTHS, commissionCutter, commissioningBerthsUsed, expeditionPlan, expeditionQuestBlock,
  restoreParkedCutter, TENDER_ARMOR_ALLOY } from './expedition'
import { questComplete } from './quests'
import { stationJourney } from './station-travel'
import { advanceStationWatches, repairStarterCutter, stationOf } from './watch'

export function StationFleet({ book, save, complete, navigation, yardRoom, inspect, operations = false }: {
  book: CampaignBook; save: Save; complete: ReadonlySet<string>; navigation: (port?: string) => void
  yardRoom: () => void
  inspect?: (ship: string) => void
  operations?: boolean
}) {
  const station = stationOf(save, book)
  const yard = stationRoom(station, 'shipyard')
  const catalog = book.fourAct!
  const anchored = save.campaignSupply?.port === station.anchor
  const inUse = commissioningBerthsUsed(save)
  const busy = !!(save.expedition || save.mission || save.campaignDay.pending || save.pairScene)
  const activePlan = save.expedition ? expeditionPlan(save, book, complete) : null
  const cutters = [...catalog.duos.values()].flatMap(duo => {
    if (!duo.expedition?.route) return []
    const ready = expeditionReadiness(catalog, duo.id, complete)
    const hull = save.fleet?.[duo.id]
    return hull || ready?.capitals === 5 ? [{ duo, route: duo.expedition.route, hull, ready }] : []
  })
  function workWatch() {
    void updateSave(s => s.expedition || s.mission || s.campaignDay.pending || s.pairScene
      ? s : advanceStationWatches(s, book, 1))
  }
  return <section className="space-y-3 rounded-xl border border-white/15 p-3" aria-label="Station fleet">
    {!operations && <>
      <h2 className="font-display text-lg font-bold">{STARTER_CUTTER.name}</h2>
      <img src="/images/homestretch-cutaway.webp" alt="Two-deck cutter interior" className="max-h-40 w-full rounded object-cover object-center" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={campaignPrimary} onClick={() => navigation()}>Plot cutter route</button>
        {!anchored && <button type="button" className={campaignControl} onClick={() => navigation(station.anchor)}>Set course for Homestretch</button>}
        {anchored && (station.integrity ?? COMMAND_HULL) < COMMAND_HULL && <button type="button" className={campaignControl}
          onClick={() => void updateSave(s => repairStarterCutter(s, book))}>Repair cutter · 1 watch</button>}
      </div>
    </>}
    <div className="flex flex-wrap items-center gap-2">
      <div>
        <h3 className="font-semibold">Shipyard</h3>
        <p className="text-sm">{yard === 'active' ? 'Operational' : yard === 'off' ? 'Power paused' : yard === 'building' ? 'Under construction' : 'Build at the Flight deck'}
          {' · '}{inUse}/{COMMISSIONING_BERTHS} commissioning berths used</p>
      </div>
      {!save.expedition && <button type="button" className={campaignControl} onClick={yardRoom}>Shipyard controls</button>}
      {inUse > 0 && yard === 'active' && <button type="button" className={campaignControl} disabled={busy} onClick={workWatch}>Advance watch</button>}
    </div>
    {cutters.length === 0 && <p className="text-sm">Expedition cutters open after all five capitals are liberated.</p>}
    {cutters.map(({ duo, hull, ready, route }) => {
      const origin = book.quests.find(row => row.id === route.launch)?.port
      const port = book.supply?.ports.find(row => row.id === origin)
      const estimate = origin && stationJourney(save, book, origin)
      const restorable = hull?.condition === 'parked' && restoreParkedCutter(save, book, duo.id) !== save
      const active = save.expedition?.duo === duo.id ? save.expedition : undefined
      const voyage = active ?? hull?.run
      const status = active ? active.berthed ? 'At launch berth' : 'Underway'
        : hull?.condition === 'parked' ? 'Parked at launch berth'
          : hull?.condition === 'returned' ? 'Returned'
            : hull?.condition === 'commissioning' ? 'Commissioning'
              : hull ? 'Ready at launch berth' : 'Awaiting commission'
      const launchBlock = !active && hull?.condition === 'commissioned'
        ? expeditionQuestBlock(save, book, route.launch, duo, q => complete.has(q.id)) : null
      const readyToCommission = yard === 'active' && anchored && !busy && inUse < COMMISSIONING_BERTHS
        && ready?.cleared === 2 && ready.returned === 6
      const commission = (reinforced: boolean) => void updateSave(s =>
        commissionCutter(s, book, duo, new Set(book.quests.filter(q => questComplete(s, q, book)).map(q => q.id)), reinforced))
      return <article key={duo.id} className="space-y-1 rounded border border-white/10 p-2">
        <h4 className="text-sm font-semibold">{route.name}</h4>
        <p className="text-xs">{duo.umas.map(actor => nameOf(book.story, actor)).join(' and ')} · {status}</p>
        {hull?.condition === 'commissioning' && <p className="text-sm">{yard === 'active'
          ? `Ready ${watchLabel(station.absoluteWatch + (hull.watches ?? 0))}` : 'Waiting for shipyard power'}</p>}
        {active && activePlan?.current && <p className="text-sm">Next · {activePlan.current.title}</p>}
        {port && !active && hull?.condition !== 'returned' && <p className="text-xs">Launch berth · {port.name}
          {estimate && estimate.watches > 0 ? ` · ${estimate.watches} watches · ${estimate.fuel} fuel` : ''}</p>}
        {launchBlock && <p className="text-xs text-amber-200">{launchBlock}</p>}
        {voyage ? <p className="text-xs">{voyage.fuel} fuel · {voyage.provisions} provisions · Hull {voyage.integrity ?? COMMAND_HULL}/{COMMAND_HULL}
          {voyage.reinforced ? ' · Reinforced escort' : ''}</p>
          : hull?.reinforced && <p className="text-xs">Fitting · Reinforced escort</p>}
        {!hull && <div className="space-y-1">
          <p className="text-xs">{ready?.cleared ?? 0}/2 General clearances · {ready?.returned ?? 0}/6 Lieutenant returns</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={campaignControl + ' disabled:opacity-40'} disabled={!readyToCommission}
              onClick={() => commission(false)}>Commission cutter · 2 watches</button>
            <button type="button" className={campaignControl + ' disabled:opacity-40'} disabled={!readyToCommission || save.wallet.alloy < TENDER_ARMOR_ALLOY}
              onClick={() => commission(true)}>Reinforced escort · {TENDER_ARMOR_ALLOY} alloy</button>
          </div>
        </div>}
        {hull?.condition === 'parked' && <button type="button" className={campaignControl} disabled={busy}
          onClick={() => restorable ? void updateSave(s => restoreParkedCutter(s, book, duo.id)) : navigation(origin)}>
          {restorable ? 'Open parked voyage' : 'Plot course to parked cutter'}</button>}
        {!active && hull?.condition === 'commissioned' && origin && save.campaignSupply?.port !== origin &&
          <button type="button" className={campaignControl} disabled={busy} onClick={() => navigation(origin)}>Plot launch berth</button>}
        {!active && hull?.condition === 'commissioned' && hull.ship === book.stationStory?.pilotShip && inspect &&
          <button type="button" className={campaignControl} onClick={() => inspect(hull.ship)}>Inspect commissioned cutter</button>}
      </article>
    })}
  </section>
}
