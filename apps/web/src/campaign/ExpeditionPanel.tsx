import { COMMAND_STATIONS, storesAt, type CampaignBook, type CampaignQuest, type Save } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { campaignControl, campaignPrimary, CampaignQuestRow } from './CampaignQuestRow'
import { expeditionBerth, expeditionPlan, expeditionOfficer, expeditionStations, fitExpeditionHull, loadTender, resumeVoyage, berthVoyage, tendAtBerth, TENDER_ARMOR_ALLOY } from './expedition'
import type { CampaignNavigation } from './navigation'

export function ExpeditionPanel({ book, save, port, complete, navigation, open, report, travel, systems }: {
  book: CampaignBook; save: Save; port?: string; complete: ReadonlySet<string>; navigation: CampaignNavigation
  open: (quest: CampaignQuest) => void; report: (scene: string) => void; travel: (destination?: string) => void; systems: boolean
}) {
  const run = save.expedition
  const plan = expeditionPlan(save, book, complete)
  if (!run || !plan) return null
  const { route, remaining, current, watch, fuel, provisions } = plan
  const berth = expeditionBerth(save, book)
  const portStock = berth && storesAt(berth.main, berth.port)
  return <section aria-label="Active expedition" className="space-y-3 rounded-xl border border-white/15 bg-[#101b2d] p-3">
    <h2 className="font-display text-xl font-bold">{route.name} · Expedition</h2>
    <p className="text-sm">{run.berthed ? 'Berthed at ' + (berth?.port.name ?? 'Homestretch') : current?.title ?? 'Departure'} · {run.members.length} assigned</p>
    <p className="text-sm">Tender cargo · {run.fuel} fuel · {run.provisions} provisions</p>
    <p className="text-sm">Remaining ship battles · {fuel} fuel · {provisions} provisions</p>
    {remaining[0] && <p className="text-sm text-cyan-200">Next · {remaining[0].title}</p>}
    {watch && <button type="button" className={campaignControl} onClick={() => report(watch.scene)}>{watch.shortfall ? 'Supply report' : 'Off duty'}</button>}
    {run.berthed && portStock && <p className="text-sm">Berth stock · {portStock.fuel} fuel · {portStock.provisions} provisions{run.towFuelDue && ' · 1 fuel tow charge due at departure'}</p>}
    {run.berthed ? <div className="flex flex-wrap gap-2">
      <button type="button" className={campaignPrimary + ' disabled:opacity-50'} disabled={resumeVoyage(save, book) === save} onClick={() => void updateSave(s => resumeVoyage(s, book))}>Resume expedition</button>
      <button type="button" className={campaignControl} onClick={() => void updateSave(s => tendAtBerth(s, book))}>Advance berth supply watch</button>
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
        return <li key={speaker}>{nameOf(book.story, speaker)} · {member.role.replaceAll('-', ' ')}{station && ' · ' + station}</li>
      })}</ul>
    </details>
  </section>
}
