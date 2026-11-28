import type { UnitInput } from '@cyber/battle'
import { issuedCampaignRig, type CampaignCombatSprite } from '@cyber/domain'
import { expect, it } from 'vitest'
import { completeSpriteSet } from './local-combat-sprites'

const file = { path: 'campaign/file.json', sha256: '0'.repeat(64), bytes: 1 }

it('uses one approved crew set with different hands and Back gear and with no frozen rig', () => {
  const outfit = 9000101
  const binding: CampaignCombatSprite = { outfit, manifest: file, placements: file, pages: [], loadouts: [
    { set: 'rifle', rigs: [{ left: null, right: 'hand-rifle', back: 'back-bulwark' }], encounters: [], attacks: ['right'] },
    { set: 'blade', rigs: [{ left: null, right: 'hand-greatblade', back: 'back-med' }], encounters: [], attacks: ['right'] },
  ] }
  const unit = { ref: { kind: 'uma', id: String(outfit) }, side: 'squad' } as UnitInput
  expect(completeSpriteSet(binding, unit)?.set).toBe('rifle')
  expect(completeSpriteSet(binding, { ...unit, frozenRig: issuedCampaignRig('hand-rifle', 'back-bulwark') })?.set).toBe('rifle')
  expect(completeSpriteSet(binding, { ...unit, frozenRig: issuedCampaignRig('hand-greatblade', 'back-med') })?.set).toBe('rifle')
  expect(completeSpriteSet(binding, { ...unit, ref: { kind: 'uma', id: '9000102' } })).toBeUndefined()
})

it('keeps an approved Lieutenant set when deployed gear and encounter templates vary', () => {
  const binding: CampaignCombatSprite = { outfit: 'lieutenant', form: 'standard', roles: ['sub-boss'],
    manifest: file, placements: file, pages: [], loadouts: [
      { set: 'range', rigs: [], encounters: ['commander'], attacks: ['right', 'back'] },
      { set: 'shield', rigs: [{ left: 'hand-tower', right: 'hand-blade' }], encounters: [], attacks: ['right'] },
      { set: 'medic', rigs: [{ left: null, right: 'hand-rifle', back: 'back-med' }], encounters: [], attacks: ['right'], medic: true },
    ] }
  const unit = { ref: { kind: 'heroine', id: 'lieutenant' }, side: 'squad',
    sprite: { role: 'sub-boss', form: 'standard' } } as UnitInput
  expect(completeSpriteSet(binding, { ...unit, frozenRig: issuedCampaignRig('hand-rifle', 'back-med') })?.set).toBe('shield')
  expect(completeSpriteSet(binding, { ...unit, side: 'enemy' })?.set).toBe('shield')
  expect(completeSpriteSet(binding, { ...unit, side: 'enemy', sprite: { ...unit.sprite!, fitting: 'commander' } })?.set).toBe('range')
  expect(completeSpriteSet(binding, { ...unit, sprite: { ...unit.sprite!, form: 'transformed' } })).toBeUndefined()
  expect(completeSpriteSet({ ...binding, loadouts: undefined }, unit)).toBeUndefined()
})

it('uses a General’s approved standard appearance on either approved side', () => {
  const binding: CampaignCombatSprite = { outfit: 'general', form: 'standard', roles: ['boss-enemy', 'boss-ally'],
    manifest: file, placements: file, pages: [],
    loadouts: [{ set: 'blade', rigs: [{ left: null, right: 'hand-greatblade', back: 'back-thruster' }], encounters: [], attacks: ['right'] }] }
  const unit = { ref: { kind: 'heroine', id: 'general' }, side: 'squad', sprite: { role: 'boss-ally', form: 'standard' },
    frozenRig: issuedCampaignRig('hand-arc-axe', 'back-thruster') } as UnitInput
  expect(completeSpriteSet(binding, unit)?.set).toBe('blade')
  expect(completeSpriteSet(binding, { ...unit, side: 'enemy', sprite: { role: 'boss-enemy', form: 'standard' } })?.set).toBe('blade')
  expect(completeSpriteSet(binding, { ...unit, side: 'enemy' })).toBeUndefined()
  expect(completeSpriteSet({ ...binding, roles: ['boss-ally'] }, { ...unit, side: 'enemy', sprite: { role: 'boss-enemy', form: 'standard' } })).toBeUndefined()
})

it('keeps an original opponent set on its approved encounter as weapons change', () => {
  const binding: CampaignCombatSprite = { outfit: 'test-court-regent', form: 'joined', roles: ['boss-enemy'],
    original: { actor: 'original-test-court-regent', rank: 'regents', court: 'silver', weaponBand: 'melee' },
    manifest: file, placements: file, pages: [],
    loadouts: [{ set: 'blade', rigs: [], encounters: ['guardian'], attacks: ['right'] }] }
  const unit = { ref: { kind: 'heroine', id: 'test-court-regent' }, side: 'enemy',
    sprite: { role: 'boss-enemy', form: 'standard', fitting: 'guardian' },
    loadout: { leftHand: null, rightHand: { kind: 'weapon', band: 'melee' } } } as UnitInput
  const rifle = { ...unit, loadout: { ...unit.loadout, rightHand: { ...unit.loadout.rightHand!, band: 'short' as const } } }
  expect(completeSpriteSet(binding, unit)?.set).toBe('blade')
  expect(completeSpriteSet(binding, rifle)?.set).toBe('blade')
  expect(completeSpriteSet(binding, { ...unit, ref: { kind: 'heroine', id: 'other' } })).toBeUndefined()
  expect(completeSpriteSet(binding, { ...unit, sprite: { ...unit.sprite!, fitting: 'backup' } })).toBeUndefined()
})
