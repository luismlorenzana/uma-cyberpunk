import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { EVENTS, parsePublishConfig, sha, type ArtEvent } from './model'
import { GcsArtStorage } from './storage'
import { gameplayFingerprint, loadSelected, publishArtCandidate, rollbackArt } from './publish'
import { resolveArt } from './sources'

export async function main(args = process.argv.slice(2)) {
  const value = (flag: string) => {
    const at = args.findIndex(arg => arg === flag || arg.startsWith(flag + '='))
    return at < 0 ? undefined : args[at]!.includes('=') ? args[at]!.slice(flag.length + 1) : args[at + 1]
  }
  const allowed = ['--config', '--event', '--only', '--dry-run', '--stage-only', '--receipt', '--rollback', '--select']
  for (const arg of args.filter(arg => arg.startsWith('--'))) if (!allowed.some(flag => arg === flag || arg.startsWith(flag + '='))) throw new Error(`Unknown option ${arg}`)
  const event = value('--event') ?? 'all'
  if (!EVENTS.includes(event as ArtEvent)) throw new Error('Unknown Cyberpunk art event')
  const dryRun = args.includes('--dry-run')
  const storage = new GcsArtStorage()
  const rollback = value('--rollback') ?? value('--select')
  if (rollback) {
    const result = await rollbackArt(storage, rollback, dryRun)
    console.log(JSON.stringify(result))
    return
  }
  const configPath = resolve(value('--config') ?? process.env.CYBER_ART_CONFIG ?? 'content/campaign-art-plan/art-publish.json')
  let raw: unknown
  try { raw = JSON.parse(await readFile(configPath, 'utf8')) }
  catch { throw new Error(`Cyberpunk game publish needs its private binding registry: ${configPath}. Platform art can be repaired into the game with pnpm art:publish after the registry is configured.`) }
  const config = parsePublishConfig(raw)
  const selected = await loadSelected(storage)
  const assetIds = new Set(selected.release.assets.map(asset => asset.id))
  const only = (value('--only') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const normalized = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const inScope = (row: Record<string, unknown>) => !only.length || only.some(key => Object.values(row).some(v => normalized(v) === normalized(key)))
  const skipped = [...config.bindings.filter(b => !assetIds.has(b.asset)
    && (event === 'all' || event === (b.from.category ?? (b.from.collection === 'local' ? 'general' : b.from.collection)))
    && inScope(b.from as unknown as Record<string, unknown>)).map(b => `${b.asset}: not in selected campaign`),
    ...config.portraits.filter(b => !assetIds.has(b.base) && ['all', 'portraits'].includes(event) && inScope(b as unknown as Record<string, unknown>)).map(b => `${b.base}: not in selected campaign`)]
  const scoped = { ...config, bindings: config.bindings.filter(b => assetIds.has(b.asset)), portraits: config.portraits.filter(b => assetIds.has(b.base)) }
  const output = resolve(value('--receipt') ?? `content/campaign-art-plan/receipts/${Date.now()}.json`)
  await mkdir(dirname(output), { recursive: true })
  let result
  let sources
  try {
    const art = await resolveArt(storage, scoped, { event: event as ArtEvent, allowMissing: dryRun,
      only, contentRoot: resolve('content'), currentImages: new Map(selected.release.assets.map(asset => [asset.id, asset.sha256])) })
    art.skipped.push(...skipped)
    sources = art.sources
    result = await publishArtCandidate(storage, selected, art, { dryRun, stageOnly: args.includes('--stage-only') })
  } catch (error) {
    await writeFile(output, JSON.stringify({ schemaVersion: 1, universe: 'cyberpunk', event, sourceRelease: selected.release.release,
      sourceGeneration: selected.pointer.generation, status: 'failed', message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() }, null, 2) + '\n')
    throw error
  }
  const receipt = { schemaVersion: 1, universe: 'cyberpunk', event, sourceRelease: selected.release.release,
    sourceGeneration: selected.pointer.generation, release: result.release.release, promoted: result.promoted,
    dryRun, bindingsSha256: sha(Buffer.from(JSON.stringify(config))), gameplaySha256: gameplayFingerprint(selected.files),
    sources, changes: result.changes, skipped: result.skipped, at: new Date().toISOString() }
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
  console.log(`Cyberpunk art: ${result.changes.length} changed; ${result.skipped.length} unbound; ${result.promoted ? 'selected' : dryRun ? 'dry run' : 'staged or unchanged'} ${result.release.release}`)
  console.log(`Receipt: ${output}`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
}
