import { startBattle } from '@cyber/battle'
import { briefingReady, campaignCases, finaleAllies, newSave, parseSave, resumeCommand,
  type CampaignBook, type CampaignPair, type CommandEncounter, type Save } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { retry } from '../mission/director'
import { launchCommand } from './command'
import { recordPairScene } from './pair'
import { questAvailable } from './quests'
import { groundInput } from './training'

const ports = ['one', 'two', 'three', 'four', 'five']
const cases = ports.map((port) => ({ port, title: port, file: `${port}-evidence` }))
const pairs = ports.map((port): CampaignPair => ({
  id: port, after: 'opening', capture: 'capture', members: [{ outfit: 9, trust: 'first' }, { outfit: 10, trust: 'second' }],
  recovery: ['one', 'two'], testimony: 'testimony', release: 'release',
  bond: { scene: 'bond', romance: 'romance', friendship: 'friendship' },
  residency: { scene: 'rooms', shared: 'shared', separate: 'separate' },
  rooms: { shared: { move: 'move', visit: 'visit', morning: 'morning' }, separate: { move: 'move', visit: 'visit', morning: 'morning' } },
  home: { port, base: 'base', defense: 'defense', scene: `${port}-choice`, visit: 'visit', jobs: ['Engineer', 'Pilot'],
    resettle: { flag: `${port}-settled`, debrief: `${port}-local-debrief` }, stay: { flag: `${port}-stayed`, debrief: `${port}-ship-debrief` },
    support: { alloy: 1, provisions: 1, relay: 2 } },
}))
const reveal = { id: 'reveal', title: 'Briefing', scene: 'briefing', port: 'one', after: 'opening' }
const ending = { id: 'ending', title: 'Aftermath', scene: 'aftermath', port: 'one', after: 'breach' }
const book: CampaignBook = {
  opening: 'opening', draft: true, quests: [
    { id: 'opening', title: 'Opening', scene: 'start' }, reveal,
    { id: 'breach', title: 'Breach', scene: 'launch-breach', after: 'reveal', encounter: 'gate' }, ending,
  ], scenes: new Map(), assets: [], art: [], commands: new Map(), ground: new Map(), pairs,
  finale: { cases, reveal: reveal.id, approach: 'approach', breach: 'breach', ending: ending.id, preparation: { alloy: 4, integrity: 2 } },
  story: { casting: { schemaVersion: 1, leads: [], crewOrder: [], heroines: [], minor: [] }, worlds: {}, chapters: {}, bonds: {},
    calls: {}, events: {}, files: Object.fromEntries(cases.map(({ file }) => [file, { schemaVersion: 1, id: file,
      lines: [{ text: 'Recorded at the relay.', redacted: true }, { text: 'Verified at the gate.', redacted: true }] }])) },
}
const initial = () => {
  const save = newSave('captain', '2026-11-17T00:00:00Z')
  return { ...save, story: { ...save.story, seen: ['start'] } }
}

describe('campaign investigation and final operation', () => {
  it('confirms all five cases across differing orders and all residence combinations', () => {
    const orders = [pairs, [...pairs].reverse(), [...pairs.slice(2), ...pairs.slice(0, 2)]]
    for (const order of orders) for (let mask = 0; mask < 32; mask++) {
      let save = initial()
      let resettled = 0
      for (const [index, pair] of order.entries()) {
        const home = pair.home!
        const local = (mask & (1 << index)) !== 0
        if (local) resettled++
        const outcome = local ? home.resettle : home.stay
        save = { ...save, story: { ...save.story, flags: [...save.story.flags, outcome.flag], seen: [...save.story.seen, home.scene] } }
        expect(questAvailable(save, book, reveal, 'one')).toBe(false)
        save = recordPairScene(save, book, pair, outcome.debrief, [])
        expect(recordPairScene(save, book, pair, outcome.debrief, [])).toBe(save)
        expect(campaignCases(book, save.story).filter(({ ready }) => ready)).toHaveLength(index + 1)
      }
      const loaded = parseSave(JSON.parse(JSON.stringify(save)))
      expect(briefingReady(book, loaded.story)).toBe(true)
      expect(finaleAllies(book, loaded.story)).toBe(Math.min(3, resettled))
      expect(questAvailable(loaded, book, reveal, 'one')).toBe(true)
      expect(questAvailable(loaded, book, reveal, 'two')).toBe(false)
      const launched = { ...loaded, story: { ...loaded.story, seen: [...loaded.story.seen, reveal.scene, 'launch-breach'] } }
      expect(questAvailable(launched, book, ending, 'one')).toBe(false)
      expect(questAvailable({ ...launched, worlds: { ...launched.worlds, missions: ['gate'] } }, book, ending, 'one')).toBe(true)
    }
  })

  it('freezes escort and reinforced shuttle integrity, and pays once before a retry', () => {
    const encounter: CommandEncounter = { id: 'approach', enemy: 14, transport: 8, cost: { fuel: 2, provisions: 2 },
      threats: [{ section: 'fore', power: 4, fighters: 2 }], assault: { emitter: 4, disabledFlag: 'service', call: 'Emitter down' },
      calls: { fire: 'Fire', evade: 'Evade', intercept: 'Intercept', strike: 'Strike', brace: 'Brace', reroute: 'Reroute' } }
    const supply = { port: 'one', stores: {}, fuel: 3, provisions: 2, shortfall: 0, reliefDay: null }
    const save: Save = initial()
    const ready: Save = { ...save, wallet: { ...save.wallet, alloy: 4 },
      mission: { id: encounter.id, chapter: 'gate', squad: [], step: 'deploy', battle: null, won: null } }
    const prepared = { ashore: new Set<number>(), relay: 3, preparation: book.finale!.preparation }
    expect(launchCommand({ ...ready, wallet: { ...ready.wallet, alloy: 3 } }, supply, encounter, prepared).mission?.step).toBe('deploy')
    const launched = launchCommand(ready, supply, encounter, prepared)
    expect(launched.wallet.alloy).toBe(0)
    expect(launched.campaignSupply?.fuel).toBe(1)
    expect(launchCommand(launched, supply, encounter, prepared)).toBe(launched)
    const restarted = retry(parseSave(JSON.parse(JSON.stringify(launched))))
    expect(restarted.mission!.battle).toEqual(launched.mission!.battle)
    expect(resumeCommand(restarted.mission!.battle!.input, [])?.state.transport).toBe(13)
    expect(restarted.wallet).toEqual(launched.wallet)
    expect(launchCommand(ready, supply, encounter).mission?.battle?.input).toMatchObject({ transport: 8 })
  })

  it('files the case through its assigned pair when two homes share a port', () => {
    const owner = pairs[0]!
    const resident = pairs[1]!
    const neighbor = { ...resident, home: { ...resident.home!, port: owner.home!.port } }
    const entry = { ...cases[0]!, pair: owner.id }
    const shared = { ...book, pairs: [neighbor, owner], finale: { ...book.finale!, cases: [entry] } }
    const save = initial()
    save.story.seen.push(neighbor.home.scene, owner.home!.scene)
    save.story.flags.push(neighbor.home.resettle.flag, owner.home!.stay.flag)
    const nearby = recordPairScene(save, shared, neighbor, neighbor.home.resettle.debrief, [])
    expect(nearby.story.files[entry.file]).toBeUndefined()
    expect(briefingReady(shared, nearby.story)).toBe(false)

    const filed = recordPairScene(nearby, shared, owner, owner.home!.stay.debrief, [])
    expect(filed.story.files[entry.file]).toEqual([0, 1])
    expect(briefingReady(shared, filed.story)).toBe(true)
    expect(finaleAllies(shared, filed.story)).toBe(0)
  })

  it('deploys both final routes with two consoles and usable campaign weapon families', () => {
    for (const scenario of ['gate-breach', 'gate-service']) {
      const input = groundInput(scenario, 9, 'Lead', 'hand-lance', 'back-deck', undefined, [{ outfit: 10, label: 'Crew', rig: null }])
      expect(input.objective).toMatchObject({ kind: 'hack', count: 2 })
      expect(input.units[1]?.ref).toEqual({ kind: 'uma', id: '10' })
      expect(() => startBattle(input)).not.toThrow()
    }
    expect(() => startBattle(groundInput('foundry-command', 9, 'Lead', 'hand-marksman', 'back-sniper'))).not.toThrow()
    expect(() => startBattle(groundInput('greenhouse-command', 9, 'Lead', 'hand-arc-axe', 'back-thruster'))).not.toThrow()
  })
})
