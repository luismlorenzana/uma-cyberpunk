// A room's page at /room/:id (CY10, CY11): the Bridge's star map and a world's map, the Log, the Hangar and the Quarters
// (CY11), and placeholders for the rooms later packets fill. Loaded on demand. Landscape, on the turned stage.
import { fillCaptain, openRooms, ROOMS, roomView, worldNodes, type RoomId, type Scene, type StoryPack } from '@cyber/domain'
import { TurnedStage } from '@luismlorenzana/uma-stage'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Hangar } from '../crew/Hangar'
import { Quarters } from '../crew/Quarters'
import { useCrew } from '../crew/useCrew'
import { dutyInfoFrom } from './duties'
import { applyStep, atNode, markSeen, progressOf, reachableWorlds, sceneSquad, startMission, timeline, travel } from '../mission/director'
import { updateSave, useGame } from '../save/game'
import { ScenePlayer } from '../story/ScenePlayer'
import { outfitName, useStory } from './useStory'

export default function RoomPage() {
  return <TurnedStage>{() => <Room />}</TurnedStage>
}

function Room() {
  const { id } = useParams()
  const navigate = useNavigate()
  const save = useGame((g) => g.save)
  const pack = useStory()
  if (!save || !pack) return <div className="flex h-full items-center justify-center bg-[#0b0d17] text-white/60">…</div>
  const room = ROOMS.find((r) => r.id === id)
  if (!room) { void navigate('/'); return null }
  const view = roomView(pack.casting, openRooms(save.ship), room, (o) => outfitName(pack, o))
  const back = <button type="button" onClick={() => void navigate('/')} className="min-h-11 rounded-md bg-[#141827] px-4 font-display font-bold ring-1 ring-white/15">Ship</button>
  return (
    <div data-room={room.id} className="relative h-full w-full overflow-hidden bg-[#0b0d17] text-[#e8ebf5]">
      <div className="absolute z-10 flex items-center gap-3" style={{ top: 'calc(var(--inset-top) + 8px)', left: 'calc(var(--inset-left) + 8px)' }}>
        {back}<h1 className="font-display text-[20px] font-bold">{room.name}</h1>
      </div>
      {!view.open ? <Placeholder text={view.key ?? 'Locked'} />
        : room.id === 'bridge' ? <Bridge pack={pack} />
          : room.id === 'log' ? <LogRoom pack={pack} />
            : room.id === 'hangar' ? <Hangar />
              : room.id === 'quarters' ? <Quarters />
            : <Placeholder text={PLACEHOLDER[room.id]} />}
    </div>
  )
}

const PLACEHOLDER: Partial<Record<RoomId, string>> = {
  store: 'The Store opens with progression (Phase 5).', comms: 'Comms open with Calls and messages (Phase 5).', simpod: 'The Sim Pod opens with practice battles (Phase 5).',
}

function Placeholder({ text }: { text?: string }) {
  return <div className="flex h-full items-center justify-center p-10 text-center text-white/60">{text}</div>
}

/** The Bridge (TC50): the star map of known worlds (a tap, a jump card, travel; no fuel, no clock), then the current
 * world's node map: locked, available or cleared, each with its danger, a locked one naming its key. */
function Bridge({ pack }: { pack: StoryPack }) {
  const { crew } = useCrew()
  const navigate = useNavigate()
  const save = useGame((g) => g.save)!
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'stars' | 'world'>(save.worlds.current && params.get('view') !== 'stars' ? 'world' : 'stars')
  const [jump, setJump] = useState<string | null>(null)
  const [playing, setPlaying] = useState<Scene | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const known = Object.keys(save.worlds.known)
  const open = reachableWorlds(save, pack)
  const world = save.worlds.current ? pack.worlds[save.worlds.current] : undefined

  const tapNode = (place: string) => {
    if (!world) return
    const due = atNode(pack, save, world.id, place)
    if (due.kind === 'scene') setPlaying(due.scene)
    else if (due.kind === 'mission') { void updateSave((s) => startMission(s, due.chapter, due.mission)).then(() => navigate('/mission')) }
    else setNote('Nothing waits here now.')
  }
  // `?node=` (the Continue card, a new game's opening) plays what waits at that node at once.
  const node = params.get('node')
  useEffect(() => {
    if (!node) return
    setParams({}, { replace: true })
    tapNode(node)
  }, [node])

  if (playing && world) {
    return (
      <div className="absolute inset-0 z-20">
        <ScenePlayer key={playing.id} pack={pack} scene={playing} squad={sceneSquad(pack, save)}
          onEffect={(step) => void updateSave((s) => applyStep(s, pack, step))}
          onBattle={async (mission) => {
            const due = Object.values(pack.chapters).find((c) => c.missions.some((m) => m.id === mission))
            const m = due?.missions.find((x) => x.id === mission)
            if (!due || !m) return
            await updateSave((s) => startMission(markSeen(s, playing.id), due, m))
            void navigate('/mission')
          }}
          onDone={() => { void updateSave((s) => markSeen(s, playing.id)); setPlaying(null) }} />
      </div>
    )
  }

  if (view === 'stars' || !world) {
    const worlds = [...known, ...open].map((id) => pack.worlds[id]).filter((w) => !!w)
    return (
      <div data-star-map className="absolute inset-0">
        <svg viewBox="0 0 100 60" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label="The star map">
          {worlds.map((w) => {
            const x = w!.x ?? 50, y = (w!.y ?? 50) * 0.6
            const here = w!.id === save.worlds.current
            return (
              <g key={w!.id} role="button" aria-label={`World ${w!.id}`} onClick={() => setJump(w!.id)} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={here ? 3.2 : 2.6} fill={here ? '#2ee6ff' : known.includes(w!.id) ? '#7ef0b0' : '#ffb84d'} />
                <circle cx={x} cy={y} r={6} fill="transparent" />
                <text x={x} y={y + 6} textAnchor="middle" fontSize="2.6" fill="#e8ebf5">{w!.id}{here ? ' (here)' : ''}</text>
              </g>
            )
          })}
        </svg>
        {jump && (
          <div data-jump className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#141827] p-3 ring-1 ring-white/15">
            <b className="font-display">{jump}</b>
            <p className="text-[13px] text-white/70">{pack.worlds[jump]?.look ?? 'An unknown world.'}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setJump(null)} className="min-h-11 flex-1 rounded-md bg-white/10 font-bold">Stay</button>
              <button type="button" onClick={() => { void updateSave((s) => travel(s, jump, pack, { info: dutyInfoFrom(crew) })); setJump(null); void navigate('/') }} className="min-h-11 flex-1 rounded-md bg-[#2ee6ff] font-bold text-[#0b0d17]">Jump</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const nodes = worldNodes(pack, world, save.story, progressOf(pack, save))
  const colour = { locked: '#6d7590', available: '#2ee6ff', cleared: '#7ef0b0' } as const
  return (
    <div data-world-map={world.id} className="absolute inset-0">
      <svg viewBox="0 0 100 60" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label={`The map of ${world.id}`}>
        {nodes.flatMap((n) => n.links.filter((l) => l > n.id).map((l) => {
          const m = nodes.find((x) => x.id === l)
          return m ? <line key={`${n.id}-${l}`} x1={n.x} y1={n.y * 0.6} x2={m.x} y2={m.y * 0.6} stroke="#ffffff33" strokeWidth="0.4" /> : null
        }))}
        {nodes.map((n) => (
          <g key={n.id} role="button" aria-label={`${n.id}: ${n.state}, danger ${n.danger}`} onClick={() => (n.state === 'locked' ? setNote(n.key) : tapNode(n.id))} style={{ cursor: 'pointer' }}>
            <circle cx={n.x} cy={n.y * 0.6} r={6} fill="transparent" />
            <circle cx={n.x} cy={n.y * 0.6} r={2.4} fill={colour[n.state]} stroke="#0b0d17" strokeWidth="0.4" />
            <text x={n.x} y={n.y * 0.6 + 5.2} textAnchor="middle" fontSize="2.3" fill="#e8ebf5">{n.id} · {'◆'.repeat(n.danger)}</text>
            {n.state === 'locked' && <text x={n.x} y={n.y * 0.6 + 0.9} textAnchor="middle" fontSize="2.4">🔒</text>}
          </g>
        ))}
      </svg>
      <div className="absolute flex gap-2" style={{ bottom: 'calc(var(--inset-bottom) + 10px)', right: 'calc(var(--inset-right) + 10px)' }}>
        <button type="button" onClick={() => setView('stars')} className="min-h-11 rounded-md bg-[#141827] px-4 font-bold ring-1 ring-white/15">Star map</button>
      </div>
      {note && <button type="button" data-note onClick={() => setNote(null)} className="absolute left-1/2 top-16 -translate-x-1/2 rounded-md bg-black/80 px-3 py-2 text-[13px]">{note}</button>}
    </div>
  )
}

/** The Log: the Timeline of scenes and debriefs seen (each replayable), the Files with their lines filled in, the Anomalies. */
function LogRoom({ pack }: { pack: StoryPack }) {
  const save = useGame((g) => g.save)!
  const [tab, setTab] = useState<'timeline' | 'files' | 'anomalies' | 'bonds'>('timeline')
  const [replay, setReplay] = useState<Scene | { id: string; place: string; steps: Scene['steps'] } | null>(null)
  const scenes = timeline(pack, save)
  if (replay) return <div className="absolute inset-0 z-20"><ScenePlayer key={replay.id} pack={pack} scene={replay} squad={sceneSquad(pack, save)} onEffect={() => {}} onBattle={async () => {}} onDone={() => setReplay(null)} /></div>
  return (
    <div className="absolute inset-0 overflow-y-auto p-4" style={{ paddingTop: 'calc(var(--inset-top) + 64px)', paddingLeft: 'calc(var(--inset-left) + 16px)' }}>
      <div className="mb-3 flex gap-2">{(['timeline', 'files', 'anomalies', 'bonds'] as const).map((t) => (
        <button key={t} type="button" onClick={() => setTab(t)} className={`min-h-11 rounded-md px-4 font-bold capitalize ${tab === t ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10'}`}>{t}</button>
      ))}</div>
      {tab === 'timeline' && (scenes.length === 0 ? <p className="text-white/60">No scenes yet.</p> : scenes.map((s) => (
        <button key={s.id} type="button" onClick={() => setReplay(s)} className="mb-2 flex min-h-11 w-full items-center justify-between rounded-lg bg-[#141827] px-3 text-left">{s.id}<span className="text-[12px] text-white/50">{s.place} · replay</span></button>
      )))}
      {tab === 'files' && Object.values(pack.files).map((f) => {
        const filled = save.story.files[f.id] ?? []
        return (
          <div key={f.id} data-file={f.id} className="mb-2 rounded-lg bg-[#141827] p-3">
            <b>{f.id}</b>
            {f.lines.map((l, i) => <div key={i} className="text-[13px]">{filled.includes(i) ? l.text : '████ ████████ ██████'}</div>)}
          </div>
        )
      })}
      {tab === 'bonds' && (() => {
        const rows = save.crew.flatMap((m) => {
          const file = pack.bonds[String(m.outfit)]
          const seen = (file?.scenes ?? []).filter((sc) => m.bond.seen.includes(sc.rank))
          return seen.length || (m.bond.rank >= 10 && file?.epilogue) ? [{ m, file: file!, seen }] : []
        })
        return rows.length === 0 ? <p className="text-white/60">No bond scenes yet: they come as each Uma's bond grows.</p> : rows.map(({ m, file, seen }) => (
          <div key={m.outfit} data-log-bond={m.outfit} className="mb-2 rounded-lg bg-[#141827] p-3">
            <b>{outfitName(pack, m.outfit)}</b> <span className="text-[12px] text-white/50">rank {m.bond.rank}{m.bond.path ? ` · ${m.bond.path === 'trust' ? 'Trust' : 'Heart'}` : ''}</span>
            <div className="mt-1 flex flex-wrap gap-2">{seen.map((sc) => (
              <button key={sc.rank} type="button" onClick={() => setReplay({ id: `bond-${m.outfit}-${sc.rank}`, place: sc.place, steps: sc.steps })} className="min-h-11 rounded-md bg-white/10 px-3 text-[13px] font-semibold">Rank {sc.rank} · replay</button>
            ))}</div>
            {m.bond.rank >= 10 && file?.epilogue && <p data-epilogue className="mt-2 rounded-md bg-[#ff3dc8]/10 p-2 text-[13px] italic">{fillCaptain(file.epilogue, save.captain)}</p>}
          </div>
        ))
      })()}
      {tab === 'anomalies' && (Object.keys(save.story.anomalies).length === 0 ? <p className="text-white/60">No Anomalies yet.</p>
        : Object.entries(save.story.anomalies).map(([id, open]) => <div key={id} className="mb-2 flex min-h-11 items-center justify-between rounded-lg bg-[#141827] px-3">{id}<span className={open ? 'text-[#ffb84d]' : 'text-[#7ef0b0]'}>{open ? 'Open' : 'Closed'}</span></div>))}
    </div>
  )
}
