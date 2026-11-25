import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { readCombatSprite } from './combat-sprites'
import { concurrent } from './concurrent'
import { carryPreview, prepareAtlases, recolorAtlas, referenceBitmap, samplePalette, type Palette } from './sprite-materials'

type RosterEntry = { character: string; outfit: number; tier: string; order: number; localBundle: string | null;
  approvedArmor: { asset: string; image: string; sha256: string } }
type Plan = { schemaVersion: number; entries: RosterEntry[] }
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'))

async function snapshot(dir: string, entry: RosterEntry) {
  const names = await readdir(dir, { withFileTypes: true })
  const versions = names.filter(item => item.isDirectory() && /^v\d{3,6}$/.test(item.name)).map(item => Number(item.name.slice(1)))
  const pointer = names.some(item => item.name === 'active-bundle.json') ? await readFile(join(dir, 'active-bundle.json')) : null
  if ((pointer ? JSON.parse(pointer.toString()).version : null) !== entry.localBundle) throw new Error('Refresh roster plan for ' + entry.character)
  return { previous: pointer?.toString() ?? null, version: 'v' + String(Math.max(0, ...versions) + 1).padStart(3, '0') }
}

async function approved(entry: RosterEntry) {
  const image = await readFile(entry.approvedArmor.image)
  assert.equal(sha(image), entry.approvedArmor.sha256, 'Approved armor changed: ' + entry.character)
  return referenceBitmap(image)
}

function label(palette: Palette, key: string) {
  return Object.values(palette).map(([r, g, b], i) => `<rect x="${16 + i * 22}" y="82" width="18" height="10" fill="rgb(${r},${g},${b})"/>`).join('') +
    `<text x="16" y="66" fill="#e0ecff" font-size="14">${key}</text>`
}

async function makeContactSheet(root: string, tier: string, entries: { character: string; palette: Palette; frames: Buffer[] }[]) {
  const width = 840, rowHeight = 126, height = 52 + entries.length * rowHeight
  const labelRows = entries.map((entry, i) => `<g transform="translate(0,${52 + i * rowHeight})">${label(entry.palette, entry.character)}</g>`).join('')
  const headers = ['Front', 'Left', 'Back', 'Right'].map((name, i) => `<text x="${270 + 160 * i}" y="33" fill="#d6e2f4" text-anchor="middle" font-size="14">${name}</text>`).join('')
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="sans-serif">
  <text x="16" y="32" fill="#fff" font-size="17">${tier} · Crew combat drafts</text>${headers}${labelRows}</svg>`)
  const frames = entries.flatMap(({ frames }, row) => frames.map((input, col) => ({
    input, left: 190 + col * 160, top: 36 + row * rowHeight,
  })))
  await sharp({ create: { width, height: height + 32, channels: 4, background: '#192338' } })
    .composite([...frames, { input: svg, left: 0, top: 0 }]).png().toFile(join(root, tier + '-contact.png'))
}

async function main() {
  const [rosterFile, templatePath, albumCategoryPath, output, paletteFile] = process.argv.slice(2)
  if (!rosterFile || !templatePath || !albumCategoryPath || !output) {
    throw new Error('Pass the roster plan, shared template version folder, Combat Sprites category directory and fresh output folder')
  }
  const root = resolve(output), template = resolve(templatePath), album = resolve(albumCategoryPath, 'characters')
  const plan = await readJson(rosterFile) as Plan
  const entries = plan.entries
  assert(plan.schemaVersion === 1 && entries.length > 0, 'Expected a crew roster plan')
  assert.equal(new Set(entries.map(entry => entry.character)).size, entries.length, 'Duplicate character')
  assert.equal(new Set(entries.map(entry => entry.outfit)).size, entries.length, 'Duplicate outfit')
  for (const row of entries) assert(slug.test(row.character) && /^T[1-5]$/.test(row.tier) && Number.isSafeInteger(row.outfit) && row.outfit > 0)

  const pinned = await readJson(join(template, 'review-receipt.json'))
  const source = await readCombatSprite(template, { manifest: pinned.selectedManifestSha256, placements: pinned.placementSha256 }, false)
  const manifest = JSON.parse(source.payloads.get(source.ref.manifest.path)!.toString())
  const placements = source.payloads.get(source.ref.placements.path)!
  const frames = await readFile(join(template, 'layer-map.json'))
  assert(source.bundle.composition, 'The shared template needs the standard composition tracks')
  const sourceFiles = new Map(source.ref.pages.map(page => [page.file, source.payloads.get(page.path)!]))
  const atlases = await prepareAtlases(source.bundle, JSON.parse(frames.toString()), sourceFiles)
  const baseEntry = entries.find(row => row.outfit === source.ref.outfit)
  assert(baseEntry, 'The roster needs the template character and her approved palette reference')
  const base = await approved(baseEntry), basePalette = samplePalette(base, base)
  const overrides = (paletteFile ? await readJson(paletteFile) : {}) as Record<string, Partial<Palette>>
  for (const [character, colors] of Object.entries(overrides)) {
    assert(entries.some(entry => entry.character === character), 'Unknown palette override: ' + character)
    for (const [role, rgb] of Object.entries(colors)) {
      assert(Object.hasOwn(basePalette, role) && Array.isArray(rgb) && rgb.length === 3 &&
        rgb.every(channel => Number.isInteger(channel) && channel >= 0 && channel < 256), 'Invalid RGB override for ' + character + '/' + role)
    }
  }
  const algorithm = await readFile(new URL('./sprite-materials.ts', import.meta.url))
  const exporter = await readFile(new URL(import.meta.url))
  await mkdir(root)

  const results = new Map<string, { entry: RosterEntry; version: string; previous: string | null; palette: Palette; changedPixels: number;
    pages: { file: string; bytes: number; sha256: string }[]; manifestSha256: string; placementSha256: string; frames: Buffer[] }>()
  await concurrent(entries, async (entry) => {
    const target = join(album, entry.character)
    const { previous, version } = await snapshot(target, entry)
    const palette = { ...samplePalette(await approved(entry), base), ...overrides[entry.character] }
    const directory = join(root, entry.character, version)
    await mkdir(join(directory, 'pages'), { recursive: true })
    const pages = { ...manifest.pages }, recolored = new Map()
    let changedPixels = 0
    for (const [key, atlas] of atlases) {
      const result = await recolorAtlas(atlas, basePalette, palette)
      changedPixels += result.changed
      recolored.set(key, result)
      const page = pages[key]
      pages[key] = { ...page, bytes: result.bytes.length, sha256: sha(result.bytes) }
      await writeFile(join(directory, page.file), result.bytes)
    }
    const bundle = Buffer.from(JSON.stringify({ ...manifest, character: entry.character, version, outfit: entry.outfit, status: 'draft', pages, sources: [
      { label: 'Shared combat animation manifest', sha256: source.ref.manifest.sha256 },
      { label: 'Shared source layer map', sha256: sha(frames) },
      { label: 'Approved helmeted armor reference', sha256: entry.approvedArmor.sha256 },
      { label: 'Palette sampler and material transfer', sha256: sha(algorithm) },
      { label: 'Crew sprite batch exporter', sha256: sha(exporter) },
    ] }))
    const manifestSha256 = sha(bundle), placementSha256 = sha(placements)
    const profile = { schemaVersion: 1, character: entry.character, outfit: entry.outfit, version, approvedArmor: entry.approvedArmor, palette,
      template: { character: source.bundle.character, version: source.bundle.version, manifestSha256: source.ref.manifest.sha256, palette: basePalette },
      changedPixels }
    await writeFile(join(directory, 'bundle.json'), bundle)
    await writeFile(join(directory, 'asset-placements.json'), placements)
    await writeFile(join(directory, 'palette-profile.json'), json(profile))
    await writeFile(join(directory, 'review-receipt.json'), json({ schemaVersion: 1, version, status: 'local-batch-palette-draft',
      stagedRoot: join(target, version), selectedManifestSha256: manifestSha256, placementSha256,
      binding: { character: entry.character, authoredOutfit: entry.outfit, campaignOutfit: entry.outfit } }))
    if (previous) await writeFile(join(directory, 'previous-album-selection.json'), previous)
    results.set(entry.character, { entry, version, previous, palette, changedPixels, pages: Object.values(pages),
      manifestSha256, placementSha256, frames: await carryPreview(source.bundle, recolored) })
  }, 4)

  const ordered = entries.map(entry => results.get(entry.character)!)
  for (const tier of new Set(entries.map(entry => entry.tier))) {
    await makeContactSheet(root, tier, ordered.filter(row => row.entry.tier === tier).map(row => ({ ...row, character: row.entry.character })))
  }
  await writeFile(join(root, 'batch.json'), json({ schemaVersion: 1, album, sharedTemplate: source.ref.manifest.sha256,
    entries: ordered.map(({ entry, version, previous, changedPixels, pages, manifestSha256, placementSha256 }) => ({
      character: entry.character, outfit: entry.outfit, tier: entry.tier, version, previous, changedPixels, pages, manifestSha256, placementSha256,
    })) }))
  console.log('Exported ' + ordered.length + ' palette drafts into ' + root)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
