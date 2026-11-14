// The golden battles for rules version 3 (CY17): one for each new action and perk the packet names, each with a short
// plan for the key move and the greedy player for the rest, and the cue that proves its rule.
import { applyBattleAction } from '../battle'
import { RIG, unit, W, battle } from '../fixtures'
import type { BattleAction, BattleState } from '../types'
import { WORKS, type Golden2 } from './battles2'

const b = (speed: 1 | 2 | 3 | 4 | 5, extra: Partial<Record<'stamina' | 'power' | 'guts' | 'wit', 1 | 2 | 3 | 4 | 5>> = {}) =>
  ({ speed, stamina: 3, power: 3, guts: 3, wit: 3, ...extra } as const)
const v3 = (units: Parameters<typeof battle>[0], opts: Parameters<typeof battle>[1] = {}) => battle(units, { map: WORKS, version: 3, ...opts })
const done = new Set<string>()
/** The action once, when it's legal now. */
const once = (key: string, state: BattleState, action: BattleAction | null): BattleAction | null => {
  if (!action || done.has(key) || applyBattleAction(state, action).error) return null
  done.add(key)
  return action
}
export const resetPlans3 = () => done.clear()
const enemyNear = (s: BattleState) => s.units.find((u) => u.side === 'enemy' && u.status === 'active')

export const GOLDEN3: Record<string, Golden2> = {
  // The captain's Sure shot on a poor rifle: that attack lands every round.
  'v3-sure-shot': {
    input: { ...v3([
      unit('gunner', 'squad', 0, { bands: b(4), loadout: { ...RIG.gunner(), rightHand: { ...W.rifle, accuracy: 30 } } }),
      unit('striker', 'squad', 1, { bands: b(3) }),
      unit('e-1', 'enemy', 0, { bands: b(2), loadout: RIG.brawler() }),
      unit('e-2', 'enemy', 1, { bands: b(2), loadout: RIG.brawler() }),
    ], { seed: 'sure' }), orders: { slots: 2, kinds: ['sure'] } },
    plan: (s) => (s.active === 'gunner' ? once('sure', s, { kind: 'order', unit: 'gunner', order: 'sure' }) : null),
    proves: (c) => c.kind === 'order' && c.order === 'sure',
  },
  // The Battery's orbital strike, marked on the enemy line, lands next round.
  'v3-orbital-strike': {
    input: { ...v3([
      unit('striker', 'squad', 0, { bands: b(4) }),
      unit('vanguard', 'squad', 1, { bands: b(3), loadout: RIG.vanguard() }),
      unit('e-1', 'enemy', 0, { bands: b(2), loadout: RIG.brawler() }),
      unit('e-2', 'enemy', 1, { bands: b(2), loadout: RIG.brawler() }),
    ], { seed: 'strike' }), orders: { slots: 2, kinds: ['strike'] }, systems: [{ id: 'battery', level: 2, band: 4 }, 'engines'] },
    plan: (s) => { const e = enemyNear(s); return s.units.find((u) => u.id === s.active)?.side === 'squad' && e ? once('strike', s, { kind: 'order', unit: s.active!, order: 'strike', at: [e.x, e.y] }) : null },
    proves: (c) => c.kind === 'burn' && c.by === 'strike',
  },
  // Calling a rank-10 Uma's name: Resonance, her Linked allies all join her attack.
  'v3-resonance': {
    input: { ...v3([
      unit('lead', 'squad', 0, { bands: b(4), bond: { rank: 10, path: 'heart' }, chargeCap: 4 }),
      unit('gunner', 'squad', 1, { bands: b(3), loadout: RIG.gunner() }),
      unit('e-1', 'enemy', 0, { bands: b(2), loadout: RIG.brawler() }),
      unit('e-2', 'enemy', 1, { bands: b(2), loadout: RIG.brawler() }),
    ], { seed: 'resonance' }), orders: { slots: 2, kinds: ['resonance'] } },
    plan: (s) => (s.active === 'gunner' ? once('resonance', s, { kind: 'order', unit: 'gunner', order: 'resonance', target: 'lead' }) : null),
    proves: (c) => c.kind === 'resonance' && c.path === 'heart',
  },
  // Partners at level 3 use their duo technique; at level 1 and 2 they join and cover for free.
  'v3-duo': {
    input: { ...v3([
      unit('a', 'squad', 0, { bands: b(4), loadout: { ...RIG.striker(), rightHand: W.rifle }, partner: { unit: 'b', level: 3 } }),
      unit('b', 'squad', 1, { bands: b(4), loadout: { ...RIG.striker(), rightHand: W.rifle } }),
      unit('e-1', 'enemy', 0, { bands: b(2), loadout: RIG.brawler() }),
      unit('e-2', 'enemy', 1, { bands: b(2), loadout: RIG.brawler() }),
    ], { seed: 'duo' }) },
    plan: (s) => { const e = enemyNear(s); return s.active === 'a' && e ? once('duo', s, { kind: 'duo', unit: 'a', target: e.id }) : null },
    proves: (c) => c.kind === 'duo',
  },
}
