import { describe, expect, it } from 'vitest'
import { LOOKS } from '@cyber/domain'
import { lookPath, parseLooks } from './looks'

describe('approved Platform wardrobe index', () => {
  const looks = LOOKS.map(outfit => ({ id: outfit, character: 'Synthetic Officer', outfit, path: `images/${outfit}.0123456789abcdef.png` }))
  it('accepts all six exact keys and separates other published categories and splashes', () => {
    const parsed = parseLooks({ looks: [...looks, { ...looks[0], category: 'weapons' }, { ...looks[0], kind: 'splash' }, { ...looks[0], outfit: 'unknown' }] })
    expect(parsed).toHaveLength(6)
    expect(lookPath(parsed, 'synthetic officer', 'ship-casual')).toContain('ship-casual')
  })
  it('keeps an older five-role index usable and uses its private neutral only when Ship Casual is absent', () => {
    const parsed = parseLooks({ looks: looks.filter(x => x.outfit !== 'ship-casual') })
    expect(parsed).toHaveLength(5)
    expect(lookPath(parsed, 'Synthetic Officer', 'ship-casual')).toContain('quarters')
    expect(lookPath(parsed, 'Different Officer', 'ship-casual')).toBeNull()
  })
})
