
import { useMemo, useState } from 'react'
import { awayMembers, campaignSupport, crewSpeaker, levelOf, ROLE_NAME, type CampaignBook, type CampaignDate, type CampaignQuest,
  type CampaignReleaseFile, type Save, type Speaker } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { CampaignThumbnail } from './CampaignThumbnail'
import { campaignControl, CampaignQuestRow } from './CampaignQuestRow'
import { expeditionWatchScene } from './expedition'
import { questScene } from './quests'
import { dateAvailable } from './dates'
import { RigSheet } from './RigSheet'
import { DatePanel } from './DatePanel'
import { campaignActs, rosterStatus, type CampaignNavigation, type RosterBrowse, type RosterEntry, type RosterKind } from './navigation'
import { Wardrobe } from './Wardrobe'

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
  const { kind, search, page, selected } = browse
  const [wardrobe, setWardrobe] = useState<Speaker>()
  const rosterSpeakers = useMemo(() => new Set(navigation.roster.map(row => row.speaker)), [navigation])
  const names = useMemo(() => new Map(navigation.roster.map(row => [row.speaker, nameOf(book.story, row.speaker)])), [book, navigation])
  const candidates = navigation.roster.filter(row => row.kind === kind && names.get(row.speaker)!.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const entry = candidates.find(row => row.speaker === selected) ?? candidates[page * pageSize]
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
  const route = duo?.expedition?.route
  const related = [...new Set([duo?.local?.base, duo?.local?.evidence, ...(duo?.returns.map(row => row.quest) ?? []),
    route?.launch, ...route?.stops ?? [], route?.return])].flatMap(id =>
    id && !entry?.quests.includes(id) ? navigation.quests.get(id) ?? [] : [])
  const returned = entry?.kind === 'Lieutenant' && entry.quests.every(id => complete.has(id))
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
  return <section aria-labelledby="roster-title" className="space-y-3">
    <h1 id="roster-title" className="font-display text-2xl font-bold">Roster</h1>
    <div className="flex flex-wrap gap-2" aria-label="Roster categories">
      {roles.map(role => <button key={role} type="button" className={role === kind ? campaignControl + ' ring-2 ring-cyan-200' : campaignControl}
        aria-pressed={role === kind} onClick={() => onBrowse({ kind: role, search: '', page: 0 })}>
        {choices[role]} · {navigation.roster.filter(row => row.kind === role).length}
      </button>)}
      <input type="search" aria-label="Search roster" placeholder="Search roster" value={search}
        onChange={event => onBrowse({ ...browse, search: event.currentTarget.value, page: 0, selected: undefined })}
        className="min-h-11 w-full max-w-xs rounded-lg border border-white/15 bg-[#101e32] px-3 text-white placeholder:text-slate-400" />
    </div>
    <div className="grid items-start gap-3 sm:grid-cols-[minmax(11rem,1fr)_minmax(16rem,2fr)]">
      <div className="rounded-xl border border-white/10 bg-[#101b2d] p-2">
        <ul aria-label={choices[kind]} className="space-y-1">
          {candidates.slice(page * pageSize, (page + 1) * pageSize).map(row => <li key={row.speaker}>
            <button type="button" data-roster-actor={row.speaker} aria-pressed={entry?.speaker === row.speaker} onClick={() => select(row.speaker)}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/8 aria-pressed:bg-[#213c58] focus-visible:outline-2 focus-visible:outline-cyan-200">
              <CampaignThumbnail asset={avatar(row)} className="size-9 shrink-0 rounded-md object-cover" />
              <span className="min-w-0"><span className="block break-words text-sm font-semibold">{names.get(row.speaker)}</span>
                <span className="block text-xs text-slate-300">{rosterStatus(row, save, book, complete)}</span></span>
            </button>
          </li>)}
        </ul>
        {candidates.length === 0 && <p className="p-2 text-sm text-slate-300">No matching crew.</p>}
        {candidates.length > pageSize && <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className={campaignControl + ' disabled:opacity-35'} disabled={page === 0} onClick={() => changePage(page - 1)}>Previous</button>
          <button type="button" className={campaignControl + ' disabled:opacity-35'} disabled={(page + 1) * pageSize >= candidates.length} onClick={() => changePage(page + 1)}>Next</button>
        </div>}
      </div>
      {entry && <article className="space-y-3 rounded-xl border border-white/10 bg-[#101b2d] p-3">
        <header className="flex items-start gap-3">
          <CampaignThumbnail asset={avatar(entry)} className="size-17 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-display text-xl font-bold">{names.get(entry.speaker)}</h2>
            <p className="text-sm text-slate-300">{rosterStatus(entry, save, book, complete)}{entry.system && ' · ' + entry.system.replaceAll('-', ' ')}</p>
          </div>
          {(member || entry.kind !== 'Uma') && profile(entry) &&
            <button type="button" className={campaignControl} onClick={() => setWardrobe(entry.speaker)}>Wardrobe</button>}
        </header>
        {entry.kind === 'Uma' && !member && signOn && <p className="text-sm text-slate-200">{signOn.request}</p>}
        {entry.kind !== 'Uma' && entry.lead !== undefined && <p className="text-sm text-slate-300">Home front · {names.get(entry.lead)}</p>}
        {entry.kind === 'Uma' && partner !== undefined && <p className="text-sm text-slate-300">Fixed partner · {names.get(partner)}</p>}
        {member && <div className="rounded-lg border border-white/10 p-2 text-sm">
          <p>Level {levelOf(member.xp)} · {member.xp} XP{member.role && ' · ' + ROLE_NAME[member.role]}</p>
          <RigSheet rig={member.rig} xp={member.xp} />
        </div>}
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
          {entry.kind === 'Lieutenant' && <p>{returned ? assignment && save.expedition?.duo === duo?.id ? 'With the expedition formation' : 'Returned to the local crew'
            : 'Crew interactions open after recovery'}</p>}
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
      </article>}
    </div>
    {guestWardrobes.length > 0 && <details className="rounded-xl border border-white/10 bg-[#101b2d] p-2">
      <summary className="flex min-h-11 cursor-pointer items-center px-1 font-semibold">Ally wardrobes</summary>
      <div className="flex flex-wrap gap-2">{guestWardrobes.map(row => <button key={row.speaker} type="button"
        className={campaignControl} onClick={() => setWardrobe(row.speaker)}>{nameOf(book.story, row.speaker)}</button>)}</div>
    </details>}
    {wardrobe !== undefined && <Wardrobe key={wardrobe} book={book} assets={assets} speaker={wardrobe} back={() => setWardrobe(undefined)} />}
  </section>
}
