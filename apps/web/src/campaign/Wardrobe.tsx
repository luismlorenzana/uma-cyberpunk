import { LOOK_NAME, LOOKS, type CampaignBook, type CampaignReleaseFile, type Look } from '@cyber/domain'
import { useState } from 'react'
import { nameOf } from '../story/runner'
import { CampaignThumbnail } from './CampaignThumbnail'

export function Wardrobe({ book, assets, speaker, back }: {
  book: CampaignBook; assets: ReadonlyMap<string, CampaignReleaseFile>; speaker: number; back: () => void
}) {
  const [role, setRole] = useState<Look>('ship-casual')
  const member = book.wardrobe?.members.find(member => member.speaker === speaker)
  const selected = member?.looks[role]
  return <section role="dialog" aria-modal="true" aria-label="Crew wardrobe" className="fixed z-30 flex flex-col gap-3 overflow-hidden bg-[#0b1020] p-3 text-white"
    style={{ inset: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }}>
    <header className="flex items-center gap-3"><button type="button" className="min-h-11 rounded-lg bg-white/10 px-3" onClick={back}>Crew stories</button>
      <h2 className="min-w-0 flex-1 font-bold">{nameOf(book.story, speaker)}</h2><span className="text-sm">{LOOK_NAME[role]}</span></header>
    <div className="grid min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)] gap-3">
      <div className="flex flex-col gap-1 overflow-y-auto" aria-label="Outfits">{LOOKS.map(look =>
        <button type="button" key={look} aria-pressed={look === role} className={`min-h-11 shrink-0 rounded-lg px-3 text-left text-sm ${look === role ? 'bg-cyan-200 text-slate-950' : 'bg-white/10'}`} onClick={() => setRole(look)}>{LOOK_NAME[look]}</button>)}</div>
      <div className="relative min-h-0 rounded-lg bg-white/5" data-wardrobe-role={role}>
        {selected ? <CampaignThumbnail key={selected.asset} asset={assets.get(selected.asset)} className="size-full object-contain" /> : <p className="p-3 text-sm">Portrait unavailable.</p>}
      </div>
    </div>
  </section>
}
