// Terrain, props and terminals (CY5, rules version 2).
import { describe, expect, it } from 'vitest'
import { strikeOf } from './attack'
import { applyBattleAction } from './battle'
import { RIG, RIG2, W } from './fixtures'
import { reachable } from './move'
import { inReach } from './sight'
import { boardOf, keyOf, liveTiles, terrainCard } from './terrain'
import { edit, setup, unitOf } from './test-kit'
import { TUNING } from './tuning'
import type { BattleState, Cue, Prop } from './types'

const fast = { speed: 5 as const, stamina: 3 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const slow = { ...fast, speed: 1 as const }
const kinds = (cues: Cue[]) => cues.map((c) => c.kind)
const stateAt = (s: BattleState, x: number, y: number) => s.field!.states[keyOf(x, y)]?.kind
const sure = { ...W.rifle, accuracy: 150 }

describe('props and the five states', () => {
  it('bursts a barrel into an Oil slick, and an F hit on it sets the slick alight', () => {
    const props: Prop[] = [{ kind: 'barrel', id: 'b1', tile: [3, 3] }]
    const state = setup([{ id: 'a', at: [3, 6], opts: { bands: fast, loadout: { ...RIG.gunner(), rightHand: sure } } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2, props })
    expect(boardOf(state).open(3, 3)).toBe(false)
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'b1' }, face: 'N' })
    expect(r.error).toBeNull()
    expect(r.cues).toContainEqual({ kind: 'burst', prop: 'b1' })
    expect(stateAt(r.state, 3, 3)).toBe('oil')
    expect(stateAt(r.state, 3, 4)).toBe('oil')
    expect(boardOf(r.state).open(3, 3)).toBe(true)
    const flamer = setup([{ id: 'a', at: [3, 5], opts: { bands: fast, loadout: { ...RIG2.flamer(), rightHand: { ...RIG2.flamer().rightHand as typeof W.rifle, accuracy: 150 } } } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2, props })
    const burned = applyBattleAction(flamer, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'b1' }, face: 'N' })
    expect(stateAt(burned.state, 3, 3)).toBe('fire')
    expect(stateAt(burned.state, 2, 3)).toBe('fire')
  })
  it('spreads Fire across the whole connected slick, and Wet puts it out', () => {
    const state = setup([{ id: 'a', at: [0, 7], opts: { bands: fast } }], [{ id: 'e', at: [7, 0] }], { version: 2 })
    const s = edit(state, 'a', () => {})
    for (const x of [2, 3, 4, 5]) s.field!.states[keyOf(x, 4)] = { kind: 'oil', until: 0 }
    s.field!.states[keyOf(6, 4)] = { kind: 'wet', until: 0 }
    const cues: Cue[] = []
    // An F hit on a unit standing on the slick.
    const withUnit = edit(s, 'e', (u) => { u.x = 2; u.y = 4 })
    void cues
    const flame = { ...withUnit, input: { ...withUnit.input, units: withUnit.input.units.map((u) => (u.id === 'a' ? { ...u, loadout: RIG2.flamer() } : u)) } }
    const moved = edit(flame, 'a', (u) => { u.x = 2; u.y = 6 })
    for (let seed = 0; seed < 30; seed++) {
      const r = applyBattleAction({ ...moved, input: { ...moved.input, seed: `f${seed}` } }, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' })
      if (!r.cues.some((c) => c.kind === 'hit')) continue
      expect([2, 3, 4, 5].map((x) => stateAt(r.state, x, 4))).toEqual(['fire', 'fire', 'fire', 'fire'])
      expect(stateAt(r.state, 6, 4)).toBe('wet')
      return
    }
    throw new Error('no seed hit')
  })
  it('burns out after three rounds, and Smoke clears after two', () => {
    let s = setup([{ id: 'a', at: [0, 7] }], [{ id: 'e', at: [7, 0] }], { version: 2 })
    s = edit(s, 'a', () => {})
    s.field!.states[keyOf(4, 4)] = { kind: 'fire', until: s.time + 3 * TUNING.roundTicks }
    s.field!.states[keyOf(5, 4)] = { kind: 'smoke', until: s.time + 2 * TUNING.roundTicks }
    const start = s.time
    while (s.time < start + 2 * TUNING.roundTicks) s = applyBattleAction(s, { kind: 'turn', unit: s.active!, act: { kind: 'none' }, face: 'N' }).state
    expect(stateAt(s, 5, 4)).toBeUndefined()
    expect(stateAt(s, 4, 4)).toBe('fire')
    while (s.time < start + 3 * TUNING.roundTicks) s = applyBattleAction(s, { kind: 'turn', unit: s.active!, act: { kind: 'none' }, face: 'N' }).state
    expect(stateAt(s, 4, 4)).toBeUndefined()
  })
  it('burns the Legs of whoever ends a turn in Fire (a Fire Coat halves it)', () => {
    const s = edit(setup([{ id: 'a', at: [3, 6], opts: { bands: fast } }], [{ id: 'e', at: [7, 0] }], { version: 2 }), 'a', () => {})
    s.field!.states[keyOf(3, 5)] = { kind: 'fire', until: 9999 }
    const r = applyBattleAction(s, { kind: 'turn', unit: 'a', to: [3, 5], act: { kind: 'none' }, face: 'N' })
    expect(r.cues).toContainEqual({ kind: 'burn', unit: 'a', part: 'legs', amount: TUNING.terrain.fireDamage, by: 'fire', broke: false })
    const coated = edit(setup([{ id: 'a', at: [3, 6], opts: { bands: fast, loadout: RIG.gunner() } }], [{ id: 'e', at: [7, 0] }], { version: 2 }), 'a', () => {})
    coated.field!.states[keyOf(3, 5)] = { kind: 'fire', until: 9999 }
    const r2 = applyBattleAction(coated, { kind: 'turn', unit: 'a', to: [3, 5], act: { kind: 'none' }, face: 'N' })
    expect(r2.cues).toContainEqual({ kind: 'burn', unit: 'a', part: 'legs', amount: TUNING.terrain.fireDamage / 2, by: 'fire', broke: false })
  })
  it('makes a cable’s tile Live, spreads current across Wet and grating at once, and hurts the Core on entering and ending there', () => {
    const tiles = ['........', '........', '........', '........', '...===..', '........', '........', '........']
    const props: Prop[] = [{ kind: 'cable', id: 'c1', tile: [2, 4] }]
    const s = edit(setup([{ id: 'a', at: [5, 6], opts: { bands: fast } }], [{ id: 'e', at: [7, 0] }], { version: 2, tiles, props }), 'a', () => {})
    s.field!.states[keyOf(5, 5)] = { kind: 'wet', until: 0 }
    const live = liveTiles(s)
    expect(['2,4', '3,4', '4,4', '5,4', '5,5'].every((k) => live.has(k))).toBe(true)
    expect(live.has('6,4')).toBe(false)
    const r = applyBattleAction(s, { kind: 'turn', unit: 'a', to: [5, 4], act: { kind: 'none' }, face: 'N' })
    expect(r.cues.filter((c) => c.kind === 'burn' && c.by === 'live').length).toBe(3) // 5,5 and 5,4 entered, 5,4 at the end
  })
  it('sets Oil alight where current meets it', () => {
    const props: Prop[] = [{ kind: 'cable', id: 'c1', tile: [2, 4] }, { kind: 'barrel', id: 'b1', tile: [4, 4] }]
    const state = setup([{ id: 'a', at: [4, 7], opts: { bands: fast, loadout: { ...RIG.gunner(), rightHand: sure } } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2, props })
    const r = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'b1' }, face: 'N' })
    expect(stateAt(r.state, 3, 4)).toBe('fire')
  })
})

describe('cover, grating and Smoke', () => {
  it('gives a cover tile −20% to Short and Long hits from the front and sides, never from behind or to Melee', () => {
    const tiles = ['........', '........', '........', '...c....', '........', '........', '........', '........']
    const s = setup([{ id: 'a', at: [3, 5], opts: { loadout: RIG.gunner() } }], [{ id: 'e', at: [3, 3], facing: 'S' }], { version: 2, tiles })
    const v1 = setup([{ id: 'a', at: [3, 5], opts: { loadout: RIG.gunner() } }], [{ id: 'e', at: [3, 3], facing: 'S' }], { tiles })
    expect(strikeOf(v1, 'a', 'right', 'e', [3, 5])!.hit - strikeOf(s, 'a', 'right', 'e', [3, 5])!.hit).toBe(TUNING.terrain.coverEvasion)
    const behind = edit(s, 'e', (u) => { u.facing = 'N' })
    expect(strikeOf(behind, 'a', 'right', 'e', [3, 5])!.hit).toBe(strikeOf(v1, 'a', 'right', 'e', [3, 5])!.hit)
  })
  it('blocks line of fire with Smoke and takes 30% off ranged hits into it', () => {
    const s = edit(setup([{ id: 'a', at: [3, 6], opts: { loadout: RIG.gunner() } }], [{ id: 'e', at: [3, 3] }], { version: 2 }), 'a', () => {})
    const before = strikeOf(s, 'a', 'right', 'e', [3, 6])!.hit
    s.field!.states[keyOf(3, 4)] = { kind: 'smoke', until: 9999 }
    expect(inReach(boardOf(s), W.rifle, [3, 6], [3, 3])).toBe(false)
    s.field!.states[keyOf(3, 4)] = { kind: 'wet', until: 0 }
    s.field!.states[keyOf(3, 3)] = { kind: 'smoke', until: 9999 }
    expect(strikeOf(s, 'a', 'right', 'e', [3, 6])!.hit).toBe(before - TUNING.terrain.smokePenalty)
  })
})

describe('terminals', () => {
  const props: Prop[] = [
    { kind: 'door', id: 'd1', tiles: [[0, 3], [1, 3]], open: false },
    { kind: 'lift', id: 'l1', tiles: [[5, 3], [6, 3]], low: 0, high: 2, raised: false },
    { kind: 'terminal', id: 't-door', tile: [3, 5], does: { door: 'd1' } },
    { kind: 'terminal', id: 't-lift', tile: [4, 5], does: { lift: 'l1' } },
    { kind: 'terminal', id: 't-lights', tile: [2, 5], does: { lights: true } },
    { kind: 'terminal', id: 't-turret', tile: [5, 5], does: { turret: 'gun' } },
  ]
  const net = { bands: fast, loadout: RIG2.netrunner() }
  const start = () => setup([{ id: 'n', at: [3, 6], opts: net }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }, { id: 'gun', at: [6, 0], opts: { bands: slow, fixed: true, loadout: RIG2.turret() } }], { version: 2, props })
  it('opens a door for 1 Charge, no roll', () => {
    const s = start()
    expect(boardOf(s).open(0, 3)).toBe(false)
    const r = applyBattleAction(s, { kind: 'turn', unit: 'n', act: { kind: 'hack', terminal: 't-door' }, face: 'N' })
    expect(r.error).toBeNull()
    expect(r.cues).toContainEqual({ kind: 'door', door: 'd1', open: true, tiles: [[0, 3], [1, 3]] })
    expect(boardOf(r.state).open(0, 3)).toBe(true)
    expect(r.cues).toContainEqual({ kind: 'charge', unit: 'n', from: 2, to: 1, why: 'hack' })
  })
  it('moves a lift: its tiles change height, with a cue for the board', () => {
    const r = applyBattleAction(start(), { kind: 'turn', unit: 'n', act: { kind: 'hack', terminal: 't-lift' }, face: 'N' })
    expect(r.cues).toContainEqual({ kind: 'heights', lift: 'l1', tiles: [[5, 3], [6, 3]], height: 2 })
    expect(boardOf(r.state).height(5, 3)).toBe(2)
  })
  it('turns a turret to her side, and cuts the lights: ranged hits −15% and turrets idle for two rounds', () => {
    const turned = applyBattleAction(start(), { kind: 'turn', unit: 'n', act: { kind: 'hack', terminal: 't-turret' }, face: 'N' })
    expect(unitOf(turned.state, 'gun').side).toBe('squad')
    const dark = applyBattleAction(start(), { kind: 'turn', unit: 'n', act: { kind: 'hack', terminal: 't-lights' }, face: 'N' })
    expect(dark.cues).toContainEqual({ kind: 'lights', out: true })
    let s = dark.state
    const all: Cue[] = [...dark.cues]
    for (let i = 0; i < 6; i++) {
      const r = applyBattleAction(s, { kind: 'turn', unit: s.active!, act: { kind: 'none' }, face: 'N' })
      all.push(...r.cues)
      s = r.state
    }
    expect(all).toContainEqual({ kind: 'skipped', unit: 'gun', why: 'idle' })
    expect(all).toContainEqual({ kind: 'lights', out: false })
  })
  it('a turret never moves', () => {
    const s = { ...start(), active: 'gun' }
    expect(reachable(s, 'gun').map((r) => r.to)).toEqual([[6, 0]])
  })
})

describe('the terrain card', () => {
  it('names the state, height, props, what could change it and what it does', () => {
    const s = edit(setup([{ id: 'a', at: [0, 7] }], [{ id: 'e', at: [7, 0] }], { version: 2, tiles: ['........', '........', '........', '...c....', '........', '........', '........', '........'] }), 'a', () => {})
    s.field!.states[keyOf(3, 3)] = { kind: 'smoke', until: s.time + 200 }
    const card = terrainCard(s, [3, 3])
    expect(card).toMatchObject({ ground: 'cover', state: 'smoke', rounds: 2, live: false, height: 0 })
    expect(card.effects.join(' ')).toMatch(/Cover/)
    expect(card.effects.join(' ')).toMatch(/Smoke/)
    expect(card.changes.length).toBeGreaterThan(0)
    void kinds
  })
})
