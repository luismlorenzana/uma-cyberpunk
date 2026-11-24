import { capacityOf, loadOf, type BattleInput } from '@cyber/battle'
import { advanceCombatTraining, issuedCampaignRig, loadoutOf, rigProblem, type Rig, type Save } from '@cyber/domain'
import { missionInput, SCENARIOS, type SquadUnit } from '../mission/battleInput'
import { finishMission } from '../mission/director'

export const TRAINING_MAIN = [
  { id: 'hand-greatblade', name: 'Great blade', details: 'Two hands · 1 tile' },
  { id: 'hand-rifle', name: 'Laser rifle', details: 'Two hands · Burst · 1–3 tiles' },
] as const
export const TRAINING_EXPANSION = [
  { id: 'back-bulwark', name: 'Bulwark', details: 'Place a barrier' },
  { id: 'back-med', name: 'Med unit', details: 'Mend damaged armor' },
] as const
export type TrainingMain = typeof TRAINING_MAIN[number]['id']
export type TrainingExpansion = typeof TRAINING_EXPANSION[number]['id']

export function trainingInput(outfit: number, label: string, main: TrainingMain, expansion: TrainingExpansion): BattleInput {
  return groundInput('training', outfit, label, main, expansion)
}

export function groundInput(scenario: string, outfit: number, label: string, main: string, expansion: string, boss?: { unit: string; name: string },
  companions: readonly { outfit: number; label: string; rig: Rig | null }[] = [], fitted?: Rig): BattleInput {
  const rig = fitted ?? issuedCampaignRig(main, expansion)
  const [trainee, ...slots] = SCENARIOS[scenario]!.input.units.filter((unit) => unit.side === 'squad')
  const squad: SquadUnit[] = [{ outfit, label, bands: trainee!.bands, loadout: loadoutOf(rig), stride: null, frozenRig: rig },
    ...slots.flatMap((slot, index) => {
      const member = companions[index]
      if (!member) return []
      const equipped = member.rig && !rigProblem(member.rig) ? loadoutOf(member.rig) : null
      const fits = equipped && loadOf(equipped) <= capacityOf({ loadout: equipped, bands: slot.bands })
      return [{ outfit: member.outfit, label: member.label, bands: slot.bands, loadout: fits ? equipped : slot.loadout,
        stride: null, ...(fits && member.rig ? { frozenRig: member.rig } : {}) }]
    })]
  const input = missionInput(scenario, squad, [], scenario)
  const mounted = input.units.some(({ loadout }) => loadout.back.kind === 'launcher' && loadout.back.weapon
    && (loadout.back.weapon.band !== 'long' || loadout.back.weapon.blast))
  const rules = mounted ? { ...input, rulesVersion: 4 } : input
  return boss ? { ...rules, units: rules.units.map((unit) => unit.id === boss.unit ? { ...unit, label: boss.name } : unit) } : rules
}

/** Exercise results settle independently of mission rewards, supply costs and the day clock. */
export function settleTraining(save: Save): Save {
  const mission = save.mission
  if (!mission || mission.step !== 'results' || !mission.won) return save
  const complete = mission.battle?.input as BattleInput | undefined
  const trained = complete?.rulesVersion === 5 && !save.worlds.missions.includes(mission.id)
    ? advanceCombatTraining(save, complete.units) : save
  return finishMission({ ...trained, worlds: { ...save.worlds, missions: [...new Set([...save.worlds.missions, mission.id])] } })
}
