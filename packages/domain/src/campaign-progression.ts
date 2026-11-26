import { levelOf } from './crew/crew'

export const CAMPAIGN_LEVEL_CAP = 50
const thresholds = [0]
for (let index = 1; index < CAMPAIGN_LEVEL_CAP; index++) {
  thresholds.push(thresholds[index - 1]! + 100 + 25 * Math.floor((index - 1) / 5))
}
export const CAMPAIGN_XP_THRESHOLDS: readonly number[] = thresholds

export const CAMPAIGN_ACT_XP = { 1: 75, 2: 60, 3: 85, 4: 100 } as const
export type CombatAct = keyof typeof CAMPAIGN_ACT_XP

export function campaignLevel(xp: number, curve?: 1): number {
  if (curve !== 1) return levelOf(xp)
  const next = CAMPAIGN_XP_THRESHOLDS.findIndex(value => xp < value)
  return next === -1 ? CAMPAIGN_LEVEL_CAP : Math.max(1, next)
}

export function migrateCampaignXp(xp: number): number {
  const old = levelOf(xp)
  const base = CAMPAIGN_XP_THRESHOLDS[old - 1]!
  const next = CAMPAIGN_XP_THRESHOLDS[old]
  return next === undefined ? base : base + Math.floor((xp % 100) * (next - base) / 100)
}

const armorMilestones = [
  [1, 0, 0, 0], [5, 1, 0, 0], [8, 1, 1, 0], [10, 2, 1, 0], [12, 2, 1, 1],
  [15, 3, 1, 1], [18, 3, 2, 1], [20, 4, 2, 1], [24, 4, 2, 2], [30, 5, 2, 2],
] as const

export const CAMPAIGN_ARMOR_LEVELS = armorMilestones.map(([level]) => level)

export function campaignArmor(level: number) {
  const next = armorMilestones.findIndex(([threshold]) => threshold > level)
  const [, core, arms, legs] = (next < 0 ? armorMilestones.at(-1) : armorMilestones[next - 1]) ?? armorMilestones[0]
  return { core, arms, legs, next: armorMilestones[next]?.[0] }
}
