import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { readCombatSprite } from './combat-sprites'
import { concurrent } from './concurrent'

type Draft = { character: string; outfit: number; version: string; manifestSha256: string; placementSha256: string }
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'

async function main() {
  const [batchDir, directory, approvalNote] = process.argv.slice(2)
  if (!batchDir || !directory || !approvalNote?.trim()) throw new Error('Pass the validated draft batch, a fresh output directory and the owner approval note')
  const root = resolve(batchDir), out = resolve(directory)
  const batch = await readJson(join(root, 'batch.json')) as { schemaVersion: 1; album: string; entries: Draft[] }
  const validation = await readJson(join(root, 'validation.json'))
  assert(batch.schemaVersion === 1 && batch.entries.length > 0 && validation.validated === batch.entries.length, 'Expected a complete validated batch')
  const roster = batch.entries.map(({ character, outfit, version }) => ({ character, outfit, version }))
  assert.deepEqual(validation.selectedDrafts.map(({ character, outfit, version }: Draft) => ({ character, outfit, version })), roster)
  assert.equal(new Set(roster.map(row => row.outfit)).size, roster.length)
  assert.equal(new Set(roster.map(row => row.character)).size, roster.length)
  await mkdir(out)

  const receipts = new Map<string, object>()
  await concurrent(batch.entries, async entry => {
    const { character, outfit, version } = entry
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(character) && /^v\d{3,6}$/.test(version))
    const folder = join(batch.album, character)
    const selected = await readJson(join(folder, 'active-bundle.json'))
    assert.equal(selected.version, version, 'Album selection changed for ' + character)
    const { bundle, payloads, ref } = await readCombatSprite(join(folder, version),
      { manifest: entry.manifestSha256, placements: entry.placementSha256 }, false)
    assert(bundle.status === 'draft' && bundle.character === character && bundle.outfit === outfit && bundle.version === version)
    const raw = JSON.parse(payloads.get(ref.manifest.path)!.toString())
    const manifest = Buffer.from(JSON.stringify({ ...raw, status: 'approved' }))
    const target = join(out, character, version)
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'bundle.json'), manifest, { flag: 'wx' })
    for (const file of [{ ...ref.placements, file: 'asset-placements.json' }, ...ref.pages]) {
      const dest = join(target, file.file)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, payloads.get(file.path)!, { flag: 'wx' })
    }
    receipts.set(character, { character, outfit, version, directory: character + '/' + version, manifestSha256: sha(manifest),
      placementsSha256: ref.placements.sha256, pages: ref.pages.map(({ file, sha256 }) => ({ file, sha256 })),
      approval: { by: 'owner', status: 'approved' } })
  }, 4)

  const bundles = batch.entries.map(entry => receipts.get(entry.character)!)
  const revision = 'crew-' + sha(Buffer.from(JSON.stringify(bundles))).slice(0, 20)
  await writeFile(join(out, 'approval.json'), json({ approvalNote, revision, drafts: batch.entries,
    approved: bundles, validationSha256: sha(await readFile(join(root, 'validation.json'))) }), { flag: 'wx' })
  await writeFile(join(out, 'sources.json'), json({ schemaVersion: 1, universe: 'cyberpunk', campaign: 'cyberpunk', revision, bundles }), { flag: 'wx' })
  console.log(`Recorded owner approval for ${bundles.length} crew sprites in ${revision}`)
}

void main().catch(error => { console.error(error); process.exitCode = 1 })
