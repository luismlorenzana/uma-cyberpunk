// The story format (CY9): the stand-in passes; each kind of error is refused with its file and path; the cross-file rules
// catch what one file can't; the story state's functions.
import { describe, expect, it } from 'vitest'
import { checkPack, sceneSeconds } from './check'
import { parseChapter, parseCasting, parsePack, parseWorld, StoryParseError } from './parse'
import { STAND_IN_FILES } from './stand-in'
import { emptyStory, fillFile, gainLead, seeScene, setAnomaly, setFlag } from './state'
import { STEP_KINDS, type StoryPack } from './types'

const standIn = (): StoryPack => {
  const r = parsePack(STAND_IN_FILES)
  if (!r.pack) throw new Error(r.errors.map((e) => e.message).join('\n'))
  return r.pack
}
const chapter = () => structuredClone(STAND_IN_FILES['chapters/sw1-ch1.json']) as Record<string, unknown> & { scenes: { steps: unknown[] }[] }
const pathOf = (fn: () => unknown): string => {
  try { fn() } catch (e) { if (e instanceof StoryParseError) return `${e.file}: ${e.path}`; throw e }
  throw new Error('no error')
}

describe('the stand-in', () => {
  it('parses, passes the check with no errors, and uses every step kind once at least', () => {
    const pack = standIn()
    expect(checkPack(pack).filter((f) => f.level === 'error')).toEqual([])
    const kinds = new Set<string>()
    const scan = (steps: { kind: string; options?: { then: unknown[] }[] }[]) => { for (const s of steps) { kinds.add(s.kind); for (const o of s.options ?? []) scan(o.then as never) } }
    for (const c of Object.values(pack.chapters)) { for (const s of c.scenes) scan(s.steps as never); scan(c.debrief.steps as never) }
    for (const call of Object.values(pack.calls)) for (const b of call.branches) scan(b.then as never)
    expect([...kinds].sort()).toEqual([...STEP_KINDS].sort())
  })
})

describe('the parser names the path of every error', () => {
  it('refuses a line over 160 characters, an unknown step, a bad slot key and unknown keys', () => {
    const long = chapter(); long.scenes[0]!.steps[1] = { line: { speaker: 'x', text: 'y'.repeat(161) } }
    expect(pathOf(() => parseChapter(long, 'chapters/sw1-ch1.json'))).toBe('chapters/sw1-ch1.json: scenes[0].steps[1].line.text')
    const unknown = chapter(); unknown.scenes[0]!.steps[0] = { dance: {} }
    expect(pathOf(() => parseChapter(unknown, 'c'))).toBe('c: scenes[0].steps[0]')
    const slot = chapter(); slot.scenes[0]!.steps[4] = { slot: { lines: { lead: 'x' }, fallback: 'y' } }
    expect(pathOf(() => parseChapter(slot, 'c'))).toBe('c: scenes[0].steps[4].slot.lines["lead"]')
    const extra = { ...chapter(), extra: 1 }
    expect(pathOf(() => parseChapter(extra, 'c'))).toBe('c: chapter')
    const noDanger = chapter(); delete (noDanger as Record<string, unknown>).danger
    expect(pathOf(() => parseChapter(noDanger, 'c'))).toBe('c: chapter.danger')
  })
  it('refuses bad ids, triggers, needs, objectives and holds', () => {
    const badNeed = chapter(); badNeed.needs = ['place:x']
    expect(pathOf(() => parseChapter(badNeed, 'c'))).toBe('c: needs[0]')
    const trig = chapter(); (trig.scenes[0] as Record<string, unknown>).trigger = { arrive: 'a', talk: 'b' }
    expect(pathOf(() => parseChapter(trig, 'c'))).toBe('c: scenes[0].trigger')
    const obj = chapter(); ((obj.missions as Record<string, unknown>[])[0]!.objective as Record<string, unknown>).kind = 'win'
    expect(pathOf(() => parseChapter(obj, 'c'))).toBe('c: missions[0].objective.kind')
    expect(pathOf(() => parseWorld({ schemaVersion: 1, id: 'W1', locations: [], factions: [] }, 'w'))).toBe('w: id')
    expect(pathOf(() => parseCasting({ schemaVersion: 1, leads: [], heroines: [{ board: 'a', faction: 'b', hold: 'chain' }] }, 'casting.json'))).toBe('casting.json: heroines[0].hold')
  })
  it('collects every file’s errors, and a file’s id must be its name', () => {
    const files = { ...STAND_IN_FILES, 'worlds/sw9.json': { schemaVersion: 1, id: 'sw1', locations: [], factions: [] } }
    const r = parsePack(files)
    expect(r.pack).toBeNull()
    expect(r.errors.map((e) => `${e.file}: ${e.path}`)).toEqual(['worlds/sw9.json: id'])
    expect(parsePack({}).errors.map((e) => e.file)).toEqual(['casting.json'])
  })
})

describe('the cross-file rules', () => {
  const broken = (change: (p: StoryPack) => void) => { const p = standIn(); change(p); return checkPack(p).filter((f) => f.level === 'error').map((f) => `${f.file} ${f.where}`) }
  it('every id resolves', () => {
    expect(broken((p) => { p.chapters['sw1-ch1']!.scenes[0]!.place = 'sw1-nowhere' })).toContain('chapters/sw1-ch1.json scenes[0].place')
    expect(broken((p) => { (p.chapters['sw1-ch1']!.scenes[1]!.steps[3] as { mission: string }).mission = 'm-x' })).toContain('chapters/sw1-ch1.json scenes[1].steps[3].battle')
    expect(broken((p) => { delete p.files['sw1-file-1'] })).toContain('chapters/sw1-ch1.json scenes[1].steps[1].file')
    expect(broken((p) => { p.chapters['sw1-ch1']!.leads = [1234] })).toContain('chapters/sw1-ch1.json leads[0]')
  })
  it('a Chapter 1 ends with aboard, and only a Chapter 1 has one; needs are real; a slot keys only leads', () => {
    expect(broken((p) => { p.chapters['sw1-ch1']!.scenes[2]!.steps.pop() })).toContain('chapters/sw1-ch1.json scenes')
    expect(broken((p) => { p.chapters['sw1-ch1']!.number = 2 })).toContain('chapters/sw1-ch1.json scenes')
    expect(broken((p) => { p.worlds['sw1']!.locations[2]!.needs = ['file:nope'] })).toContain('worlds/sw1.json locations[2].needs')
    expect(broken((p) => { (p.chapters['sw1-ch1']!.scenes[0]!.steps[4] as { lines: Record<string, string> }).lines = { 9000004: 'x' } })).toContain('chapters/sw1-ch1.json scenes[0].steps[4].slot.lines["9000004"]')
    expect(broken((p) => { p.chapters['sw1-ch1']!.scenes[1]!.steps.push({ kind: 'narrate', text: 'after' }) })).toContain('chapters/sw1-ch1.json scenes[1].steps[3]')
  })
  it('flags a scene likely over three minutes, a lead in fewer than two crossed paths, and a long Chapter 1, as todos', () => {
    const p = standIn()
    p.chapters['sw1-ch1']!.scenes[0]!.steps.push(...Array.from({ length: 30 }, () => ({ kind: 'line' as const, speaker: 'x', text: 'z'.repeat(150) })))
    const todos = checkPack(p).filter((f) => f.level === 'todo').map((f) => f.message)
    expect(todos.some((m) => /over three/.test(m))).toBe(true)
    expect(todos.some((m) => /crossed paths/.test(m))).toBe(true)
    expect(sceneSeconds({ steps: [{ kind: 'line', speaker: 1, text: 'x'.repeat(30) }] })).toBe(6)
  })
})

describe('the story state', () => {
  it('changes by pure functions, kept sorted', () => {
    let s = emptyStory()
    s = setFlag(setFlag(s, 'b'), 'a')
    s = gainLead(gainLead(s, 'l1'), 'l1')
    s = fillFile(fillFile(s, 'f', 2), 'f', 0)
    s = setAnomaly(s, 'x', true)
    s = seeScene(s, 's1')
    expect(s).toEqual({ flags: ['a', 'b'], leads: ['l1'], files: { f: [0, 2] }, anomalies: { x: true }, seen: ['s1'] })
    expect(setFlag(s, 'a', false).flags).toEqual(['b'])
  })
})
