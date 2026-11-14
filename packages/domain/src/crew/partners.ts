// Partners (CY17, TC58): two Umas whose camaraderie (from battles fought together and posts held together) reaches 100
// can be made partners, one partner each; the pair levels up at 250 and, with the Tactics project, 500. In battle a level-1
// pair joins each other's attacks free once, level 2 covers free once, level 3 has a duo technique (rules version 3).
import { pairKey } from '../ship/duties'

export interface Partnership { a: number; b: number; level: 1 | 2 | 3 }

/** Every partner number in one table (D28). */
export const PARTNER_TUNING = {
  /** Camaraderie for levels 1, 2 and 3. */
  at: [100, 250, 500] as const,
  /** A battle the two fought in together, and one where one covered or rebooted the other. */
  battle: 10, assist: 20,
  /** Level 3 also needs this Lab project (Coordinated Fire). */
  level3: 'tactics-1',
} as const

/** The level a pair's camaraderie reaches: 0 under 100; 3 only with the project done. */
export function partnerLevelFor(camaraderie: number, researched: boolean): 0 | 1 | 2 | 3 {
  const [one, two, three] = PARTNER_TUNING.at
  if (camaraderie >= three && researched) return 3
  if (camaraderie >= two) return 2
  return camaraderie >= one ? 1 : 0
}

export const partnershipOf = (partners: readonly Partnership[], outfit: number): Partnership | null => partners.find((p) => p.a === outfit || p.b === outfit) ?? null
export const partnerOfOutfit = (partners: readonly Partnership[], outfit: number): number | null => { const p = partnershipOf(partners, outfit); return p ? (p.a === outfit ? p.b : p.a) : null }

/** Why two Umas can't be made partners, or null. */
export function partnerProblem(partners: readonly Partnership[], camaraderie: Readonly<Record<string, number>>, a: number, b: number): string | null {
  if (a === b) return 'Two different Umas'
  if (partnershipOf(partners, a) || partnershipOf(partners, b)) return 'One partner each'
  if ((camaraderie[pairKey(a, b)] ?? 0) < PARTNER_TUNING.at[0]) return `Camaraderie ${camaraderie[pairKey(a, b)] ?? 0} of ${PARTNER_TUNING.at[0]}`
  return null
}

export function makePartners(partners: readonly Partnership[], camaraderie: Readonly<Record<string, number>>, a: number, b: number, researched: boolean): Partnership[] {
  if (partnerProblem(partners, camaraderie, a, b)) return [...partners]
  const [x, y] = a < b ? [a, b] : [b, a]
  return [...partners, { a: x, b: y, level: Math.max(1, partnerLevelFor(camaraderie[pairKey(x, y)] ?? 0, researched)) as 1 | 2 | 3 }]
}
export const unmakePartners = (partners: readonly Partnership[], outfit: number): Partnership[] => partners.filter((p) => p.a !== outfit && p.b !== outfit)

/** Every pair's level brought up to its camaraderie (never down). */
export function settlePartners(partners: readonly Partnership[], camaraderie: Readonly<Record<string, number>>, researched: boolean): Partnership[] {
  return partners.map((p) => ({ ...p, level: Math.max(p.level, partnerLevelFor(camaraderie[pairKey(p.a, p.b)] ?? 0, researched)) as 1 | 2 | 3 }))
}

/** Camaraderie added, by pair. */
export function addCamaraderie(camaraderie: Readonly<Record<string, number>>, gains: ReadonlyMap<string, number>): Record<string, number> {
  const out = { ...camaraderie }
  for (const [k, v] of gains) out[k] = (out[k] ?? 0) + v
  return out
}
