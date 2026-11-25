import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import { P } from '../../packages/domain/src/story/index'
import { parseCompleteSpriteBundle, type CompleteSpriteBundle } from '../../apps/web/src/board/complete-sprite-format'
import { readCompleteSpriteSource, type CompleteSpritePlacement } from './complete-combat-sprites'
import { sha } from './model'

const families = ['characters', 'bosses', 'lieutenants'] as const
const hex = /^#[a-f\d]{6}$/i
const encode = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n')

function recipe(value: unknown, file: string) {
  const p = new P(file), root = p.object(value, 'batch', ['schemaVersion', 'templates', 'actors'])
  p.version(root)
  const digest = (value: unknown, f: string) => {
    const s = p.text(value, f, 64)
    if (!/^[a-f0-9]{64}$/.test(s)) p.fail(f, 'expected SHA-256')
    return s
  }
  const path = (value: unknown, f: string) => resolve(dirname(file), p.text(value, f, 1024))
  const templates = p.list(root.templates, 'templates', (value, f) => {
    const row = p.object(value, f, ['id', 'directory', 'manifestSha256', 'placementsSha256'])
    return { id: p.slug(row.id, f), directory: path(row.directory, f),
      manifest: digest(row.manifestSha256, f), placements: digest(row.placementsSha256, f) }
  }, 256)
  const actors = p.list(root.actors, 'actors', (value, f) => {
    const row = p.object(value, f, ['category', 'character', 'version', 'template', 'sets'])
    const category = families.find(k => k === row.category) ?? p.fail(f + '.category', 'expected characters, bosses or lieutenants')
    const version = p.text(row.version, f, 7)
    if (!/^v\d{3,6}$/.test(version)) p.fail(f + '.version', 'expected an unused album version')
    const sets = p.list(row.sets, f + '.sets', (value, f) => {
      const set = p.object(value, f, ['source', 'id', 'label', 'colors', 'masks'], ['source', 'id', 'label', 'colors'])
      const colors = p.object(set.colors, f + '.colors', Object.keys((set.colors ?? {}) as object))
      const swaps = new Map<number, number>()
      for (const [from, to] of Object.entries(colors)) {
        if (!hex.test(from) || typeof to !== 'string' || !hex.test(to)) p.fail(f + '.colors', 'expected #RRGGBB replacements')
        const source = parseInt(from.slice(1), 16), target = parseInt((to as string).slice(1), 16)
        if (swaps.has(source) || source === target) p.fail(f + '.colors', 'expected distinct source swatches and a changed color')
        swaps.set(source, target)
      }
      if (!swaps.size || swaps.size > 256) p.fail(f + '.colors', 'expected 1–256 swatches')
      const masks = new Map<string, { path: string; sha256: string }>()
      if (set.masks !== undefined) {
        for (const [page, raw] of Object.entries(p.object(set.masks, f + '.masks', Object.keys(set.masks as object)))) {
          const mask = p.object(raw, f + '.masks.' + page, ['file', 'sha256'])
          masks.set(p.slug(page, f), { path: path(mask.file, f), sha256: digest(mask.sha256, f) })
        }
        if (!masks.size) p.fail(f + '.masks', 'expected at least one pinned mask')
      }
      return { source: p.slug(set.source, f), id: p.slug(set.id, f), label: p.text(set.label, f, 160), swaps, masks }
    }, 12)
    if (!sets.length || new Set(sets.map(set => set.id)).size !== sets.length) p.fail(f + '.sets', 'expected unique finished set IDs')
    return { category, character: p.slug(row.character, f), version, template: p.slug(row.template, f), sets }
  }, 512)
  if (!templates.length || !actors.length || new Set(templates.map(t => t.id)).size !== templates.length) p.fail('batch', 'expected templates and actors with unique identities')
  if (new Set(actors.map(a => a.category + '/' + a.character + '/' + a.version)).size !== actors.length) p.fail('actors', 'duplicate album version')
  for (const actor of actors) if (!templates.some(t => t.id === actor.template)) p.fail(actor.character, 'unknown approved template')
  return { templates, actors }
}

type Mask = { path: string; sha256: string }
type PixelPage = { data: Buffer; width: number; height: number }

async function recolor(page: PixelPage, swaps: ReadonlyMap<number, number>, mask?: Mask) {
  let allowed: Buffer | undefined
  if (mask) {
    const bytes = await readFile(mask.path)
    if (sha(bytes) !== mask.sha256) throw new Error('Recolor mask hash differs: ' + mask.path)
    const decoded = await sharp(bytes).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true })
    if (decoded.info.width !== page.width || decoded.info.height !== page.height || decoded.info.channels !== 1 ||
      decoded.data.some(value => value !== 0 && value !== 255)) throw new Error('Expected a same-size black and white mask: ' + mask.path)
    allowed = decoded.data
  }
  const data = Buffer.from(page.data)
  const used = new Set<number>()
  let changed = 0
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3] || (allowed && !allowed[i / 4])) continue
    const source = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!
    const target = swaps.get(source)
    if (target === undefined) continue
    data[i] = target >> 16
    data[i + 1] = (target >> 8) & 255
    data[i + 2] = target & 255
    used.add(source)
    changed++
  }
  return { data, changed, used }
}

export async function exportCompleteRecolors(file: string, folder: string) {
  const bytes = await readFile(file)
  const { templates, actors } = recipe(JSON.parse(bytes.toString()), file)
  const output = resolve(folder)
  await mkdir(dirname(output), { recursive: true })
  // Fresh draft directories keep both the reviewed templates and existing album versions intact.
  await mkdir(output)
  const active = new Map<string, Promise<Awaited<ReturnType<typeof readCompleteSpriteSource>>>>()
  const results = []
  for (const actor of actors) {
    const template = templates.find(t => t.id === actor.template)!
    let pending = active.get(template.id)
    if (!pending) {
      pending = readCompleteSpriteSource(template.directory, template)
      active.set(template.id, pending)
    }
    const source = await pending
    const directory = resolve(output, actor.category, actor.character, actor.version)
    await mkdir(directory, { recursive: true })
    const hashes: Record<string, string> = {}
    const put = async (path: string, data: Buffer) => {
      const to = resolve(directory, path)
      await mkdir(dirname(to), { recursive: true })
      await writeFile(to, data, { flag: 'wx' })
      hashes[path] = sha(data)
      return hashes[path]!
    }
    const raw = (page: PixelPage) => sharp(page.data, { raw: { width: page.width, height: page.height, channels: 4 } })
    const originals = new Map<string, PixelPage>()
    const pages: CompleteSpriteBundle['pages'] = {}, sets: CompleteSpriteBundle['sets'] = []
    const placements: CompleteSpritePlacement[] = []
    const positions = new Map(source.frames.map(p => [[p.setId, p.view, p.pose].join('/'), p]))
    const gallery: { input: Buffer; left: number; top: number }[] = []
    let changedPixels = 0
    for (const profile of actor.sets) {
      const set = source.bundle.sets.find(s => s.id === profile.source)
      if (!set) throw new Error(actor.character + ': unknown source loadout ' + profile.source)
      const usedPages = [...new Set(source.bundle.views.flatMap(view => Object.values(set.frames[view]).map(cel => cel.page)))]
      for (const page of profile.masks.keys()) if (!usedPages.includes(page)) throw new Error(profile.id + ': unused mask ' + page)
      const remapped = new Map<string, { id: string; image: PixelPage }>()
      const used = new Set<number>()
      for (const [index, key] of usedPages.entries()) {
        const page = source.bundle.pages[key]!
        let original = originals.get(key)
        if (!original) {
          const ref = source.pages.find(p => p.file === page.file)!
          const { data, info } = await sharp(source.payloads.get(ref.path)!).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
          original = { data, width: info.width, height: info.height }
          originals.set(key, original)
        }
        const mask = profile.masks.get(key)
        const pixels = profile.masks.size && !mask ? null : await recolor(original, profile.swaps, mask)
        const image = { ...original, data: pixels?.data ?? original.data }
        if (pixels) {
          changedPixels += pixels.changed
          for (const swatch of pixels.used) used.add(swatch)
        }
        const pageId = 'set-' + sets.length + '-page-' + index
        const path = 'pages/' + pageId + '.png'
        const bytes = await raw(image).png().toBuffer()
        pages[pageId] = { file: path, sha256: await put(path, bytes), bytes: bytes.length, width: image.width, height: image.height }
        remapped.set(key, { id: pageId, image })
      }
      if (used.size !== profile.swaps.size) throw new Error(actor.character + '/' + profile.id + ': a configured source swatch did not match any pixel')
      const frames = {} as CompleteSpriteBundle['sets'][number]['frames']
      for (const [column, view] of source.bundle.views.entries()) {
        frames[view] = {}
        for (const [pose, cel] of Object.entries(set.frames[view])) {
          const { id: page, image } = remapped.get(cel.page)!
          const [left, top, width, height] = cel.rect
          const png = await raw(image).extract({ left, top, width, height }).png().toBuffer()
          const file = 'frames/' + profile.id + '/' + view + '/' + pose + '.png'
          const sha256 = await put(file, png)
          frames[view][pose] = { page, rect: cel.rect, file, sha256 }
          placements.push({ ...positions.get([set.id, view, pose].join('/'))!, setId: profile.id, page, sha256 })
          if (pose === set.clips.idle!.frames[0]!.frame) gallery.push({ input: png, left: column * width, top: sets.length * height })
        }
      }
      sets.push({ id: profile.id, label: profile.label, frames, clips: set.clips })
    }
    const bundle = parseCompleteSpriteBundle({ ...source.bundle, character: actor.character, version: actor.version, status: 'draft', pages, sets,
      sources: [{ label: 'Approved template bundle', sha256: template.manifest }, { label: 'Approved template placements', sha256: template.placements },
        { label: 'Batch palette recipe', sha256: sha(bytes) }] })
    await put('bundle.json', encode(bundle))
    await put('asset-placements.json', encode({ status: 'draft', character: actor.character, version: actor.version,
      cell: bundle.cell, foot: bundle.foot, views: bundle.views, frames: placements, sourcePlacementsSHA256: template.placements }))
    await put('contact-sheet.png', await sharp({ create: { width: bundle.cell[0] * 4, height: bundle.cell[1] * sets.length, channels: 4,
      background: '#202736' } }).composite(gallery).png().toBuffer())
    const receipt = { schemaVersion: 1, status: 'draft', category: actor.category, character: actor.character, version: actor.version,
      template: template.id, sourceBundleSha256: template.manifest, sourcePlacementsSha256: template.placements, batchRecipeSha256: sha(bytes),
      sets: sets.map(s => s.id), frames: placements.length, pages: Object.keys(pages).length, changedPixels, hashes }
    await writeFile(resolve(directory, 'review-receipt.json'), encode(receipt), { flag: 'wx' })
    results.push(receipt)
  }
  const result = { schemaVersion: 1, status: 'draft', actors: results }
  await writeFile(resolve(output, 'batch.json'), encode(result), { flag: 'wx' })
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [recipe, directory, extra] = process.argv.slice(2)
  if (!recipe || !directory || extra) throw new Error('Use <private-recolor-recipe.json> <fresh-draft-directory>')
  void exportCompleteRecolors(resolve(recipe), directory).then(result => {
    console.log('Exported ' + result.actors.length + ' complete sprite draft albums')
  }, error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
}
