// The mission flow at /mission (CY10, TC32, TC42): briefing → deploy → battle → results → aboard, each step held in the
// save, so after iOS closes the app it reopens where it was (a battle replays its actions to the same state). The battle
// is CY8's screen, unchanged. Landscape, on the turned stage, loaded on demand.
import type { BattleAction, BattleInput } from '@cyber/battle'
import type { StoryPack } from '@cyber/domain'
import { TurnedStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BattleView } from '../battle/BattleView'
import { resume } from '../battle/session'
import { updateSave, useGame } from '../save/game'
import { outfitName, useStory } from '../ship/useStory'
import { ScenePlayer } from '../story/ScenePlayer'
import { missionInput, SCENARIOS } from './battleInput'
import { afterMission, applyStep, chapterOf, closeResults, deploy, finishBattle, finishMission, lockedMembers, markSeen, recordAction, retry, setSquad, toDeploy } from './director'

export default function MissionScreen() {
  return <TurnedStage>{(layout) => <Mission layout={layout} />}</TurnedStage>
}

const panel = 'rounded-xl bg-[#141827] p-4 ring-1 ring-white/10'
const primary = 'min-h-12 rounded-md bg-[#2ee6ff] px-5 font-display font-bold text-[#0b0d17]'
const secondary = 'min-h-12 rounded-md bg-white/10 px-5 font-display font-bold'

function Mission({ layout }: { layout: StageLayout }) {
  const navigate = useNavigate()
  const save = useGame((g) => g.save)
  const pack = useStory()
  if (!save || !pack) return <div className="flex h-full items-center justify-center bg-[#0b0d17] text-white/60">…</div>
  const m = save.mission
  if (!m) return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b0d17] text-white/70">No mission in progress.<button type="button" className={primary} onClick={() => void navigate('/')}>Ship</button></div>
  )
  const chapter = pack.chapters[m.chapter] ?? chapterOf(pack, m.id)
  const mission = chapter?.missions.find((x) => x.id === m.id)
  if (!chapter || !mission) return <div className="p-6 text-[#ff3d6e]">The mission {m.id} isn't in the story any more.</div>
  const frame = (children: React.ReactNode) => (
    <div className="absolute inset-0 overflow-y-auto bg-[#0b0d17] text-[#e8ebf5]" style={{ padding: 'calc(var(--inset-top) + 14px) calc(var(--inset-right) + 14px) calc(var(--inset-bottom) + 14px) calc(var(--inset-left) + 14px)' }}>
      <div className="mx-auto max-w-3xl space-y-3">{children}</div>
    </div>
  )
  const world = pack.worlds[chapter.world]
  const location = world?.locations.find((l) => l.id === mission.place)

  if (m.step === 'briefing') return frame(
    <div data-briefing className={panel}>
      <div className="text-[12px] uppercase tracking-widest text-white/50">Briefing · {chapter.id}</div>
      <h1 className="font-display text-2xl font-bold">{mission.id}</h1>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
        <div><b>Objective</b><div className="text-white/80">{mission.objective.kind}</div></div>
        <div><b>Place</b><div className="text-white/80">{mission.place} · danger {'◆'.repeat(location?.danger ?? chapter.danger)}</div></div>
        <div><b>Enemies known</b><div className="text-white/80">{mission.enemies.map((e) => (e.slot === 'boss' ? `a leader (${e.pool.length} possible)` : `${e.count} ${e.faction} ${e.job}s`)).join(', ')}</div></div>
        <div><b>Side objectives</b><div className="text-white/80">{mission.side.length ? mission.side.map((s) => s.kind).join(', ') : 'None'}</div></div>
      </div>
      <p className="mt-2 text-[13px] text-white/60">{mission.brief}</p>
      <div className="mt-3 flex gap-2"><button type="button" className={primary} onClick={() => void updateSave(toDeploy)}>Deploy</button><button type="button" className={secondary} onClick={() => void navigate('/')}>Ship</button></div>
    </div>,
  )

  if (m.step === 'deploy') return frame(<Deploy pack={pack} squad={m.squad} locked={lockedMembers(chapter, mission)} fixed={!!mission.fixedSquad} onDeploy={(squad) => {
    const scenario = mission.scenario ?? 'sandbox-muster'
    if (!SCENARIOS[scenario]) return
    const input = missionInput(scenario, squad, (o) => outfitName(pack, o), `${mission.id}:1`)
    void updateSave((s) => deploy(setSquad(s, squad), input))
  }} />)

  if (m.step === 'battle' && m.battle) return <MissionBattle layout={layout} input={m.battle.input as BattleInput} actions={m.battle.actions as BattleAction[]} />

  if (m.step === 'results') {
    const won = !!m.won
    const enemies = ((m.battle?.input as BattleInput | undefined)?.units ?? []).filter((u) => u.side === 'enemy').length
    return frame(
      <div data-mission-results className={panel}>
        <h1 className="font-display text-3xl font-bold" style={{ color: won ? '#2ee6ff' : '#ff3d6e' }}>{won ? 'Mission won' : 'Mission lost'}</h1>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[['XP', won ? 100 + enemies * 10 : enemies * 5], ['Credits', won ? 50 * enemies : 0], ['Salvage', won ? enemies : 0]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/5 p-2"><div className="text-[12px] text-white/60">{k}</div><div className="font-display text-xl font-bold">{v}</div></div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-white/50">The economy comes in Phase 5: these are plain numbers for now.</p>
        <div className="mt-3 flex gap-2">
          {!won && <button type="button" className={primary} onClick={() => void updateSave(retry)}>Retry</button>}
          <button type="button" className={won ? primary : secondary} onClick={() => void updateSave(closeResults).then(() => { if (!won) void navigate('/') })}>{won ? 'Continue' : 'Back to the ship'}</button>
        </div>
      </div>,
    )
  }

  if (m.step === 'aboard') {
    const next = afterMission(pack, save, chapter.world, m.id)
    if (next.kind !== 'scene') {
      void updateSave(finishMission).then(() => navigate('/'))
      return null
    }
    return (
      <div className="absolute inset-0">
        <ScenePlayer key={next.scene.id} pack={pack} scene={next.scene} squad={[...save.crew, ...pack.casting.crewOrder]}
          onEffect={(step) => void updateSave((s) => applyStep(s, pack, step))}
          onBattle={async () => {}}
          onDone={() => { void updateSave((s) => finishMission(markSeen(s, next.scene.id))).then(() => navigate('/')) }} />
      </div>
    )
  }
  return null
}

/** Deploy (TC32): four Umas and the guest slot; a chapter's leads are locked in, a flash-forward's whole squad is fixed. */
function Deploy({ pack, squad, locked, fixed, onDeploy }: { pack: StoryPack; squad: number[]; locked: number[]; fixed: boolean; onDeploy: (squad: number[]) => void }) {
  const crew = useGame((g) => g.save?.crew ?? [])
  const [chosen, setChosen] = useState(squad)
  const pool = [...new Set([...locked, ...crew])]
  const toggle = (o: number) => {
    if (fixed || locked.includes(o)) return
    setChosen((c) => (c.includes(o) ? c.filter((x) => x !== o) : c.length < 4 ? [...c, o] : c))
  }
  return (
    <div data-deploy className={panel}>
      <h1 className="font-display text-2xl font-bold">Deploy</h1>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="flex min-h-20 items-center justify-center rounded-lg border border-[#2ee6ff]/40 p-2 text-center text-[13px] font-bold">{chosen[i] ? outfitName(pack, chosen[i]!) : 'Empty: a stand-in fills it'}</div>)}
        <div className="flex min-h-20 items-center justify-center rounded-lg border border-[#7ef0b0]/40 p-2 text-center text-[13px] text-white/60">Guest slot</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {pool.map((o) => (
          <button key={o} type="button" onClick={() => toggle(o)} aria-pressed={chosen.includes(o)}
            className={`min-h-11 rounded-md px-3 font-semibold ${chosen.includes(o) ? 'bg-[#2ee6ff]/25 ring-1 ring-[#2ee6ff]' : 'bg-white/10'}`}>
            {outfitName(pack, o)}{locked.includes(o) ? ' 🔒' : ''}
          </button>
        ))}
      </div>
      <div className="mt-3"><button type="button" className="min-h-12 rounded-md bg-[#2ee6ff] px-5 font-display font-bold text-[#0b0d17]" onClick={() => onDeploy(chosen)}>Start the battle</button></div>
    </div>
  )
}

/** The battle, replayed from the save's input and actions (resume), every action saved as it's made. */
function MissionBattle({ layout, input, actions }: { layout: StageLayout; input: BattleInput; actions: BattleAction[] }) {
  const navigate = useNavigate()
  const session = useMemo(() => resume(input, actions), [])
  if ('error' in session) return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b0d17] p-6 text-center text-white/80">
      This battle no longer replays ({session.error}).
      <button type="button" className={primary} onClick={() => void updateSave(retry)}>Restart it</button>
    </div>
  )
  return (
    <BattleView layout={layout} session={session} control={{ squad: 'player', enemy: 'ai' }} debug={new URLSearchParams(location.search).has('debug')}
      onCommit={(s) => { void updateSave((save) => recordAction(save, s.actions[s.actions.length - 1]), { quiet: true }) }}
      onEnd={(s) => { void updateSave((save) => finishBattle(save, s.state.result?.winner === 'squad')) }}
      onQuit={() => void navigate('/')} />
  )
}
