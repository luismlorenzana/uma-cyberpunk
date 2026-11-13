// `pnpm story:check` (CY9): validates content/stories/ with the game's own parser and cross-file rules, prints the
// findings, writes content/stories/checks.json in Uma Story's shape (book "cyberpunk"), and exits non-zero on any error.
// With no story there yet, it checks the stand-in and says so.
//   pnpm story:check [--dir <folder>]
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { checksReport, parsePack, STAND_IN_FILES, type Finding } from '../../packages/domain/src/story/index'
import { readStoryFiles } from './files'

export function runCheck(dir: string, now = new Date().toISOString()): { report: ReturnType<typeof checksReport>; standIn: boolean; errors: number } {
  const read = readStoryFiles(dir)
  const standIn = read === null
  const files = read?.files ?? STAND_IN_FILES
  const parsed = parsePack(files)
  const parseFindings: Finding[] = [
    ...(read?.problems ?? []).map((p) => ({ level: 'error' as const, file: p.file, where: '', message: p.message })),
    ...parsed.errors.map((e) => ({ level: 'error' as const, file: e.file, where: e.path, message: e.message.slice(e.file.length + e.path.length + 4) })),
  ]
  const report = checksReport(parsed.pack, parseFindings, now)
  const raw = read?.raw ?? Object.fromEntries(Object.entries(STAND_IN_FILES).map(([k, v]) => [k, Buffer.from(JSON.stringify(v))]))
  report.files = Object.fromEntries(Object.entries(raw).map(([k, b]) => [k, createHash('sha256').update(b).digest('hex')]))
  return { report, standIn, errors: report.findings.filter((f) => f.level === 'error').length }
}

function main(): void {
  const at = process.argv.indexOf('--dir')
  const dir = resolve(at >= 0 ? process.argv[at + 1]! : join(import.meta.dirname, '../../content/stories'))
  const { report, standIn, errors } = runCheck(dir)
  if (standIn) console.log(`No story in ${dir} yet: checking the stand-in.`)
  for (const f of report.findings) console.log(`${f.level.padEnd(5)} ${f.file}${f.where ? ` ${f.where}` : ''}: ${f.message}`)
  // The report goes beside a real story only: the stand-in's would land in the story session's folder.
  if (!standIn) writeFileSync(join(dir, 'checks.json'), `${JSON.stringify(report, null, 1)}\n`)
  console.log(`${errors} error(s), ${report.findings.filter((f) => f.level === 'todo').length} todo(s).${standIn ? '' : ` Wrote ${join(dir, 'checks.json')}`}`)
  process.exit(errors ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main()
