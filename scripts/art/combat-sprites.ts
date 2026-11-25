import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { campaignPreviewIndex, campaignReleasePath, combatSpriteKey, parseCampaignRelease, requireCampaignIdentity, parseCombatSpriteIdentity, P,
  type CampaignCombatSprite, type CampaignRelease, type CampaignReleaseFile, type CombatSpriteIdentity } from '../../packages/domain/src/story/index'
import { parseCombatEffects, parseSpriteBundle } from '../../apps/web/src/board/combat-sprite-format'
import { GenerationConflict } from './storage'
import { concurrent } from './concurrent'

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const json = (bytes: Buffer): unknown => JSON.parse(bytes.toString())
const encode = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + '\n')

export async function readCombatSprite(directory: string, pins: { manifest: string; placements: string }, publish: boolean, binding?: CombatSpriteIdentity) {
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
  const identity = binding ?? (typeof bundle.outfit === 'number' ? { outfit: bundle.outfit } : undefined)
  if (identity && identity.outfit !== bundle.outfit) throw new Error('Combat sprite outfit disagrees with intake: ' + directory)
  if (!identity || (publish && bundle.status !== 'approved')) {
    throw new Error('Publication requires an approved bundle with a canonical outfit or heroine binding')
  }
  const pages = await Promise.all(Object.values(bundle.pages).map(async page => {
    const bytes = await read(page.file)
    if (bytes.length !== page.bytes || sha(bytes) !== page.sha256 || bytes.length < 33 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR' ||
      bytes.readUInt32BE(16) !== page.width || bytes.readUInt32BE(20) !== page.height) throw new Error('Invalid combat sprite page: ' + page.file)
    return { file: page.file, ...add(bytes, 'png') }
  }))
  pages.sort((a, b) => a.file.localeCompare(b.file))
  const ref: CampaignCombatSprite = { ...identity, manifest, placements, pages }
  return { ref, payloads, bundle }
}

export function withCombatSprites(selected: CampaignRelease, refs: ReadonlyMap<string, CampaignCombatSprite>) {
  const byOutfit = (a: CampaignCombatSprite, b: CampaignCombatSprite) => typeof a.outfit === 'number' && typeof b.outfit === 'number'
    ? a.outfit - b.outfit : combatSpriteKey(a).localeCompare(combatSpriteKey(b))
  const normalize = (rows: NonNullable<CampaignRelease['combatSprites']>) => encode([...rows].sort(byOutfit)
    .map(row => ({ ...row, pages: [...row.pages].sort((a, b) => a.file.localeCompare(b.file)) })))
  const combatSprites = [...refs.values()].sort(byOutfit)
  if (normalize(combatSprites).equals(normalize(selected.combatSprites ?? []))) return selected
  return parseCampaignRelease({ ...selected, combatSprites,
    release: 'sprite-' + sha(encode({ files: selected.files, assets: selected.assets, combatSprites })).slice(0, 20) })
}

async function main() {
  const argv = process.argv.slice(2)
  const split = argv.findIndex(arg => arg.startsWith('--'))
  const inputs = split < 0 ? argv : argv.slice(0, split)
  const args = split < 0 ? [] : argv.slice(split)
  const localAt = args.indexOf('--local')
  const local = localAt >= 0 ? args[localAt + 1] : undefined
  const dryRun = args.includes('--dry-run')
  const pilot = args.includes('--pilot'), fourAct = args.includes('--four-act')
  if (pilot && fourAct) throw new Error('Select one campaign identity')
  const campaign = fourAct ? 'four-act' : pilot ? 'pilot' : 'current'
  if (!inputs.length) throw new Error('Pass local review receipts and --local <release root>')
  if (args.includes('--cloud')) {
    if (localAt >= 0) throw new Error('Choose one combat sprite destination')
    if (inputs.length !== 1) throw new Error('Pass one cloud approval index containing the batch')
    const { main: publish } = await import('./cli')
    await publish(['--event', 'combat-sprites', '--sprite-sources', inputs[0]!, '--campaign', campaign,
      ...(dryRun ? ['--dry-run'] : []), ...(args.includes('--select') ? [] : ['--stage-only'])])
    return
  }
  if (!local || local.startsWith('--')) throw new Error('Pass local review receipts and --local <release root>')
  const selectedPath = campaignPreviewIndex(campaign)
  const pointer = await readFile(resolve(local, selectedPath))
  const selected = requireCampaignIdentity(parseCampaignRelease(json(pointer)), campaign)
  const payloads = new Map<string, Buffer>()
  const refs = new Map((selected.combatSprites ?? []).map(row => [combatSpriteKey(row), row]))
  const verified = new Map<string, { outfit: number | string; form?: string; pages: number; manifest: string }>()
  await concurrent(inputs, async (input) => {
    const receipt = json(await readFile(resolve(input))) as {
      stagedRoot: string; selectedManifestSha256: string; placementSha256: string
      binding: { authoredOutfit: number | string; campaignOutfit: number | string; form?: string; roles?: unknown }
    }
    const pins = { manifest: receipt.selectedManifestSha256, placements: receipt.placementSha256 }
    const binding = parseCombatSpriteIdentity(new P(input), { outfit: receipt.binding.campaignOutfit,
      form: receipt.binding.form, roles: receipt.binding.roles }, 'binding')
    const stage = await readCombatSprite(receipt.stagedRoot, pins, false, binding)
    const { outfit } = stage.ref
    if (outfit !== receipt.binding.authoredOutfit || outfit !== receipt.binding.campaignOutfit) {
      throw new Error('Combat sprite outfit disagrees with intake: ' + input)
    }
    const key = combatSpriteKey(stage.ref)
    if (verified.has(key)) throw new Error('Duplicate outfit in local combat sprite batch: ' + outfit)
    refs.set(key, stage.ref)
    verified.set(key, { outfit, ...(binding.form ? { form: binding.form } : {}), pages: Object.keys(stage.bundle.pages).length, manifest: pins.manifest })
    for (const [path, bytes] of stage.payloads) payloads.set(path, bytes)
  })
  const release = withCombatSprites(selected, refs)
  const manifest = encode(release)
  if (!dryRun && release !== selected) {
    const put = async (file: string, bytes: Buffer) => {
      const path = resolve(local, file)
      await mkdir(dirname(path), { recursive: true })
      try { await writeFile(path, bytes, { flag: 'wx' }) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || !(await readFile(path)).equals(bytes)) throw error
      }
    }
    await concurrent([...payloads], ([path, bytes]) => put(path, bytes))
    await put(campaignReleasePath(release.release, campaign), manifest)
    if (args.includes('--select')) {
      const path = resolve(local, selectedPath)
      if (!(await readFile(path)).equals(pointer)) throw new GenerationConflict('Local campaign selection moved')
      const next = path + '.sprites-' + process.pid
      await writeFile(next, manifest, { flag: 'wx' })
      await rename(next, path)
    }
  }
  const bundles = [...verified.values()].sort((a, b) => typeof a.outfit === 'number' && typeof b.outfit === 'number'
    ? a.outfit - b.outfit : combatSpriteKey(a).localeCompare(combatSpriteKey(b)))
  console.log(JSON.stringify({ release: release.release, ...(bundles.length === 1 ? bundles[0]! : { bundles }),
    base: selected.release, dryRun, selected: !dryRun && args.includes('--select') }))
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
