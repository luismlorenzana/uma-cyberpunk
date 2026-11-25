
import type { BattleInput } from '@cyber/battle'
import { crewSpeaker, levelOf, type Save, type Speaker } from '@cyber/domain'

export const veteranCoreHp = (xp: number) => Math.min(3, Math.floor(levelOf(xp) / 5))

/** A new deployment freezes veteran reinforcement. Retrying or replaying a recorded battle keeps its original input. */
export function campaignBattleProgression(input: BattleInput, save: Pick<Save, 'crew'>): BattleInput {
  const bonuses = new Map(save.crew.map(member => [String(crewSpeaker(member)), veteranCoreHp(member.xp)]))
  return { ...input, units: input.units.map(unit => {
    const hp = unit.side === 'squad' && unit.ref ? bonuses.get(unit.ref.id) ?? 0 : 0
    if (!hp) return unit
    const core = unit.loadout.core
    return { ...unit, loadout: { ...unit.loadout, core: { ...core, hp: (core.hp ?? 0) + hp } } }
  }) }
}

export const CAMPAIGN_CLEAR_XP = 50

/** Settlements call this once, after recording a first clear. The battle supplies the participating identities. */
export function creditCampaignClear(save: Save, actors: readonly Speaker[]): Save {
  const present = new Set(actors.map(String))
  if (!save.crew.some(member => present.has(String(crewSpeaker(member))))) return save
  return { ...save, crew: save.crew.map(member => present.has(String(crewSpeaker(member)))
    ? { ...member, xp: member.xp + CAMPAIGN_CLEAR_XP } : member) }
}
