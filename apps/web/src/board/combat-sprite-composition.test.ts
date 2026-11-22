import { PARTS_BY_ID, issuedCampaignRig, loadoutOf, type Rig, type RigSlot } from '@cyber/domain'
import type { UnitInput } from '@cyber/battle'
import { expect, it } from 'vitest'
import { compositionFor, partVisual, visualOf } from './combat-sprite-composition'
import type { SpriteBundle } from './combat-sprite-format'

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
