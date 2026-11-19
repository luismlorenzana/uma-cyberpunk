import { describe, expect, it } from 'vitest'
import { parseCampaignBook } from './campaign'
import { STAND_IN_FILES } from './stand-in'

const layer = { asset: 'pose', x: 200, y: 0, width: 400, height: 390 }
const composition = { width: 844, height: 390, portraits: 'show', layers: [layer] }
const config = (value?: unknown) => ({ schemaVersion: 1, opening: 'opening', draft: true,
  quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' }],
  assets: ['plate', 'pose'].map(id => ({ id, file: id + '.png' })),
  art: [{ scene: 'sw1-ch1-s1', backdrop: 'plate', portraits: [{ speaker: 9000001, asset: 'pose' }], ...(value ? { composition: value } : {}) }] })
const parse = (value?: unknown) => parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': config(value) })

describe('campaign scene composition', () => {
  it('holds the roster art and reused face placements beyond the earlier generic 500-entry limit', () => {
    const value = config()
    const assets = [...value.assets, ...Array.from({ length: 600 }, (_, i) => ({ id: `face-${i}`, file: `face-${i}.png` }))]
    const portraitFaces = Array.from({ length: 600 }, (_, i) => ({ speaker: 9000001, base: 'pose', emote: `cue-${i}`, asset: `face-${i}`, at: { x: 5, y: 5 } }))
    const book = parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': { ...value, assets, portraitFaces } })
    expect(book.assets).toHaveLength(602)
    expect(book.portraitFaces).toHaveLength(600)
  })
  it('keeps old scenes unchanged and declares independent pose layers with explicit talking-portrait policy', () => {
    expect(parse().art[0]!.composition).toBeUndefined()
    expect(parse(composition).art[0]!.composition).toEqual({ ...composition, layers: [{ ...layer, fit: 'contain', opacity: 100 }] })
  })
  it('rejects missing images, overflow, invalid dimensions, excessive layers and undeclared policy', () => {
    for (const invalid of [
      { ...composition, layers: [{ ...layer, asset: 'missing' }] },
      { ...composition, layers: [{ ...layer, x: 800 }] },
      { ...composition, layers: [{ ...layer, y: -1 }] },
      { ...composition, width: 0 }, { ...composition, portraits: 'sometimes' },
      { ...composition, layers: Array(13).fill(layer) },
    ]) expect(() => parse(invalid)).toThrow()
  })
})
