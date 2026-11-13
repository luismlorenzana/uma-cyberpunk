import { safePackPath } from '@luismlorenzana/uma-server/content'
import { describe, expect, it } from 'vitest'
import { STORY_ALLOW, storyPackModule } from './story-pack'

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
})
