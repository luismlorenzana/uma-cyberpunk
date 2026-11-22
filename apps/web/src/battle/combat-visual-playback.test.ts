import { expect, it } from 'vitest'
import { attackFrames } from './combat-visual-playback'
import type { Clip } from '../board/combat-sprite-format'

const rifle: Clip = {
  frames: Array.from({ length: 9 }, (_, i) => ({ frame: String(i), ms: 20 })), loop: false,
  events: [2, 4, 6].map(frame => ({ frame, cue: 'shot-pulse' })),
}

it('hits the real pulse budget and omits the unused firing cels before recovery', () => {
  expect(attackFrames(rifle, 1)).toEqual({ frames: [0, 1, 2, 7, 8], pulses: [40] })
  expect(attackFrames(rifle, 3)).toEqual({ frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], pulses: [40, 80, 120] })
  expect(attackFrames(rifle, 5)).toEqual({ frames: [0, 1, 2, 3, 4, 5, 6, 5, 6, 5, 6, 7, 8], pulses: [40, 80, 120, 160, 200] })
})
