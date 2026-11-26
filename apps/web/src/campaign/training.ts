import { capacityOf, createBattle, hash32, loadOf, type Band, type Bands, type BattleInput, type UnitInput } from '@cyber/battle'
import { advanceCombatTraining, applyGroundRules, issuedCampaignRig, laserFitting, loadoutOf, rigProblem, specialistFitting, trainingOf,
  type ExpeditionRun, type GroundRules, type Mission, type Rig, type Save, type Speaker, type StoryPack } from '@cyber/domain'
import { missionInput, SCENARIOS, type SquadUnit } from '../mission/battleInput'
import { finishMission } from '../mission/director'
import { nameOf } from '../story/runner'
import { salvageRecipes } from './salvage'

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
export function expeditionGroundInput(mission: Mission, run: ExpeditionRun, story: StoryPack, save?: Save,
  bandsOf?: CampaignBands, useFitted = true, rules?: GroundRules, refit?: ExpeditionRefit): BattleInput {
  const scenario = SCENARIOS[mission.scenario!]!
  const slots = scenario.input.units.filter(unit => unit.side === 'squad')
  const variants = new Map<string, number>()
  const fittings = run.members.map((member, index) => {
    const role = member.role
    const variant = variants.get(role) ?? 0
    variants.set(role, variant + 1)
    const identity = member.role === 'uma' ? member.outfit : member.heroine
    const bands = member.role === 'uma' ? personalBands(slots[index]!.bands, bandsOf?.(member.outfit)) : slots[index]!.bands
    const objectiveDeck = scenario.input.objective.kind === 'hack' && variant === 0 ? 'back-deck' : undefined
    const template = member.role === 'uma' ? laserFitting(trainingOf(save ?? {}, member.outfit, true), false, objectiveDeck)
      : specialistFitting(role === 'boss-ally' ? 'wing' : role === 'melee-shield' ? 'shield' : role === 'ranged-medic' ? 'medic' : 'sniper', variant)
    const equipped = useFitted ? save?.crew.find(row => member.role === 'uma' ? row.outfit === member.outfit : row.heroine === member.heroine)?.rig : undefined
    const optional = refit?.actor === identity && campaignRefitParts(save).find(row => row.part === refit.part)
    const armor = optional ? { ...template.rig, ...equipped, [optional.slot]: optional.part } : equipped
    const fit = fitCampaignChassis(template, bands, armor, save?.campaignGear.parts)
    const squad: SquadUnit = { outfit: member.role === 'uma' ? member.outfit : 0,
      ...(member.role === 'uma' ? {} : { heroine: member.heroine }), label: nameOf(story, identity), bands, frozenRig: fit.rig,
      loadout: fit.loadout, stride: null, spriteRole: role === 'boss-ally' ? 'boss-ally' : 'sub-boss' }
    return { squad, specialty: fit.specialty, terminalOnly: role === 'uma' && !!objectiveDeck }
  })
  const attempt = scenario.id.length + mission.id.length < 64 ? mission.id : String(hash32(mission.id))
  const input = missionInput(scenario.id, fittings.map(row => row.squad), [], attempt)
  const target = mission.enemies.find(enemy => enemy.slot === 'boss')?.pool[0]
  const opposition = mission.enemies.flatMap(enemy => enemy.slot === 'regular'
    ? Array.from({ length: enemy.count }, () => enemy.faction) : [])
  let sentry = 0
  const queen = mission.id.startsWith('fa-free-') && mission.id.endsWith('-turn') && input.units.find(unit => unit.leader)
  let friendly = 0
  const windup = input.units.find(unit => unit.side === 'enemy' && !unit.leader && unit.loadout.back.kind === 'launcher')
    ?? input.units.find(unit => unit.side === 'enemy' && !unit.leader && [unit.loadout.leftHand, unit.loadout.rightHand]
      .some(item => item?.kind === 'weapon' && item.band !== 'melee'))
  const projected: BattleInput = { ...input, ...(queen ? { goalRequired: true as const, protect: [queen.id] } : {}), units: input.units.map(unit => {
    if (unit.side === 'squad') {
      const fit = fittings[friendly++]!
      return { ...unit, specialty: fit.specialty, ...(fit.terminalOnly ? { terminalOnly: true as const } : {}) }
    }
    const second = mission.scenario === 'hush-collar' && unit.id === 'chorus-1'
    const named = unit.leader && target || (second ? 'seraine-seraxis' : undefined)
    const actor = named || opposition[sentry++]
    const enemy = windup?.id === unit.id ? { ...unit, specialty: { kind: 'windup' as const } } : unit
    if (!actor) return enemy
    return { ...enemy, ref: { kind: 'heroine' as const, id: actor }, label: nameOf(story, actor),
      sprite: { role: named ? 'boss-enemy' as const : 'sub-boss' as const, form: 'standard',
        fitting: named ? unit.id : 'expedition-sentry' } }
  }) }
  const battle = rules ? applyGroundRules(projected, rules, save?.story.flags) : projected
  createBattle(battle)
  return battle
}

export type CampaignBands = (outfit: number) => Bands | undefined
export interface ExpeditionRefit { actor: Speaker; part: string }

export function campaignRefitParts(save?: Save) {
  return salvageRecipes.filter(recipe => save?.campaignGear.parts.includes(recipe.part)
    && !save.crew.some(member => member.rig?.[recipe.slot] === recipe.part))
}

function personalBands(slot: Bands, personal?: Bands): Bands {
  if (!personal) return slot
  const adjust = (band: keyof Bands): Band => Math.max(1, Math.min(5, slot[band] + Math.sign(personal[band] - 3))) as Band
  return { speed: adjust('speed'), stamina: adjust('stamina'), power: adjust('power'), guts: adjust('guts'), wit: adjust('wit') }
}

/** Chassis fitting preserves rank modifiers, weapon families and role mounts. Fit validation is shared with the engine. */
function fitCampaignChassis(fit: ReturnType<typeof laserFitting>, bands: Bands, worn?: Rig | null, parts: readonly string[] = []) {
  const { rig, loadout } = fit
  const fits = (candidate: UnitInput['loadout']) => loadOf(candidate) <= capacityOf({ bands, loadout: candidate })
  const armor = ['core', 'leftArm', 'rightArm', 'legs', 'visor', 'coat'] as const
  for (const fallback of [rig, { ...rig, legs: 'legs-light' }, { ...rig, legs: 'legs-light', visor: 'visor-basic' }]) {
    const issued = loadoutOf(fallback)
    const candidate = { ...loadout, legs: issued.legs, visor: issued.visor }
    if (!fits(candidate)) continue
    const refit = { ...fallback }
    for (const slot of armor) {
      const part = worn?.[slot]
      if (part && parts.includes(part)) refit[slot] = part
    }
    const gear = loadoutOf(refit)
    const withGear = { ...candidate, core: gear.core, leftArm: gear.leftArm, rightArm: gear.rightArm, legs: gear.legs, visor: gear.visor, coat: gear.coat }
    return fits(withGear) ? { ...fit, rig: refit, loadout: withGear } : { ...fit, rig: fallback, loadout: candidate }
  }
  throw new Error('The issued role kit exceeds this slot’s Capacity.')
}

export function campaignSquadInput(input: BattleInput, save: Save, options: {
  bandsOf?: CampaignBands; alternate?: Readonly<Record<number, boolean>>; useFitted?: boolean; expansion?: string
} = {}): BattleInput {
  const lead = input.units.find(unit => unit.side === 'squad')
  const units = input.units.map(unit => {
    if (unit.side !== 'squad' || unit.ref?.kind !== 'uma') return unit
    const outfit = Number(unit.ref.id)
    const bands = personalBands(unit.bands, options.bandsOf?.(outfit))
    const member = save.crew.find(row => row.outfit === outfit && !row.heroine)
    const prior = save.combatTraining?.[outfit]
    const progress = prior ? trainingOf(save, outfit) : { rank: 1, subclass: 'heal' as const }
    const objectiveDeck = input.objective.kind === 'hack' || input.objective.kind === 'freeLeader' && !input.objective.collar
    const back = unit.id === lead?.id ? options.expansion ?? (objectiveDeck ? 'back-deck' : undefined) : undefined
    const requiredWeapon = unit.signature && (unit.signature.mount === 'left' || unit.signature.mount === 'back')
    if (requiredWeapon) return unit
    const fit = fitCampaignChassis(laserFitting(progress, options.alternate?.[outfit], back), bands,
      options.useFitted ? member?.rig : undefined, save.campaignGear.parts)
    const terminalOnly = back === 'back-deck' && progress.subclass !== 'support' && input.objective.kind === 'hack'
    return { ...unit, bands, specialty: fit.specialty, loadout: fit.loadout, frozenRig: fit.rig, ...(terminalOnly ? { terminalOnly: true as const } : {}) }
  })
  const battle = { ...input, rulesVersion: Math.max(input.rulesVersion, 6), units }
  createBattle(battle)
  return battle
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
  const attempt = ground && 'id' in ground && typeof ground.id === 'string' && ground.id.startsWith('salvage-') ? ground.id : scenario
  const input = missionInput(scenario, squad, [], attempt)
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
  const complete = mission.battle?.input as BattleInput | undefined
  const trained = !save.campaignCurve && complete?.rulesVersion === 5 && !save.worlds.missions.includes(mission.id)
    ? advanceCombatTraining(save, complete.units) : save
  return finishMission({ ...trained, worlds: { ...save.worlds, missions: [...new Set([...save.worlds.missions, mission.id])] } })
}
