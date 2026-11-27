import { formationRoleName } from './player-labels'
import { COMMAND_HULL, COMMAND_STATIONS, storesAt, WATCHES_PER_DAY, type CampaignBook, type CampaignQuest, type FixedDuo, type Save } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { campaignControl, campaignPrimary, CampaignQuestRow } from './CampaignQuestRow'
import { expeditionBerth, expeditionLaunchBudget, expeditionPlan, expeditionOfficer, expeditionStations, fitExpeditionHull, loadTender, parkCutter, repairExpeditionCutter, requestTenderRelief, resumeVoyage, berthVoyage, setBerthRationPriority, tendAtBerth, TENDER_ARMOR_ALLOY } from './expedition'
import type { CampaignNavigation } from './navigation'
import { watchLabel } from './appointments'
import { stationOf } from './watch'
import { nextStationDawn } from './station-forecast'
import { BattleHelp } from '../battle/BattleHelp'
import { CutterVisual } from './VesselVisuals'

export function ExpeditionLaunchReview({ book, save, duo, complete, block, launch, cargo, back }: {
  book: CampaignBook; save: Save; duo: FixedDuo; complete: ReadonlySet<string>; block?: string
  launch: () => void; cargo: () => void; back: () => void
}) {
  const budget = expeditionLaunchBudget(save, book, duo, complete)
  if (!budget) return <button type="button" className={campaignControl} onClick={back}>Back</button>
  const sufficient = budget.fuelMargin >= 0 && budget.provisionMargin >= 0
  const stock = save.campaignSupply
  const hull = save.fleet?.[duo.id]
  const expedition = duo.expedition
  return <section className="mx-auto max-w-lg space-y-3 rounded-xl border border-cyan-200/20 bg-[#101e32] p-4" aria-label="Expedition launch review">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-display text-xl font-bold">{expedition?.route?.name}</h1>
      {expedition?.route && <CutterVisual id={expedition.ship} name={expedition.route.name} state="berthed"
        integrity={hull?.integrity} reinforced={hull?.reinforced} compact />}
    </header>
    <div className="space-y-1 text-sm" aria-label="Formation at launch">
      {duo.umas.map(outfit => <p key={outfit}>{nameOf(book.story, outfit)} · Laser Rank {Math.max(6, save.combatTraining?.[outfit]?.rank ?? 1)} · Laser-only</p>)}
      <div className="flex items-center">The Umas retire subclasses at launch. The eight allies use full kits at Lv 6 or higher.<BattleHelp topic="roles" /></div>
    </div>
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
      <dt>Available at berth</dt><dd>{stock?.fuel ?? 0} fuel · {stock?.provisions ?? 0} provisions</dd>
      <dt>Load at departure</dt><dd>{budget.departure.fuel} fuel · {budget.departure.provisions} provisions</dd>
      <dt>Required battles</dt><dd>{budget.fuel} fuel · {budget.provisions} provisions</dd>
      <dt>Earliest return · {budget.watches} watches</dt><dd>{watchLabel(budget.at)}</dd>
    </dl>
    {sufficient ? <p className="text-sm">Projected return cargo · {budget.fuelMargin} fuel · {budget.provisionMargin} provisions</p>
      : <p className="text-sm text-amber-200">Plan to resupply · {Math.max(0, -budget.fuelMargin)} fuel · {Math.max(0, -budget.provisionMargin)} provisions</p>}
    <p className="text-xs text-slate-300">A withdrawal to berth uses 1 fuel. Repairs and supply stops add time.</p>
    {block && <p className="text-sm text-amber-200" role="status">{block}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={campaignPrimary + ' disabled:opacity-50'} disabled={!!block} onClick={launch}>Continue to launch</button>
      <button type="button" className={campaignControl} onClick={cargo}>Open Cargo</button>
      <button type="button" className={campaignControl} onClick={back}>Back</button>
    </div>
  </section>
}

export function ExpeditionPanel({ book, save, port, complete, navigation, open, report, travel, systems, parked }: {
  book: CampaignBook; save: Save; port?: string; complete: ReadonlySet<string>; navigation: CampaignNavigation
  open: (quest: CampaignQuest) => void; report: (scene: string) => void; travel: (destination?: string) => void; systems: boolean
  parked: (ship: string) => void
}) {
  const run = save.expedition
  const plan = expeditionPlan(save, book, complete)
  if (!run || !plan) return null
  const { route, remaining, current, watch, fuel, provisions, watches } = plan
  const berth = expeditionBerth(save, book)
  const portStock = berth && storesAt(berth.main, berth.port)
  const station = stationOf(save, book)
  const now = station.absoluteWatch
  const untilDawn = WATCHES_PER_DAY - now % WATCHES_PER_DAY
  const sharedBerth = book.stationStory && run.berthed && berth?.port.id === station.anchor
  const dawn = sharedBerth && nextStationDawn(save, book)
  return <section aria-label="Active expedition" className="space-y-3 rounded-xl border border-white/15 bg-[#101b2d] p-3">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-display text-xl font-bold">{route.name} · Expedition</h2>
      <CutterVisual id={run.ship} name={route.name} state={run.berthed ? 'berthed' : 'underway'}
        integrity={run.integrity} reinforced={run.reinforced} compact />
    </header>
    <p className="text-sm">{run.berthed ? 'Berthed at ' + (berth?.port.name ?? 'Homestretch') : current?.title ?? 'Departure'} · {run.members.length} assigned</p>
    <p className="text-sm">Cutter cargo · {run.fuel} fuel · {run.provisions} provisions · Hull {run.integrity ?? COMMAND_HULL}/{COMMAND_HULL}</p>
    <p className="text-sm">Remaining ship battles · {fuel} fuel · {provisions} provisions</p>
    {book.stationStory && <p className="text-sm">Earliest return · {watchLabel(now + watches)}</p>}
    {(run.fuel < fuel || run.provisions < provisions) && <p className="text-sm text-amber-200">
      Resupply needed · {Math.max(0, fuel - run.fuel)} fuel · {Math.max(0, provisions - run.provisions)} provisions
    </p>}
    {remaining[0] && <p className="text-sm text-cyan-200">Next · {remaining[0].title}</p>}
    {watch && <button type="button" className={campaignControl} onClick={() => report(watch.scene)}>{watch.shortfall ? 'Supply report' : 'Off duty'}</button>}
    {run.berthed && portStock && <p className="text-sm">Berth stock · {portStock.fuel} fuel · {portStock.provisions} provisions{run.towFuelDue && ' · 1 fuel tow charge due at departure'}</p>}
    {book.stationStory && run.berthed && <p className="text-sm">Port restocks at dawn · {untilDawn} {untilDawn === 1 ? 'watch' : 'watches'}</p>}
    {sharedBerth && <div className="space-y-1" aria-label="Berth ration priority">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={station.automaticRations !== false} onChange={event => {
          const automaticRations = event.currentTarget.checked
          void updateSave(s => setBerthRationPriority(s, book, automaticRations))
        }} /> Draw port surplus for Homestretch rations
      </label>
      {dawn && <p className={dawn.short ? 'text-sm text-amber-200' : 'text-sm text-slate-300'}>
        Homestretch next dawn · {dawn.short ? `Short ${dawn.short} provisions` : `${dawn.reserves} provisions in reserve`}
      </p>}
    </div>}
    {run.berthed ? <div className="flex flex-wrap gap-2">
      <button type="button" className={campaignPrimary + ' disabled:opacity-50'} disabled={resumeVoyage(save, book) === save} onClick={() => void updateSave(s => resumeVoyage(s, book))}>Resume expedition</button>
      {book.stationStory && berth && <button type="button" className={campaignControl}
        onClick={() => {
          let stored: string | undefined
          void updateSave(s => {
            const next = parkCutter(s, book)
            if (next !== s) stored = s.expedition?.ship
            return next
          }).then(() => { if (stored) parked(stored) })
        }}>Park cutter</button>}
      <button type="button" className={campaignControl} onClick={() => void updateSave(s => tendAtBerth(s, book))}>Advance berth supply watch</button>
      {requestTenderRelief(save, book) !== save && <button type="button" className={campaignControl}
        onClick={() => void updateSave(s => requestTenderRelief(s, book))}>Request emergency cutter supplies</button>}
      {run.integrity !== undefined && run.integrity < COMMAND_HULL && <button type="button" className={campaignControl}
        onClick={() => void updateSave(s => repairExpeditionCutter(s, book))}>Repair cutter · 1 watch</button>}
      {(['fuel', 'provisions'] as const).map(kind => <button type="button" key={kind} className={campaignControl + ' disabled:opacity-50'}
        disabled={loadTender(save, book, kind) === save} onClick={() => void updateSave(s => loadTender(s, book, kind))}>Load tender {kind}</button>)}
      <button type="button" className={campaignControl + ' disabled:opacity-50'} disabled={fitExpeditionHull(save, book) === save}
        onClick={() => void updateSave(s => fitExpeditionHull(s, book))}>{run.reinforced ? 'Reinforced escort' : 'Reinforce escort · ' + TENDER_ARMOR_ALLOY + ' alloy'}</button>
    </div> : berthVoyage(save, book) !== save && <button type="button" className={campaignControl}
      onClick={() => void updateSave(s => berthVoyage(s, book))}>{run.fuel || berth?.main.fuel ? 'Withdraw to launch berth · 1 fuel' : 'Request tow to launch berth'}</button>}
    {systems && <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {COMMAND_STATIONS.map(station => {
        const assigned = expeditionOfficer(run, station)
        return <div key={station} className="contents"><dt className="capitalize text-slate-300">{station}</dt>
          <dd>{nameOf(book.story, assigned.speaker)} · Drill {assigned.drills}</dd></div>
      })}
      <div className="contents"><dt className="text-slate-300">Escort</dt><dd>{run.reinforced ? '+1 integrity from refit' : 'Standard hull'}</dd></div>
    </dl>}
    <details>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Route and return · {remaining.length} remaining</summary>
      <ol className="space-y-1">{remaining.map(quest => <CampaignQuestRow key={quest.id} quest={quest}
        book={book} save={save} port={port} complete={complete} navigation={navigation} open={open} travel={travel} />)}</ol>
    </details>
    <details>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Formation · {run.members.length} aboard</summary>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">{run.members.map((member, i) => {
        const speaker = member.role === 'uma' ? member.outfit : member.heroine
        const station = COMMAND_STATIONS.find(station => expeditionStations(run)[station] === i)
        return <li key={speaker}>{nameOf(book.story, speaker)} · {formationRoleName[member.role]}{station && ' · ' + station}</li>
      })}</ul>
    </details>
  </section>
}
