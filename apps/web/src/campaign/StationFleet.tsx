import { COMMAND_HULL, expeditionReadiness, stationRoom, STARTER_CUTTER, type CampaignBook, type Save } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { commissionCutter, restoreParkedCutter } from './expedition'
import { questComplete } from './quests'
import { repairStarterCutter, stationOf } from './watch'

export function StationFleet({ book, save, complete, navigation, commissioned }: {
  book: CampaignBook; save: Save; complete: ReadonlySet<string>; navigation: (port?: string) => void
  commissioned: (ship: string) => void
}) {
  const station = stationOf(save, book)
  const yard = stationRoom(station, 'shipyard')
  const catalog = book.fourAct
  const anchored = save.campaignSupply?.port === station.anchor
  const cutters = [...catalog?.duos.values() ?? []].flatMap(duo => {
    if (!duo.expedition) return []
    const ready = expeditionReadiness(catalog!, duo.id, complete)
    const hull = save.fleet?.[duo.id]
    return hull || ready?.capitals === 5 ? [{ duo, hull, ready }] : []
  })
  return <section className="space-y-3 rounded-xl border border-white/15 p-3" aria-label="Station fleet">
    <h2 className="font-display text-lg font-bold">{STARTER_CUTTER.name}</h2>
    <img src="/images/homestretch-cutaway.webp" alt="Two-deck cutter interior" className="max-h-40 w-full rounded object-cover object-center" />
    <div className="flex flex-wrap gap-2">
      <button type="button" className={campaignPrimary} onClick={() => navigation()}>Plot cutter route</button>
      {!anchored && <button type="button" className={campaignControl} onClick={() => navigation(station.anchor)}>Set course for Homestretch</button>}
      {anchored && (station.integrity ?? COMMAND_HULL) < COMMAND_HULL && <button type="button" className={campaignControl}
        onClick={() => void updateSave(s => repairStarterCutter(s, book))}>Repair cutter · 1 watch</button>}
    </div>
    <h3 className="font-semibold">Shipyard</h3>
    <p className="text-sm">{yard === 'active' ? 'Operational' : yard === 'off' ? 'Power paused' : yard === 'building' ? 'Under construction' : 'Build at the Flight deck'}</p>
    {cutters.map(({ duo, hull, ready }) => {
      const origin = book.quests.find(row => row.id === duo.expedition?.route?.launch)?.port
      const restorable = hull && restoreParkedCutter(save, book, duo.id) !== save
      return <article key={duo.id} className="space-y-1 rounded border border-white/10 p-2">
        <h4 className="text-sm font-semibold">{duo.expedition?.route?.name ?? duo.expedition?.ship}</h4>
        <p className="text-xs">{duo.umas.map(actor => nameOf(book.story, actor)).join(' and ')} · {hull?.condition ?? 'Awaiting commission'}</p>
        {hull?.run && <p className="text-xs">{hull.run.fuel} fuel · {hull.run.provisions} provisions · Hull {hull.run.integrity ?? COMMAND_HULL}/{COMMAND_HULL}{hull.run.reinforced ? ' · Reinforced' : ''}</p>}
        {!hull && <button type="button" className={campaignControl + ' disabled:opacity-40'}
          disabled={yard !== 'active' || !anchored || ready?.cleared !== 2 || ready.returned !== 6}
          onClick={() => {
            let acquired: string | undefined
            void updateSave(s => {
              const next = commissionCutter(s, book, duo, new Set(book.quests.filter(q => questComplete(s, q, book)).map(q => q.id)))
              if (next !== s) acquired = next.fleet?.[duo.id]?.ship
              return next
            }).then(() => { if (acquired) commissioned(acquired) })
          }}>Commission cutter</button>}
        {hull?.condition === 'parked' && <button type="button" className={campaignControl}
          onClick={() => restorable ? void updateSave(s => restoreParkedCutter(s, book, duo.id)) : navigation(origin)}>
          {restorable ? 'Open parked voyage' : 'Plot course to parked cutter'}</button>}
        {hull?.condition === 'commissioned' && origin && save.campaignSupply?.port !== origin &&
          <button type="button" className={campaignControl} onClick={() => navigation(origin)}>Plot launch berth</button>}
      </article>
    })}
  </section>
}
