import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { Plugin } from 'vite'
import { parseCombatEffects, parseSpriteBundle } from './src/board/combat-sprite-format'

export function localCombatSpriteReview(receiptPath: string): Plugin {
  return {
    name: 'cyber-local-combat-sprite-review',
    apply: 'serve',
    configureServer(server) {
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
        stagedRoot: string; selectedManifestSha256: string; placementSha256: string
        binding: { character: string; authoredOutfit: number; campaignOutfit: number }
      }
      const root = realpathSync(receipt.stagedRoot)
      const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
      const read = (file: string) => {
        const target = realpathSync(resolve(root, file))
        if (!target.startsWith(root + sep)) throw new Error('Combat sprite file outside local review root')
        return readFileSync(target)
      }
      const manifest = read('bundle.json')
      if (digest(manifest) !== receipt.selectedManifestSha256) throw new Error('Local combat sprite manifest hash mismatch')
      const bundle = parseSpriteBundle(JSON.parse(manifest.toString()))
      const binding = receipt.binding
      if (!binding || binding.character !== bundle.character || binding.authoredOutfit !== bundle.outfit
          || !Number.isSafeInteger(binding.campaignOutfit) || binding.campaignOutfit <= 0) throw new Error('Missing or invalid local combat sprite identity binding')
      const effects = read('asset-placements.json')
      if (digest(effects) !== receipt.placementSha256) throw new Error('Local combat sprite placements hash mismatch')
      parseCombatEffects(JSON.parse(effects.toString()), bundle)
      const files = new Map<string, { bytes: Buffer; type: string }>([
        ['bundle.json', { bytes: manifest, type: 'application/json' }],
        ['binding.json', { bytes: Buffer.from(JSON.stringify({ outfit: binding.campaignOutfit })), type: 'application/json' }],
        ['asset-placements.json', { bytes: effects, type: 'application/json' }],
      ])
      for (const page of Object.values(bundle.pages)) {
        const bytes = read(page.file)
        if (bytes.length !== page.bytes || digest(bytes) !== page.sha256) throw new Error('Local combat sprite page hash mismatch: ' + page.file)
        files.set(page.file, { bytes, type: 'image/png' })
      }
      server.middlewares.use('/__cyber-combat-sprites', (req, res) => {
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
        const file = files.get(req.url?.slice(1) ?? '')
        if (!local || req.method !== 'GET' || !file) { res.writeHead(404).end(); return }
        res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'private, no-store' }).end(file.bytes)
      })
      server.middlewares.use('/__cy57-training', async (req, res, next) => {
        if (req.method !== 'GET' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) { next(); return }
        try {
          const url = '/__cy57-training' + (req.url ?? '')
          const html = await server.transformIndexHtml(url, '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Training Deck review</title></head><body><div id="root"></div><script type="module" src="/src/campaign/TrainingReview.tsx"></script></body></html>')
          res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'private, no-store' }).end(html)
        } catch (error) { next(error) }
      })
    },
  }
}
