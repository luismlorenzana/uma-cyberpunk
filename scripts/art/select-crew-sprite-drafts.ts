import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import type { SpriteBundle } from '../../apps/web/src/board/combat-sprite-format'
import { readCombatSprite } from './combat-sprites'
import { concurrent } from './concurrent'
import { prepareAtlases, type Bitmap } from './sprite-materials'

type Entry = { character: string; outfit: number; version: string; previous: string | null; changedPixels: number;
  manifestSha256: string; placementSha256: string; pages: { file: string; sha256: string; bytes: number }[] }
type Batch = { schemaVersion: 1; album: string; sharedTemplate: string; entries: Entry[] }
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'))
const selected = (version: string) => JSON.stringify({ schemaVersion: 1, version }, null, 2) + '\n'

async function previous(file: string) {
  try { return await readFile(file, 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function select(file: string, text: string) {
  const temp = file + '.' + randomUUID() + '.tmp'
  await writeFile(temp, text, { flag: 'wx' })
  try { await rename(temp, file) }
  catch (error) { await unlink(temp); throw error }
}

function motionContract(bundle: SpriteBundle) {
  return { cell: bundle.cell, foot: bundle.foot, figureHeight: bundle.figureHeight, reviewHeight: bundle.reviewHeight,
    motions: bundle.motions, fittings: bundle.fittings, composition: bundle.composition }
}

async function verifyPalettePixels(atlas: Bitmap & { bytes: Buffer }, allowed: Uint8Array, encoded: Buffer) {
  if (encoded.equals(atlas.bytes)) return 0
  const { data, info } = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert(info.width === atlas.width && info.height === atlas.height, 'Palette swap changed atlas dimensions')
  let changed = 0
  for (let index = 0; index < allowed.length; index++) {
    const offset = index * 4
    if (data[offset + 3] !== atlas.pixels[offset + 3]) throw new Error('Palette swap changed atlas opacity')
    if (data[offset] === atlas.pixels[offset] && data[offset + 1] === atlas.pixels[offset + 1] &&
      data[offset + 2] === atlas.pixels[offset + 2]) continue
    if (!allowed[index]) throw new Error('Palette swap changed pixels outside the armor mask')
    changed++
  }
  return changed
}

async function main() {
  const [batchPath, templatePath, artPath] = process.argv.slice(2)
  if (!batchPath || !templatePath || !artPath) throw new Error('Pass the exported batch directory, pinned template directory and local Art checkout')
  const root = resolve(batchPath), art = resolve(artPath)
  const batch = await readJson(join(root, 'batch.json')) as Batch
  assert(batch.schemaVersion === 1 && batch.entries.length > 0, 'Expected a crew sprite batch')
  const album = await realpath(join(art, 'content/authoring/character-universes/cyberpunk/categories/combat-sprites/characters'))
  assert.equal(await realpath(batch.album), album, 'The local album changed since export')
  const { readSpriteBundle } = await import(pathToFileURL(join(art, 'src/combat-sprites.ts')).href) as { readSpriteBundle: (folder: string) => SpriteBundle }
  const placements = sha(await readFile(join(templatePath, 'asset-placements.json')))
  const template = await readCombatSprite(templatePath, { manifest: batch.sharedTemplate, placements }, false)
  const baseline = template.bundle
  const mechanics = JSON.stringify(motionContract(baseline))
  const templatePages = new Map(template.ref.pages.map(row => [row.file, template.payloads.get(row.path)!]))
  const masks = await prepareAtlases(baseline, await readJson(join(templatePath, 'layer-map.json')), templatePages)
  const allowed = new Map([...masks].map(([key, atlas]) => {
    const result = new Uint8Array(atlas.width * atlas.height)
    for (const index of atlas.colored) result[index] = 1
    return [baseline.pages[key]!.file, { atlas, result }] as const
  }))
  assert.equal(new Set(batch.entries.map(row => row.character)).size, batch.entries.length, 'Duplicate characters')
  assert.equal(new Set(batch.entries.map(row => row.outfit)).size, batch.entries.length, 'Duplicate outfits')

  const staged = new Map<string, { pointer: string; target: string; source: string; checked: Awaited<ReturnType<typeof readCombatSprite>> }>()
  await concurrent(batch.entries, async row => {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.character) && /^v\d{3,6}$/.test(row.version))
    const albumDir = await realpath(join(album, row.character))
    if (dirname(albumDir) !== album || !albumDir.startsWith(album + sep)) throw new Error('Character folder escapes local album')
    const pointer = join(albumDir, 'active-bundle.json'), target = join(albumDir, row.version)
    assert.equal(await previous(pointer), row.previous, 'Album selection changed for ' + row.character)
    const source = join(root, row.character, row.version)
    const checked = await readCombatSprite(source, { manifest: row.manifestSha256, placements: row.placementSha256 }, false)
    // The album enforces its own file-size and preview-format limits.
    readSpriteBundle(source)
    assert.equal(checked.bundle.status, 'draft')
    assert.equal(checked.bundle.character, row.character)
    assert.equal(checked.bundle.outfit, row.outfit)
    assert.equal(checked.bundle.version, row.version)
    assert.equal(row.placementSha256, placements)
    assert.equal(JSON.stringify(motionContract(checked.bundle)), mechanics, 'Shared motion changed: ' + row.character)
    let changed = 0
    for (const page of checked.ref.pages) {
      const mask = allowed.get(page.file)!
      changed += await verifyPalettePixels(mask.atlas, mask.result, checked.payloads.get(page.path)!)
    }
    assert.equal(changed, row.changedPixels, 'Palette receipt differs from encoded pixels: ' + row.character)
    const pages = checked.ref.pages.map(({ file, sha256, bytes }) => ({ file, sha256, bytes })).sort((a, b) => a.file.localeCompare(b.file))
    assert.deepEqual(pages, [...row.pages].map(({ file, sha256, bytes }) => ({ file, sha256, bytes })).sort((a, b) => a.file.localeCompare(b.file)))
    staged.set(row.character, { pointer, target, source, checked })
  }, 4)

  // Write and prove all versions before making any active selections.
  await concurrent(batch.entries, async row => {
    const { target, source, checked } = staged.get(row.character)!
    await mkdir(target)
    const pinned = [{ file: 'bundle.json', ...checked.ref.manifest }, { file: 'asset-placements.json', ...checked.ref.placements }, ...checked.ref.pages]
    for (const item of pinned) {
      const file = join(target, item.file)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, checked.payloads.get(item.path)!, { flag: 'wx' })
    }
    const metadata = ['palette-profile.json', 'review-receipt.json', ...(row.previous ? ['previous-album-selection.json'] : [])]
    for (const file of metadata) await writeFile(join(target, file), await readFile(join(source, file)), { flag: 'wx' })
  }, 4)

  const advanced: Entry[] = []
  try {
    for (const row of batch.entries) {
      const { pointer } = staged.get(row.character)!
      assert.equal(await previous(pointer), row.previous, 'Album selection changed for ' + row.character)
      await select(pointer, selected(row.version))
      advanced.push(row)
    }
  } catch (error) {
    const failures: unknown[] = [error]
    for (const row of advanced.reverse()) {
      try {
        const { pointer } = staged.get(row.character)!
        if (await previous(pointer) !== selected(row.version)) continue
        if (row.previous === null) await unlink(pointer)
        else await select(pointer, row.previous)
      } catch (failure) { failures.push(failure) }
    }
    throw new AggregateError(failures, 'Local album selection failed; prior selections were restored where still owned by this batch')
  }
  await writeFile(join(root, 'validation.json'), JSON.stringify({ template: batch.sharedTemplate, validated: advanced.length,
    checkedPages: advanced.reduce((sum, row) => sum + row.pages.length, 0), sharedMotionTracks: Object.keys(baseline.motions).length,
    selectedDrafts: advanced.map(({ character, outfit, version, changedPixels }) => ({ character, outfit, version, changedPixels })) }, null, 2) + '\n')
  console.log(`Validated and selected ${advanced.length} local crew drafts`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
