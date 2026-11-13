// The golden battles for rules version 2 (CY5): each is aimed at one rule the packet names, with a short plan that makes
// the key move, and the greedy player for the rest. Each lists the cue that proves its rule; the golden test checks it.
import { RIG, RIG2, unit, W, battle } from '../fixtures'
import { legalTurns } from '../legal'
import type { Act, BattleAction, BattleInput, BattleMap, BattleState, Cue, Prop, TurnAction } from '../types'

const b = (speed: 1 | 2 | 3 | 4 | 5, extra: Partial<Record<'stamina' | 'power' | 'guts' | 'wit', 1 | 2 | 3 | 4 | 5>> = {}) =>
  ({ speed, stamina: 3, power: 3, guts: 3, wit: 3, ...extra } as const)

const PROPS: Prop[] = [
  { kind: 'barrel', id: 'b1', tile: [4, 3] },
  { kind: 'barrel', id: 'b2', tile: [5, 3] },
  { kind: 'pipe', id: 'p1', tile: [1, 6] },
  { kind: 'cable', id: 'c1', tile: [0, 7] },
  { kind: 'lift', id: 'l1', tiles: [[7, 4], [8, 4]], low: 0, high: 2, raised: false },
  { kind: 'terminal', id: 't-lift', tile: [2, 3], does: { lift: 'l1' } },
]

/** A 10 × 10 works floor: an Oil-barrel pair by the enemy line, a pipe and a cable by a grating run, a lift up to a
 * platform, and two cover tiles. */
export const WORKS: BattleMap = {
  schemaVersion: 1, id: 'test-works', width: 10, depth: 10,
  heights: ['0000000000', '0000000000', '0000000222', '0000000222', '0000000000', '0000000000', '0000000000', '0000000000', '0000000000', '0000000000'],
  tiles: ['..........', '..........', '..........', '..........', '..........', '..====....', '...c..c...', '..........', '..........', '..........'],
  spawns: { squad: [[1, 8], [2, 8], [3, 9], [1, 9], [2, 9]], enemy: [[4, 1], [5, 1], [6, 1], [3, 1], [8, 2], [4, 0], [5, 0], [6, 0]] },
  props: PROPS,
}

export interface Golden2 {
  input: BattleInput
  /** The key moves: an action, or null for the greedy player's. */
  plan?: (state: BattleState) => BattleAction | null
  /** The cue that proves the rule. */
  proves: (cue: Cue) => boolean
  /** A cue that must never show. */
  never?: (cue: Cue) => boolean
}

/** The first legal turn of the active unit whose act matches, from any tile. */
function find(state: BattleState, unit: string, match: (act: Act) => boolean, face: TurnAction['face'] = 'N'): TurnAction | null {
  if (state.active !== unit) return null
  const t = legalTurns(state).find((l) => match(l.act))
  return t ? { kind: 'turn', unit, to: t.to, ...(t.dash ? { dash: true } : {}), act: t.act, face } : null
}

const v2 = (units: Parameters<typeof battle>[0], opts: Parameters<typeof battle>[1] = {}) => battle(units, { map: WORKS, version: 2, ...opts })
const done = new Set<string>()
const once = (key: string, action: BattleAction | null): BattleAction | null => {
  if (!action || done.has(key)) return null
  done.add(key)
  return action
}

export const GOLDEN2: Record<string, Golden2> = {
  // A flamer bursts a barrel: Oil, then Fire across the whole slick, burning the enemy line.
  'works-oil-fire': {
    input: v2([
      unit('flamer', 'squad', 0, { bands: b(5), loadout: { ...RIG2.flamer(), rightHand: { ...(RIG2.flamer().rightHand as typeof W.rifle), range: [1, 3] } } }),
      unit('striker', 'squad', 1, { bands: b(4) }),
      unit('e-1', 'enemy', 0, { bands: b(2), loadout: RIG.brawler() }),
      unit('e-2', 'enemy', 1, { bands: b(2), loadout: RIG.brawler() }),
    ], { seed: 'oil' }),
    plan: (s) => once('oil', find(s, 'flamer', (a) => a.kind === 'attack' && a.target === 'b1')),
    proves: (c) => c.kind === 'terrain' && c.state === 'fire' && c.tiles.length >= 3,
  },
  // A pipe bursts beside a live cable: current runs across the Wet tiles and the grating.
  'works-current': {
    input: v2([
      unit('gunner', 'squad', 0, { bands: b(5), loadout: { ...RIG.gunner(), rightHand: { ...W.rifle, accuracy: 120 } } }),
      unit('vanguard', 'squad', 1, { bands: b(2), loadout: RIG.vanguard() }),
      unit('e-1', 'enemy', 0, { bands: b(3), loadout: RIG.brawler() }),
      unit('e-2', 'enemy', 3, { bands: b(3), loadout: RIG.brawler() }),
    ], { seed: 'current' }),
    plan: (s) => once('pipe', find(s, 'gunner', (a) => a.kind === 'attack' && a.target === 'p1')),
    proves: (c) => c.kind === 'burn' && c.by === 'live',
  },
  // A Netrunner raises the lift mid-battle: the board's heights change.
  'works-lift': {
    input: v2([
      unit('netrunner', 'squad', 1, { bands: b(5), loadout: RIG2.netrunner() }),
      unit('striker', 'squad', 0, { bands: b(4) }),
      unit('e-1', 'enemy', 4, { bands: b(3), loadout: RIG.trooper() }),
      unit('e-2', 'enemy', 0, { bands: b(2), loadout: RIG.brawler() }),
    ], { seed: 'lift' }),
    plan: (s) => once('lift', find(s, 'netrunner', (a) => a.kind === 'hack' && a.terminal === 't-lift')),
    proves: (c) => c.kind === 'heights' && c.height === 2,
  },
  // A Gunner aims at a heroine's Anchor until it breaks: she's freed, not broken.
  'works-anchor': {
    input: v2([
      unit('gunner', 'squad', 0, { bands: b(4, { wit: 5 }), loadout: { ...RIG.gunner(), rightHand: { ...W.rifle, type: 'I' } } }),
      unit('vanguard', 'squad', 1, { bands: b(2), loadout: RIG.vanguard() }),
      unit('heroine', 'enemy', 0, { bands: b(2, { stamina: 5 }), hold: 'anchor', holdHp: 24, loadout: RIG.brawler() }),
      unit('e-1', 'enemy', 1, { bands: b(2), loadout: RIG.brawler() }),
    ], { seed: 'anchor' }),
    plan: (s) => find(s, 'gunner', (a) => a.kind === 'attack' && a.target === 'heroine' && a.with === 'right' && a.aim === undefined)
      ? (() => { const t = find(s, 'gunner', (a) => a.kind === 'attack' && a.target === 'heroine' && a.with === 'right')!; return { ...t, act: { ...t.act, aim: 'hold' } as Act } })()
      : null,
    proves: (c) => c.kind === 'freed' && c.by === 'hold',
  },
  // A Netrunner Jacks Out a worn-down heroine.
  'works-jackout': {
    input: v2([
      unit('netrunner', 'squad', 0, { bands: b(4, { wit: 5 }), chargeCap: 4, loadout: RIG2.netrunner() }),
      unit('gunner', 'squad', 1, { bands: b(3), loadout: { ...RIG.gunner(), back: { kind: 'none', load: 0 }, rightHand: { ...W.rifle, power: 3 } } }),
      unit('heroine', 'enemy', 0, { bands: b(1, { stamina: 1, guts: 1 }), hold: 'collar', loadout: { ...RIG.trooper(), rightHand: { ...W.rifle, power: 2 } } }),
    ], { seed: 'jackout' }),
    plan: (s) => {
      const jack = find(s, 'netrunner', (a) => a.kind === 'tech' && a.tech === 'jackout')
      if (jack) return jack
      if (s.active === 'netrunner') {
        const near = legalTurns(s).find((l) => l.act.kind === 'wait' && Math.abs(l.to[0] - s.units.find((u) => u.id === 'heroine')!.x) + Math.abs(l.to[1] - s.units.find((u) => u.id === 'heroine')!.y) === 1)
        if (near) return { kind: 'turn', unit: 'netrunner', to: near.to, act: { kind: 'wait' }, face: 'N' }
      }
      return null
    },
    proves: (c) => c.kind === 'freed' && c.by === 'jackout',
  },
  // A Medic reboots a kneeling ally inside her window.
  'works-reboot-in': {
    input: v2([
      unit('medic', 'squad', 0, { bands: b(5), chargeCap: 4, loadout: RIG2.medic() }),
      unit('striker', 'squad', 1, { bands: b(1, { stamina: 1 }) }),
      unit('e-1', 'enemy', 0, { bands: b(4, { power: 5 }), loadout: { ...RIG.brawler(), rightHand: { ...W.knuckles, power: 30 } } }),
    ], { seed: 'reboot-in' }),
    plan: (s) => find(s, 'medic', (a) => a.kind === 'reboot') ?? (s.active === 'medic' ? find(s, 'medic', (a) => a.kind === 'wait') : null),
    proves: (c) => c.kind === 'rebooted',
  },
  // No Medic reaches her: the kneeling striker extracts when her next turn comes.
  'works-reboot-out': {
    input: v2([
      unit('striker', 'squad', 1, { bands: b(5, { stamina: 1 }) }),
      unit('vanguard', 'squad', 4, { bands: b(1, { stamina: 5 }), loadout: RIG.vanguard() }),
      unit('e-1', 'enemy', 0, { bands: b(4, { power: 5 }), loadout: { ...RIG.brawler(), rightHand: { ...W.knuckles, power: 40 } } }),
      unit('e-2', 'enemy', 1, { bands: b(3, { stamina: 5 }), loadout: RIG.brawler() }),
    ], { seed: 'reboot-out' }),
    proves: (c) => c.kind === 'extracted' && c.unit === 'striker',
  },
  // The Steel Muster's volley, signalled; the squad leaves the marks and it hits no one.
  'works-volley-dodged': {
    input: v2([
      unit('vanguard', 'squad', 0, { bands: b(3, { stamina: 5 }), loadout: RIG.vanguard() }),
      unit('gunner', 'squad', 1, { bands: b(3, { stamina: 5 }), loadout: RIG.gunner() }),
      ...[0, 1, 2, 3].map((i) => unit(`m-${i + 1}`, 'enemy', i, { bands: b(4), faction: 'steel-muster', loadout: RIG.trooper() })),
    ], { seed: 'volley-dodged', factions: ['steel-muster'] }),
    plan: (s) => {
      const v = s.field?.volley
      if (!v?.at || !s.active || s.units.find((u) => u.id === s.active)!.side !== 'squad') return null
      const marked = (t: readonly [number, number]) => v.marked.some((m) => m[0] === t[0] && m[1] === t[1])
      const step = legalTurns(s).find((l) => l.act.kind === 'wait' && !marked(l.to))
      return step ? { kind: 'turn', unit: s.active, to: step.to, act: step.act, face: 'N' } : null
    },
    proves: (c) => c.kind === 'volley',
    never: (c) => c.kind === 'burn' && c.by === 'volley',
  },
  // The same, but the squad holds its ground: the volley lands.
  'works-volley-lands': {
    input: v2([
      unit('vanguard', 'squad', 0, { bands: b(3, { stamina: 5 }), loadout: RIG.vanguard() }),
      unit('gunner', 'squad', 1, { bands: b(3, { stamina: 5 }), loadout: RIG.gunner() }),
      ...[0, 1, 2, 3].map((i) => unit(`m-${i + 1}`, 'enemy', i, { bands: b(4), faction: 'steel-muster', loadout: RIG.trooper() })),
    ], { seed: 'volley-lands', factions: ['steel-muster'] }),
    plan: (s) => {
      const v = s.field?.volley
      if (!v?.at || !s.active || s.units.find((u) => u.id === s.active)!.side !== 'squad') return null
      return { kind: 'turn', unit: s.active, act: { kind: 'wait' }, face: 'N' }
    },
    proves: (c) => c.kind === 'burn' && c.by === 'volley',
  },
}

/** Clears the plans' memory before a recording. */
export function resetPlans(): void {
  done.clear()
}
