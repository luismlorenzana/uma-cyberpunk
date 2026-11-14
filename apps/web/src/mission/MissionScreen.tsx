// The mission flow at /mission (CY10, TC32, TC42): briefing → deploy → battle → results → aboard, each step held in the
// save, so after iOS closes the app it reopens where it was (a battle replays its actions to the same state). The battle
// is CY8's screen, unchanged. Landscape, on the turned stage, loaded on demand.
import type { BattleAction, BattleInput } from '@cyber/battle'
import { ITEMS_BY_ID, loadoutOf, missionItem, newMember, ROLE_NAME, type StoryPack } from '@cyber/domain'
import { TurnedStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BattleView } from '../battle/BattleView'
import { battleRapport } from '../bonds/battleRapport'
import { ItemIcon } from '../cabins/art'
import { lightsFrom } from '../cabins/cabins'
import { resume } from '../battle/session'
import { useMaster } from '../master/master'
import { crewViews, infoFrom, memberView, type CrewView } from '../crew/view'
import { updateSave, useGame } from '../save/game'
import { outfitName, useStory } from '../ship/useStory'
import { ScenePlayer } from '../story/ScenePlayer'
import { missionInput, SCENARIOS } from './battleInput'
import {
  afterMission, applyStep, cantDeploy, chapterOf, closeResults, deploy, finishBattle, finishMission, lockedMembers, markSeen, recordAction, retry, rewards, sceneSquad,
  setSquad, toDeploy,
} from './director'

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
  const master = useMaster()
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

  if (m.step === 'deploy') return frame(<Deploy pack={pack} squad={m.squad} locked={lockedMembers(chapter, mission)} fixed={!!mission.fixedSquad} onDeploy={(squad, bench) => {
    const scenario = mission.scenario ?? 'sandbox-muster'
    if (!SCENARIOS[scenario]) return
    const units = squad.map((v) => ({ outfit: v.outfit, label: v.name, bands: v.bands, loadout: loadoutOf(v.rig), stride: v.stride }))
    const input = missionInput(scenario, units, bench.map((v) => v.role), `${mission.id}:1`)
    void updateSave((s) => deploy(setSquad(s, squad.map((v) => v.outfit)), input))
  }} />)

  if (m.step === 'battle' && m.battle) return <MissionBattle layout={layout} input={m.battle.input as BattleInput} actions={m.battle.actions as BattleAction[]} />

  if (m.step === 'results') {
    const won = !!m.won
    const r = rewards((m.battle?.input ?? null) as BattleInput | null, won)
    return frame(
      <div data-mission-results className={panel}>
        <h1 className="font-display text-3xl font-bold" style={{ color: won ? '#2ee6ff' : '#ff3d6e' }}>{won ? 'Mission won' : 'Mission lost'}</h1>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[['XP', r.xp], ['Credits', r.credits], ['Salvage', r.salvage]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/5 p-2"><div className="text-[12px] text-white/60">{k}</div><div className="font-display text-xl font-bold">{v}</div></div>
          ))}
        </div>
        {won && !save.worlds.missions.includes(m.id) && (() => { const item = ITEMS_BY_ID.get(missionItem(m.id)); return item ? (
          <div data-found-item={item.id} className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 p-2 text-[14px]"><ItemIcon id={item.id} size={32} /> Found for the cabins: <b>{item.name}</b></div>
        ) : null })()}
        <p className="mt-2 text-[12px] text-white/50">The squad takes the XP and a point of Strain; the crew aboard takes half and rests, shedding more Strain in a comfortable cabin. The economy comes in Phase 5: credits and salvage are plain numbers for now.</p>
        <div className="mt-3 flex gap-2">
          {!won && <button type="button" className={primary} onClick={() => void updateSave(retry)}>Retry</button>}
          <button type="button" className={won ? primary : secondary} onClick={() => {
            const rapport = m.battle ? battleRapport(m.battle.input as BattleInput, m.battle.actions as BattleAction[]) : null
            const views = crewViews(save, pack, infoFrom(master.status === 'ready' ? master.view.info : null), (o) => outfitName(pack, o))
            void updateSave((s) => closeResults(s, pack, rapport, lightsFrom(pack, views))).then(() => { if (!won) void navigate('/') })
          }}>{won ? 'Continue' : 'Back to the ship'}</button>
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
        <ScenePlayer key={next.scene.id} pack={pack} scene={next.scene} squad={sceneSquad(pack, save, m.squad)}
          onEffect={(step) => void updateSave((s) => applyStep(s, pack, step))}
          onBattle={async () => {}}
          onDone={() => { void updateSave((s) => finishMission(markSeen(s, next.scene.id))).then(() => navigate('/')) }} />
      </div>
    )
  }
  return null
}

/** Deploy (TC32): four Umas and the guest slot, each in her own rig; a chapter's leads are locked in, a flash-forward's
 * whole squad is fixed. An Uma resting at Strain 3 or with a rig she can't wear can't go, and the screen says why. */
function Deploy({ pack, squad, locked, fixed, onDeploy }: { pack: StoryPack; squad: number[]; locked: number[]; fixed: boolean; onDeploy: (squad: CrewView[], bench: CrewView[]) => void }) {
  const navigate = useNavigate()
  const save = useGame((g) => g.save)!
  const master = useMaster()
  const info = infoFrom(master.status === 'ready' ? master.view.info : null)
  const view = (o: number) => memberView(save.crew.find((c) => c.outfit === o) ?? newMember(o), pack, info, (x) => outfitName(pack, x))
  const [chosen, setChosen] = useState(squad)
  const pool = [...new Set([...locked, ...save.crew.map((c) => c.outfit)])].map(view)
  const why = (v: CrewView) => cantDeploy(save, v.outfit, locked, v.stats.problem)
  const toggle = (v: CrewView) => {
    if (fixed || locked.includes(v.outfit)) return
    setChosen((c) => (c.includes(v.outfit) ? c.filter((x) => x !== v.outfit) : c.length < 4 && !why(v) ? [...c, v.outfit] : c))
  }
  const squadViews = chosen.map(view)
  const blocked = squadViews.map((v) => ({ v, why: why(v) })).filter((x) => x.why)
  return (
    <div data-deploy className={panel}>
      <h1 className="font-display text-2xl font-bold">Deploy</h1>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {[0, 1, 2, 3].map((i) => {
          const v = squadViews[i]
          return (
            <div key={i} data-slot={v?.outfit ?? 'empty'} className={`flex min-h-20 flex-col items-center justify-center rounded-lg border p-2 text-center text-[13px] ${v && why(v) ? 'border-[#ff3d6e]' : 'border-[#2ee6ff]/40'}`}>
              {v ? <><b>{v.name}</b><span className="text-white/60">{ROLE_NAME[v.role]} · Load {v.stats.load}/{v.stats.capacity}</span></> : <span className="text-white/60">Empty: a stand-in fills it</span>}
            </div>
          )
        })}
        <div className="flex min-h-20 items-center justify-center rounded-lg border border-[#7ef0b0]/40 p-2 text-center text-[13px] text-white/60">Guest slot</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {pool.map((v) => {
          const reason = chosen.includes(v.outfit) ? null : why(v)
          return (
            <button key={v.outfit} type="button" onClick={() => toggle(v)} aria-pressed={chosen.includes(v.outfit)} title={reason ?? undefined}
              className={`min-h-11 rounded-md px-3 text-left font-semibold ${chosen.includes(v.outfit) ? 'bg-[#2ee6ff]/25 ring-1 ring-[#2ee6ff]' : reason ? 'bg-white/5 text-white/40' : 'bg-white/10'}`}>
              {v.name}{locked.includes(v.outfit) ? ' 🔒' : ''} <span className="text-[12px] font-normal text-white/60">{ROLE_NAME[v.role]} · Strain {v.member.strain}</span>
              {reason && <span className="block text-[11px] font-normal text-[#ff8fae]">{reason}</span>}
            </button>
          )
        })}
      </div>
      {blocked.length > 0 && <div data-deploy-blocked className="mt-3 rounded-md bg-[#ff3d6e]/15 p-2 text-[13px] text-[#ffb3c6]">{blocked.map((b) => <div key={b.v.outfit}>{b.v.name}: {b.why}</div>)}</div>}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={blocked.length > 0} className={`${primary} disabled:opacity-40`}
          onClick={() => onDeploy(squadViews, save.crew.filter((c) => !chosen.includes(c.outfit)).map((c) => view(c.outfit)))}>Start the battle</button>
        <button type="button" className={secondary} onClick={() => void navigate('/room/hangar')}>Hangar</button>
      </div>
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
