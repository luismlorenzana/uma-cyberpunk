// The rooms and a world's map (CY10).
import { describe, expect, it } from 'vitest'
import { parsePack } from '../story/parse'
import { STAND_IN_FILES } from '../story/stand-in'
import { emptyStory, fillFile, seeScene } from '../story/state'
import type { StoryPack } from '../story/types'
import { finishedChapters, worldNodes } from '../worlds/map'
import { OPEN_FROM_START, ROOMS, roomView, roomsOpenedBy } from './rooms'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack

describe('the rooms', () => {
  it('lists seven, four open from the start', () => {
    expect(ROOMS.map((r) => r.name)).toEqual(['Bridge', 'Hangar', 'Quarters', 'Log', 'Store', 'Comms', 'Sim Pod'])
    expect(OPEN_FROM_START).toEqual(['bridge', 'hangar', 'quarters', 'log'])
  })
  it('names a locked room’s key from the casting, and opens it when that lead comes aboard', () => {
    const comms = ROOMS.find((r) => r.id === 'comms')!, simpod = ROOMS.find((r) => r.id === 'simpod')!
    const name = (o: number) => pack.casting.labels?.[String(o)] ?? String(o)
    expect(roomView(pack.casting, OPEN_FROM_START, comms, name)).toEqual({ room: comms, open: false, key: 'Opens when Lead A comes aboard' })
    expect(roomView(pack.casting, OPEN_FROM_START, simpod, name).key).toBe('Opens later in the story')
    expect(roomsOpenedBy(pack.casting, 9000001)).toEqual(['comms'])
  })
})

describe('a world’s map', () => {
  it('shows each node locked, available or cleared, with its danger and a locked node’s key', () => {
    const world = pack.worlds['sw1']!
    let story = emptyStory()
    const nodes = () => Object.fromEntries(worldNodes(pack, world, story, { missions: [], chapters: finishedChapters(pack, story) }).map((n) => [n.id, [n.state, n.danger, n.key]]))
    // Only what a tap would play now: the chapter's next scene, so the market waits for the docks (CY12).
    expect(nodes()).toEqual({ 'sw1-docks': ['available', 1, null], 'sw1-market': ['cleared', 1, null], 'sw1-underlevels': ['locked', 2, 'Find the Log File sw1-file-1'] })
    story = seeScene(story, 'sw1-ch1-s1')
    expect([nodes()['sw1-docks']![0], nodes()['sw1-market']![0]]).toEqual(['cleared', 'available'])
    // The market's scene ends on the battle step: the mission waits at the underlevels until it's won.
    story = fillFile(seeScene(story, 'sw1-ch1-s2'), 'sw1-file-1', 0)
    expect([nodes()['sw1-market']![0], nodes()['sw1-underlevels']![0]]).toEqual(['cleared', 'available'])
    expect(worldNodes(pack, world, story, { missions: ['sw1-ch1-m1'], chapters: [] }).find((n) => n.id === 'sw1-underlevels')!.state).toBe('cleared')
  })
})
