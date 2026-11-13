// Reads a story folder's files by path (content/stories/ as the brief lays it out). Notes and reviews aren't parsed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const STORY_DIRS = ['worlds', 'chapters', 'log', 'calls'] as const

/** The story's JSON files under `dir`, by path relative to it; null when there's no story there yet. */
export function readStoryFiles(dir: string): { files: Record<string, unknown>; raw: Record<string, Buffer>; problems: { file: string; message: string }[] } | null {
  if (!existsSync(join(dir, 'casting.json')) && !STORY_DIRS.some((d) => existsSync(join(dir, d)))) return null
  const files: Record<string, unknown> = {}, raw: Record<string, Buffer> = {}, problems: { file: string; message: string }[] = []
  const take = (path: string) => {
    const rel = relative(dir, path).split(sep).join('/')
    const bytes = readFileSync(path)
    raw[rel] = bytes
    try { files[rel] = JSON.parse(bytes.toString('utf8')) } catch (e) { problems.push({ file: rel, message: `not JSON: ${e instanceof Error ? e.message : String(e)}` }) }
  }
  if (existsSync(join(dir, 'casting.json'))) take(join(dir, 'casting.json'))
  for (const d of STORY_DIRS) {
    const sub = join(dir, d)
    if (!existsSync(sub) || !statSync(sub).isDirectory()) continue
    for (const f of readdirSync(sub).filter((f) => f.endsWith('.json')).sort()) take(join(sub, f))
  }
  return { files, raw, problems }
}
