// The Steel Muster (WD11, CY5): reload, the volley meter and its signal, the volley dodged or landing, pinning fire.
import { describe, expect, it } from 'vitest'
import { applyBattleAction } from './battle'
import { RIG, W } from './fixtures'
import { forecast, type Forecast } from './forecast'
import { strikeOf } from './attack'
import { edit, setup, unitOf } from './test-kit'
import { TUNING } from './tuning'
import type { BattleState, Cue } from './types'

const fast = { speed: 5 as const, stamina: 5 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const slow = { ...fast, speed: 1 as const }
const muster = (extra = {}) => ({ faction: 'steel-muster' as const, loadout: RIG.trooper(), ...extra })

describe('the Steel Muster', () => {
  it('reloads after firing a Short weapon: no counter until her next turn', () => {
    const s = setup([{ id: 'a', at: [3, 5], opts: { bands: slow } }], [{ id: 'm', at: [3, 3], opts: muster({ bands: fast }) }], { version: 2, factions: ['steel-muster'] })
    const r = applyBattleAction(s, { kind: 'turn', unit: 'm', act: { kind: 'attack', with: 'right', target: 'a' }, face: 'S' })
    expect(r.cues).toContainEqual({ kind: 'reload', unit: 'm' })
    expect(unitOf(r.state, 'm').reloading).toBe(true)
    // The squad's attack on her draws no counter while she reloads.
    const turn = edit({ ...r.state, active: 'a' }, 'a', (u) => { u.x = 3; u.y = 4 })
    const back = applyBattleAction(turn, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'm' }, face: 'N' })
    expect(back.cues.some((c) => c.kind === 'counter')).toBe(false)
    expect(back.cues.some((c) => c.kind === 'attack')).toBe(true)
  })
  it('stays off without its flag', () => {
    const s = setup([{ id: 'a', at: [3, 5], opts: { bands: slow } }], [{ id: 'm', at: [3, 3], opts: muster({ bands: fast }) }], { version: 2 })
    const r = applyBattleAction(s, { kind: 'turn', unit: 'm', act: { kind: 'attack', with: 'right', target: 'a' }, face: 'S' })
    expect(r.cues.some((c) => c.kind === 'reload')).toBe(false)
  })
  it('fills the volley meter, signals the marked tiles a round ahead, and the volley hits whoever stayed', () => {
    let s: BattleState = setup([{ id: 'a', at: [3, 5], opts: { bands: slow } }, { id: 'b', at: [5, 5], opts: { bands: slow } }], [{ id: 'm', at: [3, 2], opts: muster({ bands: fast }) }, { id: 'n', at: [5, 2], opts: muster({ bands: fast }) }], { version: 2, factions: ['steel-muster'] })
    s = edit(s, 'm', () => {})
    s.field!.volley.meter = TUNING.muster.volleyFull - 1
    const target = s.active === 'm' ? 'a' : 'b'
    const signal = applyBattleAction(s, { kind: 'turn', unit: s.active!, act: { kind: 'attack', with: 'right', target }, face: 'S' })
    expect(signal.error).toBeNull()
    const sig = signal.cues.find((c) => c.kind === 'volleySignal')
    expect(sig).toEqual({ kind: 'volleySignal', tiles: [[3, 5], [5, 5]], at: s.time + TUNING.roundTicks })
    const f = forecast(signal.state, { kind: 'turn', unit: signal.state.active!, act: { kind: 'none' }, face: 'N' }) as Forecast
    expect(f.volley?.tiles).toEqual([[3, 5], [5, 5]])
    // Play on: units that stay on the marks are hit; 'b' steps off when her turn comes.
    let t = signal.state
    const all: Cue[] = [...signal.cues]
    for (let i = 0; i < 12 && t.field!.volley.at > 0; i++) {
      const r = applyBattleAction(t, { kind: 'turn', unit: t.active!, ...(t.active === 'b' ? { to: [5, 7] as const } : {}), act: { kind: 'none' }, face: 'N' })
      expect(r.error).toBeNull()
      all.push(...r.cues)
      t = r.state
    }
    expect(all.some((c) => c.kind === 'volley')).toBe(true)
    const volleyHits = all.filter((c) => c.kind === 'burn' && c.by === 'volley')
    expect(volleyHits.some((c) => c.kind === 'burn' && c.unit === 'a')).toBe(true)
    expect(volleyHits.some((c) => c.kind === 'burn' && c.unit === 'b')).toBe(false)
    expect(t.field!.volley.meter).toBe(0)
  })
  it('pins: a Muster hit on an arm costs that unit 10% hit until her next turn', () => {
    const sure = { ...RIG.trooper(), rightHand: { ...W.rifle, accuracy: 150 } }
    for (let i = 0; ; i++) {
      const s = setup([{ id: 'a', at: [3, 5], opts: { bands: slow, loadout: RIG.gunner() } }], [{ id: 'm', at: [3, 3], opts: muster({ bands: fast, loadout: sure }) }], { version: 2, factions: ['steel-muster'], seed: `p${i}` })
      const r = applyBattleAction(s, { kind: 'turn', unit: 'm', act: { kind: 'attack', with: 'right', target: 'a' }, face: 'S' })
      if (!r.cues.some((c) => c.kind === 'pinned')) continue
      // It costs her hit % for her counters and Crossfire until her own turn, which clears it.
      const before = strikeOf(s, 'a', 'right', 'm', [3, 5])!.hit
      expect(strikeOf(edit(s, 'a', (u) => { u.pinned = true }), 'a', 'right', 'm', [3, 5])!.hit).toBe(before - TUNING.muster.pinPenalty)
      expect(r.state.active === 'a' ? unitOf(r.state, 'a').pinned : true).not.toBe(false)
      if (r.state.active === 'a') expect(unitOf(r.state, 'a').pinned).toBeUndefined()
      break
    }
  })
})
