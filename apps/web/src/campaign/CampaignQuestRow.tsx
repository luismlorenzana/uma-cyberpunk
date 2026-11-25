
import type { CampaignBook, CampaignQuest, Save } from '@cyber/domain'
import { describeCampaignQuest, operationObjective, type CampaignNavigation } from './navigation'

export const campaignControl = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/8 px-3 text-sm font-semibold text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-cyan-200'
export const campaignPrimary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-200 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-100 focus-visible:outline-2 focus-visible:outline-white'

export function CampaignQuestRow({ quest, book, save, port, complete, navigation, open, travel, title }: {
  quest: CampaignQuest; book: CampaignBook; save: Save; port?: string
  complete: ReadonlySet<string>; navigation: CampaignNavigation
  open: (quest: CampaignQuest) => void; travel: (destination?: string) => void; title?: string
}) {
  const status = describeCampaignQuest(quest, book, save, port, complete, navigation)
  const ship = quest.encounter ? book.commands.get(quest.encounter) : undefined
  const objective = operationObjective(book, save, quest, navigation)
  return <li className="grid gap-2 border-b border-white/10 px-3 py-2 last:border-0 md:grid-cols-[1fr_auto] md:items-center">
    <div>
      <h3 className="break-words font-semibold">{quest.title}</h3>
      <p className="text-xs text-slate-300">
        {quest.encounter ? (ship ? 'Ship battle' : 'Ground battle') : 'Story'}
        {status.destination && ' · ' + status.destination.name}
        {ship && ' · ' + ship.cost.fuel + ' fuel · ' + ship.cost.provisions + ' provisions'}
      </p>
      {objective && <p className="mt-1 text-sm text-slate-300">{objective}</p>}
      {status.travels && status.nextPort && status.nextPort.id !== status.destination?.id &&
        <p className="mt-1 text-sm text-slate-300">Next stop · {status.nextPort.name}</p>}
      {status.reason && <p className="mt-1 text-sm text-slate-300">{status.reason}</p>}
    </div>
    {status.done ? <span className="text-sm text-emerald-200">Completed</span>
      : status.ready ? <button type="button" className={campaignPrimary} onClick={() => open(quest)}>{title ?? 'Open'}</button>
      : status.travels ? <button type="button" className={campaignControl} onClick={() => travel(quest.port)}>Navigation</button>
      : <span className="text-sm text-slate-400">Locked</span>}
  </li>
}
