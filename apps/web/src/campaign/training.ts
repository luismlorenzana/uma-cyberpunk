import type { BattleInput } from '@cyber/battle'
import { loadoutOf, type Rig, type Save } from '@cyber/domain'
import { missionInput, SCENARIOS } from '../mission/battleInput'
import { finishMission } from '../mission/director'

export const TRAINING_MAIN = [
  { id: 'hand-greatblade', name: 'Great blade', details: 'Two hands · 1 tile' },
  { id: 'hand-rifle', name: 'Rifle', details: 'Burst · 1–3 tiles' },
] as const
export const TRAINING_EXPANSION = [
  { id: 'back-bulwark', name: 'Bulwark', details: 'Place a barrier' },
  { id: 'back-med', name: 'Med unit', details: 'Mend damaged armor' },
] as const
export type TrainingMain = typeof TRAINING_MAIN[number]['id']
export type TrainingExpansion = typeof TRAINING_EXPANSION[number]['id']

export function trainingInput(outfit: number, label: string, main: TrainingMain, expansion: TrainingExpansion): BattleInput {
  const rig: Rig = { core: 'core-light', leftArm: 'arm-light', rightArm: 'arm-light', legs: 'legs-standard',
    visor: 'visor-aim', leftHand: null, rightHand: main, back: expansion, coat: null }
  const trainee = SCENARIOS.training!.input.units.find((unit) => unit.side === 'squad')!
  return missionInput('training', [{ outfit, label, bands: trainee.bands, loadout: loadoutOf(rig), stride: null }], [], 'training')
}

/** Exercise results settle independently of mission rewards, supply costs and the day clock. */
export function settleTraining(save: Save): Save {
  const mission = save.mission
  if (!mission || mission.step !== 'results' || !mission.won) return save
  return finishMission({ ...save, worlds: { ...save.worlds, missions: [...new Set([...save.worlds.missions, mission.id])] } })
}
