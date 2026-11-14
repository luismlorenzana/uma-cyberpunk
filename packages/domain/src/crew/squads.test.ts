// Squads, operations, standing and readiness (CY18): the squads' rules, cohesion, operations' deterministic outcomes
// through the save, each faction's standing now, and a finale's unmet needs.
import { describe, expect, it } from 'vitest'
import { newMember } from './crew'
import {
  factionsOf, heroinesFreed, moveStandingIn, offeredOperations, operationById, powerOf, readinessNow, recallSquad, returnOperations, sendProblem, sendSquad,
  standingNow, systemsBuilt,
} from './operations'
import {
  cohesionAfter, cohesionLevel, firstSquad, genericOperations, leaveSquad, newSquad, outcomeOf, outcomePay, placeNewcomer, readinessOf, seedSquads, setSquad,
  squadOf, squadPower, squadProblem, SQUAD_TUNING, unmetNeeds, type Squad,
} from './squads'
import { newSave, type Save } from '../save/save'
import { parsePack } from '../story/parse'
import { STAND_IN_FILES } from '../story/stand-in'
import type { StoryPack } from '../story/types'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-13T00:00:00.000Z'
const A = 9000001, B = 9000002, C = 9000003, D = 9000004
const progress = (s: Save) => ({ missions: s.worlds.missions, chapters: [] as string[] })
const sq = (id: string, members: number[], cohesion = 0): Squad => ({ id, name: id, banner: 'cyan', leader: members[0]!, members, cohesion })

describe('squads (TC69)', () => {
  it('levels cohesion at 2, 5, 9, 14 and 20 battles', () => {
    expect([0, 1, 2, 4, 5, 9, 14, 19, 20, 99].map(cohesionLevel)).toEqual([0, 0, 1, 1, 2, 3, 4, 4, 5, 5])
  })
  it('makes a new game’s squad from the crew aboard, four at most', () => {
    expect(firstSquad([])).toEqual([])
    expect(firstSquad([A, B, C, D, 9000005])[0]).toMatchObject({ leader: A, members: [A, B, C, D], cohesion: 0 })
  })
  it('keeps an Uma in one squad, four members and four squads at most, a leader who’s a member', () => {
    const squads = [sq('a', [A, B])]
    expect(squadProblem(squads, sq('b', [B]))).toMatch(/another squad/)
    expect(squadProblem(squads, { ...sq('b', [C]), leader: D })).toMatch(/leader/)
    expect(squadProblem(squads, sq('b', [C, D, 9000005, 9000006, 9000007]))).toMatch(/One to 4/)
    expect(squadProblem(squads, { ...sq('b', [C]), name: ' ' })).toMatch(/name/)
    const four = [sq('a', [A]), sq('b', [B]), sq('c', [C]), sq('d', [D])]
    expect(squadProblem(four, sq('e', [9000005]))).toMatch(/4 squads/)
    expect(setSquad(squads, sq('b', [B]))).toEqual(squads)
    expect(setSquad(squads, { ...squads[0]!, name: 'Night Owls' })[0]!.name).toBe('Night Owls')
  })
  it('places newcomers as the stand-in brings them: a first squad, then the canonical Vanguard, then room in it', () => {
    const canonical = pack.casting.squads!
    let squads: Squad[] = []
    squads = placeNewcomer(squads, canonical, [C], C)
    expect(squads).toEqual([{ id: 'squad-1', name: 'First Squad', banner: 'cyan', leader: C, members: [C], cohesion: 0 }])
    squads = placeNewcomer(squads, canonical, [C, A], A)
    expect(squads.map((s) => s.members)).toEqual([[C, A]])
    squads = placeNewcomer(squads, canonical, [C, A, D], D)
    expect(squads).toEqual([{ id: 'sw-vanguard', name: 'Vanguard', banner: 'amber', leader: A, members: [A, C, D], cohesion: 0 }])
    squads = placeNewcomer(squads, canonical, [C, A, D, B], B)
    expect(squadOf(squads, B)!.id).toBe('sw-vanguard')
    // A canonical squad seeds once; a full crew of squads leaves a newcomer to the Quarters.
    expect(seedSquads(squads, canonical, [A, B, C, D])).toEqual(squads)
    const full = [sq('a', [1, 2, 3, 4]), sq('b', [5, 6, 7, 8]), sq('c', [9, 10, 11, 12]), sq('d', [13, 14, 15, 16])]
    expect(placeNewcomer(full, [], [17], 17)).toEqual(full)
  })
  it('never takes Umas from a squad away on an operation: the canonical squad doesn’t form, a newcomer skips it (CY19)', () => {
    const canonical = pack.casting.squads!
    const away = [{ id: 'squad-1', name: 'First Squad', banner: 'cyan', leader: C, members: [C, A], cohesion: 0 }]
    const placed = placeNewcomer(away, canonical, [C, A, D], D, ['squad-1'])
    expect(placed.find((s) => s.id === 'squad-1')!.members).toEqual([C, A])
    expect(placed.some((s) => s.id === 'sw-vanguard')).toBe(false)
    expect(squadOf(placed, D)!.id).toBe('squad-2')
    // With nobody away it would have formed from both squads.
    expect(seedSquads(placed, canonical, [C, A, D]).map((s) => s.id)).toEqual(['sw-vanguard'])
  })
  it('names a new squad by its order and a banner not yet flown; a leaver hands over or disbands', () => {
    expect(newSquad([sq('squad-1', [A])], B)).toMatchObject({ id: 'squad-2', name: 'Second Squad', banner: 'magenta', leader: B })
    expect(leaveSquad([sq('a', [A, B]), sq('b', [C])], A)).toEqual([{ ...sq('a', [B]), leader: B }, sq('b', [C])])
    expect(leaveSquad([sq('b', [C])], C)).toEqual([])
  })
  it('grows cohesion only for a squad with three or more members deployed', () => {
    const squads = [sq('a', [A, B, C, D]), sq('b', [9000005, 9000006])]
    expect(cohesionAfter(squads, [A, B, 9000005, 9000006]).map((s) => s.cohesion)).toEqual([0, 0])
    expect(cohesionAfter(squads, [A, B, C]).map((s) => s.cohesion)).toEqual([1, 0])
  })
})

describe('operations (TC70)', () => {
  it('gives each world two to four generic operations; only the raid names the world’s faction, and it costs standing', () => {
    for (const w of ['sw1', 'sw2', 'x', 'yy', 'zzz']) {
      const ops = genericOperations(w, 2, 'steel-muster')
      expect(ops.length).toBeGreaterThanOrEqual(2)
      expect(ops.length).toBeLessThanOrEqual(4)
      for (const o of ops) expect(o.faction === null ? o.reward.standing : o.reward.standing).toBe(o.faction ? -1 : 0)
    }
  })
  it('scores power from levels, bond ranks, cohesion and partner pairs, and the outcome against danger', () => {
    const s = sq('a', [A, B, C], 5) // cohesion level 2
    const power = squadPower(s, () => 3, () => 2, (a, b) => a === A && b === B)
    expect(power).toBe(3 * (3 + 4) + 3 * 2 + 4)
    expect(outcomeOf(23, 2)).toBe('partial')
    expect(outcomeOf(24, 2)).toBe('full')
    expect(outcomeOf(15, 2)).toBe('thin')
  })
  it('pays partial and thin as a share, standing only in full, a Strain each for less than full', () => {
    const op = genericOperations('sw1', 1, 'steel-muster').find((o) => o.faction)!
    expect(outcomePay(op, 'full')).toMatchObject({ credits: op.reward.credits, standing: -1, strain: 0 })
    expect(outcomePay(op, 'partial')).toMatchObject({ credits: Math.round(op.reward.credits * 0.6), standing: 0, strain: 1 })
    expect(outcomePay(op, 'thin')).toMatchObject({ credits: Math.round(op.reward.credits * 0.3), standing: 0, strain: 1 })
  })

  const crewSave = (): Save => {
    const s = newSave('u', T0)
    const crew = [A, B, C, D].map((o) => ({ ...newMember(o), xp: 400 }))
    return { ...s, crew, squads: [sq('alpha', [A, B, C], 5), sq('beta', [D])], worlds: { current: 'sw1', known: { sw1: { cleared: [] } }, missions: [] } }
  }

  it('offers the story’s operations (needs met, not won) beside the generic ones, four at most', () => {
    const s = crewSave()
    const ids = offeredOperations(pack, s, progress(s)).map((o) => o.id)
    expect(ids[0]).toBe('sw1-op-patrol')
    expect(ids).not.toContain('sw1-op-lines') // needs Chapter 1 on sw1
    expect(ids.length).toBeLessThanOrEqual(4)
    const later = offeredOperations(pack, s, { ...progress(s), chapters: ['sw1-ch1'] }).map((o) => o.id)
    expect(later.slice(0, 2)).toEqual(['sw1-op-patrol', 'sw1-op-lines'])
    expect(offeredOperations(pack, { ...s, operationsWon: ['sw1-op-patrol'] }, progress(s)).map((o) => o.id)).not.toContain('sw1-op-patrol')
  })
  it('sends a squad, keeps it out of a mission, and brings it back after its watches with a report', () => {
    let s = crewSave()
    const op = operationById(pack, s, 'sw1-op-patrol', progress(s))!
    s = sendSquad(s, s.squads[0]!, op)
    expect(s.operations).toEqual([{ id: 'sw1-op-patrol', squad: 'alpha', back: 2 }])
    expect(sendProblem(s, s.squads[0]!)).toMatch(/already away/)
    expect(returnOperations(pack, { ...s, watch: 1 }, progress(s)).reports).toEqual([])
    // Power: three at level 5, rank 1, cohesion level 2 → 3×(5+2)+6 = 27 ≥ 12 × danger 1: full.
    expect(powerOf(s, s.squads[0]!)).toBe(27)
    const r = returnOperations(pack, { ...s, watch: 2 }, progress(s))
    expect(r.reports).toEqual([expect.objectContaining({ op: 'sw1-op-patrol', squad: 'alpha', outcome: 'full', text: expect.stringMatching(/full success.*dock-union \+1/) })])
    expect(r.save.operations).toEqual([])
    expect(r.save.wallet.credits).toBe(s.wallet.credits + 80)
    expect(r.save.operationsWon).toEqual(['sw1-op-patrol'])
    expect(standingNow(pack, r.save)['dock-union']).toBe(1)
    expect(r.save.crew.every((m) => m.strain === 0)).toBe(true)
  })
  it('a thin squad comes back with less and a Strain each; a recall is thin at once; nobody is ever lost', () => {
    let s = crewSave()
    const op = operationById(pack, s, 'sw1-op-patrol', progress(s))!
    s = sendSquad(s, s.squads[1]!, op) // one Uma at level 5: power 7 < 8: thin
    const r = returnOperations(pack, { ...s, watch: 5 }, progress(s))
    expect(r.reports[0]!.outcome).toBe('thin')
    expect(r.save.crew.find((m) => m.outfit === D)!.strain).toBe(1)
    expect(r.save.crew).toHaveLength(4)
    expect(r.save.operationsWon).toEqual([])
    const recalled = recallSquad(pack, sendSquad(crewSave(), crewSave().squads[0]!, op), 'alpha', progress(s))
    expect(recalled.report).toMatchObject({ outcome: 'thin', text: expect.stringMatching(/recalled/) })
    expect(recalled.save.operations).toEqual([])
  })
  it('refuses a squad with a member resting or in the mission under way', () => {
    const s = crewSave()
    expect(sendProblem({ ...s, crew: s.crew.map((m) => (m.outfit === A ? { ...m, strain: 3 } : m)) }, s.squads[0]!)).toMatch(/resting/)
    expect(sendProblem({ ...s, mission: { id: 'm', chapter: 'c', step: 'deploy', squad: [B], battle: null, won: null } }, s.squads[0]!)).toMatch(/mission/)
  })
})

describe('standing and readiness (TC71, TC64)', () => {
  it('knows every faction; starts at the story’s value, −1 for one it doesn’t name', () => {
    expect(factionsOf(pack)).toEqual(['dock-union', 'steel-muster'])
    const s = newSave('u', T0)
    expect(standingNow(pack, s)).toEqual({ 'dock-union': 0, 'steel-muster': -2 })
    const unnamed = { ...pack, casting: { ...pack.casting, standing: undefined } }
    expect(standingNow(unnamed, s)).toEqual({ 'dock-union': -1, 'steel-muster': -1 })
  })
  it('moves within −2 to +2 and adds one once three of a faction’s heroines are freed', () => {
    let s = newSave('u', T0)
    s = moveStandingIn(pack, s, 'dock-union', 4)
    expect(standingNow(pack, s)['dock-union']).toBe(2)
    s = moveStandingIn(pack, s, 'steel-muster', -1)
    expect(standingNow(pack, s)['steel-muster']).toBe(-2)
    expect(heroinesFreed(pack, ['sw1-ch1-m1'])).toEqual(['stand-in-1'])
    const three = { ...pack, casting: { ...pack.casting, heroines: ['stand-in-1', 'h2', 'h3'].map((board) => ({ board, faction: 'steel-muster', hold: 'none' as const })) },
      chapters: { ...pack.chapters, x: { ...pack.chapters['sw1-ch1']!, missions: [{ ...pack.chapters['sw1-ch1']!.missions[0]!, id: 'x-m', enemies: [{ slot: 'boss' as const, pool: ['h2', 'h3'] }] }] } } }
    const freed = { ...s, worlds: { ...s.worlds, missions: ['sw1-ch1-m1', 'x-m'] } }
    expect(heroinesFreed(three, freed.worlds.missions)).toEqual(['h2', 'h3', 'stand-in-1'])
    expect(standingNow(three, freed)['steel-muster']).toBe(-1)
  })
  it('totals readiness from standings, operations won and systems built', () => {
    expect(readinessOf({ a: -2, b: 0 }, 2, 1)).toBe(0 + 2 * 2 + 3 * 2 + 4)
    const s = newSave('u', T0)
    expect(systemsBuilt(s)).toEqual([])
    expect(readinessNow(pack, s)).toBe(2 * 2 + 0)
  })
  it('lists a finale’s unmet needs, each with its harsh condition', () => {
    const needs = pack.chapters['sw2-ch2']!.missions[0]!.readiness!
    expect(unmetNeeds(needs, { systems: [], standing: { 'dock-union': 0 }, total: 0 }).map((n) => n.else)).toEqual(['fog', 'hazards'])
    expect(unmetNeeds(needs, { systems: ['sensors'], standing: { 'dock-union': 1 }, total: 0 })).toEqual([])
    expect(unmetNeeds([{ total: 20, else: 'no-reinforcements' }], { systems: [], standing: {}, total: 19 })).toHaveLength(1)
    expect(SQUAD_TUNING.standing.start).toBe(-1)
  })
})
