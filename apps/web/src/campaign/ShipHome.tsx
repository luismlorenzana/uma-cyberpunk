
import type { CampaignQuest, CampaignReleaseFile } from '@cyber/domain'
import { CampaignThumbnail } from './CampaignThumbnail'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'

export const homeAreas = ['Bridge', 'Navigation', 'Ship systems', 'Quarters'] as const
export type HomeArea = typeof homeAreas[number]

export function ShipHome({ ship, location, day, cargo, backdrop, ready, roster, operations, open }: {
  ship: string; location?: string; day?: number; cargo?: { fuel: number; provisions: number; alloy?: number }
  backdrop?: CampaignReleaseFile; ready: readonly CampaignQuest[]
  roster?: () => void; operations?: () => void; open: (quest: CampaignQuest) => void
}) {
  const [first, ...following] = ready
  return <>
    <section aria-labelledby="ship-name" className="relative isolate overflow-hidden rounded-2xl border border-white/12 bg-[#142437]">
      <CampaignThumbnail asset={backdrop} className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-[#081222] via-[#081222]/78 to-[#081222]/15" />
      <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-7">
        <div>
          <p className="text-sm font-medium text-cyan-200">{location}{location && day !== undefined && ' · '}{day !== undefined && 'Day ' + day}</p>
          <h1 id="ship-name" className="max-w-2xl break-words font-display text-3xl font-bold text-white sm:text-4xl">{ship}</h1>
        </div>
        {cargo && <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div><dt className="text-slate-300">Fuel</dt><dd className="font-semibold tabular-nums">{cargo.fuel}</dd></div>
          <div><dt className="text-slate-300">Provisions</dt><dd className="font-semibold tabular-nums">{cargo.provisions}</dd></div>
          {cargo.alloy !== undefined && <div><dt className="text-slate-300">Alloy</dt><dd className="font-semibold tabular-nums">{cargo.alloy}</dd></div>}
        </dl>}
        <div className="flex flex-wrap gap-2">
          {first && <button type="button" className={campaignPrimary} onClick={() => open(first)}>{first.title}</button>}
          {!first && roster && <button type="button" className={campaignPrimary} onClick={roster}>Open roster</button>}
          {operations && <button type="button" className={campaignControl} onClick={operations}>Browse operations</button>}
        </div>
      </div>
    </section>
    {following.length > 0 && <section aria-label="Available on the bridge" className="flex flex-wrap gap-2">
      {following.map(quest => <button key={quest.id} type="button" className={campaignControl} onClick={() => open(quest)}>{quest.title}</button>)}
    </section>}
  </>
}
