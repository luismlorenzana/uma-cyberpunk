import { MOUNTS, type BattleInput, type Mount, type Signature, type TalkContact } from '@cyber/battle'
import { formGroundBattle, type GroundFormation } from './ground-formation'
import type { Rig } from '../crew/parts'
import type { P } from './parse'

export interface GroundRules {
  rescue?: { unit: string; heroine: string; label: string; spriteForm?: string; jackOutFlag?: string; entry?: { flag: string; spawn: number } }
  talk?: readonly TalkContact[]
  formation?: GroundFormation
  signatures?: { unit: string; action: Signature }[]
}

export function parseGroundSignatures(p: P, raw: unknown, field: string): NonNullable<GroundRules['signatures']> {
  const units = new Set<string>()
  return p.list(raw, field, (value, path) => {
    const row = p.object(value, path, ['unit', 'id', 'label', 'mount', 'charge', 'power'])
    const unit = p.slug(row.unit, path + '.unit'), mount = row.mount as Mount
    if (units.has(unit) || !MOUNTS.includes(mount)) p.fail(path, 'expected a unique unit and a weapon mount')
    units.add(unit)
    return { unit, action: { id: p.slug(row.id, path + '.id'), label: p.text(row.label, path + '.label', 64), mount,
      charge: p.int(row.charge, path + '.charge', 1, 3), power: p.int(row.power, path + '.power', 1, 12) } }
  }, 16)
}

/** Apply the authored policy to a copy of the scenario input. Old campaign routes keep their frozen rules. */
export function applyGroundRules(input: BattleInput, rules: GroundRules, flags?: readonly string[], allyRig?: Rig): BattleInput {
  if (!rules.rescue && !rules.talk?.length && !rules.formation && !rules.signatures?.length) return input
  const battle = rules.formation ? formGroundBattle(input, rules.formation, flags, allyRig) : input
  const rescue = rules.rescue
  if (rescue && !battle.units.some((unit) => unit.side === 'enemy' && unit.leader && unit.id === rescue.unit)) {
    throw new Error(`Missing the enemy leader ${rescue.unit} for rescue`)
  }
  const entry = rescue?.entry
  const useEntry = entry && flags?.includes(entry.flag)
  if (entry && (battle.units.filter(unit => unit.side === 'squad').length !== 1 || !battle.map.spawns.squad[entry.spawn])) {
    throw new Error('A rescue entry needs a solo lead and a valid squad spawn')
  }
  const units = battle.units.map(unit => {
    const signature = rules.signatures?.find(row => row.unit === unit.id)?.action
    const named = rescue && unit.id === rescue.unit
      ? { ...unit, hold: 'collar' as const, ref: { kind: 'heroine' as const, id: rescue.heroine }, label: rescue.label,
        sprite: { role: 'boss-enemy' as const, form: rescue.spriteForm ?? 'standard', fitting: unit.id } }
      : useEntry && unit.side === 'squad' ? { ...unit, spawn: entry.spawn } : unit
    return signature ? { ...named, signature: { ...signature } } : named
  })
  for (const { unit } of rules.signatures ?? []) {
    if (!units.some(candidate => candidate.id === unit)) throw new Error(`Missing signature unit ${unit}`)
  }
  return {
    ...battle, units, rulesVersion: Math.max(battle.rulesVersion, rules.signatures?.length ? 6 : 5),
    ...(rescue ? { objective: { kind: 'freeLeader', collar: 'rigBreak' } } : {}),
    ...(rules.talk?.length ? { talk: rules.talk.map((contact) => ({ ...contact })) } : {}),
  }
}
