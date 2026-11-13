// The director, headless (CY10): the stand-in chapter played through on its rules, every step of a mission, and resume.
import { newSave, parsePack, parseSave, STAND_IN_FILES, type Save, type StoryPack } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import {
  afterMission, applyStep, atNode, chapterOf, closeResults, defaultSquad, deploy, ensureWorld, finishBattle, finishMission, lockedMembers, markSeen,
  reachableWorlds, recordAction, retry, startMission, toDeploy, travel, waiting,
} from './director'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-12T12:00:00.000Z'
const chapter = pack.chapters['sw1-ch1']!
const mission = chapter.missions[0]!
/** A save as it'd come back from the device: JSON and parsed, so nothing the save can't hold slips through. */
const roundTrip = (s: Save): Save => parseSave(JSON.parse(JSON.stringify(s)))

describe('the director', () => {
  it('starts a new game on the first lead’s world, with the first scene due at its node', () => {
    const save = ensureWorld(newSave('u', T0), pack)
    expect(save.worlds.current).toBe('sw1')
    const due = atNode(pack, save, 'sw1', 'sw1-docks')
    expect(due.kind === 'scene' && due.scene.id).toBe('sw1-ch1-s1')
    expect(atNode(pack, save, 'sw1', 'sw1-market').kind).toBe('none')
    expect(waiting(pack, save)?.text).toMatch(/sw1-docks/)
  })
  it('plays a chapter in order: the market’s scene after the docks’, the mission from its battle step', () => {
    let save = markSeen(ensureWorld(newSave('u', T0), pack), 'sw1-ch1-s1')
    const due = atNode(pack, save, 'sw1', 'sw1-market')
    expect(due.kind === 'scene' && due.scene.id).toBe('sw1-ch1-s2')
    save = markSeen(save, 'sw1-ch1-s2')
    const m = atNode(pack, save, 'sw1', 'sw1-underlevels')
    expect(m.kind === 'mission' && m.mission.id).toBe('sw1-ch1-m1')
    expect(chapterOf(pack, 'sw1-ch1-m1')?.id).toBe('sw1-ch1')
  })
  it('steps a mission through briefing, deploy, battle, results and aboard, each surviving the save', () => {
    let save = ensureWorld(newSave('u', T0), pack)
    save = roundTrip(startMission(save, chapter, mission))
    expect(save.mission).toMatchObject({ id: 'sw1-ch1-m1', step: 'briefing', squad: [9000001] })
    save = roundTrip(toDeploy(save))
    expect(save.mission?.step).toBe('deploy')
    save = roundTrip(deploy(save, { seed: 'sw1-ch1-m1:1' }))
    save = roundTrip(recordAction(recordAction(save, { kind: 'turn', n: 1 }), { kind: 'turn', n: 2 }))
    expect(save.mission?.battle?.actions).toHaveLength(2)
    save = roundTrip(finishBattle(save, false))
    expect(save.mission).toMatchObject({ step: 'results', won: false })
    save = roundTrip(retry(save))
    expect(save.mission).toMatchObject({ step: 'battle', won: null })
    expect(save.mission?.battle?.actions).toEqual([])
    save = roundTrip(closeResults(finishBattle(save, true)))
    expect(save.mission?.step).toBe('aboard')
    expect(save.worlds.missions).toEqual(['sw1-ch1-m1'])
    const next = afterMission(pack, markSeen(markSeen(save, 'sw1-ch1-s1'), 'sw1-ch1-s2'), 'sw1', 'sw1-ch1-m1')
    expect(next.kind === 'scene' && next.scene.id).toBe('sw1-ch1-s3')
    expect(roundTrip(finishMission(save)).mission).toBeNull()
  })
  it('a loss ends the mission without counting it', () => {
    const save = closeResults(finishBattle(deploy(startMission(newSave('u', T0), chapter, mission), {}), false))
    expect(save.mission).toBeNull()
    expect(save.worlds.missions).toEqual([])
  })
  it('brings crew aboard: join adds her, aboard adds the lead and opens her rooms', () => {
    let save = newSave('u', T0)
    save = applyStep(save, pack, { kind: 'join', outfit: 9000003 })
    save = applyStep(save, pack, { kind: 'aboard', outfit: 9000001 })
    expect(save.crew).toEqual([9000003, 9000001])
    expect(save.ship.rooms).toContain('comms')
    save = applyStep(save, pack, { kind: 'lead', lead: 'x' })
    expect(save.story.leads).toEqual(['x'])
  })
  it('picks the squad: the chapter’s leads (locked), then the crew, four at most; a flash-forward’s fixed squad', () => {
    const save = { ...newSave('u', T0), crew: [9000002, 9000003, 9000004, 9000005] }
    expect(defaultSquad(save, chapter, mission)).toEqual([9000001, 9000002, 9000003, 9000004])
    expect(lockedMembers(chapter, mission)).toEqual([9000001])
    expect(defaultSquad(save, chapter, { ...mission, fixedSquad: [9000004] })).toEqual([9000004])
  })
  it('opens a new world on the star map once a chapter’s key is met, and travels', () => {
    let save = ensureWorld(newSave('u', T0), pack)
    expect(reachableWorlds(save, pack)).toEqual([])
    for (const s of chapter.scenes) save = markSeen(save, s.id)
    expect(reachableWorlds(save, pack)).toEqual(['sw2'])
    save = travel(save, 'sw2')
    expect(save.worlds.current).toBe('sw2')
    expect(Object.keys(save.worlds.known)).toEqual(['sw1', 'sw2'])
  })
  it('says on the ship what’s waiting', () => {
    const save = toDeploy(startMission(newSave('u', T0), chapter, mission))
    expect(waiting(pack, save)).toEqual({ text: 'Continue sw1-ch1-m1: deploying the squad', to: '/mission' })
  })
})
