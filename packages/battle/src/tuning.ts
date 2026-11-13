// Every number the battle rules use, in one table (TC4, TC17–TC21, TC23; CY4). The simulator (CY6) tunes this file and
// nothing else. Percentages are whole numbers so the damage formula stays in exact integer arithmetic.
import type { Band, PartId, WeaponBand } from './types'

export const TUNING = {
  /** A master-data stat at 5★ to its band: 70–89 is 1, 90–109 is 2, 110–129 is 3, 130–149 is 4, 150+ is 5 (TC4). Below
   * the first threshold is still band 1. */
  bandThresholds: [70, 90, 110, 130, 150] as const,

  /** The timeline (TC3): a unit's clock fills by its Speed band's rate each tick; a turn comes at `clockFull`. A round is
   * `roundTicks`, one turn at Speed band 3. */
  clockFull: 1000,
  clockRate: { 1: 8, 2: 9, 3: 10, 4: 11, 5: 12 } as Record<Band, number>,
  roundTicks: 100,
  /** Wait: her clock restarts here instead of at 0, so her next turn comes sooner. */
  waitClock: 250,
  /** The timeline shows this many turns ahead (TC29). */
  timelineLength: 8,

  /** Charge (TC20). */
  charge: { start: 1, perTurn: 1, cap: 3, counter: 1, crossfire: 1, cover: 1, wait: 1 },

  /** Part HP (TC4, TC17): base + per Stamina band, before a part's own bonus. */
  partHp: {
    core: { base: 22, perBand: 6 },
    leftArm: { base: 10, perBand: 4 },
    rightArm: { base: 10, perBand: 4 },
    legs: { base: 14, perBand: 5 },
  } as Record<PartId, { base: number; perBand: number }>,

  /** Capacity (TC18): base + per Power band, plus the Core's and the Back unit's bonus. */
  capacity: { base: 10, perBand: 2 },
  /** At this share of Capacity or less, +1 Move: a light rig is a fast rig. */
  lightRigPct: 70,

  /** Move by Speed band (TC4). Broken Legs: `brokenLegsMove`, and no level changes. */
  move: { 1: 3, 2: 3, 3: 4, 4: 4, 5: 5 } as Record<Band, number>,
  brokenLegsMove: 1,
  /** A step climbs or drops this many levels at most. */
  stepHeight: 1,

  /** Hits (TC19). Hit % = accuracy + Wit × `witAccuracy` − evasion − `aimPenalty` when aimed, clamped. */
  witAccuracy: 3,
  speedEvasion: 2,
  aimPenalty: 25,
  hitClamp: [5, 95] as const,
  /** A two-handed weapon with one arm broken fires at this share of its accuracy. */
  oneArmTwoHandedPct: 50,
  baseCrit: 5,
  critPct: 140,

  /** Where hits land, by weapon band, out of 100 (TC19). An aimed hit goes where aimed; a hit on a broken part goes to
   * the Core. */
  partWeights: {
    melee: { core: 60, leftArm: 15, rightArm: 15, legs: 10 },
    short: { core: 40, leftArm: 20, rightArm: 20, legs: 20 },
    long: { core: 50, leftArm: 15, rightArm: 15, legs: 20 },
  } as Record<Exclude<WeaponBand, 'tech'>, Record<PartId, number>>,

  /** Damage (TC19, TC23): Melee adds Power × this; facing and height multiply; a matching Coat halves. */
  meleePowerPerBand: 2,
  sidePct: 125,
  backPct: 150,
  heightPctPerLevel: 10,
  coatPct: 50,
  minDamage: 1,

  /** Reach and range (TC23): Melee and Short reach this many levels up or down; Long gains range from this high up. */
  reachLevels: 2,
  longHeightBonus: { levels: 2, range: 1 },

  /** Crossfire (TC21): how many allies join an attack at most, and how many rounds a joiner's basic attack fires. */
  crossfireMax: 2,
  crossfireRounds: 1,

  /** Rig Break (TC25): Guts at this band or more gives Hold on once a battle, surviving at `holdOnCore`. */
  holdOnBand: 4,
  holdOnCore: 1,

  /** The board (TC2, TC30). */
  map: { minSize: 6, maxSize: 14, maxHeight: 3, squad: 5, maxEnemies: 8 },

  // --- Rules version 2 (CY5) ---

  /** Terrain (TC24): damage and timers in rounds; cover and Smoke as hit % off; the lights. */
  terrain: { fireDamage: 8, liveDamage: 6, fireRounds: 3, smokeRounds: 2, smokePenalty: 30, coverEvasion: 20, lightsPenalty: 15, lightsRounds: 2 },
  /** Tech (TC19, TC26): the Deck's range, the chance (base + Wit − Guts), the Charge each costs, Jack-Out's threshold, and
   * a Stun or Jam's damage to a Hold. Hacking a terminal: range and Charge, no roll. */
  tech: {
    range: [2, 4] as const, jackOutRange: 1, base: 50, perWit: 5, perGuts: 10, clamp: [5, 95] as const,
    stun: 2, jam: 1, jackOut: 2, jackOutCorePct: 30, holdDamage: 10, hackRange: [1, 4] as const, hack: 1,
  },
  /** An impact hit on the Core can Stun (rules version 2). */
  impactStun: 10,
  /** An Anchor or a Collar's HP unless the unit says. */
  holdHp: 30,
  /** The Back units (TC5). */
  back: { barrier: 1, barrierHp: 40, dash: 1, dashMove: 2, thrusterClimb: 2, mend: 1, mendCore: 12, mendPartPct: 25, reboot: 2, rebootCorePct: 25 },
  /** Chance skills (TC22): +5% a Wit band, capped; Burst's extra rounds. */
  skills: { perWit: 5, cap: 95, burstRounds: 2 },
  /** Items: the stock's cap and what each does. */
  items: { max: 6, repairCore: 20, patchPct: 25, smokeRange: 3, cell: 1 },
  /** Stride's Move (TC46). */
  stride: { break: 1, draft: 1, surge: 1, kick: 2 },
  /** The bench support call (TC27): fixed damage and the repair drop. */
  bench: { strike: 15, mortar: 10, drop: 15 },
  /** The Steel Muster (WD11): the volley meter's size and pinning fire's hit % off. */
  muster: { volleyFull: 6, pinPenalty: 10 },
} as const

/** A master-data stat at 5★ to its band (TC4). */
export function bandOf(stat: number): Band {
  const t = TUNING.bandThresholds
  if (stat >= t[4]) return 5
  if (stat >= t[3]) return 4
  if (stat >= t[2]) return 3
  if (stat >= t[1]) return 2
  return 1
}
