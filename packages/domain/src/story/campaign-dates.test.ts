import { expect, it } from 'vitest'
import { parseCampaignDates } from './campaign-dates'
import { parsePack } from './parse'
import { STAND_IN_FILES } from './stand-in'
import type { Scene, StoryPack } from './types'

it('accepts a known shore port only on a milestone and preserves old unrestricted visits', () => {
  const story = parsePack(STAND_IN_FILES).pack as StoryPack
  const scenes = new Map(['first', 'decision', 'regular'].map(id => [id, {
    id, place: 'port', trigger: { arrive: 'port' }, cast: [{ outfit: 9000001 }], steps: id === 'decision'
      ? [{ kind: 'path', trust: [{ kind: 'narrate', text: 'Friends.' }], heart: [{ kind: 'narrate', text: 'Partners.' }] }]
      : [{ kind: 'narrate', text: 'Evening.' }],
  } as Scene]))
  const make = (port?: string) => [{ companion: 9000001, after: 'joined', awards: [], regular: { scene: 'regular', title: 'Chat' },
    milestones: [{ scene: 'first', title: 'Visit', rank: 1, rapport: 1, ...(port ? { port } : {}) }, { scene: 'decision', title: 'Decision', rank: 8, rapport: 0 }] }]
  const parse = (port?: string) => parseCampaignDates(make(port), story, scenes, new Set(['joined']), new Set(), new Set(), new Set(['harbour']))
  expect(parse()[0]?.milestones[0]?.port).toBeUndefined()
  expect(parse('harbour')[0]?.milestones[0]?.port).toBe('harbour')
  expect(() => parse('unknown')).toThrow(/unknown shore port/)
})
