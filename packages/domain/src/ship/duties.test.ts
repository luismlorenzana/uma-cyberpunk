import { describe, expect, it } from 'vitest'
import { newMember } from '../crew/crew'
import { newSave, type Save } from '../save/save'
import { aptitude, autoAssign, likedDuty, mealOf, outputFactor, partnersOn, POSTS, shipPosts, stars, tenure, type Worker } from './duties'
import { shipWith } from './hull'
import { assignPost, drawEvent, GENERIC_EVENTS, resolveChoice, runDuties } from './watch'

const B = (o: Partial<Record<'speed' | 'stamina' | 'power' | 'guts' | 'wit', number>> = {}) =>
  ({ speed: 3, stamina: 3, power: 3, guts: 3, wit: 3, ...o }) as Worker['bands']
const T0 = '2026-11-13T00:00:00.000Z'
const worker = (over: Partial<Worker> = {}): Worker => ({ outfit: 1, bands: B(), role: 'striker', style: 'front', post: { module: 'log', index: 0, since: 1, mastery: 0 }, deployed: false, chief: null, liked: null, ...over })

describe('posts (TC67)', () => {
  it('a new game’s ship holds a post in each running room that has one', () => {
    const posts = shipPosts(shipWith(['bridge', 'hangar', 'quarters', 'log', 'engineering']))
    expect(posts.map((p) => p.kind)).toEqual(['pilot', 'archivist', 'engineer', 'mechanic'])
  })
  it('aptitude by thresholds: band 2 or less half, 3 the job, 4–5 the extra; the better of two bands counts', () => {
    expect(aptitude('archivist', B({ wit: 2 }))).toBe(1)
    expect(aptitude('archivist', B({ wit: 3 }))).toBe(2)
    expect(aptitude('archivist', B({ wit: 5 }))).toBe(3)
    expect(aptitude('engineer', B({ power: 1, wit: 4 }))).toBe(3)
  })
  it('each running style’s tenure curve', () => {
    expect([1, 2, 3, 4].map((w) => tenure('front', w))).toEqual([1, 1, 1, 1])
    expect([1, 2, 3, 4].map((w) => tenure('pace', w))).toEqual([1, 1, 1, 1])
    expect([1, 2, 3, 4].map((w) => tenure('late', w))).toEqual([1, 1, 1.5, 1.5]) // the bonus lands on her third watch
    expect([1, 2, 3, 6, 9].map((w) => tenure('end', w))).toEqual([1, 1.1, 1.2, 1.5, 1.5])
  })
  it('mastery stars at 3, 8 and 15 watches', () => {
    expect([0, 3, 8, 15, 40].map(stars)).toEqual([0, 1, 2, 3, 3])
  })
  it('a deployed Uma works at half, a Pace Chaser never; band 2 halves; a chief adds a quarter', () => {
    expect(outputFactor(worker(), 1)).toBe(1)
    expect(outputFactor(worker({ deployed: true }), 1)).toBe(0.5)
    expect(outputFactor(worker({ deployed: true, style: 'pace' }), 1)).toBe(1)
    expect(outputFactor(worker({ bands: B({ wit: 2 }) }), 1)).toBe(0.5)
    expect(outputFactor(worker({ chief: 'log' }), 1)).toBe(1.25)
  })
  it('the liked duty and the meal follow her best band', () => {
    expect(likedDuty(B({ wit: 5 }))).toBe('archivist')
    expect(mealOf(B({ stamina: 4 }))).toBe('stew')
    expect(mealOf(B({ power: 5 }))).toBe('feast')
  })
})

describe('auto-assign (TC68)', () => {
  const posts = shipPosts(shipWith(['bridge', 'hangar', 'quarters', 'log', 'engineering']))
  const c = (outfit: number, bands: Worker['bands'], strain = 0) => ({ outfit, bands, role: 'striker' as const, mastery: {}, liked: null, strain })
  it('fills posts with the best fits among those not deployed, deterministically', () => {
    const crew = [c(1, B({ wit: 5 })), c(2, B({ speed: 5 })), c(3, B({ power: 5 })), c(4, B())]
    const got = autoAssign(posts, crew, [4])
    expect(got.get(1)).toEqual({ module: 'log', index: 0 })
    expect(got.get(2)).toEqual({ module: 'bridge', index: 0 })
    expect(['hangar', 'engineering']).toContain(got.get(3)!.module)
    expect(got.has(4)).toBe(false)
    expect(autoAssign(posts, crew, [4])).toEqual(got)
  })
  it('sends an Uma at Strain 3 to the Med Bay first', () => {
    const withMed = shipPosts({ ...shipWith(['bridge', 'log', 'engineering']), modules: [...shipWith(['bridge', 'log', 'engineering']).modules, { id: 'medbay', deck: 1, slot: 0, level: 1, building: null }] })
    const got = autoAssign(withMed, [c(1, B({ wit: 5 }), 3)], [])
    expect(got.get(1)).toEqual({ module: 'medbay', index: 0 })
  })
  it('two Umas on one module’s posts are partners', () => {
    expect(partnersOn([{ outfit: 2, post: { module: 'bridge', index: 0 } }, { outfit: 1, post: { module: 'bridge', index: 1 } }, { outfit: 3, post: { module: 'log', index: 0 } }])).toEqual(['1-2'])
  })
})

describe('a watch’s duties', () => {
  const posted = (): Save => {
    let s: Save = { ...newSave('u', T0), crew: [newMember(1), newMember(2), { ...newMember(3), strain: 2 }] }
    s = assignPost(s, 1, { module: 'log', index: 0 })
    s = assignPost(s, 2, { module: 'hangar', index: 0 })
    return { ...s, watch: 1 }
  }
  const info = (o: number) => ({ bands: B(o === 1 ? { wit: 5 } : {}), role: 'striker' as const, style: o === 2 ? 'late' as const : null, liked: o === 1 ? 'archivist' as const : null })
  it('applies every post’s output to one card, the same every time', () => {
    const a = runDuties(posted(), info, {}, []), b = runDuties(posted(), info, {}, [])
    expect(a.log).toEqual(b.log)
    expect(a.log.lines.map((l) => l.post)).toEqual(['archivist', 'mechanic'])
    expect(a.log.gains).toEqual({ credits: 0, alloy: POSTS.mechanic.amount, data: Math.round(POSTS.archivist.amount * 1.5) })
    expect(a.save.wallet.data).toBe(posted().wallet.data + a.log.gains.data)
    expect(a.rapport.get(1)).toBe(5) // her liked duty
    expect(a.save.crew.find((m) => m.outfit === 1)!.post!.mastery).toBe(1)
  })
  it('a deployed Uma’s post makes half, and says so', () => {
    const r = runDuties(posted(), info, {}, [2])
    expect(r.log.lines.find((l) => l.outfit === 2)).toMatchObject({ half: true, text: `+${POSTS.mechanic.amount / 2} alloy` })
  })
  it('a Late Surger’s bonus lands on her third watch at the post', () => {
    let s = posted()
    const alloy: number[] = []
    for (let w = 1; w <= 3; w++) { const r = runDuties({ ...s, watch: w }, info, {}, []); alloy.push(r.log.gains.alloy); s = r.save }
    expect(alloy).toEqual([10, 10, 15])
  })
})

describe('jump events (TC66)', () => {
  it('one jump in three draws an event, the same for the same watch and world', () => {
    let drawn = 0
    for (let w = 0; w < 300; w++) if (drawEvent(w, 'sw1', GENERIC_EVENTS)) drawn++
    expect(drawn).toBeGreaterThan(70)
    expect(drawn).toBeLessThan(130)
    expect(drawEvent(5, 'sw2', GENERIC_EVENTS)).toEqual(drawEvent(5, 'sw2', GENERIC_EVENTS))
  })
  it('a check passes on the holder’s band, fails without a holder', () => {
    const choice = GENERIC_EVENTS.find((e) => e.id === 'debris-field')!.choices[0]!
    expect(resolveChoice(choice, B({ speed: 4 })).passed).toBe(true)
    expect(resolveChoice(choice, B({ speed: 3 })).passed).toBe(false)
    expect(resolveChoice(choice, null).reward).toEqual({ alloy: 5 })
  })
})
