
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { awayMembers, bandsOf, campaignSupport, campaignLevel, crewSpeaker, ROLE_NAME, stationCapacity, STAND_IN_BANDS, type CampaignBook, type CampaignDate, type CampaignQuest,
  type CampaignReleaseFile, type Save, type Speaker } from '@cyber/domain'
import { updateSave } from '../save/game'
import { nameOf } from '../story/runner'
import { CampaignThumbnail } from './CampaignThumbnail'
import { campaignControl, CampaignQuestRow } from './CampaignQuestRow'
import { expeditionWatchScene } from './expedition'
import { questScene } from './quests'
import { dateAvailable } from './dates'
import { DatePanel } from './DatePanel'
import { campaignActs, characterTabs, rosterStatus, type CampaignNavigation, type RosterBrowse, type RosterEntry, type RosterKind } from './navigation'
import { homestretchCabins, setLieutenantResidence } from './homestretch'
import { stationOf } from './watch'
import { Wardrobe } from './Wardrobe'
import { campaignActorXp } from './progression'
import { useMaster } from '../master/master'
import { characterBuild } from './character-build'
import { CharacterStats } from './CharacterStats'
import { CharacterEquipment } from './CharacterEquipment'
import { CharacterProgression } from './CharacterProgression'
import { expeditionCrewBands } from './training'

const roles: readonly RosterKind[] = ['Uma', 'General', 'Lieutenant']
const choices = { Uma: 'Umas', General: 'Generals', Lieutenant: 'Lieutenants' }
const pageSize = 18
const assignments = {
  uma: 'Rifle officer', 'boss-ally': 'Melee officer', 'melee-shield': 'Shield specialist',
  'ranged-medic': 'Combat medic', 'long-range': 'Long-range specialist',
} as const

export default function RosterScreen({ book, save, assets, complete, navigation, port, open, travel, evening, shared, report, browse, onBrowse }: {
  book: CampaignBook; save: Save; assets: ReadonlyMap<string, CampaignReleaseFile>; complete: ReadonlySet<string>
  navigation: CampaignNavigation; port?: string
  open: (quest: CampaignQuest) => void; travel: (destination?: string) => void; evening?: (date: CampaignDate) => void
  shared?: (actor: Speaker) => (() => void) | undefined; report?: (scene: string) => void
  browse: RosterBrowse; onBrowse: (state: RosterBrowse) => void
}) {
  const { kind, search, page, selected, tab = 'Stats' } = browse
  const [wardrobe, setWardrobe] = useState<Speaker>()
  const master = useMaster()
  const tabId = useId()
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  const list = useRef<HTMLDivElement>(null)
  const detail = useRef<HTMLDivElement>(null)
  const rosterSpeakers = useMemo(() => new Set(navigation.roster.map(row => row.speaker)), [navigation])
  const names = useMemo(() => new Map(navigation.roster.map(row => [row.speaker, nameOf(book.story, row.speaker)])), [book, navigation])
  const candidates = navigation.roster.filter(row => row.kind === kind && names.get(row.speaker)!.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const chosenIndex = candidates.findIndex(row => row.speaker === selected)
  const visiblePage = chosenIndex < 0 ? page : Math.floor(chosenIndex / pageSize)
  const entry = candidates[chosenIndex < 0 ? visiblePage * pageSize : chosenIndex]
  const actor = entry?.speaker
  useEffect(() => { if (list.current) list.current.scrollTop = 0 }, [visiblePage, kind, search])
  useEffect(() => { if (detail.current) detail.current.scrollTop = 0 }, [actor, tab])
  const members = new Map(save.crew.map(member => [crewSpeaker(member), member]))
  const profile = (row: RosterEntry) => {
    const look = book.wardrobe?.members.find(member => member.speaker === row.speaker)
    if (row.kind !== 'Uma' && !members.has(row.speaker)
      && (!look?.after || !save.story.seen.includes(look.after))) return undefined
    if (look?.requiresFlag && !save.story.flags.includes(look.requiresFlag)) return undefined
    return look
  }
  const avatar = (row: RosterEntry) => {
    const look = profile(row)
    const first = navigation.quests.get(row.quests[0] ?? '')
    const fallback = row.kind === 'Uma' && book.art.find(art => art.scene === first?.scene)?.portraits
      .find(portrait => portrait.speaker === row.speaker && !portrait.emote)?.profile
    const preferred = look?.looks[look.default ?? 'ship-casual']
    const ref = preferred?.profile ?? look?.looks['ship-casual']?.profile ?? (fallback || undefined)
    return ref ? assets.get(ref) : undefined
  }
  function select(speaker: Speaker) {
    onBrowse({ ...browse, selected: speaker })
    setWardrobe(undefined)
  }
  function changePage(next: number) {
    onBrowse({ ...browse, page: next, selected: undefined })
    setWardrobe(undefined)
  }
  const guestWardrobes = book.wardrobe?.members.filter(row => typeof row.speaker === 'string' && !rosterSpeakers.has(row.speaker)
    && row.after && save.story.seen.includes(row.after) && (!row.requiresFlag || save.story.flags.includes(row.requiresFlag))) ?? []
  const member = entry ? members.get(entry.speaker) : undefined
  const ally = book.allies?.find(row => row.heroine === entry?.speaker)
  const companion = entry?.kind === 'General' ? ally?.member : entry?.kind === 'Uma' ? entry.speaker : undefined
  const date = book.dates?.find(row => row.companion === companion)
  const canVisit = date && !save.expedition && dateAvailable(save, book, date)
  const sharedEvening = entry && shared?.(entry.speaker)
  const chapters = entry?.quests.flatMap(id => navigation.quests.get(id) ?? []) ?? []
  const lead = entry?.lead ?? (typeof entry?.speaker === 'number' ? entry.speaker : undefined)
  const duo = lead === undefined ? undefined : [...book.fourAct?.duos.values() ?? []].find(row => row.umas.includes(lead))
  const partner = duo?.umas.find(outfit => outfit !== lead)
  const assignment = duo?.expedition?.members.find(row => (row.role === 'uma' ? row.outfit : row.heroine) === entry?.speaker)
  const variant = assignment ? (duo?.expedition?.members.filter(row => row.role === assignment.role).indexOf(assignment) ?? 0) : 0
  const route = duo?.expedition?.route
  const formationIndex = assignment ? duo?.expedition?.members.indexOf(assignment) : undefined
  const formationEncounter = formationIndex === undefined ? undefined : route?.stops
    .map(id => navigation.quests.get(id)?.encounter)
    .find(id => id && book.ground.has(id))
  const formationBands = formationIndex === undefined || !formationEncounter || typeof actor !== 'string' ? undefined
    : expeditionCrewBands(navigation.missions.get(formationEncounter)?.mission.scenario)[formationIndex]
  const info = master.status === 'ready' && typeof actor === 'number' ? master.view.info.get(actor) : undefined
  const bands = info ? bandsOf(info.stats) : formationBands ?? STAND_IN_BANDS
  const bandsSource = info ? 'Personal bands' : formationBands ? 'Bands for the first expedition battle' : 'Standard bands for this preview'
  const xp = actor === undefined ? undefined : campaignActorXp(save, actor)
  const fit = actor === undefined ? undefined : { actor, bands, assignment, variant }
  const build = fit && (tab === 'Stats' || tab === 'Equipment') ? characterBuild(save, fit) : undefined
  const related = [...new Set([duo?.local?.base, duo?.local?.evidence, ...(duo?.returns.map(row => row.quest) ?? []),
    route?.launch, ...route?.stops ?? [], route?.return])].flatMap(id =>
    id && !entry?.quests.includes(id) ? navigation.quests.get(id) ?? [] : [])
  const returned = entry?.kind === 'Lieutenant' && entry.quests.every(id => complete.has(id))
  const resident = typeof entry?.speaker === 'string' && save.station?.lieutenantResidents?.includes(entry.speaker)
  const watch = returned && save.expedition?.duo === duo?.id ? expeditionWatchScene(save, book, complete) : null
  const hasActor = (scene: string) => book.scenes.get(scene)?.cast.some(actor => (actor.outfit ?? actor.heroine) === entry?.speaker)
  const returnScene = returned ? chapters.filter(row => complete.has(row.id)).map(row => questScene(save, row))
    .findLast(id => save.story.seen.includes(id) && hasActor(id)) : undefined
  const crewWatch = watch && hasActor(watch.scene) ? watch : null
  const duty = member && (awayMembers(save.operations, save.squads).includes(member.outfit) ? 'Away on assignment'
    : campaignSupport(book, save).ashore.has(member.outfit) ? 'Ashore'
      : save.expedition ? assignment && duo?.id === save.expedition.duo ? 'Assigned to the active expedition' : 'On Homestretch'
        : 'Aboard Homestretch')
  const signOn = lead === undefined ? undefined : book.recruits?.find(recruit => recruit.outfit === lead)
  return <section aria-labelledby="roster-title" className="grid min-h-[17rem] grid-cols-[minmax(8rem,1fr)_minmax(0,3fr)] gap-2.5"
    style={{ height: 'calc(100dvh - 5.5rem - var(--inset-top, 0px) - var(--inset-bottom, 0px))' }}>
      <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101b2d]">
        <div className="space-y-1.5 border-b border-white/10 p-2">
          <h1 id="roster-title" className="font-display text-lg font-bold">Roster</h1>
          <select aria-label="Roster category" className="min-h-11 w-full rounded-lg border border-white/15 bg-[#17273c] px-2 text-sm text-white" value={kind}
            onChange={event => { const next = roles.find(role => role === event.currentTarget.value); if (next) onBrowse({ kind: next, search: '', page: 0, tab }) }}>
            {roles.map(role => <option key={role} value={role}>{choices[role]} · {navigation.roster.filter(row => row.kind === role).length}</option>)}
          </select>
          <input type="search" aria-label="Search roster" placeholder="Search roster" value={search}
            onChange={event => onBrowse({ ...browse, search: event.currentTarget.value, page: 0, selected: undefined })}
            className="min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#17273c] px-2 text-sm text-white placeholder:text-slate-400" />
        </div>
        <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          <ul aria-label={choices[kind]} className="space-y-1">
            {candidates.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize).map(row => <li key={row.speaker}>
              <button type="button" data-roster-actor={row.speaker} aria-pressed={entry?.speaker === row.speaker} onClick={() => select(row.speaker)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/8 aria-pressed:bg-[#213c58] focus-visible:outline-2 focus-visible:outline-cyan-200">
                <CampaignThumbnail asset={avatar(row)} className="size-9 shrink-0 rounded-md object-cover" />
                <span className="min-w-0"><span className="block break-words text-xs font-semibold sm:text-sm">{names.get(row.speaker)}</span>
                  <span className="block text-[11px] text-slate-300">{rosterStatus(row, save, book, complete)}</span></span>
              </button>
            </li>)}
          </ul>
          {candidates.length === 0 && <p className="p-2 text-sm text-slate-300">No matching crew.</p>}
        </div>
        {candidates.length > pageSize && <div className="flex items-center justify-between gap-1 border-t border-white/10 p-1.5">
          <button type="button" aria-label="Previous roster page" className="min-h-11 min-w-11 rounded-lg bg-white/8 text-sm disabled:opacity-35" disabled={visiblePage === 0} onClick={() => changePage(visiblePage - 1)}>‹</button>
          <span className="text-[11px] tabular-nums text-slate-300">{visiblePage + 1}/{Math.ceil(candidates.length / pageSize)}</span>
          <button type="button" aria-label="Next roster page" className="min-h-11 min-w-11 rounded-lg bg-white/8 text-sm disabled:opacity-35" disabled={(visiblePage + 1) * pageSize >= candidates.length} onClick={() => changePage(visiblePage + 1)}>›</button>
        </div>}
      </aside>
      {entry && fit ? <article className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101b2d]" data-character={entry.speaker}>
        <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 bg-[#142239] p-2.5">
          <CampaignThumbnail asset={avatar(entry)} className="size-13 shrink-0 rounded-lg object-cover sm:size-14" />
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-display text-lg leading-tight font-bold sm:text-xl">{names.get(entry.speaker)}</h2>
            <p className="mt-1 text-xs text-slate-300">{rosterStatus(entry, save, book, complete)}{entry.system && ' · ' + entry.system.replaceAll('-', ' ')}</p>
          </div>
          {xp !== undefined && <p className="shrink-0 rounded-md border border-cyan-200/25 bg-cyan-200/8 px-2 py-1 font-mono text-sm font-bold text-cyan-100">Lv {campaignLevel(xp, save.campaignCurve)}</p>}
        </header>
        <div role="tablist" aria-label="Character menu" className="grid shrink-0 grid-cols-4 border-b border-white/10 px-1">
          {characterTabs.map((value, index) => <button type="button" key={value} ref={button => { tabButtons.current[index] = button }}
            role="tab" id={`${tabId}-${value}`} aria-selected={tab === value} aria-controls={`${tabId}-panel`} tabIndex={tab === value ? 0 : -1}
            className="min-h-11 min-w-0 rounded-t-md border-b-2 border-transparent px-0.5 text-xs font-bold text-slate-300 focus-visible:outline-2 focus-visible:outline-cyan-200 aria-selected:border-cyan-200 aria-selected:bg-cyan-200/8 aria-selected:text-cyan-100 sm:text-sm"
            onClick={() => onBrowse({ ...browse, tab: value, selected: actor })}
            onKeyDown={event => {
              const count = characterTabs.length
              const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count
                : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : undefined
              if (next === undefined) return
              event.preventDefault()
              tabButtons.current[next]?.focus()
              onBrowse({ ...browse, tab: characterTabs[next]!, selected: actor })
            }}>{value}</button>)}
        </div>
        <div ref={detail} id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${tab}`} tabIndex={0}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-2.5 focus-visible:outline-2 focus-visible:outline-cyan-200" data-character-pane={tab}>
          {tab === 'Stats' && <CharacterStats bands={bands} source={bandsSource} build={build} />}
          {tab === 'Equipment' && <CharacterEquipment key={entry.speaker} book={book} save={save} context={fit} build={build} />}
          {tab === 'Progression' && <CharacterProgression save={save} actor={entry.speaker} assigned={!!assignment} />}
          {tab === 'Story' && <>
            {(member || entry.kind !== 'Uma') && profile(entry) && <button type="button" className={campaignControl} onClick={() => setWardrobe(entry.speaker)}>Wardrobe</button>}
            {entry.kind === 'Uma' && !member && signOn && <p className="text-sm text-slate-200">{signOn.request}</p>}
            {entry.kind !== 'Uma' && entry.lead !== undefined && <p className="text-sm text-slate-300">Home front · {names.get(entry.lead)}</p>}
            {entry.kind === 'Uma' && partner !== undefined && <p className="text-sm text-slate-300">Fixed partner · {names.get(partner)}</p>}
            {member?.role && <p className="text-sm text-slate-300">{ROLE_NAME[member.role]}</p>}
            <section aria-label="Character chapters">
              <h3 className="font-semibold">Chapters</h3>
              {campaignActs.map(act => {
                const group = chapters.filter(quest => (navigation.acts.get(quest.id) ?? 'Shared') === act)
                return group.length ? <div key={act} className="mt-2">
                  <p className="px-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">{act}</p>
                  <ol>{group.map(quest => <CampaignQuestRow key={quest.id} quest={quest} book={book} save={save}
                    port={port} complete={complete} navigation={navigation} open={open} travel={travel}
                    title={quest.id === signOn?.signOn ? 'Sign on' : 'Open chapter'} />)}</ol>
                </div> : null
              })}
            </section>
            <section className="space-y-2 rounded-lg border border-white/10 p-2 text-sm" aria-label="Personal interactions">
              {duty && <p className="text-slate-300">{duty}</p>}
              {date && member && <DatePanel save={save} book={book} dates={[date]} compact />}
              {date && canVisit && evening ? <button type="button" className={campaignControl} onClick={() => evening(date)}>Visit this evening</button>
                : date && <p>{!member || !complete.has(date.after) ? 'Evenings open after ' + (navigation.quests.get(date.after)?.title ?? 'the introduction')
                  : entry.kind === 'General' && lead !== undefined && !complete.has(book.fourAct?.arcs.get(lead)?.rehabilitation?.quarters ?? '')
                    ? 'Evenings open after the shared quarters settlement' : 'Evening visit unavailable at this watch'}</p>}
              {sharedEvening && <button type="button" className={campaignControl} onClick={sharedEvening}>Invite both to an evening</button>}
              {entry.kind === 'Lieutenant' && <p>{returned ? assignment && save.expedition?.duo === duo?.id ? 'With the expedition formation' : resident ? 'Resident on Homestretch' : 'Returned to the local crew'
                : 'Crew interactions open after recovery'}</p>}
              {returned && book.stationStory && typeof entry?.speaker === 'string' && !save.expedition && (() => {
                const actor = entry.speaker
                const hasCabin = resident || homestretchCabins(book, save).length < stationCapacity(stationOf(save, book))
                return <button type="button" className={campaignControl + ' disabled:opacity-50'} disabled={!hasCabin}
                  onClick={() => void updateSave(current => setLieutenantResidence(current, book, actor, !resident))}>
                  {resident ? 'Return to the local base' : hasCabin ? 'Assign quarters aboard' : 'Permanent cabin required'}
                </button>
              })()}
              {returned && report && crewWatch && <button type="button" className={campaignControl}
                onClick={() => report(crewWatch.scene)}>{crewWatch.shortfall ? 'Join supply report' : 'Join off-duty watch'}</button>}
              {returned && report && returnScene && <button type="button" className={campaignControl}
                onClick={() => report(returnScene)}>Revisit the return conversation</button>}
            </section>
            {route && assignment && <p className="text-sm text-slate-300">{route.name} · {assignments[assignment.role]}</p>}
            {related.length > 0 && <details className="rounded-lg border border-white/10">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">Duo operations</summary>
              <ol>{related.map(quest => <CampaignQuestRow key={quest.id} quest={quest} book={book} save={save}
                port={port} complete={complete} navigation={navigation} open={open} travel={travel} />)}</ol>
            </details>}
            {guestWardrobes.length > 0 && <details className="rounded-xl border border-white/10 bg-[#101b2d] p-2">
              <summary className="flex min-h-11 cursor-pointer items-center px-1 font-semibold">Ally wardrobes</summary>
              <div className="flex flex-wrap gap-2">{guestWardrobes.map(row => <button key={row.speaker} type="button"
                className={campaignControl} onClick={() => setWardrobe(row.speaker)}>{nameOf(book.story, row.speaker)}</button>)}</div>
            </details>}
          </>}
        </div>
      </article> : <p className="rounded-xl border border-white/10 bg-[#101b2d] p-3 text-sm text-slate-300">Choose a character to inspect.</p>}
    {wardrobe !== undefined && <Wardrobe key={wardrobe} book={book} assets={assets} speaker={wardrobe} back={() => setWardrobe(undefined)} />}
  </section>
}
