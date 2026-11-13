// The golden battles (CY4): hand-built inputs on the two test maps, each aimed at a few rules. Their actions come from
// the greedy player once and are then fixed in the JSON beside this file.
import { battle, RIG, STEPS, unit, YARD } from '../fixtures'
import type { BattleInput } from '../types'

const b = (speed: 1 | 2 | 3 | 4 | 5, extra: Partial<Record<'stamina' | 'power' | 'guts' | 'wit', 1 | 2 | 3 | 4 | 5>> = {}) =>
  ({ speed, stamina: 3, power: 3, guts: 3, wit: 3, ...extra } as const)

export const GOLDEN: Record<string, BattleInput> = {
  // Melee against melee: counters both ways, parts breaking, Rig Break.
  'yard-duel': battle([
    unit('striker', 'squad', 0, { bands: b(4, { power: 4 }) }),
    unit('brawler', 'enemy', 2, { bands: b(3), loadout: RIG.brawler() }),
  ], { map: YARD, seed: 'duel' }),
  // Three against three: pincers, links, Cover from the Vanguard.
  'yard-pincer': battle([
    unit('striker-1', 'squad', 0, { bands: b(4) }),
    unit('striker-2', 'squad', 1, { bands: b(4) }),
    unit('gunner', 'squad', 2, { bands: b(3), loadout: RIG.gunner() }),
    unit('trooper', 'enemy', 0, { loadout: RIG.trooper() }),
    unit('brawler', 'enemy', 1, { loadout: RIG.brawler() }),
    unit('vanguard', 'enemy', 2, { bands: b(2), loadout: RIG.vanguard() }),
  ], { map: YARD, seed: 'pincer' }),
  // A full squad against a leader and her guard.
  'yard-leader': battle([
    unit('vanguard', 'squad', 0, { bands: b(2), loadout: RIG.vanguard() }),
    unit('striker', 'squad', 1, { bands: b(5) }),
    unit('gunner-1', 'squad', 2, { loadout: RIG.gunner() }),
    unit('gunner-2', 'squad', 3, { loadout: RIG.gunner() }),
    unit('guest', 'squad', 4, { bands: b(3, { wit: 5 }), loadout: RIG.brawler() }),
    unit('boss', 'enemy', 3, { leader: true, bands: b(3, { stamina: 5, guts: 4 }), loadout: RIG.vanguard() }),
    unit('e-1', 'enemy', 0, { loadout: RIG.trooper() }),
    unit('e-2', 'enemy', 1, { loadout: RIG.trooper() }),
    unit('e-3', 'enemy', 2, { loadout: RIG.brawler() }),
    unit('e-4', 'enemy', 4, { loadout: RIG.brawler() }),
  ], { map: YARD, seed: 'leader', objective: { kind: 'defeatLeader' } }),
  // Gunners firing up three terraces: height, line of fire, Long's range and ammo.
  'steps-long': battle([
    unit('gunner-1', 'squad', 0, { loadout: RIG.gunner() }),
    unit('gunner-2', 'squad', 2, { loadout: RIG.gunner() }),
    unit('vanguard', 'squad', 4, { bands: b(2), loadout: RIG.vanguard() }),
    unit('trooper-1', 'enemy', 0, { loadout: RIG.trooper() }),
    unit('trooper-2', 'enemy', 2, { loadout: RIG.trooper() }),
    unit('brawler', 'enemy', 3, { bands: b(4), loadout: RIG.brawler() }),
  ], { map: STEPS, seed: 'long' }),
  // A run for the top tile past a picket.
  'steps-reach': battle([
    unit('striker-1', 'squad', 1, { bands: b(5) }),
    unit('striker-2', 'squad', 3, { bands: b(4) }),
    unit('trooper', 'enemy', 1, { loadout: RIG.trooper() }),
    unit('brawler', 'enemy', 4, { loadout: RIG.brawler() }),
  ], { map: STEPS, seed: 'reach', objective: { kind: 'reach', tile: [7, 0] } }),
  // Holding the yard for six rounds against faster enemies.
  'yard-hold': battle([
    unit('vanguard-1', 'squad', 0, { bands: b(2), loadout: RIG.vanguard() }),
    unit('vanguard-2', 'squad', 1, { bands: b(2), loadout: RIG.vanguard() }),
    unit('e-1', 'enemy', 0, { bands: b(5), loadout: RIG.brawler() }),
    unit('e-2', 'enemy', 1, { bands: b(5), loadout: RIG.brawler() }),
    unit('e-3', 'enemy', 2, { bands: b(4), loadout: RIG.trooper() }),
  ], { map: YARD, seed: 'hold', objective: { kind: 'hold', rounds: 6 } }),
  // Gritty units on both sides: Hold on, then Rig Break and extraction.
  'yard-holdon': battle([
    unit('striker', 'squad', 0, { bands: b(4, { guts: 5, power: 5 }) }),
    unit('gunner', 'squad', 1, { bands: b(3, { guts: 4 }), loadout: RIG.gunner() }),
    unit('brawler-1', 'enemy', 0, { bands: b(4, { guts: 4 }), loadout: RIG.brawler() }),
    unit('brawler-2', 'enemy', 1, { bands: b(3, { guts: 5 }), loadout: RIG.brawler() }),
  ], { map: YARD, seed: 'holdon' }),
}
