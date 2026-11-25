import { PARTS_BY_ID, issuedCampaignRig, loadoutOf, type Rig, type RigSlot } from '@cyber/domain'
import type { UnitInput } from '@cyber/battle'
import { expect, it } from 'vitest'
import { composedClip, compositionFor, partVisual, visualOf } from './combat-sprite-composition'
import type { Clip, Layer, SpriteBundle, Track } from './combat-sprite-format'
import { paintComposition } from './combat-sprite-gear'

const sprite = { outfit: 9000101, composition: { body: 'mixed', blade: 'blade', rifle: 'rifle' } } as SpriteBundle
const unit = (rig: Rig) => ({
  ref: { kind: 'uma', id: String(sprite.outfit) },
  frozenRig: rig, loadout: loadoutOf(rig),
}) as UnitInput

it('assigns every live equipment ID a shared visual and resolves it from the frozen rig', () => {
  expect(Object.keys(partVisual).sort()).toEqual([...PARTS_BY_ID.keys()].sort())
  for (const part of PARTS_BY_ID.values()) {
    const slot: RigSlot = part.slot === 'hand' ? 'rightHand' : part.slot === 'arm' ? 'leftArm' : part.slot
    const rig = { ...issuedCampaignRig(), [slot]: part.id }
    expect(compositionFor(sprite, unit(rig))?.rig[slot], part.id).toBe(part.id)
    expect(visualOf(part.id)).toBeTruthy()
  }
})

it('keeps empty mounts empty and rejects unknown parts and outfit mismatches', () => {
  const rig = { ...issuedCampaignRig(), leftHand: null, rightHand: null, back: null }
  const input = unit(rig)
  expect(compositionFor(sprite, input)).toMatchObject({ left: undefined, right: undefined, back: undefined })
  expect(compositionFor(sprite, { ...input, frozenRig: { ...rig, back: 'back-unknown' } })).toBeUndefined()
  expect(compositionFor(sprite, { ...input, ref: { kind: 'uma', id: '9000102' } })).toBeUndefined()
})

it('only uses a two-hand pose when the frozen rules say the grip needs both arms', () => {
  const rig = issuedCampaignRig('hand-rifle')
  const frozen = unit(rig)
  expect(compositionFor(sprite, frozen)?.twoHand).toBe('right')
  const hand = frozen.loadout.rightHand!
  if (hand.kind !== 'weapon') throw new Error('Expected the issued rifle')
  expect(compositionFor(sprite, { ...frozen, loadout: { ...frozen.loadout, rightHand: { ...hand, twoHanded: false } } })?.twoHand).toBeUndefined()
})

const clip = (frame: string, cue?: string): Clip => ({ frames: [{ frame, ms: 50 }], loop: false,
  events: cue ? [{ frame: 0, cue }] : [] })
const tracks = (clips: Record<string, Clip>): SpriteBundle['motions'][string] => {
  const track: Track = { frames: {}, clips }
  return { S: track, W: track, N: track, E: track }
}
const fitted: SpriteBundle = { ...sprite, motions: {
  mixed: tracks({ idle: clip('mixed'), 'attack-left': clip('mixed-shot'), 'attack-back': clip('mixed-back', 'shot-pulse') }),
  'mixed-reverse': tracks({ idle: clip('reverse'), 'attack-right': clip('reverse-shot'), 'attack-left': clip('reverse-strike') }),
  rifle: tracks({ idle: clip('rifle'), 'idle-one-left': clip('rifle-left'), 'back-tech': clip('rifle-tech', 'emitter'),
    'walk-degraded': clip('limp'), 'down-damaged': clip('down-damaged') }),
  blade: tracks({ idle: clip('greatblade') }),
} }

it('uses native opposite-hand clips without reflecting the body and keeps legacy reflection', () => {
  const rig = { ...issuedCampaignRig('hand-pistol'), leftHand: 'hand-blade' }
  const composition = compositionFor(fitted, unit(rig))!
  expect(composedClip(fitted, composition, 'E', 'attack-right')).toMatchObject({
    track: fitted.motions['mixed-reverse']!.E, clip: clip('reverse-shot'), flip: false,
  })
  expect(composedClip(fitted, composition, 'W', 'attack-left')?.clip).toEqual(clip('reverse-strike'))
  const { 'mixed-reverse': _reverse, ...legacy } = fitted.motions
  expect(composedClip({ ...fitted, motions: legacy }, composition, 'E', 'attack-right')?.flip).toBe(true)
})

it('preserves native two-grip and surviving-arm poses during Back actions and damage recovery', () => {
  const composition = compositionFor(fitted, unit(issuedCampaignRig('hand-rifle', 'back-deck')))!
  expect(composedClip(fitted, composition, 'S', 'back-tech')?.clip).toEqual(clip('rifle-tech', 'emitter'))
  expect(composedClip(fitted, composition, 'S', 'back-tech-one-left')?.clip).toEqual(clip('rifle-left', 'emitter'))
  expect(composedClip(fitted, composition, 'S', 'attack-back')?.clip).toEqual(clip('rifle', 'shot-pulse'))
  expect(composedClip(fitted, composition, 'S', 'walk-degraded')?.clip).toEqual(clip('limp'))
  expect(composedClip(fitted, composition, 'S', 'down-damaged')?.clip).toEqual(clip('down-damaged'))
})

it('paints native reversed props and only draws the mounted effect on its resolved pulse', () => {
  const rig = compositionFor(fitted, unit({ ...issuedCampaignRig('hand-pistol', 'back-deck'), leftHand: 'hand-blade' }))!
  const cel: Layer = { page: 'test', rect: [0, 0, 1, 1], at: [0, 0] }
  const pistol: Layer = { ...cel, when: { slot: 'rightHand', part: 'hand-pistol' } }
  const blade: Layer = { ...cel, when: { slot: 'leftHand', part: 'hand-blade' } }
  const unusedBack: Layer = { ...cel, when: { slot: 'back', part: 'back-missiles' } }
  const deck: Layer = { ...cel, when: { slot: 'back', part: 'back-deck' } }
  const flash: Layer = { ...pistol, effect: true }
  const frame = { layers: [pistol, blade, unusedBack, deck, flash], anchors: {} }
  const ctx = new Proxy({}, { get: () => () => undefined }) as CanvasRenderingContext2D
  const selection = { ...composedClip(fitted, rig, 'E', 'attack-right')!, clip: clip('reverse-shot', 'shot-pulse') }
  const paint = (index: number) => {
    const drawn: Layer[] = []
    paintComposition(ctx, frame, selection, { rig, facing: 'E', hp: { core: 1, leftArm: 1, rightArm: 1, legs: 1 },
      action: 'attack-right', index, foot: [5, 5] }, layer => drawn.push(layer))
    return drawn
  }
  expect(paint(0)).toEqual([pistol, blade, deck, flash])
  expect(paint(1)).toEqual([pistol, blade, deck])
})
