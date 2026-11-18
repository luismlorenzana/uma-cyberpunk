import { describe, expect, it } from 'vitest'
import { parseCampaignBook } from './campaign'
import { STAND_IN_FILES } from './stand-in'

const configure = () => ({
  schemaVersion: 1, draft: true, opening: 'first-watch',
  quests: [{ id: 'first-watch', title: 'First Watch', scene: 'sw1-ch1-s1' }],
  assets: ['bridge', 'pilot', 'street', 'boss-station', 'face'].map((id) => ({ id, file: `${id}.png` })),
  art: [
    { scene: 'sw1-ch1-s1', backdrop: 'bridge', portraits: [{ speaker: 9000001, asset: 'pilot' }] },
    { scene: 'sw1-ch1-s2', portraits: [{ speaker: 9000001, asset: 'street' }, { speaker: 'stand-in-1', asset: 'boss-station' }] },
  ],
})

const pilotFace = { speaker: 9000001, base: 'pilot', emote: 'worried', asset: 'face', at: { x: 34, y: 25 } }
const read = (config: object) => parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': config })

describe('campaign face crop placements', () => {
  it('accepts the same crop at more than one outfit placement and a separate boss speaker', () => {
    const config = configure()
    const portraitFaces = [pilotFace, { ...pilotFace, base: 'street', at: { x: 41, y: 19 } },
      { ...pilotFace, speaker: 'stand-in-1', base: 'boss-station', emote: 'stern' }]
    expect(read({ ...config, portraitFaces })).toMatchObject({ portraitFaces, art: config.art })
    expect(read(config).portraitFaces).toBeUndefined()
  })

  it('rejects placements on another speaker’s portrait, duplicate cues and invalid offsets', () => {
    expect(() => read({ ...configure(), portraitFaces: [{ ...pilotFace, base: 'boss-station' }] })).toThrow('default scene portrait for this speaker')
    expect(() => read({ ...configure(), portraitFaces: [pilotFace, pilotFace] })).toThrow('duplicate')
    expect(() => read({ ...configure(), portraitFaces: [{ ...pilotFace, at: { x: -1, y: 0 } }] })).toThrow('portraitFaces[0].at.x')
    expect(() => read({ ...configure(), portraitFaces: [{ ...pilotFace, emote: 'neutral' }] })).toThrow('neutral uses the base portrait')
  })
})
