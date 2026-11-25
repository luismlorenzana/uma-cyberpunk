import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { EVENTS, parsePublishConfig, sha, type ArtEvent } from './model'
import { COMBAT_SPRITE_PREFIX, GcsArtStorage } from './storage'
import { gameplayFingerprint, loadSelected, publishArtCandidate, rollbackArt } from './publish'
import { resolveArt } from './sources'
import { publishCombatSprites, readSpriteApprovalIndex } from './combat-sprite-release'
import { readLocalSplashRelease, resolveSplashBindings } from './splash-bindings'

export async function main(args = process.argv.slice(2)) {
  const value = (flag: string) => {
    const at = args.findIndex(arg => arg === flag || arg.startsWith(flag + '='))
    if (at < 0) return undefined
    const input = args[at]!.includes('=') ? args[at]!.slice(flag.length + 1) : args[at + 1]
    if (!input || input.startsWith('--')) throw new Error(flag + ' needs a value')
    return input
  }
  const flags = ['--config', '--event', '--only', '--receipt', '--rollback', '--select', '--sprite-sources', '--from-staged', '--splash-bindings', '--local-release', '--campaign']
  for (const arg of args.filter(arg => arg.startsWith('--'))) if (arg !== '--dry-run' && arg !== '--stage-only' &&
    !flags.some(flag => arg === flag || arg.startsWith(flag + '='))) throw new Error(`Unknown option ${arg}`)
  const event = value('--event') ?? 'all'
  if (!EVENTS.includes(event as ArtEvent)) throw new Error('Unknown Cyberpunk art event')
  const dryRun = args.includes('--dry-run')
  const storage = new GcsArtStorage()
  const only = (value('--only') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (args.some(arg => arg === '--only' || arg.startsWith('--only=')) && !only.length) throw new Error('--only needs one or more source identities')
  const rollback = value('--rollback') ?? value('--select')
  const campaign = value('--campaign') ?? 'current'
  if (campaign !== 'current' && campaign !== 'pilot' && campaign !== 'four-act') {
    throw new Error('--campaign accepts current, pilot or four-act')
  }
  const stagedRelease = value('--from-staged')
  if (stagedRelease && (event !== 'combat-sprites' || dryRun || rollback || args.includes('--stage-only'))) {
    throw new Error('--from-staged only selects a previously staged combat sprite release')
  }
  if (rollback && event !== 'combat-sprites') {
    const result = await rollbackArt(storage, rollback, dryRun, campaign)
    console.log(JSON.stringify(result))
    return
  }
  if (event === 'combat-sprites') {
    const sourcePath = resolve(value('--sprite-sources') ?? process.env.CYBER_COMBAT_SPRITE_SOURCES ??
      (campaign === 'four-act' ? 'content/campaign-art-plan/four-act-combat-sprite-sources.json' : 'content/campaign-art-plan/combat-sprite-sources.json'))
    const output = resolve(value('--receipt') ?? `content/campaign-art-plan/receipts/combat-sprites-${Date.now()}.json`)
    if (sourcePath === output) throw new Error('Combat sprite receipts need a separate file from the producer approval index')
    const journal: Record<string, unknown> = { schemaVersion: 1, universe: 'cyberpunk', campaign, event, only, dryRun, at: new Date().toISOString() }
    const stages: string[] = []
    const record = async (status: string) => {
      await writeFile(output, JSON.stringify({ ...journal, stages, status }, null, 2) + '\n')
    }
    await mkdir(dirname(output), { recursive: true })
    try {
      if (rollback) {
        if (only.length || args.includes('--stage-only')) throw new Error('Combat sprite rollback selects a whole campaign release')
        journal.rollback = rollback
        await record('preflight')
        const result = await rollbackArt(storage, rollback, dryRun, campaign)
        Object.assign(journal, result)
        await record(dryRun ? 'rollback-planned' : 'rolled-back')
        console.log(`Cyberpunk combat sprites: ${dryRun ? 'planned rollback to' : 'restored'} ${result.release}. Receipt: ${output}`)
        return
      }
      const sources = await readSpriteApprovalIndex(sourcePath, only)
      const selected = await loadSelected(storage, campaign)
      Object.assign(journal, { campaign, sourceRevision: sources.revision, sourceSha256: sources.sha256, sourceRelease: selected.release.release,
        sourceGeneration: selected.pointer.generation, gameplaySha256: gameplayFingerprint(selected.files),
        bundles: sources.bundles.map(row => ({ character: row.character, outfit: row.outfit, version: row.version, approval: row.status,
          ...(row.form ? { form: row.form, roles: row.roles } : {}),
          manifestSha256: row.manifest, ...(row.status === 'approved' ? { placementsSha256: row.placements, pages: row.pages } : {}) })) })
      await record('preflight')
      const platform = new GcsArtStorage(undefined, undefined, COMBAT_SPRITE_PREFIX)
      if (stagedRelease) journal.stagedRelease = stagedRelease
      const result = await publishCombatSprites(storage, platform, selected, sources, { dryRun, stageOnly: args.includes('--stage-only'), stagedRelease, campaign,
        report: async (stage, release) => { journal.release = release; stages.push(stage); await record('publishing') } })
      Object.assign(journal, result)
      await record(result.status)
      console.log(`Cyberpunk combat sprites: ${result.status} ${result.release}. Receipt: ${output}`)
    } catch (error) {
      journal.message = error instanceof Error ? error.message : String(error)
      await record('failed')
      throw error
    }
    return
  }
  if (value('--sprite-sources')) throw new Error('--sprite-sources requires --event combat-sprites')
  const localRelease = value('--local-release')
  const splashBindings = value('--splash-bindings')
  if (event === 'splashes') {
    if (localRelease && !dryRun) throw new Error('--local-release supports splash dry runs only')
    const source = resolve(splashBindings ?? process.env.CYBER_SPLASH_BINDINGS ?? 'content/campaign-art-plan/splash-bindings.json')
    const output = resolve(value('--receipt') ?? `content/campaign-art-plan/receipts/splashes-${Date.now()}.json`)
    if (source === output) throw new Error('Splash receipts need a separate file from the binding registry')
    const target = localRelease ? readLocalSplashRelease(resolve(localRelease)) : storage
    const selected = await loadSelected(target, campaign)
    const summary = { schemaVersion: 1, universe: 'cyberpunk', campaign, event, only, sourceRelease: selected.release.release,
      sourceGeneration: selected.pointer.generation, gameplaySha256: gameplayFingerprint(selected.files), dryRun, at: new Date().toISOString() }
    await mkdir(dirname(output), { recursive: true })
    let result
    try {
      const art = await resolveSplashBindings(source, selected, storage, { only, dryRun, localAssets: !!localRelease })
      result = await publishArtCandidate(target, selected, art, { dryRun, stageOnly: args.includes('--stage-only') })
      await writeFile(output, JSON.stringify({ ...summary, release: result.release.release, promoted: result.promoted, changes: result.changes,
        sources: art.sources, splashRoutes: art.sceneSplashes }, null, 2) + '\n')
    } catch (error) {
      await writeFile(output, JSON.stringify({ ...summary, status: 'failed', message: error instanceof Error ? error.message : String(error) }, null, 2) + '\n')
      throw error
    }
    console.log(`Cyberpunk splashes: ${result.changes.length} changed in ${result.release.release}. Receipt: ${output}`)
    return
  }
  if (splashBindings) throw new Error('--splash-bindings requires --event splashes')
  if (localRelease && (event !== 'general' || !dryRun)) throw new Error('--local-release supports general and splash dry runs only')
  const configPath = resolve(value('--config') ?? process.env.CYBER_ART_CONFIG ?? (campaign === 'four-act' ?
    'content/campaign-art-plan/four-act-art-publish.json' : 'content/campaign-art-plan/art-publish.json'))
  let raw: unknown
  try { raw = JSON.parse(await readFile(configPath, 'utf8')) }
  catch { throw new Error(`Cyberpunk game publish needs its private binding registry: ${configPath}. Platform art can be repaired into the game with pnpm art:publish after the registry is configured.`) }
  const config = parsePublishConfig(raw)
  const target = localRelease ? readLocalSplashRelease(resolve(localRelease)) : storage
  const selected = await loadSelected(target, campaign)
  const assetIds = new Set(selected.release.assets.map(asset => asset.id))
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
      only, contentRoot: resolve('content'), wardrobe: selected.book.wardrobe, currentImages: new Map(selected.release.assets.map(asset => [asset.id, asset.sha256])) })
    art.skipped.push(...skipped)
    sources = art.sources
    result = await publishArtCandidate(target, selected, art, { dryRun, stageOnly: args.includes('--stage-only') })
  } catch (error) {
    await writeFile(output, JSON.stringify({ schemaVersion: 1, universe: 'cyberpunk', campaign, event, sourceRelease: selected.release.release,
      sourceGeneration: selected.pointer.generation, status: 'failed', message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() }, null, 2) + '\n')
    throw error
  }
  const receipt = { schemaVersion: 1, universe: 'cyberpunk', campaign, event, sourceRelease: selected.release.release,
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
