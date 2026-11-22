import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { main as publishGame } from './cli'
import { parsePublishConfig, type PublishConfig } from './model'

const normalized = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** One wardrobe cohort: all Platform stages succeed before the game selection can move. */
export async function syncWardrobes(config: PublishConfig, options: { root: string; only: string[]; dryRun: boolean },
  run: (args: string[]) => Promise<void>, publish: (selectors: string[]) => Promise<void>): Promise<void> {
  const actors = (config.wardrobes ?? []).filter(actor => !options.only.length || options.only.some(key =>
    [actor.speaker, actor.character, actor.from.character, actor.from.unitId].some(value => normalized(value) === normalized(key))))
  for (const key of options.only) if (!actors.some(actor => [actor.speaker, actor.character, actor.from.character, actor.from.unitId]
    .some(value => normalized(value) === normalized(key)))) throw new Error(`Unregistered wardrobe identity: ${key}`)
  if (!actors.length) throw new Error('No registered cast wardrobes to publish')
  const script = resolve(options.root, 'src/push.ts')
  if (!existsSync(script)) throw new Error('Art authoring checkout needs src/push.ts; set UMA_ART_AUTHORING_ROOT or authoringRoot in the private registry')
  // Translate game speaker IDs to the authoring character keys for all three collections.
  const selectors = actors.map(actor => actor.character).join(',')
  for (const flags of [[], ['--enemies'], ['--portraits']]) {
    await run(['--import', 'tsx', script, 'cyberpunk', ...flags, '--only', selectors, '--no-release', ...(options.dryRun ? ['--dry-run'] : [])])
  }
  await publish(actors.map(actor => actor.character))
}

export async function main(args = process.argv.slice(2)) {
  const valued = ['--config', '--only', '--receipt', '--authoring-root'], switches = ['--dry-run', '--stage-only']
  const values = new Map<string, string>()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (switches.includes(arg)) continue
    if (!valued.includes(arg) || !args[i + 1] || args[i + 1]!.startsWith('--')) throw new Error(`Invalid wardrobe sync option: ${arg}`)
    values.set(arg, args[++i]!)
  }
  const configPath = resolve(values.get('--config') ?? process.env.CYBER_ART_CONFIG ?? 'content/campaign-art-plan/art-publish.json')
  const config = parsePublishConfig(JSON.parse(await readFile(configPath, 'utf8')))
  const root = values.get('--authoring-root') ?? process.env.UMA_ART_AUTHORING_ROOT ?? config.authoringRoot
  if (!root) throw new Error('Set UMA_ART_AUTHORING_ROOT or authoringRoot in the private registry')
  const only = (values.get('--only') ?? '').split(',').map(value => value.trim()).filter(Boolean)
  await syncWardrobes(config, { root: resolve(root), only, dryRun: args.includes('--dry-run') }, async producerArgs => {
    const result = spawnSync(process.execPath, producerArgs, { cwd: resolve(root), stdio: 'inherit', windowsHide: true })
    if (result.error || result.status !== 0) throw new Error('Art source publication stopped; game selection was not changed. Inspect Platform/source status before retrying.')
  }, async selectors => { await publishGame(['--config', configPath, '--event', 'all', '--only', selectors.join(','),
    ...args.filter(arg => switches.includes(arg)), ...(values.has('--receipt') ? ['--receipt', values.get('--receipt')!] : [])]) })
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
}
