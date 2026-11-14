// Squads, operations and standing through the director and the screens' helpers (CY18): moving Umas between squads,
// cohesion after battles and into the battle input, an operation over two watches with its report on the ship log, a
// standing step, and the stand-in finale's conditions.
import { startBattle, type BattleInput } from '@cyber/battle'
import { bestRig, loadoutOf, newMember, newSave, parsePack, parseSave, standingNow, STAND_IN_FILES, type Save, type StoryPack } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { lifeAboardInput, missionInput, squadCohesion } from '../mission/battleInput'
import { applyStep, cantDeploy, closeResults, defaultSquad, finaleConditions, finaleNeeds, nextFinale, passAWatch, travel } from '../mission/director'
import { expectedOutcome, offersNow, recallOperation, sendOperation } from '../ship/operations'
import { editSquad, moveProblem, moveToSquad } from './squads'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-13T00:00:00.000Z'
const A = 9000001, B = 9000002, C = 9000003, D = 9000004
const BANDS = { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 } as const
const roundTrip = (s: Save): Save => parseSave(JSON.parse(JSON.stringify(s)))
/** The stand-in's crew as the story brings them: C joins, A comes aboard, D joins, B comes aboard. */
function crewed(): Save {
  let s: Save = { ...newSave('u', T0), worlds: { current: 'sw1', known: { sw1: { cleared: [] }, sw2: { cleared: [] } }, missions: [] } }
  for (const [kind, outfit] of [['join', C], ['aboard', A], ['join', D], ['aboard', B]] as const) s = applyStep(s, pack, { kind, outfit })
  return { ...s, crew: s.crew.map((m) => ({ ...m, xp: 400 })) }
}

describe('squads on the Quarters deck', () => {
  it('seeds the stand-in’s Vanguard as its members come aboard, and the fourth joins it', () => {
    const s = crewed()
    expect(s.squads).toEqual([{ id: 'sw-vanguard', name: 'Vanguard', banner: 'amber', leader: A, members: [A, C, D, B], cohesion: 0 }])
  })
  it('moves an Uma to a new squad she leads, renames it, and keeps a squad away whole', () => {
    let s = moveToSquad(crewed(), B, 'new')
    expect(s.squads.map((q) => [q.id, q.members])).toEqual([['sw-vanguard', [A, C, D]], ['squad-1', [B]]])
    s = moveToSquad(s, D, 'squad-1')
    s = editSquad(s, 'squad-1', { name: '  Yard Crew ', leader: D })
    expect(s.squads[1]).toMatchObject({ name: 'Yard Crew', leader: D, members: [B, D] })
    expect(editSquad(s, 'squad-1', { name: '' })).toBe(s)
    s = moveToSquad(s, A, null)
    expect(s.squads[0]).toMatchObject({ leader: C, members: [C] })
    const away = sendOperation(pack, s, 'squad-1', 'sw1-op-patrol')
    expect(moveProblem(away, B, 'sw-vanguard')).toMatch(/away/)
    expect(moveProblem(away, C, 'squad-1')).toMatch(/away/)
    expect(moveToSquad(away, B, null)).toBe(away)
    expect(roundTrip(away)).toEqual(away)
  })
})

describe('cohesion', () => {
  it('grows a squad that fights with three or more of its members, won or lost, and goes into the battle input', () => {
    let s = crewed()
    for (let i = 0; i < 2; i++) {
      s = { ...s, mission: { id: 'sw1-ch1-m1', chapter: 'sw1-ch1', step: 'results', squad: [A, C, D], battle: { input: {}, actions: [] }, won: i === 0 } }
      s = closeResults(s, pack)
    }
    expect(s.squads[0]!.cohesion).toBe(2)
    const base = missionInput('sandbox-muster', [A, C, D, B].map((o) => ({ outfit: o, label: String(o), bands: BANDS, loadout: loadoutOf(bestRig('striker', BANDS)), stride: 'break' as const })), [], 'x')
    const input = lifeAboardInput(base, s, () => null)
    expect(input.cohesion).toEqual({ level: 1, leader: expect.any(String), members: expect.arrayContaining([expect.any(String)]) })
    expect(input.cohesion!.members).toHaveLength(4)
    expect(startBattle(input).state.v3?.orders).toBeDefined()
    // Fewer than three of a squad: no cohesion.
    expect(squadCohesion({ ...s, squads: [{ ...s.squads[0]!, members: [A, 9000005, 9000006] }] }, new Map([[A, 'u1']]))).toBeNull()
  })
})

describe('operations through the watches', () => {
  it('offers the patrol on sw1, shows the outcome, sends a squad that can’t deploy while away, and reports two watches later', () => {
    let s = moveToSquad(moveToSquad(crewed(), B, 'new'), D, 'squad-1')
    const offers = offersNow(pack, s)
    expect(offers.map((o) => o.id)).toContain('sw1-op-patrol')
    const patrol = offers.find((o) => o.id === 'sw1-op-patrol')!
    expect(expectedOutcome(s, 'squad-1', patrol)).toBe('full') // two at level 5, rank 1: 14 ≥ 12
    s = roundTrip(sendOperation(pack, s, 'squad-1', 'sw1-op-patrol'))
    expect(s.operations).toEqual([{ id: 'sw1-op-patrol', squad: 'squad-1', back: 2 }])
    expect(cantDeploy(s, B, [], null)).toMatch(/Away on an operation until watch 2/)
    const chapter = pack.chapters['sw2-ch1']!
    expect(defaultSquad(s, chapter, chapter.missions[0]!)).toEqual([B, C, A])
    // A watch: still away; posts at half while away (no posts here). Two: back, with a report on the ship log.
    s = roundTrip(passAWatch(s, pack))
    expect(s.operations).toHaveLength(1)
    s = roundTrip(travel(s, 'sw2', pack))
    expect(s.operations).toEqual([])
    expect(s.log!.reports).toEqual([expect.objectContaining({ op: 'sw1-op-patrol', outcome: 'full' })])
    expect(s.log!.gains.credits).toBeGreaterThanOrEqual(80)
    expect(s.log!.read).toBe(false)
    expect(standingNow(pack, s)['dock-union']).toBe(1)
    expect(s.operationsWon).toEqual(['sw1-op-patrol'])
    expect(offersNow(pack, s).map((o) => o.id)).not.toContain('sw1-op-patrol')
  })
  it('recalls a squad at once with thin rewards and a report', () => {
    let s = moveToSquad(crewed(), B, 'new')
    s = sendOperation(pack, s, 'squad-1', 'sw1-op-patrol')
    s = recallOperation(pack, s, 'squad-1')
    expect(s.operations).toEqual([])
    expect(s.log!.reports![0]).toMatchObject({ outcome: 'thin', text: expect.stringMatching(/recalled/) })
    expect(s.crew.find((m) => m.outfit === B)!.strain).toBe(1)
  })
})

describe('standing and the finale', () => {
  it('a standing step moves a faction within −2 to +2', () => {
    let s = crewed()
    expect(standingNow(pack, s)).toEqual({ 'dock-union': 0, 'steel-muster': -2 })
    s = applyStep(s, pack, { kind: 'standing', faction: 'dock-union', by: 1 })
    s = applyStep(s, pack, { kind: 'standing', faction: 'steel-muster', by: -1 })
    expect(standingNow(pack, roundTrip(s))).toEqual({ 'dock-union': 1, 'steel-muster': -2 })
  })
  it('names the stand-in finale; its briefing lists both needs and the unmet ones go into the battle', () => {
    let s = crewed()
    const f = nextFinale(pack, s)!
    expect(f.mission.id).toBe('sw2-ch2-m1')
    expect(finaleNeeds(pack, s, f.mission).map((n) => n.met)).toEqual([false, false])
    expect(finaleConditions(pack, s, f.mission)).toEqual(['fog', 'hazards'])
    s = applyStep(s, pack, { kind: 'standing', faction: 'dock-union', by: 1 })
    expect(finaleConditions(pack, s, f.mission)).toEqual(['fog'])
    const base = missionInput('high-ground', [A, C, D, B].map((o) => ({ outfit: o, label: String(o), bands: BANDS, loadout: loadoutOf(bestRig('striker', BANDS)), stride: 'break' as const })), [], 'y')
    const input: BattleInput = lifeAboardInput(base, s, () => null, finaleConditions(pack, s, f.mission))
    expect(input.conditions).toEqual(['fog'])
    expect(startBattle(input).state.v3).toBeDefined()
    // A non-finale mission has no needs.
    expect(finaleConditions(pack, s, pack.chapters['sw1-ch1']!.missions[0]!)).toEqual([])
    expect(newMember(A).outfit).toBe(A)
  })
})
