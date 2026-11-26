
import { useMemo, useState } from 'react'
import { PARTS_BY_ID, type CampaignBook, type CampaignQuest, type Save } from '@cyber/domain'
import { campaignControl, CampaignQuestRow } from './CampaignQuestRow'
import { campaignActs, operationTypes, operationStates, type CampaignNavigation, type OperationBrowse } from './navigation'
import { questAvailable } from './quests'
import { salvageCrew, salvageOptions, type SalvageContract } from './salvage'
import { nameOf } from '../story/runner'

const option = 'min-h-11 rounded-lg border border-white/15 bg-[#17253b] px-3 text-sm'
const pageSize = 16

export default function OperationsScreen({ book, save, port, complete, navigation, open, travel, browse, onBrowse, startSalvage }: {
  book: CampaignBook; save: Save; port?: string; complete: ReadonlySet<string>; navigation: CampaignNavigation
  open: (quest: CampaignQuest) => void; travel: (destination?: string) => void
  browse: OperationBrowse; onBrowse: (state: OperationBrowse) => void
  startSalvage?: (contract: SalvageContract, outfit: number) => void
}) {
  const [selectedLead, setSelectedLead] = useState<number>()
  const { type, act, state, search, page } = browse
  const local = useMemo(() => new Set((state === 'Ready' || state === 'Locked') && !save.mission
    ? book.quests.filter(quest => questAvailable(save, book, quest, port)).map(quest => quest.id) : []),
    [state, save, book, port])
  const ports = useMemo(() => new Map(book.supply?.ports.map(row => [row.id, row.name])), [book])
  const exclude = useMemo(() => new Set([
    ...book.recruits?.map(recruit => recruit.signOn) ?? [],
    ...book.allies?.flatMap(ally => ally.pairConsent ?? []) ?? [],
  ]), [book])
  const query = search.trim().toLocaleLowerCase()
  const matching = book.quests.filter(quest => {
    if (exclude.has(quest.id)) return false
    const kind = quest.encounter ? book.commands.has(quest.encounter) ? 'Ship' : 'Ground' : 'Story'
    const group = navigation.acts.get(quest.id) ?? 'Shared'
    if (type !== 'All' && type !== kind || act !== 'All acts' && act !== group) return false
    const completeHere = complete.has(quest.id)
    if (state === 'Completed' && !completeHere || state === 'Ready' && !local.has(quest.id)
      || state === 'Locked' && (completeHere || local.has(quest.id))) return false
    return (quest.title + ' ' + (quest.port ? ports.get(quest.port) ?? '' : '')).toLocaleLowerCase().includes(query)
      || !!query && !!quest.encounter && (navigation.missions.get(quest.encounter)?.chapter.id ?? '').toLocaleLowerCase().includes(query)
  })
  const current = Math.min(page, Math.max(Math.ceil(matching.length / pageSize) - 1, 0))
  const leads = type === 'Salvage' ? salvageCrew(save, book) : []
  const lead = selectedLead !== undefined && leads.includes(selectedLead) ? selectedLead : leads[0]
  const contracts = type === 'Salvage' ? salvageOptions(save, book).filter(row => row.title.toLocaleLowerCase().includes(query)) : []
  return <section aria-labelledby="operations-title" className="space-y-3">
    <h1 id="operations-title" className="font-display text-2xl font-bold">Operations</h1>
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs"><span id="operation-type">Type</span><select aria-labelledby="operation-type" className={option} value={type} onChange={e => onBrowse({ ...browse, type: e.currentTarget.value as typeof type, page: 0 })}>
        {operationTypes.filter(value => value !== 'Salvage' || book.fourAct).map(value => <option key={value}>{value}</option>)}</select></label>
      {type !== 'Salvage' && <><label className="grid gap-1 text-xs"><span id="operation-act">Act</span><select aria-labelledby="operation-act" className={option} value={act} onChange={e => onBrowse({ ...browse, act: e.currentTarget.value as typeof act, page: 0 })}>
        {['All acts', ...campaignActs].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-xs"><span id="operation-status">Status</span><select aria-labelledby="operation-status" className={option} value={state} onChange={e => onBrowse({ ...browse, state: e.currentTarget.value as typeof state, page: 0 })}>
        {operationStates.map(value => <option key={value}>{value}</option>)}</select></label></>}
      <input className={option + ' min-w-40 flex-1'} placeholder="Search missions or ports" aria-label="Search operations"
        type="search" value={search} onChange={e => onBrowse({ ...browse, search: e.currentTarget.value, page: 0 })} />
    </div>
    {type === 'Salvage' ? <>
      {lead !== undefined && <label className="flex flex-wrap items-center gap-2 text-sm">Sortie lead
        <select className={option} value={lead} onChange={event => setSelectedLead(Number(event.currentTarget.value))}>
          {leads.map(outfit => <option key={outfit} value={outfit}>{nameOf(book.story, outfit)}</option>)}
        </select>
      </label>}
      {!contracts.length && <p className="text-sm text-slate-300">Clear a ground battle, then dock at Homestretch or an operating base.</p>}
      {contracts.map(row => <article key={row.key} className="rounded-xl border border-white/10 bg-[#101b2d] p-3">
        <h2 className="font-semibold">{row.title}</h2>
        <p className="text-sm">1 watch · {row.reward} Hangar Alloy on victory</p>
        {row.recipe && !save.salvage?.clears[row.key] && <p className="text-sm">First clear · {PARTS_BY_ID.get(row.recipe.part)?.name} recipe</p>}
        {!row.reward && <p className="text-sm">Spend Hangar Alloy before launching.</p>}
        <button type="button" className={campaignControl + ' disabled:opacity-40'}
          disabled={lead === undefined || !row.reward || !!save.mission || !!save.expedition || !!save.campaignDay.pending || !!save.pairScene}
          onClick={() => { if (lead !== undefined) startSalvage?.(row.key, lead) }}>Launch salvage</button>
      </article>)}
    </> : <><p className="text-sm text-slate-300">{matching.length} {matching.length === 1 ? 'operation' : 'operations'}</p>
    <ol className="rounded-xl border border-white/10 bg-[#101b2d]">
      {matching.slice(current * pageSize, (current + 1) * pageSize).map(quest => <CampaignQuestRow key={quest.id}
        quest={quest} book={book} save={save} port={port} complete={complete} navigation={navigation} open={open} travel={travel} />)}
      {matching.length === 0 && <li className="p-3 text-sm text-slate-300">No matching operations.</li>}
    </ol>
    {matching.length > pageSize && <div className="flex gap-2">
      <button type="button" className={campaignControl + ' disabled:opacity-35'} disabled={current === 0} onClick={() => onBrowse({ ...browse, page: current - 1 })}>Previous</button>
      <button type="button" className={campaignControl + ' disabled:opacity-35'} disabled={(current + 1) * pageSize >= matching.length}
        onClick={() => onBrowse({ ...browse, page: current + 1 })}>Next</button>
    </div>}</>}
  </section>
}
