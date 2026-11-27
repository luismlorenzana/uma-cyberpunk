import { useState } from 'react'
import { stationCapacity, type CampaignBook, type CampaignReleaseFile, type Save, type Speaker } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { CampaignAvatar } from './CampaignThumbnail'
import { residentPortrait } from './menu-portraits'
import { campaignControl } from './CampaignQuestRow'
import { moveHomeCabin, type homestretchCabins } from './homestretch'
import { stationOf } from './watch'

export default function StationCabins({ cabins, book, save, open, assets }: {
  cabins: ReturnType<typeof homestretchCabins>; book: CampaignBook; save: Save; assets: ReadonlyMap<string, CampaignReleaseFile>; open: (actor: Speaker) => void
}) {
  const [search, setSearch] = useState('')
  const [moving, setMoving] = useState<Speaker>()
  const [destination, setDestination] = useState(0)
  const capacity = stationCapacity(stationOf(save, book))
  const occupied = new Set(cabins.filter(row => !row.temporary).map(row => row.berth))
  const vacant = moving === undefined ? [] : Array.from({ length: capacity }, (_, index) => index + 1).filter(berth => !occupied.has(berth))
  const busy = !!(save.mission || save.expedition || save.campaignDay.pending || save.pairScene)
  const visible = cabins.map(row => ({ ...row, name: nameOf(book.story, row.actor) }))
    .filter(row => row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const blocks = [
    { label: 'Core Quarters', first: 1, last: 20 },
    { label: 'Habitat A', first: 21, last: 120 },
    { label: 'Habitat B', first: 121, last: 280 },
  ]
  return <div className="space-y-2">
    <p className="text-sm">{occupied.size}/{capacity} permanent cabins assigned · {cabins.filter(row => row.temporary && row.berth).length} in reserve</p>
    <input className="min-h-11 w-full rounded bg-[#24344b] p-2 sm:w-72" type="search" aria-label="Find a resident"
      placeholder="Find a resident" value={search} onChange={event => setSearch(event.currentTarget.value)} />
    {visible.length === 0 && <p className="text-sm">No matching residents.</p>}
    <ul className="grid gap-2 sm:grid-cols-2">
      {visible.map(({ actor, name, berth, temporary, away }) => <li key={actor} className="rounded border border-white/10 p-2">
        <button type="button" className={campaignControl + ' w-full justify-between'} onClick={() => open(actor)}>
          <span className="flex items-center gap-2 text-left"><CampaignAvatar asset={residentPortrait(book, assets, actor)} name={name} className="size-8 rounded" />{name}</span>
          <span className="text-xs text-cyan-200">{berth === undefined ? 'Awaiting a cabin' : temporary ? 'Guest room ' + berth : 'Cabin ' + berth}{away && ' · Away'}</span>
        </button>
        {moving === actor ? <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={event => {
          event.preventDefault()
          void updateSave(current => moveHomeCabin(current, book, actor, destination)).then(() => setMoving(undefined))
        }}>
          <select className="min-h-11 rounded bg-[#24344b] p-2" aria-label="Destination cabin" value={destination}
            onChange={event => setDestination(Number(event.currentTarget.value))}>
            <option value={0}>Choose cabin</option>
            {blocks.map(({ label, first, last }) => {
              const group = vacant.filter(berth => berth >= first && berth <= last)
              return group.length > 0 && <optgroup key={label} label={label}>
                {group.map(berth => <option key={berth} value={berth}>Cabin {berth}</option>)}
              </optgroup>
            })}
          </select>
          <button type="submit" className={campaignControl + ' disabled:opacity-40'} disabled={busy || !vacant.includes(destination)}>Move</button>
          <button type="button" className={campaignControl} onClick={() => setMoving(undefined)}>Cancel</button>
        </form> : !away && !busy && occupied.size < capacity && <button type="button" className={campaignControl + ' mt-1'}
          onClick={() => { setDestination(0); setMoving(actor) }}>Move cabin</button>}
      </li>)}
    </ul>
  </div>
}
