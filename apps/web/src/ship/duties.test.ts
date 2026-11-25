// Duties through the save (CY16): auto-assign fills the posts, presets keep arrangements, a mission's end writes one
// ship-log card with a deployed Uma at half, a jump may draw an event the pilot resolves.
import { assignPost, newMember, newSave, parsePack, parseSave, runDuties, STAND_IN_FILES, type Save, type StoryPack } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { crewViews, infoFrom } from '../crew/view'
import { closeResults, travel } from '../mission/director'
import { answerEvent, autoAssignSave, currentEvent, dutyInfoFrom, loadPreset, savePreset } from './duties'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-13T00:00:00.000Z'
const crewSave = (): Save => ({ ...newSave('u', T0), crew: [9000001, 9000002, 9000003, 9000004].map(newMember) })
const views = (s: Save) => crewViews(s, pack, infoFrom(null), (o) => `Uma ${o}`)

describe('duties through the save', () => {
  it('auto-assign fills every post of a new ship (four posts, four Umas)', () => {
    const s = autoAssignSave(crewSave(), views(crewSave()))
    expect(s.crew.filter((m) => m.post).length).toBe(4)
    expect(new Set(s.crew.filter((m) => m.post).map((m) => `${m.post!.module}:${m.post!.index}`)).size).toBe(4)
  })
  it('a preset keeps the arrangement and brings it back', () => {
    let s = autoAssignSave(crewSave(), views(crewSave()))
    s = savePreset(s, 0, 'Day')
    const posts = s.crew.map((m) => m.post?.module ?? null)
    s = { ...s, crew: s.crew.map((m) => ({ ...m, post: null })) }
    s = loadPreset(s, 0)
    expect(s.crew.map((m) => m.post?.module ?? null)).toEqual(posts)
    expect(s.dutyPresets[0]!.name).toBe('Day')
  })
  it('excludes a restricted guest from persisted presets, watches and live posts', () => {
    const ordinary = autoAssignSave(crewSave(), views(crewSave()))
    const first = ordinary.crew[0]!, post = first.post!
    const stale = parseSave({ ...savePreset(ordinary, 0, 'Day'), crew: ordinary.crew.map(member => member.outfit === first.outfit
      ? { ...member, heroine: 'adviser', expeditionOnly: true } : member) })
    expect(assignPost(stale, first.outfit, post)).toBe(stale)
    expect(savePreset(stale, 1, 'Night').dutyPresets[1]?.posts[first.outfit]).toBeUndefined()
    expect(loadPreset(stale, 0).crew[0]?.post).toBeNull()
    expect(autoAssignSave(stale, views(ordinary)).crew[0]?.post).toBeNull()
    expect(runDuties(stale, dutyInfoFrom(views(stale)), {}, []).log.lines.map(line => line.outfit)).not.toContain(first.outfit)
  })
  it('a mission’s end writes one ship-log card, the deployed Uma at half', () => {
    let s = autoAssignSave(crewSave(), views(crewSave()))
    const deployed = s.crew.find((m) => m.post)!.outfit
    s = { ...s, mission: { id: 'm', chapter: 'c', step: 'results', squad: [deployed], battle: null, won: false } }
    s = closeResults(s, pack, null, null, dutyInfoFrom(views(s)))
    expect(s.log!.lines).toHaveLength(4)
    expect(s.log!.lines.find((l) => l.outfit === deployed)!.half).toBe(true)
    expect(s.log!.read).toBe(false)
  })
  it('a jump draws an event one time in three; the pilot answers it', () => {
    let s = autoAssignSave(crewSave(), views(crewSave()))
    let drawn = 0, answered = false
    for (let i = 0; i < 9; i++) {
      s = travel({ ...s, event: null }, i % 2 ? 'sw1' : 'sw2', pack, { info: dutyInfoFrom(views(s)) })
      if (currentEvent(s, pack)) {
        drawn++
        const r = answerEvent(s, pack, views(s), 0)!
        expect(r.save.event).toBeNull()
        answered = true
      }
    }
    expect(drawn).toBeGreaterThan(0)
    expect(answered).toBe(true)
  })
})
