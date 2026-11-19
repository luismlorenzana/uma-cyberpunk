import { describe, expect, it } from 'vitest'
import { LOOKS, lookFor, placeLookContext } from '../looks'
import { wardrobeSceneArt } from '../campaign-wardrobe'
import { parseCampaignBook } from './campaign'
import { STAND_IN_FILES } from './stand-in'

const raw = () => ({ schemaVersion: 1, draft: true, opening: 'opening', quests: [{ id: 'opening', title: 'Opening', scene: 'sw1-ch1-s1' }],
  assets: [...LOOKS.map(role => ({ id: role, file: role + '.png' })), { id: 'pose', file: 'pose.png' }, { id: 'dialogue', file: 'dialogue.webp' }, { id: 'profile', file: 'profile.webp' }],
  art: [{ scene: 'sw1-ch1-s1', portraits: [{ speaker: 9000001, asset: 'pilot' }], composition: { width: 100, height: 100, portraits: 'show', layers: [
    { asset: 'pilot', x: 0, y: 0, width: 50, height: 100 }, { asset: 'pose', x: 50, y: 0, width: 50, height: 100 }] } }],
  wardrobe: { members: [{ speaker: 9000001, looks: Object.fromEntries(LOOKS.map(role => [role, { asset: role, ...(role === 'pilot' ? { dialogue: 'dialogue', profile: 'profile' } : {}) }])) }],
    scenes: [{ scene: 'sw1-ch1-s1', context: 'ship' }], crops: [{ base: 'pilot', width: 100, height: 150,
      dialogue: { asset: 'dialogue', left: 20, top: 0, width: 60, height: 85 }, profile: { asset: 'profile', left: 25, top: 0, size: 50 } }] } })
const parse = (config = raw()) => parseCampaignBook({ ...structuredClone(STAND_IN_FILES), 'campaign.json': config })

describe('six-role wardrobe and reviewed campaign routing', () => {
  it('keeps private, public, operational, shore and equipped contexts distinct, honoring explicit looks', () => {
    expect(lookFor('spot')).toBe('ship-casual')
    expect(lookFor('briefing')).toBe('ship-casual')
    expect(lookFor('cabin')).toBe('quarters')
    expect(lookFor('bridge')).toBe('pilot')
    expect(lookFor('world')).toBe('street')
    expect(lookFor('mission')).toBe('armor')
    expect(lookFor('sealed')).toBe('armor-helmet')
    expect(lookFor('briefing', 'pilot')).toBe('pilot')
    expect(placeLookContext('aboard')).toBe('ship')
    expect(placeLookContext('cabin')).toBe('cabin')
    expect(placeLookContext('a-shore-pier')).toBe('world')
  })
  it('routes the neutral placeholder and profile while preserving a bespoke pose and all script effects', () => {
    const book = parse(), original = structuredClone(book.scenes.get('sw1-ch1-s1')!)
    const art = wardrobeSceneArt(book, original.id)!
    expect(art.portraits[0]!.asset).toBe('ship-casual')
    expect(art.composition!.layers.map(layer => layer.asset)).toEqual(['ship-casual', 'pose'])
    expect(book.art[0]!.portraits[0]!.asset).toBe('pilot')
    book.scenes.get(original.id)!.look = 'pilot'
    expect(wardrobeSceneArt(book, original.id)!.portraits[0]).toMatchObject({ asset: 'dialogue', profile: 'profile' })
    expect(book.scenes.get(original.id)!.steps).toEqual(original.steps)
    const config = { ...raw(), portraitFaces: [{ speaker: 9000001, base: 'dialogue', emote: 'happy', asset: 'pose', at: { x: 0, y: 0 } }] }
    expect(parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': config }).portraitFaces).toHaveLength(1)
    config.portraitFaces[0]!.speaker = 9000002
    expect(() => parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': config })).toThrow()
  })
  it('rejects incomplete roles, unknown actors/scenes/images, conflicting and out-of-bounds crops', () => {
    for (const mutate of [
      (x: ReturnType<typeof raw>) => { delete x.wardrobe.members[0]!.looks['ship-casual'] },
      (x: ReturnType<typeof raw>) => { x.wardrobe.members[0]!.speaker = 9999999 },
      (x: ReturnType<typeof raw>) => { x.wardrobe.scenes[0]!.scene = 'missing' },
      (x: ReturnType<typeof raw>) => { x.wardrobe.members.push(x.wardrobe.members[0]!) },
      (x: ReturnType<typeof raw>) => { x.wardrobe.crops[0]!.profile.left = 60 },
      (x: ReturnType<typeof raw>) => { x.wardrobe.crops[0]!.profile.asset = 'pilot' },
    ]) { const x = raw(); mutate(x); expect(() => parse(x)).toThrow() }
    const legacy = raw() as Record<string, unknown>; delete legacy.wardrobe
    expect(wardrobeSceneArt(parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': legacy }), 'sw1-ch1-s1')!.portraits[0]!.asset).toBe('pilot')
  })
})
