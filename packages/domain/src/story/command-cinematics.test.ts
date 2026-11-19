import { describe, expect, it } from 'vitest'
import { parseCommandCinematics } from './command-cinematics'
import { STAND_IN_FILES } from './stand-in'
import { parseCampaignBook } from './campaign'
import type { Scene } from './types'

const parsed = parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': { schemaVersion: 1, opening: 'opening', draft: true,
  quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' }], assets: [{ id: 'plate', file: 'plate.png' }], art: [] } })
const room: Scene = { id: 'context', place: 'bridge', trigger: { arrive: 'bridge' }, cast: [], steps: [{ kind: 'narrate', text: 'The watch reads the protected route.' }] }
const command = { id: 'escort', cost: { fuel: 1, provisions: 1 }, enemy: 5, transport: 6, threats: [{ section: 'fore' as const, power: 1, fighters: 0 }],
  calls: { evade: 'Turn', brace: 'Brace', fire: 'Fire', intercept: 'Screen', strike: 'Strike', reroute: 'Power' } }
const book = { ...parsed, commands: new Map([['escort', command]]), scenes: new Map([['context', room]]) }
const raw = () => ({ stations: [{ station: 'pilot', backdrop: 'plate' }], actors: [{ speaker: 9000001, role: 'crew', base: 'plate', poseSlot: 'officer-operating' }],
  encounters: [{ encounter: 'escort', objective: 'Relief craft', preparation: 'context' }] })

describe('command cinematic private bindings', () => {
  it('accepts independent neutral art and a named pending operating pose slot', () => {
    const config = parseCommandCinematics(raw(), book)
    expect(config.actors[0]!.pose).toBeUndefined()
    expect(config.actors[0]!.poseSlot).toBe('officer-operating')
  })
  it('rejects missing identities/images, duplicates and unsupported emitter scenes', () => {
    for (const mutate of [
      (x: ReturnType<typeof raw>) => { x.actors[0]!.speaker = 9999999 },
      (x: ReturnType<typeof raw>) => { x.actors[0]!.base = 'missing' },
      (x: ReturnType<typeof raw>) => { x.encounters[0]!.encounter = 'missing' },
      (x: ReturnType<typeof raw>) => { x.actors.push(x.actors[0]!) },
    ]) { const x = raw(); mutate(x); expect(() => parseCommandCinematics(x, book)).toThrow() }
    expect(() => parseCommandCinematics({ ...raw(), encounters: [{ ...raw().encounters[0], disabled: 'context' }] }, book)).toThrow('emitter')
    expect(() => parseCommandCinematics({ ...raw(), encounters: [{ ...raw().encounters[0], commander: 9000001 }] }, book)).toThrow('enemy-role')
  })
  it('refuses cinematic dialogue that grants state or hides an action in a choice', () => {
    for (const steps of [[{ kind: 'join', outfit: 9000001 }], [{ kind: 'choice', options: [{ text: 'Confirm', then: [{ kind: 'flag', flag: 'free-victory', set: true }] }] }]] as Scene['steps'][]) {
      expect(() => parseCommandCinematics(raw(), { ...book, scenes: new Map([['context', { ...room, steps }]]) })).toThrow('no gameplay effects')
    }
  })
  it('uses the shared composition format for full CG, profiles and outcome-selected art while bounding FX layers', () => {
    const layer = { asset: 'plate', x: 0, y: 0, width: 844, height: 390 }
    const composition = { width: 844, height: 390, portraits: 'show', layers: [layer] }
    const value = { ...raw(), actors: [{ ...raw().actors[0], composition }], effects: [{ kind: 'hit', slot: 'hit-mark', composition }] }
    expect(parseCommandCinematics(value, book).actors[0]!.composition!.layers[0]!.fit).toBe('contain')
    expect(parseCommandCinematics(value, book).effects![0]!.kind).toBe('hit')
    expect(() => parseCommandCinematics({ ...value, effects: [{ kind: 'arrival', slot: 'arrival', composition }] }, book)).toThrow('unknown resolved effect')
    expect(() => parseCommandCinematics({ ...value, effects: [{ kind: 'hit', slot: 'hit', composition: { ...composition, layers: [layer, layer, layer] } }] }, book)).toThrow('at most two')
  })
})
