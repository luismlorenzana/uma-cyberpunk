import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { strikeOf } from './attack'
import { applyBattleAction } from './battle'
import { RIG, W } from './fixtures'
import { edit, setup, unitOf } from './test-kit'
import { TUNING } from './tuning'
import type { Cue } from './types'

const visualCues = [
  'turnStarted', 'charge', 'moved', 'faced', 'waited', 'linked', 'attack', 'cover', 'crossfire', 'counter',
  'guard', 'hit', 'miss', 'partBroke', 'holdOn', 'rigBreak', 'extracted', 'objective', 'ended', 'terrain',
  'burn', 'burst', 'hacked', 'door', 'heights', 'turned', 'lights', 'tech', 'stunned', 'skipped', 'holdHit',
  'freed', 'barrier', 'barrierHit', 'dash', 'mended', 'rebooted', 'item', 'skill', 'bench', 'scan', 'reload',
  'pinned', 'volleySignal', 'volley', 'order', 'resonance', 'strikeMarked', 'endure', 'freeJoin',
  'freeCover', 'duo', 'sweep', 'drone', 'shielded', 'talked', 'signatureWarning', 'signatureCanceled',
] as const satisfies readonly Cue['kind'][]

// A new engine cue must be assigned a treatment before the matrix counts as current.
const coversEveryCue: Exclude<Cue['kind'], typeof visualCues[number]> extends never ? true : never = true

const kinds = (cues: Cue[]) => cues.map(({ kind }) => kind)

describe('ground combat visual authoring', () => {
  it('assigns each ordered cue exactly one documented visual treatment', () => {
    expect(coversEveryCue).toBe(true)
    const doc = readFileSync(join(__dirname, '../../../docs/technical/ground-combat-visual-matrix.md'), 'utf8')
    const cueTable = doc.split('## Resolved cues')[1]?.split('## Shared cues and persistent states')[0] ?? ''
    const rows = [...cueTable.matchAll(/^\| `([A-Za-z]+)` \| (.+?) \| (.+?) \|$/gm)].map((row) => row[1])
    expect(rows).toEqual(visualCues)
  })

  it('keeps the two-handed rifle on its equipped mount for either surviving arm', () => {
    const loadout = { ...RIG.trooper(), leftHand: null, rightHand: { ...W.rifle, twoHanded: true } }
    const state = setup([{ id: 'a', at: [3, 5], opts: { loadout } }], [{ id: 'e', at: [3, 3] }], { active: 'a', version: 4 })
    const attack = { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' } as const
    const intact = strikeOf(state, 'a', 'right', 'e', [3, 5])!
    for (const arm of ['leftArm', 'rightArm'] as const) {
      const damaged = edit(state, 'a', (u) => { u.hp[arm] = 0 })
      const reduced = strikeOf(damaged, 'a', 'right', 'e', [3, 5])!
      expect(reduced.hit).toBe(intact.hit - W.rifle.accuracy + Math.floor(W.rifle.accuracy / 2))
      const result = applyBattleAction(damaged, attack)
      expect(result.error).toBeNull()
      expect(result.cues).toContainEqual({ kind: 'attack', unit: 'a', target: 'e', with: 'right', band: 'short', role: 'main', facing: 'front' })
    }
    const both = edit(state, 'a', (u) => { u.hp.leftArm = u.hp.rightArm = 0 })
    const blocked = applyBattleAction(both, attack)
    expect(blocked.error).not.toBeNull()
    expect(blocked.cues).toEqual([])
  })

  it('cues guard on the live shield bearer for front and side attacks', () => {
    const state = setup([{ id: 'a', at: [3, 5] }], [{ id: 'e', at: [3, 4], opts: { loadout: RIG.vanguard() } }], { active: 'a', version: 4 })
    const attack = { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' } as const
    for (const facing of ['S', 'E', 'N'] as const) {
      const defender = edit(state, 'e', (u) => { u.facing = facing })
      const result = applyBattleAction(defender, attack)
      expect(result.error).toBeNull()
      expect(result.cues.filter((cue) => cue.kind === 'guard')).toEqual(facing === 'N' ? [] : [{ kind: 'guard', unit: 'e', cut: 40 }])
    }
    const broken = edit(state, 'e', (u) => { u.hp.leftArm = 0 })
    expect(kinds(applyBattleAction(broken, attack).cues)).not.toContain('guard')
  })

  it('distinguishes Bulwark deployment from the same barrier placed by bench support', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { loadout: RIG.vanguard() } }], [{ id: 'e', at: [7, 0] }],
      { active: 'a', version: 4, bench: ['vanguard'] })
    const deploy = applyBattleAction(state, { kind: 'turn', unit: 'a', act: { kind: 'barrier', at: [3, 4] }, face: 'N' })
    const drop = applyBattleAction(state, { kind: 'bench', unit: 'a', role: 'vanguard', at: [3, 4] })
    expect(deploy.error).toBeNull()
    expect(drop.error).toBeNull()
    expect(deploy.cues.slice(0, 2)).toEqual([
      expect.objectContaining({ kind: 'charge', unit: 'a', why: 'barrier' }),
      { kind: 'barrier', unit: 'a', id: 'barrier-1', at: [3, 4] },
    ])
    expect(kinds(drop.cues)).toEqual(['bench', 'barrier'])
    expect(drop.state.field?.barriers).toEqual(deploy.state.field?.barriers)
  })

  it('goes from a real Core break to Med or Order Reboot and preserves broken limbs', () => {
    const loadout = { ...RIG.striker(), back: { kind: 'med' as const, load: 3 } }
    let state = setup([{ id: 'm', at: [3, 6], opts: { loadout } }, { id: 'b', at: [3, 5] }],
      [{ id: 'e', at: [3, 4], opts: { loadout: RIG.gunner() } }], { active: 'e', version: 4, seed: 'visual-reboot' })
    state = edit(state, 'm', (u) => { u.charge = 3; u.clock = 99 })
    state = edit(state, 'b', (u) => { u.hp.core = 1; u.hp.leftArm = 0; u.charge = 0; u.clock = 0 })
    const down = applyBattleAction(state, { kind: 'turn', unit: 'e', act: { kind: 'attack', with: 'right', target: 'b', aim: 'core' }, face: 'S' })
    expect(down.error).toBeNull()
    expect(down.cues.filter((cue) => cue.kind === 'partBroke' || cue.kind === 'rigBreak')).toEqual([
      { kind: 'partBroke', unit: 'b', part: 'core' }, { kind: 'rigBreak', unit: 'b' },
    ])
    expect(unitOf(down.state, 'b')).toMatchObject({ status: 'down', x: 3, y: 5, hp: { core: 0, leftArm: 0 } })
    const up = applyBattleAction(down.state, { kind: 'turn', unit: 'm', act: { kind: 'reboot', target: 'b' }, face: 'N' })
    expect(up.error).toBeNull()
    expect(up.cues.slice(0, 2)).toEqual([
      expect.objectContaining({ kind: 'charge', unit: 'm', why: 'reboot' }),
      { kind: 'rebooted', unit: 'm', target: 'b' },
    ])
    expect(unitOf(up.state, 'b')).toMatchObject({ status: 'active', x: 3, y: 5, hp: {
      core: Math.floor(unitOf(state, 'b').maxHp.core * TUNING.back.rebootCorePct / 100), leftArm: 0,
    } })
    const orderState = { ...down.state, input: { ...down.state.input, orders: { slots: 1, kinds: ['reboot'] as const } } }
    const ordered = applyBattleAction(orderState, { kind: 'order', unit: 'm', order: 'reboot', target: 'b' })
    expect(ordered.error).toBeNull()
    expect(ordered.cues).toEqual([
      { kind: 'order', unit: 'm', order: 'reboot', target: 'b' }, { kind: 'rebooted', unit: 'm', target: 'b' },
    ])
    expect(unitOf(ordered.state, 'b')).toMatchObject({ status: 'active', x: 3, y: 5, hp: {
      core: Math.floor(unitOf(state, 'b').maxHp.core * TUNING.orders.rebootCorePct / 100), leftArm: 0,
    } })
  })
})
