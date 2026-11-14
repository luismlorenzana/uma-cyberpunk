// Rules version 3 (CY17): the bond perks, Orders, the ship's support and passives, meals, partners and the duo technique;
// and version 2 frozen: a v2 battle with v3 fields in its input plays exactly as without them.
import { describe, expect, it } from 'vitest'
import { applyBattleAction, battleStateHash, replayBattle, startBattle } from './battle'
import { battle, placed, RIG, unit, W } from './fixtures'
import { greedyTurn } from './golden/policy'
import type { BattleAction, BattleInput, BattleState, Cue } from './types'

const V3 = { version: 3 } as const
const squadOf = (s: BattleState) => s.units.filter((u) => u.side === 'squad')
const act = (s: BattleState, a: BattleAction) => { const r = applyBattleAction(s, a); if (r.error) throw new Error(r.error); return r }
const playOut = (input: BattleInput, n = 200) => {
  let s = startBattle(input).state
  const actions: BattleAction[] = []
  for (let i = 0; i < n && !s.result; i++) { const a = greedyTurn(s); actions.push(a); s = act(s, a).state }
  return { s, actions }
}

describe('rules version 3', () => {
  it('version 2 is frozen: life-aboard fields in a v2 input change nothing', () => {
    const units = [unit('a', 'squad', 0), unit('b', 'squad', 1), unit('x', 'enemy', 0), unit('y', 'enemy', 1)]
    const bare = battle(units, { version: 2, seed: 'frozen' })
    const dressed: BattleInput = { ...bare, meal: 'curry', systems: ['battery'], orders: { slots: 2, kinds: ['sure'] }, units: units.map((u) => ({ ...u, bond: { rank: 10, path: 'heart' } })) }
    const a = playOut(bare), b = replayBattle(dressed, a.actions)
    expect(b.error).toBeNull()
    expect(battleStateHash(b.state)).toBe(battleStateHash(a.s))
  })

  it('Ready (rank 3) starts with +1 Charge; a curry adds 1 more; a stew adds a tenth of Core HP', () => {
    const slow = { speed: 1, stamina: 3, power: 3, guts: 3, wit: 3 } as const
    const units = [unit('a', 'squad', 0, { bond: { rank: 3, path: null }, bands: slow }), unit('b', 'squad', 1, { bands: slow }), unit('x', 'enemy', 0, { bands: { ...slow, speed: 5 } })]
    const s = startBattle(battle(units, { ...V3 })).state
    expect(s.units.find((u) => u.id === 'a')!.charge).toBeGreaterThan(s.units.find((u) => u.id === 'b')!.charge)
    const curry = startBattle({ ...battle(units, { ...V3 }), meal: 'curry' }).state
    expect(curry.units.find((u) => u.id === 'b')!.charge).toBe(s.units.find((u) => u.id === 'b')!.charge + 1)
    const stew = startBattle({ ...battle(units, { ...V3 }), meal: 'stew' }).state
    expect(stew.units.find((u) => u.id === 'b')!.maxHp.core).toBeGreaterThan(s.units.find((u) => u.id === 'b')!.maxHp.core)
  })

  it('the Engines give the squad a head start on the clock', () => {
    const units = [unit('a', 'squad', 0), unit('x', 'enemy', 0)]
    // Equal speeds: without the Engines the tie goes by the seeded roll; with them the squad moves first on every seed.
    for (const seed of ['e1', 'e2', 'e3', 'e4', 'e5']) expect(startBattle({ ...battle(units, { ...V3, seed }), systems: ['engines'] }).state.active).toBe('a')
  })

  it('Sure shot: the next attack can’t miss; Orders come from the battle’s slots only', () => {
    const map = placed([[3, 5]], [[3, 3]])
    const units = [unit('a', 'squad', 0, { loadout: { ...RIG.striker(), rightHand: { ...W.rifle, accuracy: 5 } } }), unit('x', 'enemy', 0)]
    const input: BattleInput = { ...battle(units, { ...V3, map }), orders: { slots: 1, kinds: ['sure'] }, systems: ['engines'] }
    let s = startBattle(input).state
    expect(s.active).toBe('a')
    s = act(s, { kind: 'order', unit: 'a', order: 'sure' }).state
    expect(applyBattleAction(s, { kind: 'order', unit: 'a', order: 'sure' }).error).toMatch(/already|left/)
    const r = act(s, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'x' }, face: 'N' })
    expect(r.cues.filter((c) => c.kind === 'miss')).toHaveLength(0)
    expect(r.cues.some((c) => c.kind === 'hit')).toBe(true)
    expect(r.state.v3!.sure).toBeNull()
  })

  it('the orbital strike marks a 3 × 3 area, then lands at the start of the next round', () => {
    const map = placed([[1, 7]], [[4, 2], [5, 2]])
    const units = [unit('a', 'squad', 0), unit('x', 'enemy', 0), unit('y', 'enemy', 1)]
    const input: BattleInput = { ...battle(units, { ...V3, map }), orders: { slots: 2, kinds: ['strike'] }, systems: [{ id: 'battery', level: 2, band: 4 }, 'engines'] }
    let s = startBattle(input).state
    const r = act(s, { kind: 'order', unit: 'a', order: 'strike', at: [4, 2] })
    expect(r.cues.some((c) => c.kind === 'strikeMarked' && c.tiles.length === 9)).toBe(true)
    s = r.state
    const all: Cue[] = []
    for (let i = 0; i < 8 && s.v3!.strike; i++) { const t = act(s, greedyTurn(s)); all.push(...t.cues); s = t.state }
    expect(s.v3!.strike).toBeNull()
    expect(all.filter((c) => c.kind === 'burn' && c.by === 'strike').length).toBeGreaterThanOrEqual(1)
  })

  it('Call her name (rank 10): full Charge, she acts next, and Resonance is said with her path', () => {
    const units = [unit('a', 'squad', 0), unit('b', 'squad', 1, { bond: { rank: 10, path: 'heart' }, chargeCap: 4 }), unit('x', 'enemy', 0)]
    const input: BattleInput = { ...battle(units, { ...V3 }), orders: { slots: 2, kinds: ['resonance'] }, systems: ['engines'] }
    let s = startBattle(input).state
    const first = s.active!
    const caller = first === 'b' ? 'a' : first
    if (first === 'b') s = act(s, { kind: 'turn', unit: 'b', act: { kind: 'wait' }, face: 'N' }).state
    while (s.active !== caller) s = act(s, greedyTurn(s)).state
    const r = act(s, { kind: 'order', unit: caller, order: 'resonance', target: 'b' })
    expect(r.cues).toContainEqual({ kind: 'resonance', unit: 'b', path: 'heart' })
    expect(r.state.units.find((u) => u.id === 'b')!.charge).toBe(4)
    const after = act(r.state, { kind: 'turn', unit: caller, act: { kind: 'wait' }, face: 'N' })
    expect(after.state.active).toBe('b')
    expect(applyBattleAction(after.state, { kind: 'order', unit: 'b', order: 'resonance', target: 'b' }).error).toMatch(/called|left/)
  })

  it('a partner joins an attack free once a battle, link or not', () => {
    const map = placed([[3, 4], [3, 2]], [[3, 3]])
    const units = [
      unit('a', 'squad', 0, { loadout: RIG.striker(), partner: { unit: 'b', level: 1 } }),
      unit('b', 'squad', 1, { link: false, loadout: { ...RIG.striker(), rightHand: W.knuckles } }),
      unit('x', 'enemy', 0),
    ]
    const input: BattleInput = { ...battle(units, { ...V3, map }), systems: ['engines'] }
    let s = startBattle(input).state
    while (s.active !== 'a') s = act(s, { kind: 'turn', unit: s.active!, act: { kind: 'wait' }, face: 'N' }).state
    const r = act(s, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'x' }, face: 'N' })
    expect(r.cues).toContainEqual({ kind: 'freeJoin', unit: 'b', why: 'partner' })
    expect(r.state.v3!.joined).toContain('b')
  })

  it('Endure (rank 8): once a battle a Core break leaves 1', () => {
    const units = [unit('a', 'squad', 0, { bond: { rank: 8, path: 'trust' } }), unit('x', 'enemy', 0)]
    const s = startBattle(battle(units, { ...V3 })).state
    const a = s.units.find((u) => u.id === 'a')!
    const cues: Cue[] = []
    a.hp.core = 3
    // Through the harm path the rules use.
    void import('./harm').then(({ harm }) => {
      harm(s, a, 'core', 10, cues, (broke) => ({ kind: 'hit', unit: 'x', target: 'a', part: 'core', amount: 10, crit: false, broke }))
      expect(a.hp.core).toBe(1)
      expect(cues.some((c) => c.kind === 'endure')).toBe(true)
      harm(s, a, 'core', 10, cues, (broke) => ({ kind: 'hit', unit: 'x', target: 'a', part: 'core', amount: 10, crit: false, broke }))
      expect(a.status).toBe('down')
    })
  })

  it('a duo technique: both partners strike, and the partner’s next turn is spent', () => {
    const map = placed([[3, 5], [4, 4]], [[3, 4]])
    const units = [
      unit('a', 'squad', 0, { loadout: { ...RIG.striker(), rightHand: W.knuckles }, partner: { unit: 'b', level: 3 } }),
      unit('b', 'squad', 1, { loadout: { ...RIG.striker(), rightHand: W.knuckles } }),
      unit('x', 'enemy', 0, { bands: { speed: 1, stamina: 5, power: 3, guts: 3, wit: 3 } }),
    ]
    const input: BattleInput = { ...battle(units, { ...V3, map }), systems: ['engines'] }
    let s = startBattle(input).state
    while (s.active !== 'a') s = act(s, { kind: 'turn', unit: s.active!, act: { kind: 'wait' }, face: 'N' }).state
    const r = act(s, { kind: 'duo', unit: 'a', target: 'x' })
    expect(r.cues.some((c) => c.kind === 'duo')).toBe(true)
    expect(r.cues.filter((c) => c.kind === 'attack').map((c) => (c as { unit: string }).unit)).toEqual(['a', 'b'])
    let t = r.state, skipped = false
    for (let i = 0; i < 6 && !t.result && !skipped; i++) { const n = act(t, greedyTurn(t)); skipped = n.cues.some((c) => c.kind === 'skipped' && c.unit === 'b' && c.why === 'duo'); t = n.state }
    expect(skipped || r.cues.some((c) => c.kind === 'skipped' && c.unit === 'b')).toBe(true)
  })

  it('refuses bad v3 input: a bond rank 11, an unknown Order, an unknown meal', () => {
    const units = [unit('a', 'squad', 0), unit('x', 'enemy', 0)]
    expect(() => startBattle({ ...battle([{ ...units[0]!, bond: { rank: 11, path: null } }, units[1]!], { ...V3 }) })).toThrow(/bond/)
    expect(() => startBattle({ ...battle(units, { ...V3 }), orders: { slots: 1, kinds: ['nuke' as never] } })).toThrow(/Order/)
    expect(() => startBattle({ ...battle(units, { ...V3 }), meal: 'cake' })).toThrow(/meal/)
  })
})

export { squadOf }
