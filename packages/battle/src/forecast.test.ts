// The forecast against the resolution (CY4): the same functions, so the card's numbers are the result's, and its hit %
// matches the resolved hit rate over many seeds for every weapon band.
import { describe, expect, it } from 'vitest'
import { applyBattleAction } from './battle'
import { forecast, type Forecast } from './forecast'
import { RIG } from './fixtures'
import { setup } from './test-kit'
import type { Cue, Mount, UnitInput } from './types'

const fast = { speed: 5 as const, stamina: 5 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }
const sturdy = { speed: 2 as const, stamina: 5 as const, power: 3 as const, guts: 3 as const, wit: 3 as const }

function trial(seed: string, attacker: Partial<UnitInput>, mount: Mount, at: [number, number]) {
  const state = setup([{ id: 'a', at, opts: { bands: fast, ...attacker } }], [{ id: 'e', at: [3, 2], facing: 'N', opts: { bands: sturdy, loadout: RIG.trooper() } }], { seed })
  const turn = { kind: 'turn' as const, unit: 'a', act: { kind: 'attack' as const, with: mount, target: 'e' }, face: 'N' as const }
  const f = forecast(state, turn) as Forecast
  const r = applyBattleAction(state, turn)
  return { f, cues: r.cues }
}

const mainRolls = (cues: Cue[]) => cues.filter((c) => (c.kind === 'hit' || c.kind === 'miss') && c.unit === 'a')

describe('the forecast', () => {
  const bands: [string, Partial<UnitInput>, Mount, [number, number]][] = [
    ['Melee', {}, 'right', [3, 3]],
    ['Short', { loadout: RIG.gunner() }, 'right', [3, 4]],
    ['Long', { loadout: RIG.gunner() }, 'back', [3, 6]],
  ]
  for (const [name, attacker, mount, at] of bands) {
    it(`${name}: its hit % is within two points of the resolved rate over 2,000 seeds, and its damage is the result's`, () => {
      let hits = 0, rolls = 0, expected = 0
      for (let i = 0; i < 2000; i++) {
        const { f, cues } = trial(`seed-${i}`, attacker, mount, at)
        expected = f.attack!.hit
        for (const c of mainRolls(cues)) {
          rolls++
          if (c.kind === 'hit') {
            hits++
            expect(c.crit ? f.attack!.damage[1] : f.attack!.damage[0]).toBe(c.amount)
          }
        }
      }
      expect(Math.abs((hits / rolls) * 100 - expected)).toBeLessThanOrEqual(2)
    })
  }

  it('names who joins, who counters and the Charge they spend, as the result does', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: { ...fast, stamina: 3 } } }, { id: 'b', at: [3, 3] }], [{ id: 'e', at: [3, 4], opts: { bands: sturdy, loadout: RIG.brawler() } }])
    const turn = { kind: 'turn' as const, unit: 'a', act: { kind: 'attack' as const, with: 'right' as const, target: 'e' }, face: 'N' as const }
    const f = forecast(state, turn) as Forecast
    expect(f.crossfire.map((c) => [c.unit, c.how])).toEqual([['b', 'pincer']])
    expect(f.counter?.unit).toBe('e')
    expect(f.charge).toEqual({ b: 1, e: 1 })
    expect(f.attack?.facing).toBe('front')
    expect(f.timeline).toHaveLength(8)
    const r = applyBattleAction(state, turn)
    expect(r.cues).toContainEqual({ kind: 'crossfire', unit: 'b', target: 'e', how: 'pincer' })
    expect(r.cues.some((c) => c.kind === 'counter')).toBe(true)
  })

  it('lights the likely parts and says which will or may break', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }], [{ id: 'e', at: [3, 4], facing: 'N' }])
    const f = forecast(state, { kind: 'turn', unit: 'a', act: { kind: 'attack', with: 'right', target: 'e' }, face: 'N' }) as Forecast
    expect(f.attack?.facing).toBe('back')
    expect(f.attack?.parts[0]?.part).toBe('core')
    expect(f.attack?.parts.reduce((sum, p) => sum + p.chance, 0)).toBeCloseTo(f.attack!.hit, 0)
    expect(f.counter).toBeNull()
  })

  it('shows a Wait as Charge gained and an earlier next turn, and refuses what the reducer refuses', () => {
    const state = setup([{ id: 'a', at: [3, 5], opts: { bands: fast } }], [{ id: 'e', at: [7, 0] }])
    const f = forecast(state, { kind: 'turn', unit: 'a', act: { kind: 'wait' }, face: 'N' }) as Forecast
    expect(f.charge).toEqual({ a: -1 })
    expect(forecast(state, { kind: 'turn', unit: 'e', act: { kind: 'none' }, face: 'N' })).toEqual({ error: "it is not e's turn" })
  })
})
