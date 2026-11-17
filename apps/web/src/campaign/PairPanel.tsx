import { pairProgress, type CampaignPair, type StoryPack, type StoryState } from '@cyber/domain'
import { nameOf } from '../story/runner'

export function PairPanel({ pair, story, pack, open }: { pair: CampaignPair; story: StoryState; pack: StoryPack; open: (scene: string) => void }) {
  const progress = pairProgress(pair, story)
  const next = progress.next
  const action = next === pair.release ? 'Review release' : next === pair.bond.scene ? 'Talk about their bond'
    : next === pair.residency.scene ? 'Discuss quarters' : progress.residency === 'shared' ? 'Move into shared quarters' : 'Open separate cabins'
  return <section aria-label="Company aboard" className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3">
    <h2 className="font-display text-lg font-bold">Company aboard</h2>
    <ul className="grid gap-2 text-sm sm:grid-cols-2">
      {pair.members.map(({ outfit }, i) => <li key={outfit} className="rounded-lg bg-black/20 p-2">
        <p className="font-semibold">{nameOf(pack, outfit)}</p>
        {i === 1 && <p className="text-white/75">{progress.released ? 'Released · Aboard by choice' : 'In custody'}</p>}
        <p className="text-white/75">{progress.trust[i] ? 'Trust established' : 'Getting to know each other'}</p>
      </li>)}
    </ul>
    {!progress.released && <p className="text-sm">Recovery {progress.recovery}/{pair.recovery.length}{!next && ' · Visit the brig this evening'}</p>}
    {progress.bond && <p className="text-sm">{progress.bond === 'romance' ? 'Dating' : 'Friends'}</p>}
    {progress.moved && <p className="text-sm text-cyan-200">{progress.residency === 'shared' ? 'Shared quarters' : 'Separate cabins'}</p>}
    {next && <button type="button" onClick={() => open(next)} className="min-h-11 rounded-lg bg-[#2ee6ff] px-3 text-sm font-bold text-[#0b0d17]">{action}</button>}
  </section>
}
