import { describe, expect, it } from 'vitest'
import { parseCampaignManagement } from './campaign-management'
import type { Scene } from './types'

const room: Scene = { id: 'room', place: 'bridge', trigger: { arrive: 'bridge' }, cast: [], steps: [{ kind: 'narrate', text: 'The route board is open.' }] }
const book = { quests: [{ id: 'opening', title: 'Opening', scene: 'room' }], projects: [], scenes: new Map([['room', room]]), assets: [{ id: 'plate', file: 'plate.png' }] }
const raw = () => ({ after: 'opening', locations: [{ id: 'bridge', title: 'Bridge', family: 'command', entry: { kind: 'module', module: 'bridge' },
  scene: 'room', visual: { slot: 'bridge-approved', asset: 'plate', fallback: 'plate' },
  states: { building: { slot: 'bridge-work-draft', fallback: 'plate' } } }],
  reports: [{ kind: 'refit-complete', subject: 'bridge', location: 'bridge', scene: 'room', fallback: 'room' }] })

describe('private management presentation contract', () => {
  it('accepts explicit unfinished art fallbacks without changing the economy or claiming a final image', () => {
    const config = parseCampaignManagement(raw(), book)
    expect(config.locations[0]!.states.building).toEqual({ slot: 'bridge-work-draft', fallback: 'plate' })
    expect(config.reports[0]!.kind).toBe('refit-complete')
  })
  it('rejects missing targets, duplicate rooms, undeclared states and unavailable exports', () => {
    for (const mutate of [
      (x: ReturnType<typeof raw>) => { x.locations[0]!.entry.module = 'imaginary' },
      (x: ReturnType<typeof raw>) => { x.locations[0]!.visual.fallback = 'missing' },
      (x: ReturnType<typeof raw>) => { x.reports[0]!.location = 'missing' },
      (x: ReturnType<typeof raw>) => { x.reports[0]!.subject = 'imaginary-drive' },
      (x: ReturnType<typeof raw>) => { x.locations.push(x.locations[0]!) },
    ]) {
      const value = raw(); mutate(value)
      expect(() => parseCampaignManagement(value, book)).toThrow()
    }
    expect(() => parseCampaignManagement({ ...raw(), locations: [{ ...raw().locations[0], states: { repaired: { slot: 'repaired', fallback: 'plate' } } }] }, book)).toThrow()
  })
  it('rejects hidden grants, nested battle/effect branches and fallbacks requiring an absent officer', () => {
    const invalid: Scene['steps'][] = [
      [{ kind: 'flag', flag: 'free-alloy', set: true }],
      [{ kind: 'choice', options: [{ text: 'Take it', then: [{ kind: 'join', outfit: 9000001 }] }] }],
      [{ kind: 'battle', mission: 'fake-transfer' }],
      [{ kind: 'call', call: 'reward' }],
      [{ kind: 'line', speaker: 9000001, text: 'I might be ashore.' }],
    ]
    for (const steps of invalid) expect(() => parseCampaignManagement(raw(), { ...book, scenes: new Map([['room', { ...room, steps }]]) })).toThrow()
  })
})
