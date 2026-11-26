import type { CampaignQuest, CampaignReleaseFile } from '@cyber/domain'
import { CampaignThumbnail } from './CampaignThumbnail'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'

export const homeAreas = ['Deck', 'Bridge', 'Navigation', 'Engineering', 'Hangar', 'Cargo', 'Quarters'] as const
export type HomeArea = typeof homeAreas[number]

const rooms = [
  { area: 'Quarters', left: '11%', top: '24%', width: '50%', height: '22%' },
  { area: 'Bridge', left: '62%', top: '24%', width: '33%', height: '22%' },
  { area: 'Engineering', left: '11%', top: '49%', width: '22%', height: '31%' },
  { area: 'Hangar', left: '34%', top: '49%', width: '35%', height: '31%' },
  { area: 'Cargo', left: '70%', top: '49%', width: '24%', height: '31%' },
] as const
type Room = typeof rooms[number]['area']

type Manifest = { fuel: number; provisions: number; alloy?: number }

function Stores({ cargo }: { cargo: Manifest }) {
  return <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
    <div><dt className="text-slate-300">Fuel</dt><dd className="font-semibold tabular-nums">{cargo.fuel}</dd></div>
    <div><dt className="text-slate-300">Provisions</dt><dd className="font-semibold tabular-nums">{cargo.provisions}</dd></div>
    {cargo.alloy !== undefined && <div><dt className="text-slate-300">Alloy</dt><dd className="font-semibold tabular-nums">{cargo.alloy}</dd></div>}
  </dl>
}

export function ShipHome({ ship, location, day, cargo, backdrop, ready, roster, operations, open, deck, recruit, navigation }: {
  ship: string; location?: string; day?: number; cargo?: Manifest
  backdrop?: CampaignReleaseFile; ready: readonly CampaignQuest[]
  roster?: () => void; operations?: () => void; open: (quest: CampaignQuest) => void
  deck?: { open: (room: Room) => void; crew: number; reactor: number; hangar: number }
  recruit?: () => void; navigation?: () => void
}) {
  const [first, ...following] = ready
  return <>
    {deck ? <section className="overflow-hidden rounded-xl border border-sky-200/15 bg-[#080e21]" aria-labelledby="ship-name">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-cyan-200">{location}{location && day !== undefined && ' · '}{day !== undefined && 'Day ' + day}</p>
          <h1 id="ship-name" className="font-display text-3xl font-bold">{ship}</h1>
        </div>
        {cargo && <Stores cargo={cargo} />}
        <div className="flex flex-wrap gap-2">
          {recruit && <button type="button" className={campaignPrimary} onClick={recruit}>Recruit crew</button>}
          {navigation && <button type="button" className={campaignControl} onClick={navigation}>Navigation</button>}
        </div>
      </div>
      <div className="relative isolate mx-auto aspect-[5/2] w-full max-w-[56rem]" data-homestretch-cutaway aria-label="Homestretch rooms">
        <img src="/images/homestretch-cutaway.webp" alt="Cutaway of Homestretch with two decks"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        {rooms.map(({ area, ...placement }) => <button key={area} type="button" data-homestretch-room={area} style={placement}
          aria-label={area} onClick={() => deck.open(area)}
          className="group absolute flex min-h-11 items-end justify-center rounded-lg border border-transparent px-1 pb-1 text-xs font-bold hover:border-cyan-200/65 hover:bg-cyan-200/10 focus-visible:border-cyan-100 focus-visible:outline-2 focus-visible:outline-white">
          <span className="flex flex-wrap items-center justify-center gap-x-2 rounded bg-[#060b17]/95 px-2 py-1 text-white ring-1 ring-cyan-200/40">
            {area}<span className="hidden font-medium text-cyan-100 sm:inline">
              {area === 'Quarters' ? `${deck.crew} assigned` : area === 'Engineering' ? `${deck.reactor} power`
                : area === 'Hangar' ? `Lv ${deck.hangar}` : area === 'Cargo' ? `${cargo?.fuel ?? 0} fuel` : undefined}
            </span>
          </span>
        </button>)}
      </div>
    </section> : <section aria-labelledby="ship-name" className="relative isolate overflow-hidden rounded-2xl border border-white/12 bg-[#142437]">
      <CampaignThumbnail asset={backdrop} className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-[#081222] via-[#081222]/78 to-[#081222]/15" />
      <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-7">
        <div>
          <p className="text-sm font-medium text-cyan-200">{location}{location && day !== undefined && ' · '}{day !== undefined && 'Day ' + day}</p>
          <h1 id="ship-name" className="max-w-2xl break-words font-display text-3xl font-bold text-white sm:text-4xl">{ship}</h1>
        </div>
        {cargo && <Stores cargo={cargo} />}
        <div className="flex flex-wrap gap-2">
          {recruit && <button type="button" className={campaignPrimary} onClick={recruit}>Recruit crew</button>}
          {first && <button type="button" className={recruit ? campaignControl : campaignPrimary} onClick={() => open(first)}>{first.title}</button>}
          {!first && roster && <button type="button" className={campaignPrimary} onClick={roster}>Open roster</button>}
          {operations && <button type="button" className={campaignControl} onClick={operations}>Browse operations</button>}
        </div>
      </div>
    </section>}
    {(deck ? ready : following).length > 0 && <section aria-label="Available on the bridge" className="flex flex-wrap gap-2">
      {(deck ? ready : following).map(quest => <button key={quest.id} type="button" className={campaignControl} onClick={() => open(quest)}>{quest.title}</button>)}
    </section>}
  </>
}
