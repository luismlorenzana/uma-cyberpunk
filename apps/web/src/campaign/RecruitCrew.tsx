import { useState } from 'react'
import type { CampaignBook, CampaignQuest, CampaignReleaseFile, Save } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { CampaignThumbnail } from './CampaignThumbnail'
import { campaignControl, campaignPrimary } from './CampaignQuestRow'
import { homeQuestTravel } from './homestretch'

export default function RecruitCrew({ book, save, assets, meet, cargo }: {
  book: CampaignBook; save: Save; assets: ReadonlyMap<string, CampaignReleaseFile>
  meet: (quest: CampaignQuest) => void; cargo: () => void
}) {
  const [system, setSystem] = useState<string>()
  const [search, setSearch] = useState('')
  const [choice, setChoice] = useState<number>()
  const aboard = new Set(save.crew.map(member => member.outfit))
  const systems = [...book.fourAct?.systems.values() ?? []]
  const quests = new Map(book.quests.map(q => [q.id, q]))
  const recruits = (book.recruits ?? []).map(recruit => ({
    recruit, name: nameOf(book.story, recruit.outfit), system: book.fourAct?.arcs.get(recruit.outfit)?.system,
  }))
  const remaining = recruits.filter(row => !aboard.has(row.recruit.outfit))
  const shown = remaining.filter(row => (!system || row.system === system) && row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const selected = shown.find(row => row.recruit.outfit === choice)
  const quest = selected && quests.get(selected.recruit.signOn)
  const travel = quest && homeQuestTravel(save, book, quest)
  const port = book.supply?.ports.find(row => row.id === quest?.port)
  const street = selected && book.wardrobe?.members.find(row => row.speaker === selected.recruit.outfit)?.looks.street
  const portrait = street && assets.get(street.profile ?? street.asset)
  return <section className="space-y-3" aria-labelledby="recruit-title">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 id="recruit-title" className="font-display text-2xl font-bold">Recruit crew</h1>
        <p className="text-sm text-slate-300">{recruits.length - remaining.length} / {recruits.length} aboard</p>
      </div>
      <input type="search" aria-label="Find a recruit" placeholder="Find a recruit" value={search}
        className="min-h-11 w-full max-w-xs rounded-lg border border-white/15 bg-[#101e32] px-3 text-white"
        onChange={event => { setSearch(event.currentTarget.value); setSystem(undefined); setChoice(undefined) }} />
    </header>
    <nav aria-label="Recruitment systems" className="flex flex-wrap gap-2">
      <button type="button" className={campaignControl + ' aria-pressed:border-cyan-200'} aria-pressed={!system}
        onClick={() => { setSystem(undefined); setChoice(undefined) }}>All · {remaining.length}</button>
      {systems.map(({ id }) => <button key={id} type="button" className={campaignControl + ' capitalize aria-pressed:border-cyan-200'}
        aria-pressed={system === id} onClick={() => { setSystem(id); setChoice(undefined) }}>
        {id.replaceAll('-', ' ')} · {remaining.filter(row => row.system === id).length}
      </button>)}
    </nav>
    <div className="grid items-start gap-3 sm:grid-cols-[minmax(13rem,1fr)_minmax(14rem,1fr)]">
      <ul aria-label="Available recruits" className="grid max-h-64 gap-1 overflow-auto rounded-xl border border-white/10 bg-[#101b2d] p-2 sm:grid-cols-2">
        {shown.map(({ recruit, name }) => <li key={recruit.outfit}><button type="button" data-recruit={recruit.outfit}
          aria-pressed={choice === recruit.outfit} className={campaignControl + ' w-full justify-start text-left aria-pressed:border-cyan-200'}
          onClick={() => setChoice(recruit.outfit)}>{name}</button></li>)}
      </ul>
      {selected && quest ? <article className="space-y-3 rounded-xl border border-white/10 bg-[#101b2d] p-3" aria-label="Selected recruit">
        <div className="flex items-center gap-3">
          <CampaignThumbnail asset={portrait} className="size-16 shrink-0 rounded-lg object-cover object-top" />
          <div><h2 className="font-display text-xl font-bold">{selected.name}</h2>{port && <p className="text-sm text-cyan-200">{port.name}</p>}</div>
        </div>
        <p className="text-sm text-slate-200">{selected.recruit.request}</p>
        <button type="button" className={campaignPrimary + ' disabled:opacity-40'} disabled={!travel?.affordable}
          onClick={() => meet(quest)}>{travel?.fuel ? `Travel and meet · ${travel.fuel} fuel` : 'Meet'}</button>
        {travel && !travel.affordable && <button type="button" className={campaignControl} onClick={cargo}>Get fuel in Cargo</button>}
        {!travel && <p className="text-sm text-slate-300">Meeting unavailable at this watch.</p>}
      </article> : <p className="p-2 text-sm text-slate-300">{shown.length ? 'Choose an Uma to meet.' : remaining.length ? 'No matching recruits.' : 'All Umas are aboard.'}</p>}
    </div>
  </section>
}
