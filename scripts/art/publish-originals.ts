import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { sha } from './model'
import { publishOriginalImages, readOriginalAlbum, readOriginalBindings } from './originals'
import { gameplayFingerprint, loadSelected } from './publish'
import { GcsArtStorage, ORIGINAL_ART_PREFIX } from './storage'

async function main() {
  const { values } = parseArgs({ options: {
    album: { type: 'string' }, bindings: { type: 'string' }, receipt: { type: 'string' },
    'expect-release': { type: 'string' },
    'dry-run': { type: 'boolean' }, 'stage-only': { type: 'boolean' },
  } })
  if (!values.album || !values.bindings || !values.receipt) throw new Error('Pass --album, --bindings and --receipt')
  if (values['dry-run'] && values['stage-only']) throw new Error('Select either --dry-run or --stage-only')
  const output = resolve(values.receipt), bindingFile = resolve(values.bindings)
  if (output === bindingFile) throw new Error('Use a separate file for the publication receipt')
  const storage = new GcsArtStorage()
  const platform = new GcsArtStorage(undefined, undefined, ORIGINAL_ART_PREFIX)
  const [album, bytes, selected] = await Promise.all([readOriginalAlbum(resolve(values.album)), readFile(bindingFile), loadSelected(storage, 'four-act')])
  const bindings = readOriginalBindings(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')))
  const result = await publishOriginalImages(storage, platform, selected, album, bindings, {
    dryRun: values['dry-run'], stageOnly: values['stage-only'], expectRelease: values['expect-release'],
  })
  const receipt = {
    schemaVersion: 1, campaign: selected.campaign, collection: album.collection, sourceRelease: selected.release.release,
    sourceGeneration: selected.pointer.generation, gameplaySha256: gameplayFingerprint(selected.files),
    assets: album.entries, bindings, bindingsSha256: sha(bytes), ...result,
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
  console.log(`Original art ${album.collection}: ${album.entries.length} approved images, ${result.changes} campaign changes, ${result.release}. Receipt: ${output}`)
}

void main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
