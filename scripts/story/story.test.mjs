// pnpm story:check and story:pack on fixtures (CY9): the stand-in passes and packs; a broken file fails with its path.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { png } from '../make-icons.mjs'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const tsx = createRequire(import.meta.url).resolve('tsx/cli')

test('the check passes the stand-in, writes checks.json and the pack writes hash-named files and an index', () => {
  const dir = mkdtempSync(join(tmpdir(), 'story-'))
  try {
    const out = spawnSync(process.execPath, [tsx, join(root, 'scripts/story/check.ts'), '--dir', join(dir, 'none')], { encoding: 'utf8' })
    assert.equal(out.status, 0, out.stdout + out.stderr)
    assert.match(out.stdout, /checking the stand-in/)
    mkdirSync(join(dir, 'stories'))
    execFileSync(process.execPath, [tsx, join(root, 'scripts/story/pack.ts'), '--dir', join(dir, 'none'), '--out', join(dir, 'release')])
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
    const out = spawnSync(process.execPath, [tsx, join(root, 'scripts/story/check.ts'), '--dir', dir], { encoding: 'utf8' })
    assert.equal(out.status, 1)
    assert.match(out.stdout, /chapters\/w1-ch1\.json scenes\[0\]\.steps\[0\]\.slot\.lines\["1002"\]: expected text of 160 characters at most/)
    assert.ok(existsSync(join(dir, 'checks.json')))
    const report = JSON.parse(readFileSync(join(dir, 'checks.json'), 'utf8'))
    assert.equal(report.book, 'cyberpunk')
    assert.ok(report.findings.some((f) => f.level === 'error'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('campaign publication replaces files under stable IDs, rejects damage and rolls back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'campaign-'))
  try {
    const source = join(dir, 'source'), out = join(dir, 'release')
    mkdirSync(join(source, 'worlds'), { recursive: true })
    mkdirSync(join(source, 'chapters'))
    mkdirSync(join(source, 'art'))
    const write = (file, value) => writeFileSync(join(source, file), JSON.stringify(value))
    write('casting.json', { schemaVersion: 1, leads: [{ outfit: 9000999, world: 'demo' }] })
    write('worlds/demo.json', { schemaVersion: 1, id: 'demo', factions: [], locations: [{ id: 'dock', danger: 1, x: 25, y: 50 }] })
    const scene = (text) => write('chapters/demo.json', { schemaVersion: 1, id: 'demo', world: 'demo', leads: [9000999],
      number: 2, danger: 1, scenes: [{ id: 'arrival', place: 'dock', trigger: { arrive: 'dock' }, cast: [{ outfit: 9000999 }],
        steps: [{ line: { speaker: 9000999, text } }] }] })
    const campaign = { schemaVersion: 1, opening: 'first-call', draft: true,
      quests: [{ id: 'first-call', title: 'First call', scene: 'arrival' }],
      assets: [{ id: 'portrait', file: 'portrait.png' }],
      art: [{ scene: 'arrival', portraits: [{ speaker: 9000999, asset: 'portrait' }] }] }
    write('campaign.json', campaign)
    const run = (task, release, ...args) => spawnSync(process.execPath,
      [tsx, join(root, 'scripts/story/campaign.ts'), task, release, '--dir', source, '--out', out, ...args], { encoding: 'utf8' })
    const succeed = (task, release, ...args) => {
      const result = run(task, release, ...args)
      assert.equal(result.status, 0, result.stderr)
    }
    const index = () => JSON.parse(readFileSync(join(out, 'campaign/preview.json'), 'utf8'))
    scene('First line.')
    writeFileSync(join(source, 'art/portrait.png'), png(16))
    succeed('pack', 'v1')
    succeed('select', 'v1')
    const first = index()
    scene('Updated line.')
    writeFileSync(join(source, 'art/portrait.png'), png(20))
    const pinsPath = join(dir, 'pins.json')
    const sources = ['casting.json', 'campaign.json', 'worlds/demo.json', 'chapters/demo.json', 'art/portrait.png']
    writeFileSync(pinsPath, JSON.stringify(Object.fromEntries(sources.map(file => [file,
      createHash('sha256').update(readFileSync(join(source, file))).digest('hex')]))))
    assert.match(run('pack', 'v1', '--pilot').stderr, /requires source pins/)
    succeed('pack', 'v1', '--pilot', '--pins', pinsPath)
    succeed('select', 'v1', '--pilot')
    const pilot = JSON.parse(readFileSync(join(out, 'campaign/pilot.json'), 'utf8'))
    assert.deepEqual(index(), first)
    assert.notEqual(pilot.assets[0].sha256, first.assets[0].sha256)
    scene('Unpinned line.')
    assert.match(run('pack', 'v2', '--pilot', '--pins', pinsPath).stderr, /chapters\/demo.json: missing or mismatched source pin/)
    scene('Updated line.')
    succeed('pack', 'v2')
    assert.equal(run('pack', 'v1').status, 1)
    succeed('select', 'v2')
    const second = index()
    assert.equal(second.assets[0].id, first.assets[0].id)
    assert.notEqual(second.assets[0].path, first.assets[0].path)
    const chapterHash = (release) => release.files.find((file) => file.source === 'chapters/demo.json').sha256
    assert.notEqual(chapterHash(second), chapterHash(first))
    succeed('select', 'v1')
    const secondPath = join(out, 'campaign/releases/v2.json')
    const validManifest = readFileSync(secondPath)
    const invalid = Buffer.from(JSON.stringify({ ...campaign, opening: 'not-a-quest' }))
    const invalidHash = createHash('sha256').update(invalid).digest('hex')
    const invalidPath = `campaign/files/pack.${invalidHash}.json`
    writeFileSync(join(out, invalidPath), invalid)
    writeFileSync(secondPath, JSON.stringify({ ...second, files: second.files.map(ref => ref.source === 'campaign.json'
      ? { ...ref, path: invalidPath, sha256: invalidHash, bytes: invalid.length } : ref) }))
    assert.match(run('select', 'v2').stderr, /unknown quest not-a-quest/)
    assert.deepEqual(index(), first)
    writeFileSync(secondPath, validManifest)
    writeFileSync(join(out, second.assets[0].path), 'corrupt')
    assert.match(run('select', 'v2').stderr, /failed integrity check/)
    assert.deepEqual(index(), first)
    campaign.quests[0].scene = 'missing'
    write('campaign.json', campaign)
    assert.match(run('check', 'unused').stderr, /campaign.json: quests\[0\]\.scene: unknown scene missing/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
