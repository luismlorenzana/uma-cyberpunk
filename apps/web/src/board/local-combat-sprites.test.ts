import { issuedCampaignRig } from '@cyber/domain'
import { expect, it } from 'vitest'
import { matchCombatFitting } from './local-combat-sprites'

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
