import { LOOK_NAME, type CampaignBook, type CampaignReleaseFile, type Look, type Speaker } from '@cyber/domain'
import { useEffect, useState } from 'react'
import { nameOf } from '../story/runner'
import { CampaignThumbnail } from './CampaignThumbnail'
import { campaignImage } from './load'
import { loadScenePortraits } from './portraits'
import { ScenePortrait, selectScenePortrait, type ScenePortraitImage } from '../story/ScenePortrait'

export function Wardrobe({ book, assets, speaker, back }: {
  book: CampaignBook; assets: ReadonlyMap<string, CampaignReleaseFile>; speaker: Speaker; back: () => void
}) {
  const member = book.wardrobe?.members.find(member => member.speaker === speaker)
  const [role, setRole] = useState(member?.default ?? (member?.looks['ship-casual'] ? 'ship-casual' : Object.keys(member?.looks ?? {})[0] ?? 'ship-casual'))
  const selected = member?.looks[role]
  const label = (role: string) => member?.looks[role]?.label ?? LOOK_NAME[role as Look] ?? role.replaceAll('-', ' ')
  return <section role="dialog" aria-modal="true" aria-label="Crew wardrobe" className="fixed z-30 flex flex-col gap-3 overflow-hidden bg-[#0b1020] p-3 text-white"
    style={{ inset: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }}>
    <header className="flex items-center gap-3"><button type="button" className="min-h-11 rounded-lg bg-white/10 px-3" onClick={back}>Crew stories</button>
      <h2 className="min-w-0 flex-1 font-bold">{nameOf(book.story, speaker)}</h2><span className="text-sm">{label(role)}</span></header>
    <div className="grid min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)] gap-3">
      <div className="flex flex-col gap-1 overflow-y-auto" aria-label="Outfits">{Object.keys(member?.looks ?? {}).map(look =>
        <button type="button" key={look} aria-pressed={look === role} className={`min-h-11 shrink-0 rounded-lg px-3 text-left text-sm ${look === role ? 'bg-cyan-200 text-slate-950' : 'bg-white/10'}`} onClick={() => setRole(look)}>{label(look)}</button>)}</div>
      <div className="relative flex min-h-0 gap-2 rounded-lg bg-white/5" data-wardrobe-role={role}>
        {selected ? <CampaignThumbnail key={selected.asset} asset={assets.get(selected.asset)} className="h-full w-0 min-w-0 flex-1 object-contain" /> : <p className="p-3 text-sm">Portrait unavailable.</p>}
        {selected?.portrait && <ExpressionPreview key={selected.portrait} book={book} assets={assets} speaker={speaker} base={selected.portrait} />}
      </div>
    </div>
  </section>
}

function ExpressionPreview({ book, assets, speaker, base }: { book: CampaignBook; assets: ReadonlyMap<string, CampaignReleaseFile>; speaker: Speaker; base: string }) {
  const [images, setImages] = useState<ScenePortraitImage[]>([]), [emote, setEmote] = useState('neutral')
  useEffect(() => {
    let live = true
    const urls: string[] = []
    void loadScenePortraits([{ speaker, asset: base }], book.portraitFaces ?? [], async id => {
      const ref = assets.get(id)
      if (!ref) throw new Error('Missing portrait')
      const url = await campaignImage(ref)
      if (live) urls.push(url); else URL.revokeObjectURL(url)
      return url
    }).then(images => { if (live) setImages(images) })
    return () => { live = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [book, assets, speaker, base])
  const shown = selectScenePortrait(images, speaker, emote)
  const expressions = ['neutral', ...(images[0]?.faces?.map(face => face.emote) ?? [])]
  return <div className="flex min-w-[12rem] flex-col gap-2 overflow-y-auto p-2" aria-label="Approved expressions">
    {shown && <ScenePortrait key={shown.image.url} image={shown.image} face={shown.face} />}
    <div className="flex flex-wrap gap-1">{expressions.map(tag => <button type="button" key={tag} aria-pressed={tag === emote}
      onClick={() => setEmote(tag)} className={`min-h-11 rounded-lg px-3 text-sm capitalize ${tag === emote ? 'bg-cyan-200 text-slate-950' : 'bg-white/10'}`}>{tag}</button>)}</div>
  </div>
}
