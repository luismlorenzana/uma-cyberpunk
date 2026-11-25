import { readFile, realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import type { CampaignCombatSprite, CampaignReleaseFile, CombatSpriteIdentity, CombatSpriteLoadout } from '../../packages/domain/src/story/index'
import { parseCompleteSpriteBundle } from '../../apps/web/src/board/complete-sprite-format'
import { sha } from './model'

export interface CompleteSpritePlacement {
  setId: string; view: string; pose: string; page: string; sha256: string
  rect: { x: number; y: number; width: number; height: number }
  pivot: { x: number; y: number }
  bounds?: { x: number; y: number; width: number; height: number }
}

export async function readCompleteSpriteSource(directory: string, source: { manifest: string; placements: string }) {
  const root = await realpath(directory)
  const payloads = new Map<string, Buffer>()
  async function pinned(file: string, extension: 'json' | 'png', expected: string): Promise<CampaignReleaseFile> {
    const path = await realpath(resolve(root, file))
    if (!path.startsWith(root + sep)) throw new Error('Complete sprite payload outside its approved album')
    const bytes = await readFile(path)
    if (sha(bytes) !== expected) throw new Error('Complete sprite approval hash differs: ' + file)
    const key = 'campaign/files/pack.' + expected + '.' + extension
    payloads.set(key, bytes)
    return { path: key, sha256: expected, bytes: bytes.length }
  }
  const manifest = await pinned('bundle.json', 'json', source.manifest)
  const bundle = parseCompleteSpriteBundle(JSON.parse(payloads.get(manifest.path)!.toString()))
  if (bundle.status !== 'approved') throw new Error('A complete sprite source requires album approval')
  const placements = await pinned('asset-placements.json', 'json', source.placements)
  const data = JSON.parse(payloads.get(placements.path)!.toString())
  const placementRows: unknown[] = data.frames
  const expectedFrames = new Map(bundle.sets.flatMap(set => bundle.views.flatMap(view =>
    Object.entries(set.frames[view]).map(([pose, cel]) => [set.id + '/' + view + '/' + pose, cel] as const))))
  if (data.character !== bundle.character || data.status !== 'approved' || data.version !== bundle.version ||
    JSON.stringify(data.cell) !== JSON.stringify(bundle.cell) || JSON.stringify(data.foot) !== JSON.stringify(bundle.foot) ||
    JSON.stringify(data.views) !== JSON.stringify(bundle.views) || !Array.isArray(placementRows) || placementRows.length !== expectedFrames.size) {
    throw new Error('Complete sprite placements disagree with the manifest')
  }
  const frames: CompleteSpritePlacement[] = []
  for (const value of placementRows) {
    if (!value || typeof value !== 'object') throw new Error('Invalid complete sprite placement')
    const row = value as CompleteSpritePlacement
    const key = row.setId + '/' + row.view + '/' + row.pose
    const cel = expectedFrames.get(key)
    if (!cel || row.page !== cel.page || row.sha256 !== cel.sha256 ||
      !cel.rect.every((dimension, index) => dimension === [row.rect?.x, row.rect?.y, row.rect?.width, row.rect?.height][index]) ||
      row.pivot?.x !== bundle.foot[0] || row.pivot?.y !== bundle.foot[1]) throw new Error('Complete sprite placement differs: ' + key)
    expectedFrames.delete(key)
    frames.push(row)
  }

  const pages = await Promise.all(Object.values(bundle.pages).map(async page => {
    const entry = await pinned(page.file, 'png', page.sha256)
    const bytes = payloads.get(entry.path)!
    if (entry.bytes !== page.bytes || entry.bytes < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(16) !== page.width || bytes.readUInt32BE(20) !== page.height) {
      throw new Error('Complete sprite atlas dimensions differ: ' + page.file)
    }
    return { file: page.file, ...entry }
  }))
  return { bundle, manifest, placements, pages, payloads, frames }
}

export async function readCompleteCombatSprite(directory: string, source: {
  manifest: string; placements: string; character: string; version: string; loadouts: CombatSpriteLoadout[]; compatibleOnly?: boolean
}, identity: CombatSpriteIdentity) {
  const { bundle, manifest, placements, pages, payloads } = await readCompleteSpriteSource(directory, source)
  if (bundle.character !== source.character || bundle.version !== source.version ||
    (!source.compatibleOnly && source.loadouts.length !== bundle.sets.length) || source.loadouts.some(row => !bundle.sets.some(set => set.id === row.set))) {
    throw new Error('Complete sprite identity or loadouts differ from the approved album')
  }
  const ref: CampaignCombatSprite = { ...identity, manifest, placements, pages, loadouts: source.loadouts }
  return { ref, payloads }
}
