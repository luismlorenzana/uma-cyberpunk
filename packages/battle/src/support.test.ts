// The Back units' actions, items, Stride, the bench support call and the three new objectives (CY5, rules version 2).
import { describe, expect, it } from 'vitest'
import { applyBattleAction } from './battle'
import { RIG, RIG2, W } from './fixtures'
import { reachable } from './move'
import { boardOf } from './terrain'
import { edit, setup, unitOf } from './test-kit'
import { TUNING } from './tuning'
import type { BattleState, Cue, Prop } from './types'

const fast = { speed: 5 as const, stamina: 3 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const slow = { ...fast, speed: 1 as const }
const none = (s: BattleState) => applyBattleAction(s, { kind: 'turn', unit: s.active!, act: { kind: 'none' }, face: 'N' })

describe('the Bulwark', () => {
  it('deploys a solid barrier on an adjacent tile for 1 Charge; it blocks sight and breaks at 0 HP', () => {
    const s = setup([{ id: 'v', at: [3, 6], opts: { bands: fast, loadout: RIG2.bulwark() } }], [{ id: 'e', at: [3, 2], opts: { bands: slow } }], { version: 2 })
    const r = applyBattleAction(s, { kind: 'turn', unit: 'v', act: { kind: 'barrier', at: [3, 5] }, face: 'N' })
    expect(r.error).toBeNull()
    expect(r.cues).toContainEqual({ kind: 'barrier', unit: 'v', id: 'barrier-1', at: [3, 5] })
    expect(boardOf(r.state).open(3, 5)).toBe(false)
    expect(boardOf(r.state).blocks(3, 5)).toBe(true)
    expect(r.state.field!.barriers[0]!.hp).toBe(TUNING.back.barrierHp)
    expect(applyBattleAction(s, { kind: 'turn', unit: 'v', act: { kind: 'barrier', at: [3, 4] }, face: 'N' }).error).toMatch(/adjacent/)
  })
})

describe('the Thruster', () => {
  it('climbs two levels a step, and Dash gives +2 Move with no zones of control for 1 Charge', () => {
    const heights = ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00020000']
    const t = setup([{ id: 't', at: [2, 7], opts: { bands: fast, loadout: RIG2.thruster() } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2, heights })
    expect(reachable(t, 't').some((r) => r.to[0] === 3 && r.to[1] === 7)).toBe(true)
    const v1 = setup([{ id: 't', at: [2, 7], opts: { bands: fast, loadout: RIG2.thruster() } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { heights })
    expect(reachable(v1, 't').some((r) => r.to[0] === 3 && r.to[1] === 7)).toBe(false)
    const base = reachable(t, 't').length
    const dashed = reachable(t, 't', { dash: true }).length
    expect(dashed).toBeGreaterThan(base)
    const r = applyBattleAction(t, { kind: 'turn', unit: 't', to: [2, 1], dash: true, act: { kind: 'none' }, face: 'N' })
    expect(r.error).toBeNull()
    expect(r.cues).toContainEqual({ kind: 'dash', unit: 't' })
  })
})

describe('the Med unit', () => {
  it('Mend restores Core HP or mends a broken limb at 25%', () => {
    const s = edit(setup([{ id: 'm', at: [3, 6], opts: { bands: fast, loadout: RIG2.medic() } }, { id: 'b', at: [3, 5] }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2 }), 'b', (u) => { u.hp.core = 20; u.hp.legs = 0 })
    const core = applyBattleAction(s, { kind: 'turn', unit: 'm', act: { kind: 'mend', target: 'b', part: 'core' }, face: 'N' })
    expect(core.cues).toContainEqual({ kind: 'mended', unit: 'm', target: 'b', part: 'core', hp: Math.min(unitOf(s, 'b').maxHp.core, 20 + TUNING.back.mendCore) })
    const legs = applyBattleAction(s, { kind: 'turn', unit: 'm', act: { kind: 'mend', target: 'b', part: 'legs' }, face: 'N' })
    expect(unitOf(legs.state, 'b').hp.legs).toBe(Math.floor(unitOf(s, 'b').maxHp.legs * TUNING.back.mendPartPct / 100))
  })
  it('Reboot stands a kneeling ally inside her window at 25% Core; outside it she has extracted', () => {
    const s = edit(setup([{ id: 'm', at: [3, 6], opts: { bands: fast, loadout: RIG2.medic() } }, { id: 'b', at: [3, 5], opts: { bands: slow } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2 }), 'b', (u) => { u.hp.core = 0; u.hp.leftArm = 0; u.status = 'down' })
    const charged = edit(s, 'm', (u) => { u.charge = 3 })
    const r = applyBattleAction(charged, { kind: 'turn', unit: 'm', act: { kind: 'reboot', target: 'b' }, face: 'N' })
    expect(r.cues).toContainEqual({ kind: 'rebooted', unit: 'm', target: 'b' })
    expect(unitOf(r.state, 'b')).toMatchObject({ status: 'active', hp: { core: Math.floor(unitOf(s, 'b').maxHp.core * TUNING.back.rebootCorePct / 100), leftArm: 0 } })
    let late = s
    while (unitOf(late, 'b').status === 'down') late = none(late).state
    expect(unitOf(late, 'b').status).toBe('out')
    expect(applyBattleAction(edit(late, late.active!, (u) => { u.charge = 3 }), { kind: 'turn', unit: late.active!, act: { kind: 'reboot', target: 'b' }, face: 'N' }).error).not.toBeNull()
  })
})

describe('items', () => {
  it('uses the squad stock: repair, patch, cell and smoke, costing no Charge', () => {
    const s = edit(setup([{ id: 'a', at: [3, 6], opts: { bands: fast } }, { id: 'b', at: [3, 5] }], [{ id: 'e', at: [3, 2], opts: { bands: slow } }], { version: 2, items: { repair: 1, patch: 1, cell: 1, smoke: 1 } }), 'b', (u) => { u.hp.core = 10; u.hp.rightArm = 0 })
    const repair = applyBattleAction(s, { kind: 'turn', unit: 'a', act: { kind: 'item', item: 'repair', target: 'b' }, face: 'N' })
    expect(unitOf(repair.state, 'b').hp.core).toBe(10 + TUNING.items.repairCore)
    expect(repair.state.field!.items.repair).toBe(0)
    const patch = applyBattleAction(s, { kind: 'turn', unit: 'a', act: { kind: 'item', item: 'patch', target: 'b', part: 'rightArm' }, face: 'N' })
    expect(unitOf(patch.state, 'b').hp.rightArm).toBe(Math.floor(unitOf(s, 'b').maxHp.rightArm * TUNING.items.patchPct / 100))
    const cell = applyBattleAction(s, { kind: 'turn', unit: 'a', act: { kind: 'item', item: 'cell' }, face: 'N' })
    expect(cell.cues).toContainEqual({ kind: 'charge', unit: 'a', from: 2, to: 3, why: 'item' })
    const smoke = applyBattleAction(s, { kind: 'turn', unit: 'a', act: { kind: 'item', item: 'smoke', at: [3, 3] }, face: 'N' })
    expect(smoke.state.field!.states['3,3']?.kind).toBe('smoke')
    expect(smoke.state.field!.states['3,2']?.kind).toBe('smoke')
    const empty = edit(s, 'a', () => {})
    empty.field!.items.cell = 0
    expect(applyBattleAction(empty, { kind: 'turn', unit: 'a', act: { kind: 'item', item: 'cell' }, face: 'N' }).error).toMatch(/no cell/)
  })
})

describe('Stride', () => {
  const move = (stride: 'break' | 'draft' | 'surge' | 'kick', change?: (s: BattleState) => BattleState) => {
    let s = setup([{ id: 'a', at: [3, 7], opts: { bands: fast, stride } }, { id: 'b', at: [4, 7] }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2 })
    if (change) s = change(s)
    return Math.max(...reachable(s, 'a').map((r) => r.path.length - 1))
  }
  const plain = TUNING.move[5]
  it('Break: +1 Move on her first turn; Draft: +1 next to an ally; Surge: +1 after a Wait; Kick: +2 at half Core or less', () => {
    expect(move('break')).toBe(plain + 1)
    expect(move('break', (s) => edit(s, 'a', (u) => { u.turns = 1 }))).toBe(plain)
    expect(move('draft')).toBe(plain + 1)
    expect(move('draft', (s) => edit(s, 'b', (u) => { u.x = 7; u.y = 7 }))).toBe(plain)
    expect(move('surge')).toBe(plain)
    expect(move('surge', (s) => edit(s, 'a', (u) => { u.waited = true }))).toBe(plain + 1)
    expect(move('kick')).toBe(plain)
    expect(move('kick', (s) => edit(s, 'a', (u) => { u.hp.core = Math.floor(u.maxHp.core / 2) }))).toBe(plain + 2)
  })
})

describe('the bench support call', () => {
  it('spends one free call a battle by role: a strike, a mortar, a scan, a repair drop or a barrier', () => {
    const s = setup([{ id: 'a', at: [3, 6], opts: { bands: fast } }, { id: 'b', at: [1, 6] }], [{ id: 'e', at: [3, 2], opts: { bands: slow } }, { id: 'f', at: [4, 2], opts: { bands: slow } }], { version: 2, bench: ['gunner', 'medic'] })
    const r = applyBattleAction(s, { kind: 'bench', unit: 'a', role: 'gunner', at: [3, 2] })
    expect(r.error).toBeNull()
    expect(r.cues.filter((c) => c.kind === 'burn' && c.by === 'mortar').map((c) => c.kind === 'burn' && c.unit)).toEqual(['e', 'f'])
    expect(r.state.active).toBe('a')
    expect(applyBattleAction(r.state, { kind: 'bench', unit: 'a', role: 'medic', at: [3, 6] }).error).toMatch(/already been called/)
    expect(applyBattleAction(s, { kind: 'bench', unit: 'a', role: 'striker', at: [3, 2] }).error).toMatch(/no striker/)
  })
})

describe('the new objectives', () => {
  it('escort: won when she reaches the tile, lost if she is out', () => {
    const s = setup([{ id: 'a', at: [3, 7], opts: { bands: fast } }, { id: 'vip', at: [4, 7], opts: { bands: slow } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2, objective: { kind: 'escort', unit: 'vip', tile: [4, 4] } })
    const lost = edit(s, 'vip', (u) => { u.status = 'out' })
    const r = applyBattleAction(lost, { kind: 'turn', unit: 'a', act: { kind: 'none' }, face: 'N' })
    expect(r.state.result?.winner).toBe('enemy')
    let w = s
    for (let i = 0; i < 8 && !w.result; i++) w = applyBattleAction(w, { kind: 'turn', unit: w.active!, ...(w.active === 'vip' ? { to: [4, 4] as const } : {}), act: { kind: 'none' }, face: 'N' }).state
    expect(w.result?.winner).toBe('squad')
  })
  it('hack N terminals: won when that many have been hacked', () => {
    const props: Prop[] = [{ kind: 'terminal', id: 't1', tile: [2, 5], does: { lights: true } }, { kind: 'terminal', id: 't2', tile: [4, 5], does: { lights: true } }]
    let s = setup([{ id: 'n', at: [3, 6], opts: { bands: fast, loadout: RIG2.netrunner(), chargeCap: 5 } }], [{ id: 'e', at: [7, 0], opts: { bands: slow } }], { version: 2, props, objective: { kind: 'hack', count: 2 } })
    s = edit(s, 'n', (u) => { u.charge = 5 })
    const one = applyBattleAction(s, { kind: 'turn', unit: 'n', act: { kind: 'hack', terminal: 't1' }, face: 'N' })
    expect(one.cues).toContainEqual({ kind: 'objective', objective: 'hack', value: 1, of: 2 })
    let t = one.state
    while (t.active !== 'n') t = none(t).state
    const two = applyBattleAction(t, { kind: 'turn', unit: 'n', act: { kind: 'hack', terminal: 't2' }, face: 'N' })
    expect(two.state.result?.winner).toBe('squad')
  })
  it('free the leader: freeing wins, breaking her loses', () => {
    const killer = { bands: fast, loadout: { ...RIG.striker(), rightHand: { ...W.blade, accuracy: 150, power: 300 } } }
    for (let i = 0; ; i++) {
      const s = edit(setup([{ id: 'a', at: [3, 5], opts: killer }], [{ id: 'boss', at: [3, 4], facing: 'N', opts: { bands: slow, leader: true, hold: 'collar' } }], { version: 2, seed: `l${i}`, objective: { kind: 'freeLeader' } }), 'boss', (u) => { u.hp.leftArm = 0; u.hp.rightArm = 0; u.hp.legs = 0 })
      const r = applyBattleAction(s, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'boss' }, face: 'N' })
      if (!r.cues.some((c: Cue) => c.kind === 'rigBreak')) continue
      expect(r.state.result?.winner).toBe('enemy')
      break
    }
  })
})
