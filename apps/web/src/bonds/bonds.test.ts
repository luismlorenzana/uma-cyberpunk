// Bonds headless (CY13): the story's gates, the catch-up, a battle's rapport from its own cues, replies, a bond scene's
// effects, and the scene that's ready; the runner's captain and path steps under each Romance setting.
import { applyBattleAction, chooseTurn, startBattle, type BattleAction } from '@cyber/battle'
import { newMember, newSave, parsePack, seeScene, STAND_IN_FILES, type Save, type StoryPack } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { missionInput } from '../mission/battleInput'
import { playScene, type SceneUi } from '../story/runner'
import { afterBattleBonds, applyBondEffect, bondSceneDone, gateOpenFor, giveRapport, readyBondScene, replyTo, settleBonds } from './bonds'
import { battleRapport } from './battleRapport'
import { messageFor } from './messages'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-13T00:00:00.000Z'
const crewSave = (...outfits: number[]): Save => ({ ...newSave('u', T0), crew: outfits.map(newMember) })
const bondOf = (s: Save, o: number) => s.crew.find((m) => m.outfit === o)!.bond

describe('bonds with the story (TC56)', () => {
  it('waits at rank 3 until the story opens rank 4, then lands it with the rapport kept', () => {
    let s = giveRapport(crewSave(9000001), pack, 9000001, 600)
    expect(gateOpenFor(pack, s)(4)).toBe(false) // rank 4 waits on chapter:sw1-ch1
    expect(bondOf(s, 9000001).rank).toBe(3)
    for (const sc of pack.chapters['sw1-ch1']!.scenes) s = { ...s, story: seeScene(s.story, sc.id) }
    expect(gateOpenFor(pack, s)(4)).toBe(true)
    s = settleBonds(s, pack)
    expect(bondOf(s, 9000001).rank).toBe(4)
    expect(settleBonds(s, pack)).toBe(s) // nothing more to land: the same save
  })
  it('doubles rapport for an Uma below the crew’s median rank', () => {
    let s = crewSave(9000001, 9000002, 9000003)
    s = giveRapport(s, null, 9000001, 300) // rank 3
    s = giveRapport(s, null, 9000002, 300) // rank 3; the median is now 3
    s = giveRapport(s, null, 9000003, 50) // below the median: counts 100, so rank 2
    expect(bondOf(s, 9000003).rank).toBe(2)
  })
  it('reads a battle’s rapport from its cues: everyone who fought, once each for a cover and a Crossfire', () => {
    const units = [9000001, 9000003].map((o) => ({ outfit: o, label: `Uma ${o}`, bands: { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 } as const, loadout: startBattle(missionInput('sandbox-muster', [], [], 'x')).state.input.units[0]!.loadout, stride: null }))
    const input = missionInput('sandbox-muster', units, [], 'bonds:1')
    let state = startBattle(input).state
    const actions: BattleAction[] = []
    for (let i = 0; i < 400 && !state.result; i++) { const a = chooseTurn(state); actions.push(a); state = applyBattleAction(state, a).state }
    const gains = battleRapport(input, actions)
    expect([...gains.keys()].sort()).toEqual([9000001, 9000003])
    for (const g of gains.values()) expect(g).toBeGreaterThanOrEqual(20)
    for (const g of gains.values()) expect(g).toBeLessThanOrEqual(40)
    const after = afterBattleBonds(crewSave(9000003), pack, gains)
    expect(after.inbox).toEqual([9000003]) // only the Uma aboard writes
    expect(bondOf(after, 9000003).rapport).toBe(gains.get(9000003))
  })
  it('pays a reply once and reads the message', () => {
    const s = { ...crewSave(9000003), inbox: [9000003] }
    const replied = replyTo(s, pack, 9000003)
    expect([bondOf(replied, 9000003).rapport, replied.inbox]).toEqual([15, []])
    expect(replyTo(replied, pack, 9000003)).toBe(replied)
    expect(messageFor(9000003, 4)).toBe(messageFor(9000003, 4))
  })
  it('offers her bond scene once she reaches its rank, takes its rapport and path, and marks it seen', () => {
    let s = crewSave(9000001)
    expect(readyBondScene(pack, s.crew[0]!)).toBeNull()
    s = giveRapport(s, pack, 9000001, 100)
    expect(readyBondScene(pack, s.crew[0]!)).toBe(2)
    s = applyBondEffect(s, pack, 9000001, { kind: 'rapport', amount: 20 })
    s = applyBondEffect(s, pack, 9000001, { kind: 'path', path: 'heart' })
    s = bondSceneDone(s, 9000001, 2)
    expect(bondOf(s, 9000001)).toMatchObject({ rank: 2, rapport: 20, path: 'heart', seen: [2] })
    expect(readyBondScene(pack, s.crew[0]!)).toBeNull()
    expect(readyBondScene(pack, newMember(9000004))).toBeNull() // no bond file
  })
})

describe('the runner’s captain and path steps', () => {
  const scene = pack.bonds['9000001']!.scenes.find((s) => s.rank === 8)!
  const run = async (romance: 'ask' | 'friends', pick: 'trust' | 'heart') => {
    const effects: unknown[] = []
    const lines: string[] = []
    const ui: SceneUi = {
      line: async (_s, text) => { lines.push(text) }, emote: async () => {}, wait: async () => {}, choose: async () => 0, call: async () => 0, battle: async () => {}, effect: () => {},
      captain: async () => 0, path: async () => pick, bond: (e) => { effects.push(e) },
    }
    await playScene(scene, ui, { pack, squad: [], skipping: () => false, stopSkipping: () => {}, romance })
    return { effects, lines }
  }
  it('plays the branch picked, and reports the path', async () => {
    const heart = await run('ask', 'heart')
    expect(heart.effects).toEqual([{ kind: 'path', path: 'heart' }])
    expect(heart.lines.at(-1)).toMatch(/walk the deck/)
  })
  it('takes Trust without asking under Friends only', async () => {
    const friends = await run('friends', 'heart')
    expect(friends.effects).toEqual([{ kind: 'path', path: 'trust' }])
    expect(friends.lines.at(-1)).toMatch(/Partners/)
  })
  it('gives a captain’s choice its rapport', async () => {
    const effects: unknown[] = []
    const ui: SceneUi = { line: async () => {}, emote: async () => {}, wait: async () => {}, choose: async () => 0, call: async () => 0, battle: async () => {}, effect: () => {}, captain: async () => 1, bond: (e) => { effects.push(e) } }
    await playScene(pack.bonds['9000001']!.scenes[0]!, ui, { pack, squad: [], skipping: () => false, stopSkipping: () => {} })
    expect(effects).toEqual([{ kind: 'rapport', amount: 10 }])
  })
})
