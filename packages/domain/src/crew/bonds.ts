// Bonds (CY13, TC56): the captain and each Uma, rank 1 to 10, raised by rapport. Upper ranks wait on keys the story names
// (`casting.json`'s `bondGates`), and rapport keeps filling past a closed gate, so the rank lands the moment it opens.
// Nothing decays and nothing is missable: a ready bond scene waits until the player opens it. At rank 8 she says what
// she hopes for and the player picks Trust or Heart, equal in power (TC58 plays the perks in battle, CY17).
export type BondPath = 'trust' | 'heart'
export const BOND_PATHS: readonly BondPath[] = ['trust', 'heart']

export interface Bond {
  rank: number
  /** Toward the next rank; may pass it while that rank's gate is closed. */
  rapport: number
  path: BondPath | null
  /** The bond scenes she's played, by rank. */
  seen: number[]
}

export const BOND_MAX = 10
/** Every bond number in one table (D22); tuned with the rest of life aboard. */
export const BOND_TUNING = {
  /** Rapport to reach each rank from the one below. */
  toRank: { 2: 100, 3: 150, 4: 200, 5: 250, 6: 300, 7: 350, 8: 400, 9: 450, 10: 500 } as Record<number, number>,
  /** A battle she fought in, covering an ally, joining a Crossfire (each once a battle), a reply to her message. */
  battle: 20, cover: 10, crossfire: 10, reply: 15,
  /** Below the crew's median rank, rapport counts this many times over. */
  catchUp: 2,
  /** Ranks that can wait on a story key. */
  gated: [4, 6, 8, 10] as const,
  /** Ranks with a bond scene. */
  sceneRanks: [2, 4, 6, 8, 10] as const,
  /** The rank where she speaks first and the player picks Trust or Heart. */
  pathRank: 8,
} as const

export const newBond = (): Bond => ({ rank: 1, rapport: 0, path: null, seen: [] })

/** Rapport added, and every rank it reaches landed while each next rank's gate is open (`gateOpen(rank)`). */
export function addRapport(bond: Bond, amount: number, gateOpen: (rank: number) => boolean): Bond {
  let { rank, rapport } = bond
  rapport += Math.max(0, Math.round(amount))
  while (rank < BOND_MAX) {
    const need = BOND_TUNING.toRank[rank + 1]!
    if (rapport < need || !gateOpen(rank + 1)) break
    rapport -= need
    rank++
  }
  if (rank === BOND_MAX) rapport = 0
  return { ...bond, rank, rapport }
}

/** Ranks whose gates have opened since, landed (no new rapport). */
export const settleBond = (bond: Bond, gateOpen: (rank: number) => boolean): Bond => addRapport(bond, 0, gateOpen)

/** The rapport toward the next rank, as a share 0–1 (1 at rank 10, or waiting at a closed gate). */
export function bondProgress(bond: Bond): number {
  if (bond.rank >= BOND_MAX) return 1
  return Math.min(1, bond.rapport / BOND_TUNING.toRank[bond.rank + 1]!)
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** The catch-up (TC56): an Uma below the crew's median rank earns double, so a late recruit is never a chore. */
export const catchUpFactor = (rank: number, crewRanks: readonly number[]): number => (rank < median(crewRanks) ? BOND_TUNING.catchUp : 1)

/** The bond scene ready to play: the lowest written rank she has reached and not seen, or null. */
export function readyScene(bond: Bond, written: readonly number[]): number | null {
  return [...written].sort((a, b) => a - b).find((r) => r <= bond.rank && !bond.seen.includes(r)) ?? null
}

export const seeBondScene = (bond: Bond, rank: number): Bond => (bond.seen.includes(rank) ? bond : { ...bond, seen: [...bond.seen, rank].sort((a, b) => a - b) })
export const choosePath = (bond: Bond, path: BondPath): Bond => ({ ...bond, path })

/** The perks a bond rank brings in battle (TC58; played by rules version 3, CY17), for her profile. */
export const BOND_PERKS: readonly { rank: number; id: string; name: string; does: string }[] = [
  { rank: 3, id: 'ready', name: 'Ready', does: 'Starts each battle with +1 Charge' },
  { rank: 5, id: 'answer', name: 'Answer', does: 'Gains 1 Charge when an ally next to her suffers a Rig Break' },
  { rank: 7, id: 'sure', name: 'Sure', does: 'Her chance skills +5%' },
  { rank: 8, id: 'endure', name: 'Endure', does: 'Once a battle, a hit that would break her Core leaves it at 1' },
  { rank: 9, id: 'steadfast', name: 'Steadfast', does: 'One free Cover a battle' },
  { rank: 10, id: 'resonance', name: 'Resonance', does: 'The captain can call her name: she acts at once with full Charge, and her Linked allies join her attack' },
]
export const RESONANCE_NAME: Record<BondPath, string> = { trust: 'Resolve', heart: 'Devotion' }
