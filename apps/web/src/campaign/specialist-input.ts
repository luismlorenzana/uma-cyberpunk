import { createBattle, type BattleInput, type UnitInput } from '@cyber/battle'
import { awayMembers, FORMATION_NAME, laserFitting, resting, specialistFitting, trainingOf, type GroundCombat, type Save, type StoryPack } from '@cyber/domain'
import { missionInput } from '../mission/battleInput'
import { nameOf } from '../story/runner'

export function formationReady(save: Save, combat: Extract<GroundCombat, { kind: 'combined' }>, shifted: boolean, ashore?: ReadonlySet<number>): boolean {
  if (!shifted) return false
  const away = awayMembers(save.operations, save.squads)
  return combat.members.every(({ outfit, requires }) => (!requires || save.story.flags.includes(requires)) && (outfit === undefined
    || (!ashore?.has(outfit) && !away.includes(outfit) && save.crew.some((crew) => crew.outfit === outfit && !resting(crew)))))
}

interface Deployment {
  scenario: string
  combat: GroundCombat
  save: Save
  story: StoryPack
  outfits: readonly number[]
  shifted: boolean
  alternate?: Readonly<Record<number, boolean>>
  expansion?: string
  boss?: { unit: string; name: string }
}

export function specialistInput({ scenario, combat, save, story, outfits, shifted, alternate, expansion, boss }: Deployment): BattleInput {
  const base = missionInput(scenario, [], [], scenario)
  const slots = base.units.filter(({ side }) => side === 'squad')
  const enemies = base.units.filter(({ side }) => side === 'enemy').map(({ specialty, ...unit }): UnitInput => ({
    ...unit, ...(unit.id === boss?.unit ? { label: boss.name } : {}),
    ...(combat.kind === 'combined' ? combat.windups.includes(unit.id) ? { specialty: { kind: 'windup' } } : {} : { specialty }),
  }))
  const squad: UnitInput[] = []
  if (combat.kind === 'combined') {
    if (!formationReady(save, combat, shifted) || slots.length !== 10 || base.objective.kind !== 'defeatLeader') {
      throw new Error('The combined formation is unavailable.')
    }
    if (combat.windups.some((id) => !enemies.some((unit) => unit.id === id))) throw new Error('A prepared enemy is missing from the map.')
    const assigned = new Map<string, number>()
    for (const member of combat.members) {
      const count = assigned.get(member.role) ?? 0
      assigned.set(member.role, count + 1)
      const template = slots.filter((unit) => unit.specialty?.kind === member.role)[count]
      if (!template) throw new Error(`The map needs another ${FORMATION_NAME[member.role]} slot.`)
      const fitting = member.role === 'laser' ? laserFitting(trainingOf(save, member.outfit!, true)) : specialistFitting(member.role, count)
      const ref = member.outfit === undefined ? { kind: 'heroine' as const, id: member.heroine! } : { kind: 'uma' as const, id: String(member.outfit) }
      squad.push({ ...template, ref, label: nameOf(story, member.outfit ?? member.heroine!) || FORMATION_NAME[member.role],
        loadout: fitting.loadout, frozenRig: fitting.rig, specialty: fitting.specialty })
    }
  } else {
    for (const [index, outfit] of [...new Set(outfits)].slice(0, slots.length).entries()) {
      const fitting = laserFitting(trainingOf(save, outfit, shifted), alternate?.[outfit], index === 0 ? expansion : undefined)
      squad.push({ ...slots[index]!, ref: { kind: 'uma', id: String(outfit) }, label: nameOf(story, outfit),
        loadout: fitting.loadout, frozenRig: fitting.rig, specialty: fitting.specialty })
    }
  }
  const input = { ...base, rulesVersion: 5, units: [...squad, ...enemies] }
  createBattle(input)
  return input
}
