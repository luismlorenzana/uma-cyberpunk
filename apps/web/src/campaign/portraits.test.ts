import type { CampaignPortraitFace, Speaker } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { faceBox, selectScenePortrait } from '../story/ScenePortrait'
import { loadScenePortraits } from './portraits'

describe('campaign dialogue portraits', () => {
  const place = (speaker: Speaker, base: string, emote: string, asset: string, x: number): CampaignPortraitFace =>
    ({ speaker, base, emote, asset, at: { x, y: 40 } })
  const faces = [
    place(9000001, 'pilot', 'worried', 'hero-face', 30),
    place(9000001, 'street', 'worried', 'hero-face', 50),
    place('boss-one', 'station', 'stern', 'enemy-face', 20),
    place('boss-one', 'station', 'loving', 'ally-face', 20),
  ]
  const read = async (asset: string) => `url:${asset}`

  it('layers a shared crop on the correct outfit and plays enemy and ally emotions on the same neutral boss image', async () => {
    for (const [asset, x] of [['pilot', 30], ['street', 50]] as const) {
      const portraits = await loadScenePortraits([{ speaker: 9000001, asset }], faces, read)
      expect(selectScenePortrait(portraits, 9000001, 'worried')).toMatchObject({
        image: { url: `url:${asset}` }, face: { url: 'url:hero-face', at: { x, y: 40 } },
      })
    }
    const boss = await loadScenePortraits([{ speaker: 'boss-one', asset: 'station' }], faces, read)
    expect(selectScenePortrait(boss, 'boss-one', 'stern')).toMatchObject({ image: { url: 'url:station' }, face: { url: 'url:enemy-face' } })
    expect(selectScenePortrait(boss, 'boss-one', 'loving')).toMatchObject({ image: { url: 'url:station' }, face: { url: 'url:ally-face' } })
    expect(selectScenePortrait(boss, 'boss-one', 'neutral')).toMatchObject({ image: { url: 'url:station' }, face: undefined })
  })

  it('preserves old whole-image expressions and the neutral fallback if an optional crop is unavailable', async () => {
    const portraits = await loadScenePortraits([
      { speaker: 'boss-one', asset: 'station' },
      { speaker: 'boss-one', asset: 'old-expression', emote: 'stern' },
    ], faces, async (asset) => {
      if (asset.endsWith('-face')) throw new Error('offline')
      return read(asset)
    })
    expect(selectScenePortrait(portraits, 'boss-one', 'stern')?.image.url).toBe('url:old-expression')
    expect(selectScenePortrait(portraits, 'boss-one', 'loving')).toMatchObject({ image: { url: 'url:station' }, face: undefined })
  })

  it('scales both axes with the portrait and hides a crop that extends beyond the base', () => {
    const base = { width: 400, height: 600 }
    const face = { width: 100, height: 120 }
    expect(faceBox(base, face, { x: 80, y: 150 })).toEqual({ left: '20%', top: '25%', width: '25%', height: '20%' })
    expect(faceBox(base, face, { x: 301, y: 150 })).toBeUndefined()
    expect(faceBox(base, { width: 0, height: 0 }, { x: 0, y: 0 })).toBeUndefined()
  })
})

it('falls back from a missing derived portrait to its native image without pasting derived-coordinate faces', async () => {
  const result = await loadScenePortraits([{ speaker: 9000001, asset: 'dialogue' }], [{ speaker: 9000001, base: 'dialogue', emote: 'happy', asset: 'face', at: { x: 0, y: 0 } }],
    async id => { if (id === 'dialogue') throw Error('offline'); return 'url:' + id }, () => ['native'])
  expect(result).toEqual([{ speaker: 9000001, url: 'url:native' }])
  expect(await loadScenePortraits([{ speaker: 9000001, asset: 'missing' }], [], async () => { throw Error('offline') })).toEqual([])
})
