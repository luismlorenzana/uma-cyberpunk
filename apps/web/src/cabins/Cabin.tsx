// Her cabin (CY14, TC60, TC61): a landscape diorama with six slots and a window on the world the ship orbits, her
// Quarters look standing in it (master data's bust until the look loads), and three panels: the visit, decorating, and
// her profile with the tastes she's revealed.
import {
  CABIN_SLOT_NAME, comfortOf, DECOR_NAME, GIFT_NAME, GIFTS, ITEMS_BY_ID, KEEPSAKES, FURNITURE, readyScene, SLOTS, talkTopics, TOPIC_NAME,
  VISIT_TUNING, type Item, type Save, type Slot, type StoryPack,
} from '@cyber/domain'
import { AlbumArtProvider, UmaBust } from '@luismlorenzana/uma-kit/album'
import { useState } from 'react'
import { BondPanel } from '../bonds/BondPanel'
import { PartnersPanel } from '../bonds/PartnersPanel'
import { outfitName } from '../ship/useStory'
import { bondFileOf } from '../bonds/bonds'
import { albumArt } from '../crew/art'
import { Profile } from '../crew/Profile'
import type { CrewView } from '../crew/view'
import { LookPortrait } from '../looks/looks'
import { updateSave, useGame } from '../save/game'
import { ItemIcon, SLOT_SPOTS, STAND, windowColors } from './art'
import { applyThemeKit, canInvite, grantItem, placeItem, revealText, tastesFor, visit, visitsLeftNow, type VisitChoice, type VisitResult } from './cabins'

const btn = 'min-h-11 rounded-md bg-white/10 px-3 text-[14px] font-semibold disabled:opacity-40'
const primary = 'min-h-11 rounded-md bg-[#2ee6ff] px-4 font-display font-bold text-[#0b0d17] disabled:opacity-40'

export function Lights({ lights, points }: { lights: number; points?: number }) {
  return (
    <span data-comfort={lights} className="inline-flex items-center gap-1" title={points === undefined ? undefined : `Comfort ${points}`}>
      {Array.from({ length: 5 }, (_, i) => <span key={i} className={`inline-block size-2.5 rounded-full ${i < lights ? 'bg-[#ffd166] shadow-[0_0_6px_#ffd166]' : 'bg-white/15'}`} />)}
    </span>
  )
}

/** The room: back wall, floor, the window, each slot's piece (or an empty mark), and her standing in the middle. */
function Room({ view, save, onSlot, picked }: { view: CrewView; save: Save; onSlot: (slot: Slot) => void; picked: Slot | null }) {
  const [sky, glow] = windowColors(save.worlds.current)
  const cabin = view.member.cabin
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
      <svg viewBox="0 0 640 360" className="absolute inset-0 size-full" aria-label={`${view.name}'s cabin`}>
        <defs>
          <linearGradient id="cab-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c2140" /><stop offset="1" stopColor="#141a33" /></linearGradient>
          <linearGradient id="cab-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#252a46" /><stop offset="1" stopColor="#10142a" /></linearGradient>
          <linearGradient id="cab-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky} /><stop offset="1" stopColor={glow} stopOpacity="0.55" /></linearGradient>
        </defs>
        <rect width="640" height="250" fill="url(#cab-wall)" />
        <path d="M0 250 L640 250 L640 360 L0 360 Z" fill="url(#cab-floor)" />
        <path d="M0 250 L640 250" stroke="#2ee6ff" strokeOpacity="0.25" />
        <g data-window>
          <rect x="262" y="36" width="150" height="100" rx="12" fill="url(#cab-sky)" stroke="#0b0d17" strokeWidth="6" />
          <circle cx="372" cy="78" r="24" fill={glow} opacity="0.7" />
          {[[280, 56], [300, 108], [330, 50], [396, 120], [350, 98]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r="1.6" fill="#fff" opacity="0.8" />)}
        </g>
        {SLOTS.map((slot) => {
          const spot = SLOT_SPOTS[slot], id = cabin.slots[slot]
          return (
            <g key={slot} data-slot={slot} role="button" tabIndex={0} aria-label={`${CABIN_SLOT_NAME[slot]}: ${id ? ITEMS_BY_ID.get(id)?.name : 'empty'}`}
              onClick={() => onSlot(slot)} onKeyDown={(e) => { if (e.key === 'Enter') onSlot(slot) }} className="cursor-pointer">
              {id ? <foreignObject x={spot.x} y={spot.y - spot.size * 0.25} width={spot.size} height={spot.size}><ItemIcon id={id} size={spot.size} /></foreignObject>
                : <><rect x={spot.x + spot.size * 0.15} y={spot.y} width={spot.size * 0.7} height={spot.size * 0.45} rx="8" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeDasharray="6 5" />
                  <text x={spot.x + spot.size / 2} y={spot.y + spot.size * 0.27} textAnchor="middle" fill="#ffffff" fillOpacity="0.55" fontSize="14">+ {CABIN_SLOT_NAME[slot]}</text></>}
              {picked === slot && <rect x={spot.x} y={spot.y - spot.size * 0.25} width={spot.size} height={spot.size} rx="10" fill="none" stroke="#2ee6ff" strokeWidth="3" />}
            </g>
          )
        })}
      </svg>
      <div className="pointer-events-none absolute -translate-x-1/2" style={STAND}>
        <LookPortrait outfit={view.outfit} name={view.name} look="quarters" mode="full"
          fallback={<div data-stand-in-figure className="aspect-[5/8] h-[82%] translate-y-[22%] overflow-hidden rounded-t-[40%] opacity-90 shadow-[0_0_24px_rgba(46,230,255,0.25)]"><AlbumArtProvider art={albumArt(() => view.name)}><UmaBust outfitId={String(view.outfit)} label={view.name} size={120} className="size-full" /></AlbumArtProvider></div>} />
      </div>
    </div>
  )
}

function itemLine(item: Item, liked: boolean) {
  const style = item.kind === 'furniture' ? DECOR_NAME[item.style] : item.kind === 'gift' ? GIFT_NAME[item.gift] : 'Keepsake'
  return <span className="text-[12px] text-white/60">{style}{'comfort' in item ? ` · comfort ${item.comfort}` : ''}{liked ? ' · she likes this' : ''}</span>
}

function ResultCard({ result, view, pack, onDone }: { result: VisitResult; view: CrewView; pack: StoryPack | null; onDone: () => void }) {
  const tastes = tastesFor(pack, view)
  return (
    <div data-visit-result={result.kind} className="space-y-2 rounded-lg bg-[#0b0d17]/70 p-3 ring-1 ring-[#2ee6ff]/30">
      <div className="space-y-1 text-[15px] italic text-white/90">{result.lines.map((l, i) => <p key={i}>{result.kind === 'invite' ? l : `“${l}”`}</p>)}</div>
      {result.placed && <div className="flex items-center gap-2 text-[13px]"><ItemIcon id={result.placed.item} size={32} /> She put the {ITEMS_BY_ID.get(result.placed.item)?.name} in the {CABIN_SLOT_NAME[result.placed.slot].toLowerCase()} slot.</div>}
      <div className="flex flex-wrap gap-2 text-[13px]">
        <span data-rapport={result.rapport} className="rounded bg-[#ff3dc8]/20 px-2 py-1 font-bold text-[#ff8fdc]">+{result.rapport} rapport</span>
        {result.strainShed > 0 && <span className="rounded bg-[#ffb84d]/20 px-2 py-1 font-bold text-[#ffb84d]">−{result.strainShed} Strain</span>}
      </div>
      {result.revealed.map((r) => <div key={r} data-revealed={r} className="text-[13px] text-[#ffd166]">New: {revealText(r, tastes)}</div>)}
      {result.request && <div data-request={result.request} className="text-[13px] text-[#2ee6ff]">She asks: “Could you find me something for the {CABIN_SLOT_NAME[result.request].toLowerCase()}?”</div>}
      <button type="button" className={primary} onClick={onDone}>Done</button>
    </div>
  )
}

function VisitPanel({ view, save, pack, onBondScene }: { view: CrewView; save: Save; pack: StoryPack | null; onBondScene: (rank: number) => void }) {
  const [mode, setMode] = useState<'choose' | 'talk' | 'gift'>('choose')
  const [result, setResult] = useState<VisitResult | null>(null)
  const left = visitsLeftNow(save)
  const tastes = tastesFor(pack, view)
  const used = save.visits.watch === save.watch ? save.visits.used : 0
  const scene = bondFileOf(pack, view.outfit) ? readyScene(view.member.bond, bondFileOf(pack, view.outfit)!.scenes.map((s) => s.rank)) : null
  // The visit is worked out on the save as it is now, its card shown at once, and the save written after.
  const go = (choice: VisitChoice) => {
    const now = useGame.getState().save
    const r = now ? visit(now, pack, view, choice) : null
    setMode('choose')
    if (!r) return
    setResult(r.result)
    void updateSave(() => r.save)
  }
  if (result) return <ResultCard result={result} view={view} pack={pack} onDone={() => setResult(null)} />
  const gifts = GIFTS.filter((g) => (save.items[g.id] ?? 0) > 0)
  return (
    <div data-visit className="space-y-2">
      <div className="text-[13px] text-white/70">Visits this watch: <b data-visits-left={left}>{left}</b> of {VISIT_TUNING.perWatch}{left === 0 ? '. The next watch starts when a mission’s results close or the ship jumps.' : ''}</div>
      {scene !== null && <button type="button" data-bond-scene={scene} className={primary} onClick={() => onBondScene(scene)}>Her bond scene is waiting (rank {scene})</button>}
      {mode === 'choose' && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" data-choice="talk" className={btn} disabled={!left} onClick={() => setMode('talk')}>Talk</button>
          <button type="button" data-choice="gift" className={btn} disabled={!left || !gifts.length} onClick={() => setMode('gift')}>Give a gift{gifts.length ? '' : ' (none)'}</button>
          <button type="button" data-choice="decorate" className={btn} disabled={!left} onClick={() => go({ kind: 'decorate' })}>Decorate together</button>
          <button type="button" data-choice="invite" className={btn} disabled={!left || !canInvite(view.member)} onClick={() => go({ kind: 'invite' })}>
            {canInvite(view.member) ? 'Invite: Observation Deck' : `Invite (bond rank ${VISIT_TUNING.inviteRank})`}
          </button>
        </div>
      )}
      {mode === 'talk' && (
        <div className="space-y-1.5">
          <div className="text-[13px] text-white/60">What do you talk about?</div>
          {talkTopics(tastes, view.outfit, save.watch, used).map((t) => (
            <button key={t} type="button" data-topic={t} className={`${btn} w-full text-left`} onClick={() => go({ kind: 'talk', topic: t })}>
              {TOPIC_NAME[t]}{view.member.cabin.revealed.includes(`topic:${t}`) ? ' ♥' : ''}
            </button>
          ))}
          <button type="button" className="text-[13px] text-white/50" onClick={() => setMode('choose')}>Back</button>
        </div>
      )}
      {mode === 'gift' && (
        <div className="space-y-1.5">
          {gifts.map((g) => (
            <button key={g.id} type="button" data-gift={g.id} className={`${btn} flex w-full items-center gap-2 text-left`} onClick={() => go({ kind: 'gift', item: g.id })}>
              <ItemIcon id={g.id} size={28} /><span className="flex-1">{g.name} <span className="text-white/50">×{save.items[g.id]}</span></span>
              {itemLine(g, view.member.cabin.revealed.includes('gift') && g.gift === tastes.gift)}
            </button>
          ))}
          <button type="button" className="text-[13px] text-white/50" onClick={() => setMode('choose')}>Back</button>
        </div>
      )}
      <p className="text-[12px] text-white/45">Talk: +{VISIT_TUNING.talkLoved} on a topic she loves, half otherwise. A gift: +{VISIT_TUNING.giftFavourite} her favourite kind, +{VISIT_TUNING.giftOther} any other. Decorating together: +{VISIT_TUNING.decorate}. An invitation: +{VISIT_TUNING.invite} and a point of Strain off. At Comfort 4, half again.</p>
    </div>
  )
}

function DecoratePanel({ view, save, pack, slot, setSlot }: { view: CrewView; save: Save; pack: StoryPack | null; slot: Slot; setSlot: (s: Slot) => void }) {
  const tastes = tastesFor(pack, view)
  const cabin = view.member.cabin
  const knowsStyle = cabin.revealed.includes('styles')
  const pool: Item[] = slot === 'keepsake' ? [...KEEPSAKES] : FURNITURE.filter((f) => f.slot === slot)
  const owned = pool.filter((i) => (save.items[i.id] ?? 0) > 0)
  const request = cabin.request
  const grantable = request ? FURNITURE.filter((f) => f.slot === request && (save.items[f.id] ?? 0) > 0) : []
  return (
    <div data-decorate className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SLOTS.map((s) => <button key={s} type="button" data-pick-slot={s} aria-pressed={s === slot} className={`${btn} ${s === slot ? 'ring-2 ring-[#2ee6ff]' : ''}`} onClick={() => setSlot(s)}>{CABIN_SLOT_NAME[s]}</button>)}
      </div>
      {request && (
        <div data-request-banner className="rounded-lg bg-[#2ee6ff]/10 p-2 text-[13px]">
          She asked for something for the {CABIN_SLOT_NAME[request].toLowerCase()} (+{VISIT_TUNING.request} rapport).
          <div className="mt-1 flex flex-wrap gap-1.5">{grantable.length ? grantable.map((f) => (
            <button key={f.id} type="button" data-grant={f.id} className={btn} onClick={() => void updateSave((s) => grantItem(s, pack, view.outfit, f.id))}><ItemIcon id={f.id} size={24} /> {f.name}</button>
          )) : <span className="text-white/50">Nothing in the stock fits yet.</span>}</div>
        </div>
      )}
      <div className="space-y-1">
        {cabin.slots[slot] && (
          <button type="button" data-clear className={`${btn} w-full text-left`} onClick={() => void updateSave((s) => placeItem(s, view.outfit, slot, null))}>Empty the {CABIN_SLOT_NAME[slot].toLowerCase()} slot</button>
        )}
        {owned.length === 0 && <div className="text-[13px] text-white/50">The stock has nothing for this slot. Items come from won missions (and the Store, later).</div>}
        {owned.map((i) => (
          <button key={i.id} type="button" data-place={i.id} disabled={cabin.slots[slot] === i.id}
            className={`${btn} flex w-full items-center gap-2 text-left ${cabin.slots[slot] === i.id ? 'ring-2 ring-[#ffd166]' : ''}`}
            onClick={() => void updateSave((s) => placeItem(s, view.outfit, slot, i.id))}>
            <ItemIcon id={i.id} size={30} /><span className="flex-1">{i.name} <span className="text-white/50">×{save.items[i.id]}</span></span>
            {itemLine(i, knowsStyle && i.kind === 'furniture' && i.style === tastes.favourite)}
          </button>
        ))}
      </div>
      <button type="button" data-theme-kit className={btn} onClick={() => void updateSave((s) => applyThemeKit(s, pack, view))}>
        Theme kit: {knowsStyle ? DECOR_NAME[tastes.favourite] : 'her style'} from the stock
      </button>
      <p className="text-[12px] text-white/45">Comfort: each piece's comfort, +2 in her style, −1 in the style she dislikes, +2 for a full line of five. At three lights she sheds a point of Strain resting through a mission; at five, all of it. Decorating never gates a rank.</p>
    </div>
  )
}

export function Cabin({ view, save, pack, onBack, onBondScene }: { view: CrewView; save: Save; pack: StoryPack | null; onBack: () => void; onBondScene: (rank: number) => void }) {
  const [tab, setTab] = useState<'visit' | 'decorate' | 'profile'>('visit')
  const [slot, setSlot] = useState<Slot>('bed')
  const tastes = tastesFor(pack, view)
  const comfort = comfortOf(view.member.cabin, tastes)
  const known = view.member.cabin.revealed
  return (
    <div data-cabin={view.outfit} className="flex h-full gap-3">
      <div className="flex w-[58%] shrink-0 flex-col gap-2">
        <div className="flex items-center gap-3">
          <button type="button" data-back className={btn} onClick={onBack}>← Quarters</button>
          <h2 className="truncate font-display text-[20px] font-bold">{view.name}’s cabin</h2>
          <span className="ml-auto flex items-center gap-2 text-[13px] text-white/70">Comfort <Lights lights={comfort.lights} points={comfort.points} /> <span data-comfort-points>{comfort.points}</span></span>
        </div>
        <Room view={view} save={save} picked={tab === 'decorate' ? slot : null} onSlot={(s) => { setTab('decorate'); setSlot(s) }} />
        <div data-tastes className="rounded-lg bg-[#141827] p-2 text-[13px] ring-1 ring-white/10">
          <b className="font-display">Her tastes</b>{' '}
          {known.length === 0 ? <span className="text-white/50">Nothing yet: a gift, decorating together and talk reveal them.</span>
            : <span className="text-white/80">{known.map((r) => revealText(r, tastes)).join(' · ')}</span>}
          {comfort.set && <span className="ml-2 text-[#ffd166]">· a full {DECOR_NAME[comfort.set]} set</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto rounded-xl bg-[#141827] p-3 ring-1 ring-white/10">
        <div className="mb-2 flex gap-1.5">
          {(['visit', 'decorate', 'profile'] as const).map((t) => (
            <button key={t} type="button" data-tab={t} aria-pressed={t === tab} className={`min-h-11 rounded-md px-3 text-[14px] font-semibold ${t === tab ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10'}`} onClick={() => setTab(t)}>
              {t === 'visit' ? 'Visit' : t === 'decorate' ? 'Decorate' : 'Profile'}
            </button>
          ))}
        </div>
        {tab === 'visit' && <VisitPanel view={view} save={save} pack={pack} onBondScene={onBondScene} />}
        {tab === 'decorate' && <DecoratePanel view={view} save={save} pack={pack} slot={slot} setSlot={setSlot} />}
        {tab === 'profile' && <Profile view={view} nameOf={() => view.name} bond={<><BondPanel member={view.member} pack={pack} save={save} onPlay={onBondScene} /><PartnersPanel save={save} outfit={view.outfit} nameOf={(o) => outfitName(pack, o)} /></>} />}
      </div>
    </div>
  )
}

