import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { CAMPAIGN_PREVIEW_INDEX, campaignReleasePath, parseCampaignRelease, type CampaignRelease, type CampaignReleaseFile } from '../../packages/domain/src/story/index'
import { parseCombatEffects, parseSpriteBundle } from '../../apps/web/src/board/combat-sprite-format'
import { immutable, loadSelected } from './publish'
import { CAMPAIGN_PREFIX, COMBAT_SPRITE_PREFIX, GcsArtStorage, GenerationConflict } from './storage'
import { concurrent } from './concurrent'

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const json = (bytes: Buffer): unknown => JSON.parse(bytes.toString())
const encode = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n')

export async function combatSpriteCandidate(selected: CampaignRelease, directory: string,
  pins: { manifest: string; placements: string }, publish: boolean) {
  const root = await realpath(directory)
  async function read(file: string) {
    const path = await realpath(resolve(root, file))
    if (!path.startsWith(root + sep)) throw new Error('Combat sprite payload outside bundle')
    return readFile(path)
  }
  const payloads = new Map<string, Buffer>()
  function add(bytes: Buffer, extension: 'json' | 'png'): CampaignReleaseFile {
    const sha256 = sha(bytes), path = `campaign/files/pack.${sha256}.${extension}`
    payloads.set(path, bytes)
    return { path, sha256, bytes: bytes.length }
  }
  const manifest = add(await read('bundle.json'), 'json')
  const placements = add(await read('asset-placements.json'), 'json')
  if (manifest.sha256 !== pins.manifest || placements.sha256 !== pins.placements) throw new Error('Combat sprite approval pins do not match')
  const bundle = parseSpriteBundle(json(payloads.get(manifest.path)!))
  parseCombatEffects(json(payloads.get(placements.path)!), bundle)
  if (typeof bundle.outfit !== 'number' || (publish && bundle.status !== 'approved')) throw new Error('Publication requires an approved bundle with a canonical outfit')
  const pages = await Promise.all(Object.values(bundle.pages).map(async page => {
    const bytes = await read(page.file)
    if (bytes.length !== page.bytes || sha(bytes) !== page.sha256 || bytes.length < 33 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR' ||
      bytes.readUInt32BE(16) !== page.width || bytes.readUInt32BE(20) !== page.height) throw new Error('Invalid combat sprite page: ' + page.file)
    return { file: page.file, ...add(bytes, 'png') }
  }))
  const combatSprites = [...(selected.combatSprites ?? []).filter(row => row.outfit !== bundle.outfit),
    { outfit: bundle.outfit, manifest, placements, pages }].sort((a, b) => a.outfit - b.outfit)
  const release = parseCampaignRelease({ ...selected, combatSprites,
    release: 'sprite-' + sha(encode({ files: selected.files, assets: selected.assets, combatSprites })).slice(0, 20) })
  return { release, payloads, bundle }
}

async function main() {
  const [input, ...args] = process.argv.slice(2)
  const localAt = args.indexOf('--local')
  const local = localAt >= 0 ? args[localAt + 1] : undefined
  const dryRun = args.includes('--dry-run')
  if (!input || (!local && !args.includes('--cloud'))) throw new Error('Pass an intake receipt and --local <release root> or --cloud')
  const receipt = json(await readFile(resolve(input))) as {
    stagedRoot: string; selectedManifestSha256: string; placementSha256: string
    binding: { authoredOutfit: number; campaignOutfit: number }
  }
  const pins = { manifest: receipt.selectedManifestSha256, placements: receipt.placementSha256 }
  const storage = new GcsArtStorage()
  const pointer = local ? await readFile(resolve(local, CAMPAIGN_PREVIEW_INDEX)) : await loadSelected(storage)
  const selected = Buffer.isBuffer(pointer) ? parseCampaignRelease(json(pointer)) : pointer.release
  const { release, payloads, bundle } = await combatSpriteCandidate(selected, receipt.stagedRoot, pins, !local)
  if (bundle.outfit !== receipt.binding.authoredOutfit || bundle.outfit !== receipt.binding.campaignOutfit) throw new Error('Combat sprite outfit disagrees with intake')
  const manifest = encode(release)
  if (!dryRun && local && Buffer.isBuffer(pointer)) {
    const put = async (file: string, bytes: Buffer) => {
      const path = resolve(local, file)
      await mkdir(dirname(path), { recursive: true })
      try { await writeFile(path, bytes, { flag: 'wx' }) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || !(await readFile(path)).equals(bytes)) throw error
      }
    }
    await concurrent([...payloads], ([path, bytes]) => put(path, bytes))
    await put(campaignReleasePath(release.release), manifest)
    if (args.includes('--select')) {
      const path = resolve(local, CAMPAIGN_PREVIEW_INDEX)
      if (!(await readFile(path)).equals(pointer)) throw new GenerationConflict('Local campaign selection moved')
      const next = path + '.sprites-' + process.pid
      await writeFile(next, manifest, { flag: 'wx' })
      await rename(next, path)
    }
  } else if (!dryRun && !Buffer.isBuffer(pointer)) {
    const platform = new GcsArtStorage(undefined, undefined, COMBAT_SPRITE_PREFIX)
    const outfitRoot = COMBAT_SPRITE_PREFIX + bundle.outfit + '/'
    const platformIndex = outfitRoot + 'index.json'
    const prior = await platform.read(platformIndex)
    const ref = release.combatSprites!.find(row => row.outfit === bundle.outfit)!
    const platformPath = (file: CampaignReleaseFile) => ({ ...file, path: outfitRoot + file.path.split('/').at(-1)! })
    const index = encode({ schemaVersion: 1, outfit: bundle.outfit, version: bundle.version,
      manifest: platformPath(ref.manifest), placements: platformPath(ref.placements),
      pages: ref.pages.map(page => ({ file: page.file, ...platformPath(page) })) })
    await concurrent([...payloads], ([path, bytes]) => immutable(platform, outfitRoot + path.split('/').at(-1)!, bytes))
    await immutable(platform, outfitRoot + 'release.' + sha(index) + '.json', index)
    if (args.includes('--select') && !prior?.bytes.equals(index)) {
      await platform.put(platformIndex, index, prior?.generation ?? '0')
      if (!(await platform.read(platformIndex))?.bytes.equals(index)) throw new Error('Platform combat sprite index readback failed')
    }
    await concurrent([...payloads], async ([path, bytes]) => {
      const remote = await platform.read(outfitRoot + path.split('/').at(-1)!)
      if (!remote?.bytes.equals(bytes)) throw new Error(`Platform combat sprite payload changed: ${path}`)
      await immutable(storage, CAMPAIGN_PREFIX + path, remote.bytes)
    })
    await immutable(storage, CAMPAIGN_PREFIX + campaignReleasePath(release.release), manifest)
    if (args.includes('--select')) {
      if (!(await platform.read(platformIndex))?.bytes.equals(index)) throw new GenerationConflict('Platform combat sprite selection moved')
      await storage.put(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX, manifest, pointer.pointer.generation)
      const selected = await storage.read(CAMPAIGN_PREFIX + CAMPAIGN_PREVIEW_INDEX)
      if (!selected?.bytes.equals(manifest)) throw new Error('Combat sprite selection readback failed')
    }
  }
  console.log(JSON.stringify({ release: release.release, outfit: bundle.outfit, pages: Object.keys(bundle.pages).length,
    manifest: pins.manifest, base: selected.release, dryRun, selected: !dryRun && args.includes('--select') }))
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
