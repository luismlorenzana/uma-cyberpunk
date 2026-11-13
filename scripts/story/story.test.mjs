// pnpm story:check and story:pack on fixtures (CY9): the stand-in passes and packs; a broken file fails with its path.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const tsx = join(root, 'node_modules/.bin/tsx')

test('the check passes the stand-in, writes checks.json and the pack writes hash-named files and an index', () => {
  const dir = mkdtempSync(join(tmpdir(), 'story-'))
  try {
    const out = spawnSync(tsx, [join(root, 'scripts/story/check.ts'), '--dir', join(dir, 'none')], { encoding: 'utf8' })
    assert.equal(out.status, 0, out.stdout + out.stderr)
    assert.match(out.stdout, /checking the stand-in/)
    mkdirSync(join(dir, 'stories'))
    execFileSync(tsx, [join(root, 'scripts/story/pack.ts'), '--dir', join(dir, 'none'), '--out', join(dir, 'release')])
    const index = JSON.parse(readFileSync(join(dir, 'release/story.json'), 'utf8'))
    assert.equal(index.book, 'cyberpunk')
    assert.ok(index.files.length >= 6)
    for (const f of index.files) assert.ok(existsSync(join(dir, 'release', f.path)) && /story\/[a-z0-9-]+\.[a-f0-9]{8}\.json$/.test(f.path), f.path)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a broken chapter fails the check with its file and path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'story-'))
  try {
    mkdirSync(join(dir, 'chapters'))
    writeFileSync(join(dir, 'casting.json'), JSON.stringify({ schemaVersion: 1, leads: [{ outfit: 1001, world: 'w1' }] }))
    writeFileSync(join(dir, 'chapters/w1-ch1.json'), JSON.stringify({ schemaVersion: 1, id: 'w1-ch1', world: 'w1', leads: [1001], number: 1, danger: 1,
      scenes: [{ id: 's1', place: 'p', trigger: { arrive: 'p' }, cast: [], steps: [{ slot: { lines: { 1002: 'x'.repeat(200) }, fallback: 'y' } }] }] }))
    const out = spawnSync(tsx, [join(root, 'scripts/story/check.ts'), '--dir', dir], { encoding: 'utf8' })
    assert.equal(out.status, 1)
    assert.match(out.stdout, /chapters\/w1-ch1\.json scenes\[0\]\.steps\[0\]\.slot\.lines\["1002"\]: expected text of 160 characters at most/)
    assert.ok(existsSync(join(dir, 'checks.json')))
    const report = JSON.parse(readFileSync(join(dir, 'checks.json'), 'utf8'))
    assert.equal(report.book, 'cyberpunk')
    assert.ok(report.findings.some((f) => f.level === 'error'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
