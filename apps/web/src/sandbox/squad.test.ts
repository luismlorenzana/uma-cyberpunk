// The sandbox's squad, headless (D19): tier 1's picks fill the squad slots with their bands, Stride and best rig; the rest
// of tier 1 is the bench, each role once; a slot with no pick keeps its stand-in.
import { startBattle, scenarioInput, type BattleInput } from '@cyber/battle'
import { bandsOf, bestRig, loadoutOf, type OutfitInfo } from '@cyber/domain'
import type { ArtIndex } from '@luismlorenzana/uma-data'
import { describe, expect, it } from 'vitest'
import { TIER_1 } from '../crew/tier1'
import { infoFrom } from '../crew/view'
import { SCENARIOS } from '../mission/battleInput'
import { applyPicks, defaultPicks, pickView } from './squad'
import maps from '../../../../scenarios/maps/underlevels-14.json'

// Invented numbers for the tier 1 ids (the real ones come from master data at run time): alternating spreads and styles.
const STYLES: OutfitInfo['strategy'][] = [
  { front: 'A', pace: 'B', late: 'C', end: 'D' }, { front: 'C', pace: 'A', late: 'B', end: 'D' },
  { front: 'D', pace: 'C', late: 'A', end: 'B' }, { front: 'G', pace: 'G', late: 'B', end: 'A' },
]
const info = infoFrom(new Map(TIER_1.map((o, i) => [o, { stats: { speed: 130 - i, stamina: 100 + i, power: 110, guts: 100, wit: 110 - i }, strategy: STYLES[i % 4]! }])))
const name = (o: number) => `Uma ${o}`
const input = (): BattleInput => scenarioInput(SCENARIOS['sandbox-muster']!, maps as never, 1)
const art = (withSets: number[]): ArtIndex => ({ images: {}, atlases: {}, sprites: Object.fromEntries(withSets.map((o) => [String(o), `art/${o}.json`])) }) as unknown as ArtIndex

describe('the sandbox squad', () => {
  it('starts with four tier 1 Umas, those with their chibis first', () => {
    expect(defaultPicks(art([TIER_1[7]!, TIER_1[2]!])).map((p) => p?.outfit)).toEqual([TIER_1[2], TIER_1[7], TIER_1[0], TIER_1[1]])
    expect(defaultPicks(null).map((p) => p?.outfit)).toEqual(TIER_1.slice(0, 4))
  })

  it('fills the squad slots with her bands, Stride and the best rig for her role; the rest of tier 1 is the bench, each role once', () => {
    const picks = [{ outfit: TIER_1[0]!, role: null }, null, { outfit: TIER_1[3]!, role: 'medic' as const }]
    const out = applyPicks(input(), picks, info, name)
    const squad = out.units.filter((u) => u.side === 'squad')
    expect(squad.map((u) => u.ref)).toEqual([{ kind: 'uma', id: String(TIER_1[0]) }, { kind: 'standin', id: 'striker-a' }, { kind: 'uma', id: String(TIER_1[3]) }, input().units.filter((u) => u.side === 'squad')[3]!.ref])
    const first = squad[0]!
    const bands = bandsOf({ speed: 130, stamina: 100, power: 110, guts: 100, wit: 110 })
    expect([first.label, first.bands, first.stride]).toEqual([`Uma ${TIER_1[0]}`, bands, 'break'])
    expect(first.loadout).toEqual(loadoutOf(bestRig('striker', bands)))
    expect(squad[2]!.loadout.back.kind).toBe('med')
    expect(new Set(out.bench).size).toBe(out.bench!.length)
    expect(out.bench!.length).toBeGreaterThan(0)
    expect(() => startBattle(out)).not.toThrow()
  })

  it('leaves the scenario as it is when no slot has a pick', () => {
    expect(applyPicks(input(), [null, null], info, name)).toEqual(input())
  })

  it('takes the role picked over her style’s, and her style’s by default', () => {
    expect(pickView({ outfit: TIER_1[1]!, role: null }, info, name).role).toBe('vanguard')
    expect(pickView({ outfit: TIER_1[1]!, role: 'gunner' }, info, name).rig.back).toMatch(/^back-(missiles|mortar)$/)
  })
})
