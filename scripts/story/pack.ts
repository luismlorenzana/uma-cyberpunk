// `pnpm story:pack` (CY9, as uma-farm's release.mjs): the checked story as hash-named files and a `story.json` index in
// the ignored content/story-release/, which the API serves at /api/content/… from STORY_DIR. Refuses a story with errors.
//   pnpm story:pack [--dir <folder>] [--out <folder>]
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { STAND_IN_FILES } from '../../packages/domain/src/story/index'
import { runCheck } from './check'
import { readStoryFiles } from './files'

export interface StoryIndex { schemaVersion: 1; book: 'cyberpunk'; packedAt: string; files: { source: string; path: string; sha256: string; bytes: number }[] }

/** Writes the release; returns its index. */
export function pack(dir: string, out: string, now = new Date().toISOString()): StoryIndex {
  const { errors, report } = runCheck(dir, now)
  if (errors) throw new Error(`the story has ${errors} error(s): run pnpm story:check (${report.findings.find((f) => f.level === 'error')?.message})`)
  const files = readStoryFiles(dir)?.files ?? STAND_IN_FILES
  rmSync(out, { recursive: true, force: true })
  mkdirSync(join(out, 'story'), { recursive: true })
  const index: StoryIndex = { schemaVersion: 1, book: 'cyberpunk', packedAt: now, files: [] }
  for (const [source, value] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const bytes = Buffer.from(JSON.stringify(value))
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const name = source.replace(/\.json$/, '').replace(/\//g, '-')
    const path = `story/${name}.${sha256.slice(0, 8)}.json`
    writeFileSync(join(out, path), bytes)
    index.files.push({ source, path, sha256, bytes: bytes.length })
  }
  writeFileSync(join(out, 'story.json'), `${JSON.stringify(index, null, 1)}\n`)
  return index
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const at = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined }
  const root = join(import.meta.dirname, '../..')
  const index = pack(resolve(at('--dir') ?? process.env.UMA_CYBER_STORIES ?? join(root, '../uma-story-authoring/content/cyberpunk/stories')), resolve(at('--out') ?? join(root, 'content/story-release')))
  console.log(`Packed ${index.files.length} files into content/story-release/ (story.json and story/*).`)
}
