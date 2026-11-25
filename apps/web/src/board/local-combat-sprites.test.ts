import { issuedCampaignRig, type CampaignCombatSprite } from '@cyber/domain'
import { expect, it } from 'vitest'
import { matchCombatFitting, matchesSpriteBinding } from './local-combat-sprites'

it('selects the frozen fitting and falls back for legacy and unknown gear', () => {
  const outfit = 9000101
  const rifle = { id: 'rifle', label: 'Rifle', motion: 'rifle', rig: issuedCampaignRig() }
  const med = { id: 'med', label: 'Med', motion: 'med', rig: issuedCampaignRig('hand-rifle', 'back-med') }
  const bundle = { outfit, fittings: [rifle, med] }
  const ref = { kind: 'uma', id: String(outfit) } as const
  expect(matchCombatFitting(bundle, { ref, frozenRig: rifle.rig })).toBe(rifle)
  expect(matchCombatFitting(bundle, { ref, frozenRig: med.rig })).toBe(med)
  expect(matchCombatFitting(bundle, { ref, frozenRig: { ...rifle.rig, coat: 'coat-f' } })).toBeUndefined()
  expect(matchCombatFitting(bundle, { ref })).toBeUndefined()
  expect(matchCombatFitting(bundle, { ref: { ...ref, id: '9000102' }, frozenRig: rifle.rig })).toBeUndefined()
})

it('uses the sub-boss bundle on either side with the correct fitting source', () => {
  const file = { path: 'campaign/file.json', sha256: '0'.repeat(64), bytes: 1 }
  const binding: CampaignCombatSprite = { outfit: 'lieutenant', form: 'standard', roles: ['sub-boss'],
    manifest: file, placements: file, pages: [] }
  const unit = { ref: { kind: 'heroine', id: 'lieutenant' }, sprite: { role: 'sub-boss', form: 'standard' } } as const
  expect(matchesSpriteBinding(binding, { ...unit, side: 'squad', frozenRig: issuedCampaignRig() })).toBe(true)
  expect(matchesSpriteBinding(binding, { ...unit, side: 'squad' })).toBe(false)
  expect(matchesSpriteBinding(binding, { ...unit, side: 'enemy', sprite: { ...unit.sprite, fitting: 'sentry' } })).toBe(true)
  expect(matchesSpriteBinding(binding, { ...unit, side: 'enemy' })).toBe(false)
})
