import { capacityOf, hash32, loadOf, type BattleInput } from '@cyber/battle'
import { applyGroundRules, issuedCampaignRig, loadoutOf, rigProblem, type ExpeditionRun, type GroundRules, type Mission, type Rig, type Save, type StoryPack } from '@cyber/domain'
import { missionInput, SCENARIOS, type SquadUnit } from '../mission/battleInput'
import { finishMission } from '../mission/director'
import { nameOf } from '../story/runner'

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

export function groundSquadCapacity(scenario: string | undefined): number {
  return Math.min(4, (scenario ? SCENARIOS[scenario]?.input.units.filter(unit => unit.side === 'squad').length : 0) || 1)
}

/** All ten fixed expedition members arrive from the saved roster with role-appropriate issued equipment. */
export function expeditionGroundInput(mission: Mission, run: ExpeditionRun, story: StoryPack): BattleInput {
  const scenario = SCENARIOS[mission.scenario!]!
  const slots = scenario.input.units.filter(unit => unit.side === 'squad')
  const squad: SquadUnit[] = run.members.map((member, index) => {
    const role = member.role
    const rig = role === 'uma' ? issuedCampaignRig('hand-rifle', 'back-deck')
      : role === 'boss-ally' ? issuedCampaignRig('hand-greatblade', 'back-thruster')
      : role === 'melee-shield' ? { ...issuedCampaignRig('hand-blade', 'back-bulwark'), leftHand: 'hand-buckler' }
      : role === 'ranged-medic' ? issuedCampaignRig('hand-rifle', 'back-med')
      : issuedCampaignRig('hand-pistol', 'back-sniper')
    const identity = member.role === 'uma' ? member.outfit : member.heroine
    return { outfit: member.role === 'uma' ? member.outfit : 0, ...(member.role === 'uma' ? {} : { heroine: member.heroine }),
      label: nameOf(story, identity), bands: slots[index]!.bands, frozenRig: rig, loadout: loadoutOf(rig), stride: null,
      spriteRole: role === 'boss-ally' ? 'boss-ally' : 'sub-boss' }
  })
  const attempt = scenario.id.length + mission.id.length < 64 ? mission.id : String(hash32(mission.id))
  const input = missionInput(scenario.id, squad, [], attempt)
  const target = mission.enemies.find(enemy => enemy.slot === 'boss')?.pool[0]
  const opposition = mission.enemies.flatMap(enemy => enemy.slot === 'regular'
    ? Array.from({ length: enemy.count }, () => enemy.faction) : [])
  let sentry = 0
  return { ...input, units: input.units.map(unit => {
    if (unit.side !== 'enemy') return unit
    const named = unit.leader && target
    const actor = named || opposition[sentry++]
    if (!actor) return unit
    return { ...unit, ref: { kind: 'heroine' as const, id: actor }, label: nameOf(story, actor),
      sprite: { role: named ? 'boss-enemy' as const : 'sub-boss' as const, form: 'standard',
        fitting: named ? unit.id : 'expedition-sentry' } }
  }) }
}

export function trainingInput(outfit: number, label: string, main: TrainingMain, expansion: TrainingExpansion): BattleInput {
  return groundInput('training', outfit, label, main, expansion)
}

export function groundInput(scenario: string, outfit: number, label: string, main: string, expansion: string, boss?: { unit: string; name: string },
  companions: readonly { outfit: number; heroine?: string; label: string; rig: Rig | null; issueIfUnfitted?: boolean }[] = [],
  fitted?: Rig, ground?: GroundRules, flags: readonly string[] = [], allyRig?: Rig): BattleInput {
  const issued = issuedCampaignRig(main, expansion)
  const rig = fitted ?? issued
  const [trainee, ...slots] = SCENARIOS[scenario]!.input.units.filter((unit) => unit.side === 'squad')
  const squad: SquadUnit[] = [{ outfit, label, bands: trainee!.bands, loadout: loadoutOf(rig), stride: null, frozenRig: rig },
    ...slots.flatMap((slot, index) => {
      const member = companions[index]
      if (!member) return []
      const fits = (candidate: Rig | null) => {
        if (!candidate || rigProblem(candidate)) return false
        const loadout = loadoutOf(candidate)
        return loadOf(loadout) <= capacityOf({ loadout, bands: slot.bands })
      }
      const fitting = fits(member.rig) ? member.rig : member.issueIfUnfitted && fits(issued) ? issued : null
      return [{ outfit: member.outfit, heroine: member.heroine, label: member.label, bands: slot.bands,
        loadout: fitting ? loadoutOf(fitting) : slot.loadout, stride: null, ...(fitting ? { frozenRig: fitting } : {}) }]
    })]
  const input = missionInput(scenario, squad, [], scenario)
  const mounted = input.units.some(({ loadout }) => loadout.back.kind === 'launcher' && loadout.back.weapon
    && (loadout.back.weapon.band !== 'long' || loadout.back.weapon.blast))
  const rules = mounted ? { ...input, rulesVersion: Math.max(input.rulesVersion, 4) } : input
  const named = boss ? { ...rules, units: rules.units.map((unit) => unit.id === boss.unit ? { ...unit, label: boss.name } : unit) } : rules
  return ground ? applyGroundRules(named, ground, flags, allyRig) : named
}

/** Exercise results settle independently of mission rewards, supply costs and the day clock. */
export function settleTraining(save: Save): Save {
  const mission = save.mission
  if (!mission || mission.step !== 'results' || !mission.won) return save
  return finishMission({ ...save, worlds: { ...save.worlds, missions: [...new Set([...save.worlds.missions, mission.id])] } })
}
