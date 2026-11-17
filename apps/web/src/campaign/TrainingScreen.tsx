import type { BattleAction, BattleInput } from '@cyber/battle'
import type { Mission, Save } from '@cyber/domain'
import type { StageLayout } from '@luismlorenzana/uma-stage'
import { useState } from 'react'
import { BattleView } from '../battle/BattleView'
import { resume } from '../battle/session'
import { deploy, finishBattle, recordAction, retry, setSquad, toDeploy } from '../mission/director'
import { updateSave } from '../save/game'
import { settleTraining, TRAINING_EXPANSION, TRAINING_MAIN, trainingInput, type TrainingExpansion, type TrainingMain } from './training'

const action = 'min-h-11 rounded-lg bg-white/10 px-4 text-sm font-bold text-white'
const primary = 'min-h-11 rounded-lg bg-[#2ee6ff] px-4 font-bold text-[#0b0d17]'
const panel = 'absolute inset-0 overflow-auto bg-[#0b0d17] p-4 text-[#e8ebf5]'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }

export default function TrainingScreen({ save, mission, layout, trainee, label, close }: {
  save: Save; mission: Mission; layout: StageLayout; trainee: number; label: string; close: () => void
}) {
  const state = save.mission
  const [main, setMain] = useState<TrainingMain>(TRAINING_MAIN[0].id)
  const [expansion, setExpansion] = useState<TrainingExpansion>(TRAINING_EXPANSION[0].id)
  if (!state) return null
  if (state.step === 'battle' && state.battle) {
    return <TrainingBattle layout={layout} input={state.battle.input as BattleInput} actions={state.battle.actions as BattleAction[]} close={close} />
  }
  return (
    <main className={panel} style={insets} data-training={state.step}>
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="font-display text-2xl font-bold">{state.step === 'briefing' ? 'Training'
          : state.step === 'deploy' ? 'Training Hangar' : state.won ? 'Exercise passed' : 'Exercise lost'}</h1>
        {state.step === 'briefing' && <>
          <p className="text-sm text-white/80">{mission.brief}</p>
          <div className="flex gap-2">
            <button type="button" className={primary} onClick={() => void updateSave(toDeploy)}>Prepare gear</button>
            <button type="button" className={action} onClick={close}>Campaign</button>
          </div>
        </>}
        {state.step === 'deploy' && <>
          <p className="font-semibold">{label}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="space-y-2"><legend className="text-sm text-white/70">Main weapon</legend>
              {TRAINING_MAIN.map((option) => <button key={option.id} type="button" aria-pressed={main === option.id}
                className={`${action} block w-full text-left aria-pressed:ring-2 aria-pressed:ring-cyan-300`} onClick={() => setMain(option.id)}>
                {option.name} <span className="font-normal text-white/70">· {option.details}</span>
              </button>)}
            </fieldset>
            <fieldset className="space-y-2"><legend className="text-sm text-white/70">Armor expansion</legend>
              {TRAINING_EXPANSION.map((option) => <button key={option.id} type="button" aria-pressed={expansion === option.id}
                className={`${action} block w-full text-left aria-pressed:ring-2 aria-pressed:ring-cyan-300`} onClick={() => setExpansion(option.id)}>
                {option.name} <span className="font-normal text-white/70">· {option.details}</span>
              </button>)}
            </fieldset>
          </div>
          <div className="flex gap-2">
            <button type="button" className={primary} onClick={() => {
              const input = trainingInput(trainee, label, main, expansion)
              void updateSave((s) => s.mission?.step === 'deploy' ? deploy(setSquad(s, [trainee]), input) : s)
            }}>Deploy</button>
            <button type="button" className={action} onClick={close}>Campaign</button>
          </div>
        </>}
        {state.step === 'results' && <div className="flex gap-2">
          {state.won ? <button type="button" className={primary} onClick={() => void updateSave(settleTraining)}>Debrief</button>
            : <button type="button" className={primary} onClick={() => void updateSave(retry)}>Retry</button>}
          <button type="button" className={action} onClick={close}>Campaign</button>
        </div>}
      </div>
    </main>
  )
}

function TrainingBattle({ layout, input, actions, close }: { layout: StageLayout; input: BattleInput; actions: BattleAction[]; close: () => void }) {
  const [session] = useState(() => resume(input, actions))
  if ('error' in session) return <div className={panel} style={insets}>
    <p role="alert">The exercise can’t resume.</p>
    <button type="button" className={primary} onClick={() => void updateSave((save) => toDeploy(retry(save)))}>Prepare again</button>
  </div>
  return <BattleView layout={layout} session={session} control={{ squad: 'player', enemy: 'ai' }} debug={false} training
    onCommit={(next) => {
      const action = next.actions.at(-1)
      if (action) void updateSave((save) => save.mission?.step === 'battle' ? recordAction(save, action) : save, { quiet: true })
    }}
    onEnd={(next) => void updateSave((save) => save.mission?.step === 'battle' ? finishBattle(save, next.state.result?.winner === 'squad') : save)}
    onQuit={close} />
}
