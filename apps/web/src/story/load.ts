// The story's one loader seam (CY9, as uma-farm's load.ts): the private pack from cyber-api's `/api/content/story.json`
// and its hash-named files, each verified by its hash; the invented stand-in from `@cyber/domain` when the API serves no
// pack (a 404: no `content/story-release/` locally, and production until Phase 4's bucket) or with
// `VITE_CYBER_STORY=stand-in`. Either way the pack is checked by the game's own parser.
import { parsePack, STAND_IN_FILES, type StoryPack } from '@cyber/domain'
import { ContentError } from '@luismlorenzana/uma-kit/content'
import { CONTENT } from '../content/client'

export interface LoadedStory { pack: StoryPack; source: 'pack' | 'stand-in' }

interface StoryIndex { schemaVersion: 1; book: string; files: { source: string; path: string; sha256: string; bytes: number }[] }

const decode = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes))

function standIn(): LoadedStory {
  const r = parsePack(STAND_IN_FILES)
  if (!r.pack) throw new Error(`the stand-in story doesn't parse: ${r.errors[0]?.message}`)
  return { pack: r.pack, source: 'stand-in' }
}

export async function loadStory(): Promise<LoadedStory> {
  if (import.meta.env.VITE_CYBER_STORY === 'stand-in') return standIn()
  let index: StoryIndex
  try {
    index = decode(await CONTENT.pack('story.json')) as StoryIndex
  } catch (e) {
    if (e instanceof ContentError && e.status === 404) return standIn()
    throw e
  }
  const files: Record<string, unknown> = {}
  for (const f of index.files) files[f.source] = decode(await CONTENT.pack(f.path, { path: f.path, sha256: f.sha256, bytes: f.bytes }))
  const r = parsePack(files)
  if (!r.pack) throw new Error(`the story pack doesn't parse: ${r.errors[0]?.message}`)
  return { pack: r.pack, source: 'pack' }
}

let cached: Promise<LoadedStory> | null = null
/** The story, loaded once a session. */
export const story = (): Promise<LoadedStory> => (cached ??= loadStory().catch((e: unknown) => { cached = null; throw e }))
