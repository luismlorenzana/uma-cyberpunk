import { safePackPath } from '@luismlorenzana/uma-server/content'
import { describe, expect, it } from 'vitest'
import { contentSource, LOOKS_ALLOW, STORY_ALLOW, storyPackModule } from './story-pack'

describe('the story pack route', () => {
  it('serves the index and hash-named story files only', () => {
    expect(safePackPath('story.json', STORY_ALLOW)).toMatchObject({ path: 'story.json', immutable: false })
    expect(safePackPath('story/chapters-w1-ch1.0123abcd.json', STORY_ALLOW)).toMatchObject({ immutable: true })
    expect(safePackPath('../casting.json', STORY_ALLOW)).toBeNull()
    expect(safePackPath('story/casting.json', STORY_ALLOW)).toBeNull()
    expect(safePackPath('traveler-keys/index.json', STORY_ALLOW)).toBeNull()
  })
  it('reads the folder locally and a bucket only when one is named', () => {
    expect(storyPackModule({}, '/repo/apps/api')).toBeDefined()
    expect(storyPackModule({ STORY_BUCKET: '' }, '/repo/apps/api')).toBeDefined()
  })
  it('serves the universe looks: the index and hash-named images only', () => {
    expect(safePackPath('looks/index.json', LOOKS_ALLOW)).toMatchObject({ path: 'looks/index.json', immutable: false })
    expect(safePackPath('looks/images/uma-armor-helmet.0123456789abcdef.png', LOOKS_ALLOW)).toMatchObject({ immutable: true })
    expect(safePackPath('looks/images/uma-armor.0123abcd.png', LOOKS_ALLOW)).toBeNull()
    expect(safePackPath('looks/../story.json', LOOKS_ALLOW)).toBeNull()
    expect(safePackPath('looks/manifest.json', LOOKS_ALLOW)).toBeNull()
  })
  it('sends looks/ to the looks under their prefix and everything else to the story', async () => {
    const seen: string[] = []
    const src = (tag: string) => ({ read: async (p: string) => { seen.push(`${tag}:${p}`); return new Uint8Array([1]) } })
    const source = contentSource(src('story'), src('looks'), 'art/universes/cyberpunk/')
    await source.read('story.json')
    await source.read('looks/index.json')
    expect(seen).toEqual(['story:story.json', 'looks:art/universes/cyberpunk/index.json'])
    expect(await contentSource(src('story'), null).read('looks/index.json')).toBeNull()
  })
})
