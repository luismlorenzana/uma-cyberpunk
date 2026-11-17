import { createHash, randomUUID } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import {
  CAMPAIGN_PREVIEW_INDEX, CAMPAIGN_RELEASE_PATH, campaignReleasePath, parseCampaignBook, parseCampaignRelease,
  type CampaignRelease, type CampaignReleaseFile,
} from '../../packages/domain/src/story/index'
import { readStoryFiles } from './files'

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

function readJson(file: string): unknown {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (error) { throw new Error(`${file}: ${String(error)}`) }
}

function writeAtomic(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, bytes, { flag: 'wx' })
    renameSync(temporary, path)
  } finally {
    rmSync(temporary, { force: true })
  }
}

function writeRelease(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  let fd: number
  try { fd = openSync(path, 'wx') } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if (!readFileSync(path).equals(bytes)) throw new Error(`${path}: a different release already exists`)
    return
  }
  try {
    try { writeFileSync(fd, bytes) } finally { closeSync(fd) }
  } catch (error) {
    rmSync(path, { force: true })
    throw error
  }
}

function packed(bytes: Buffer, extension: string): CampaignReleaseFile {
  const sha256 = sha(bytes)
  return { path: `campaign/files/pack.${sha256}${extension}`, sha256, bytes: bytes.length }
}

function verifiedArt(path: string): Buffer {
  const bytes = readFileSync(path)
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (extname(path) === '.png' ? !isPng : !isWebp) throw new Error(`${path}: image header does not match its extension`)
  return bytes
}

function source(dir: string) {
  const story = readStoryFiles(dir)
  if (!story) throw new Error(`${dir}: no story source`)
  if (story.problems.length) throw new Error(story.problems.map((p) => `${p.file}: ${p.message}`).join('\n'))
  const files = { ...story.files, 'campaign.json': readJson(join(dir, 'campaign.json')) }
  const book = parseCampaignBook(files)
  const assets = book.assets.map(({ id, file }) => {
    const bytes = verifiedArt(join(dir, 'art', file))
    return { id, bytes, extension: extname(file) }
  })
  return { files, assets }
}

/** Assemble an immutable release in the private preview directory. Selecting it is a separate operation. */
export function packCampaign(dir: string, out: string, release: string): CampaignRelease {
  const path = campaignReleasePath(release)
  if (!CAMPAIGN_RELEASE_PATH.test(path)) throw new Error('Release must be a lowercase slug')
  const input = source(dir)
  const files = Object.entries(input.files).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => {
    const bytes = Buffer.from(JSON.stringify(value))
    return { bytes, ref: { source: name, ...packed(bytes, '.json') } }
  })
  const assets = input.assets.map(({ id, bytes, extension }) => ({ bytes, ref: { id, ...packed(bytes, extension) } }))
  const index = parseCampaignRelease({ schemaVersion: 1, release, files: files.map((f) => f.ref), assets: assets.map((a) => a.ref) })
  for (const { ref, bytes } of [...files, ...assets]) writeAtomic(join(out, ref.path), bytes)
  writeRelease(join(out, path), Buffer.from(`${JSON.stringify(index, null, 2)}\n`))
  return index
}

/** Publish or roll back the preview pointer once all referenced files pass verification. */
export function selectCampaign(out: string, release: string): CampaignRelease {
  const path = campaignReleasePath(release)
  if (!CAMPAIGN_RELEASE_PATH.test(path)) throw new Error('Release must be a lowercase slug')
  const index = parseCampaignRelease(readJson(join(out, path)), path)
  if (index.release !== release) throw new Error(`${path}: release ID does not match the filename`)
  for (const file of [...index.files, ...index.assets]) {
    const bytes = readFileSync(join(out, file.path))
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw new Error(`${file.path}: failed integrity check`)
  }
  writeAtomic(join(out, CAMPAIGN_PREVIEW_INDEX), Buffer.from(`${JSON.stringify(index, null, 2)}\n`))
  return index
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [command, release] = process.argv.slice(2)
  const arg = (flag: string) => {
    const index = process.argv.indexOf(flag)
    return index < 0 ? undefined : process.argv[index + 1]
  }
  const dir = resolve(arg('--dir') ?? 'content/campaign')
  const out = resolve(arg('--out') ?? 'content/campaign-release')
  try {
    if (command === 'check') { source(dir); console.log('Campaign source and art are valid') }
    else if (command === 'pack' && release) { const index = packCampaign(dir, out, release); console.log(`Packed ${index.release} with ${index.files.length} story files and ${index.assets.length} images`) }
    else if (command === 'select' && release) { selectCampaign(out, release); console.log(`Preview now serves ${release}`) }
    else throw new Error('Use pnpm campaign check, pack <release>, or select <release>')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
