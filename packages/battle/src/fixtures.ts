// Stand-in maps, weapons and rigs for the tests and the golden replays (CY4). Generic and nameless, so they belong in git.
import type { Bands, BattleInput, BattleMap, Dir, Loadout, Objective, Shield, Side, UnitInput, Weapon } from './types'

export const W = {
  blade: { kind: 'weapon', band: 'melee', type: 'P', power: 12, accuracy: 85, range: [1, 1], hits: 1, load: 2 },
  knuckles: { kind: 'weapon', band: 'melee', type: 'I', power: 10, accuracy: 90, range: [1, 1], hits: 1, load: 2 },
  rifle: { kind: 'weapon', band: 'short', type: 'P', power: 6, accuracy: 75, range: [1, 3], hits: 3, load: 3 },
  scattergun: { kind: 'weapon', band: 'short', type: 'I', power: 5, accuracy: 70, range: [1, 2], hits: 4, load: 3 },
  greatblade: { kind: 'weapon', band: 'melee', type: 'P', power: 18, accuracy: 80, range: [1, 1], hits: 1, twoHanded: true, load: 4 },
  missiles: { kind: 'weapon', band: 'long', type: 'F', power: 18, accuracy: 70, range: [3, 6], hits: 1, load: 0 },
} as const satisfies Record<string, Weapon>

export const S = {
  tower: { kind: 'shield', guard: 40, load: 3 },
  buckler: { kind: 'shield', guard: 20, load: 1 },
} as const satisfies Record<string, Shield>

const base = (): Loadout => ({
  core: { load: 3 }, leftArm: { load: 2 }, rightArm: { load: 2 }, legs: { load: 2 },
  back: { kind: 'none', load: 0 }, visor: { load: 1 }, leftHand: null, rightHand: null, coat: null,
})

/** Five stand-in rigs, one per role, all inside Capacity at Power band 3. */
export const RIG = {
  striker: (): Loadout => ({ ...base(), core: { load: 2 }, back: { kind: 'thruster', load: 2 }, rightHand: W.blade, coat: 'P' }),
  vanguard: (): Loadout => ({
    ...base(), core: { load: 5, capacity: 4 }, legs: { load: 4 }, back: { kind: 'bulwark', load: 3, capacity: 4 },
    leftHand: S.tower, rightHand: W.scattergun, coat: 'P',
  }),
  gunner: (): Loadout => ({
    ...base(), back: { kind: 'launcher', load: 3, weapon: W.missiles, ammo: 3 }, visor: { load: 1, aim: true }, rightHand: W.rifle, coat: 'F',
  }),
  trooper: (): Loadout => ({ ...base(), leftHand: S.buckler, rightHand: W.rifle, coat: 'I' }),
  brawler: (): Loadout => ({ ...base(), rightHand: W.knuckles, leftHand: W.blade }),
}

export const BANDS: Bands = { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 }

export function unit(id: string, side: Side, spawn: number, opts: Partial<Omit<UnitInput, 'id' | 'side' | 'spawn'>> = {}): UnitInput {
  return {
    id, side, spawn, bands: { ...BANDS, ...opts.bands }, chargeCap: opts.chargeCap ?? 3, link: opts.link ?? true, facing: opts.facing ?? (side === 'squad' ? 'N' : 'S'),
    loadout: opts.loadout ?? RIG.striker(), ...(opts.leader ? { leader: true } : {}),
  }
}

const flat = (w: number, d: number, c: string) => Array.from({ length: d }, () => c.repeat(w))

/** A flat 10 × 10 yard with a raised block, a high block and a wall. */
export const YARD: BattleMap = {
  schemaVersion: 1, id: 'test-yard', width: 10, depth: 10,
  heights: ['0000000000', '0000000000', '0001100000', '0001100000', '0000000000', '0000000000', '0000022000', '0000022000', '0000000000', '0000000000'],
  tiles: ['..........', '..........', '..........', '..........', '....##....', '..........', '..........', '..........', '..........', '..........'],
  spawns: { squad: [[1, 8], [2, 8], [3, 8], [1, 9], [2, 9]], enemy: [[7, 1], [8, 1], [6, 1], [7, 0], [8, 0], [5, 0], [9, 1], [6, 0]] },
}

/** A small 8 × 8 terraced map: three levels down to the south, for height and line of fire. */
export const STEPS: BattleMap = {
  schemaVersion: 1, id: 'test-steps', width: 8, depth: 8,
  heights: ['33333333', '33333333', '22222222', '22222222', '11111111', '11111111', '00000000', '00000000'],
  tiles: flat(8, 8, '.'),
  spawns: { squad: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], enemy: [[2, 0], [4, 0], [6, 0], [3, 1], [5, 1]] },
}

/** An open 8 × 8 floor for unit tests that place units by hand. */
export const OPEN: BattleMap = {
  schemaVersion: 1, id: 'test-open', width: 8, depth: 8, heights: flat(8, 8, '0'), tiles: flat(8, 8, '.'),
  spawns: { squad: [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7]], enemy: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]] },
}

export function battle(units: UnitInput[], opts: { map?: BattleMap; seed?: string; objective?: Objective } = {}): BattleInput {
  return { rulesVersion: 1, seed: opts.seed ?? 'test', map: opts.map ?? OPEN, objective: opts.objective ?? { kind: 'defeatAll' }, units }
}

/** A map with spawns placed where a test wants its units: `squad` and `enemy` tiles, the rest of the map open. */
export function placed(squad: [number, number][], enemy: [number, number][], opts: { heights?: string[]; tiles?: string[]; dir?: Dir } = {}): BattleMap {
  const pad = <T>(list: T[], fill: T[]) => [...list, ...fill.filter((f) => !list.some((l) => JSON.stringify(l) === JSON.stringify(f)))]
  const spareSquad: [number, number][] = [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7]]
  return {
    schemaVersion: 1, id: 'test-placed', width: 8, depth: 8, heights: opts.heights ?? flat(8, 8, '0'), tiles: opts.tiles ?? flat(8, 8, '.'),
    spawns: {
      squad: pad(squad, spareSquad.filter((t) => !enemy.some((e) => e[0] === t[0] && e[1] === t[1]))).slice(0, 5),
      enemy,
    },
  }
}
