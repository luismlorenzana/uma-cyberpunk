import { homeOutcome, type CampaignHome, type CampaignPair, type StoryPack, type StoryState } from '@cyber/domain'
import { nameOf } from '../story/runner'

export function HomePanel({ pair, home, name, story, pack, next, defended, open }: {
  pair: CampaignPair; home: CampaignHome; name: string; story: StoryState; pack: StoryPack
  next: string | null; defended: boolean; open: (scene: string) => void
}) {
  const outcome = homeOutcome(home, story)
  const action = next === home.scene ? 'Discuss returning home' : next === home.visit ? 'Visit the relay base' : 'Hear the defense debrief'
  return <section aria-label={`Home at ${name}`} className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3">
    <h2 className="font-display text-lg font-bold">{name} Base</h2>
    <p className="text-sm text-cyan-200">{defended ? 'Relay secured' : 'Civilian base reopened'}</p>
    {outcome === 'resettle' && <ul className="grid gap-2 text-sm sm:grid-cols-2">
      {pair.members.map(({ outfit }, i) => <li key={outfit} className="rounded-lg bg-black/20 p-2">
        <p className="font-semibold">{nameOf(pack, outfit)}</p>
        <p>{home.jobs[i]}</p>
      </li>)}
    </ul>}
    {outcome === 'stay' && <p className="text-sm">Staying aboard · Quarters and station assignments retained</p>}
    {next === home.scene && <p className="text-sm">Settling here frees both ship berths and stations. Staying keeps both crew members aboard.</p>}
    {(outcome === 'resettle' || next === home.scene) && <p className="text-sm">
      {next === home.scene && 'If they resettle · '}+{home.support.alloy} local alloy/night · −{home.support.provisions} ship provisions/night · +{home.support.relay} relay integrity
    </p>}
    {outcome === 'resettle' && <p className="text-sm text-white/75">Based ashore</p>}
    {next && <button type="button" onClick={() => open(next)}
      className="min-h-11 rounded-lg bg-[#2ee6ff] px-3 text-sm font-bold text-[#0b0d17]">{action}</button>}
  </section>
}
