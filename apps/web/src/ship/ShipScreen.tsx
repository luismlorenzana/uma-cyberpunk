// The ship (CY10, TC9, TC49): the hub every session starts and ends in. A side cutaway of the decks, each room a hotspot
// of at least 44 pt; a tap opens its quick look (an open room's, or a locked one naming its key), and Enter goes in. A
// Continue card says what's waiting. Landscape, on the turned stage. When the app opens with a mission in progress, it
// goes straight back to it (resume anywhere).
import { ROOMS, roomView, type RoomId } from '@cyber/domain'
import { TurnedStage } from '@luismlorenzana/uma-stage'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ensureWorld, waiting } from '../mission/director'
import { updateSave, useGame } from '../save/game'
import { outfitName, useStory } from './useStory'

/** Each room's place on the cutaway (viewBox 1000 × 460). */
const LAYOUT: Record<RoomId, { x: number; y: number; w: number; h: number }> = {
  bridge: { x: 760, y: 70, w: 170, h: 100 }, comms: { x: 560, y: 70, w: 190, h: 100 }, log: { x: 360, y: 70, w: 190, h: 100 },
  quarters: { x: 160, y: 180, w: 230, h: 100 }, store: { x: 400, y: 180, w: 200, h: 100 }, simpod: { x: 610, y: 180, w: 200, h: 100 },
  hangar: { x: 160, y: 290, w: 650, h: 110 },
}

let resumedThisLoad = false

export default function ShipScreen() {
  return <TurnedStage>{() => <Ship />}</TurnedStage>
}

function Ship() {
  const navigate = useNavigate()
  const save = useGame((g) => g.save)
  const pack = useStory()
  const [peek, setPeek] = useState<RoomId | null>(null)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    if (!save || !pack) return
    if (Object.keys(save.worlds.known).length === 0) void updateSave((s) => ensureWorld(s, pack))
    if (!resumedThisLoad) {
      resumedThisLoad = true
      if (save.mission) void navigate('/mission')
    }
  }, [save, pack])

  if (!save || !pack) return <div className="flex h-full items-center justify-center bg-[#0b0d17] text-white/60">Boarding…</div>
  const views = ROOMS.map((r) => roomView(pack.casting, save.ship.rooms, r, (o) => outfitName(pack, o)))
  const card = waiting(pack, save)
  const peeked = views.find((v) => v.room.id === peek)
  return (
    <div data-ship className="relative h-full w-full overflow-hidden bg-[#0b0d17] text-[#e8ebf5]">
      <svg viewBox="0 0 1000 460" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label="The ship">
        <defs>
          <linearGradient id="hull" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1b2033" /><stop offset="1" stopColor="#0e1222" /></linearGradient>
        </defs>
        <path d="M120 60 L930 60 Q990 60 985 150 L960 420 L120 420 Q90 420 90 380 L90 100 Q90 60 120 60 Z" fill="url(#hull)" stroke="#2ee6ff44" strokeWidth="3" />
        {views.map(({ room, open }) => {
          const r = LAYOUT[room.id]
          return (
            <g key={room.id} role="button" tabIndex={0} aria-label={`${room.name}${open ? '' : ', locked'}`} onClick={() => setPeek(room.id)} style={{ cursor: 'pointer' }}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill={open ? '#141827' : '#0b0d17'} stroke={peek === room.id ? '#2ee6ff' : open ? '#2ee6ff66' : '#ffffff22'} strokeWidth={peek === room.id ? 4 : 2} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 8} textAnchor="middle" fontSize="24" fontWeight="700" fill={open ? '#e8ebf5' : '#6d7590'}>{open ? room.name : `🔒 ${room.name}`}</text>
            </g>
          )
        })}
      </svg>
      <div className="absolute flex gap-2" style={{ top: 'calc(var(--inset-top) + 8px)', left: 'calc(var(--inset-left) + 8px)' }}>
        <button type="button" onClick={() => setMenu((m) => !m)} className="min-h-11 rounded-md bg-[#141827] px-4 font-display font-bold ring-1 ring-white/15">Menu</button>
        <span className="flex min-h-11 items-center px-2 text-[13px] text-white/60">Crew {save.crew.length} · {save.worlds.current ?? 'no world'}</span>
      </div>
      {card && (
        <Link to={card.to} data-continue className="absolute min-h-11 rounded-lg bg-[#2ee6ff] px-4 py-2 font-display font-bold text-[#0b0d17]" style={{ top: 'calc(var(--inset-top) + 8px)', right: 'calc(var(--inset-right) + 8px)' }}>
          {card.text}
        </Link>
      )}
      {menu && (
        <div className="absolute flex flex-col gap-2 rounded-xl bg-[#141827] p-3 ring-1 ring-white/15" style={{ top: 'calc(var(--inset-top) + 60px)', left: 'calc(var(--inset-left) + 8px)' }}>
          {[['Account', '/account'], ['Sandbox', '/sandbox'], ['Board bench', '/board'], ['Story test', '/story']].map(([label, to]) => (
            <Link key={to} to={to!} className="flex min-h-11 items-center rounded-md bg-white/5 px-3 font-semibold">{label}</Link>
          ))}
        </div>
      )}
      {peeked && (
        <div data-peek className="absolute w-72 rounded-xl bg-[#141827]/95 p-3 ring-1 ring-white/15" style={{ bottom: 'calc(var(--inset-bottom) + 10px)', right: 'calc(var(--inset-right) + 10px)' }}>
          <div className="flex items-center justify-between"><b className="font-display text-[18px]">{peeked.room.name}</b>
            <button type="button" onClick={() => setPeek(null)} className="min-h-11 min-w-11 text-white/60" aria-label="Close">✕</button></div>
          <p className="text-[13px] text-white/70">{peeked.open ? PEEK[peeked.room.id](save.crew.length, save.story.seen.length) : peeked.key}</p>
          {peeked.open && <button type="button" onClick={() => void navigate(`/room/${peeked.room.id}`)} className="mt-2 min-h-11 w-full rounded-md bg-[#2ee6ff] font-display font-bold text-[#0b0d17]">Enter</button>}
        </div>
      )}
    </div>
  )
}

/** Each open room's quick look. */
const PEEK: Record<RoomId, (crew: number, seen: number) => string> = {
  bridge: () => 'The star map and the world below: travel, missions, scenes.',
  hangar: (crew) => `The rigs and the crew's loadouts (CY11). ${crew} aboard.`,
  quarters: (crew) => `Where the crew rests (CY11). ${crew} aboard.`,
  log: (_, seen) => `The Timeline of ${seen} scenes, the Files and the Anomalies.`,
  store: () => 'Parts and remodels (Phase 5).',
  comms: () => 'Calls and messages (Phase 5).',
  simpod: () => 'Practice battles (Phase 5).',
}
