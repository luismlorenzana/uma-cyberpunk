import { BOND_TUNING, campaignSpeaker, type CampaignBook, type CampaignDate, type Save } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { dateProgress } from './dates'

export function DatePanel({ save, book, dates, compact = false }: {
  save: Save; book: CampaignBook; dates: readonly CampaignDate[]; compact?: boolean
}) {
  return <section aria-label="Captain's relationships" className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3">
    {compact ? <h3 className="font-semibold">Relationship</h3> : <h2 className="font-display text-lg font-bold">Captain’s relationships</h2>}
    <ul className="space-y-2">
      {dates.map((date) => {
        const { bond, milestone, visit } = dateProgress(save, book, date)
        const threshold = BOND_TUNING.toRank[bond.rank + 1]
        const label = nameOf(book.story, campaignSpeaker(book.allies, date.companion))
        return <li key={date.companion} className="space-y-1 rounded-lg bg-black/20 p-2 text-sm">
          <p className="font-semibold">{label} · Rank {bond.rank}</p>
          <p>{bond.path === 'heart' ? 'Dating' : bond.path === 'trust' ? 'Friends' : bond.rank > 1 ? 'Building trust' : 'Teammates'}</p>
          {threshold && <progress className="block h-1.5 w-full accent-cyan-300" aria-label={`Rapport with ${label}`}
            value={Math.min(bond.rapport, threshold)} max={threshold} />}
          {milestone && <p className="text-white/75">{milestone === visit ? `${milestone.title} this evening`
            : `${milestone.title} · Rank ${milestone.rank}${milestone.port ? ' · ' + book.supply?.ports.find(({ id }) => id === milestone.port)?.name : ''}${milestone.after ? ' · ' + book.quests.find(({ id }) => id === milestone.after)?.title : ''}`}</p>}
        </li>
      })}
    </ul>
  </section>
}
