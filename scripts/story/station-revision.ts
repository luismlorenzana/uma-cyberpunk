import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  campaignPreviewIndex, documentsInStoryPage, parseCampaignRelease, requireCampaignIdentity,
  type CampaignReleaseFile,
} from '../../packages/domain/src/story/campaign'
import { stageCampaignRevision } from './campaign'

type Edit = { path: string; expect: unknown; replace: unknown }
type SceneRow = { id: string; key?: string; chapter?: string; status: string; stepsSha256?: string; vessel?: string | null;
  source?: { chapter: string }; edits?: Edit[]; fromPinnedRelease?: { edits: Edit[] } }
type RawScene = { id: string; steps: unknown[] }
type Chapter = { scenes: RawScene[] }
type Export = { packet: string; schemaVersion: number; revision: string; scenes: SceneRow[];
  art: { scene: string; sourceAsset: string | null }[];
  catalog: { operations: { id: string; watches: number | null }[] };
  openingExample: { recruit: { outfit: number; port: string } };
  calendar: { months: { id: string; days: number }[]; events: { id: string; label: string; month: string; day: number;
    scene: string; fromYear?: number; actors: (number | string)[]; prerequisites: string[] }[] } }

const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')
const decode = (bytes: Buffer) => JSON.parse(bytes.toString('utf8'))

function checked(path: string, sha256: string, length?: number): Buffer {
  const bytes = readFileSync(path)
  if (hash(bytes) !== sha256 || (length !== undefined && bytes.length !== length)) throw new Error(`${path}: integrity mismatch`)
  return bytes
}

function applySceneEdit(scene: RawScene, row: SceneRow, edit: Edit) {
  if (!/^steps\[\d+\](?:(?:\.[a-z]+)|(?:\[\d+\]))*$/i.test(edit.path)) {
    throw new Error(`${row.id}: unsafe step selector ${edit.path}`)
  }
  const keys = edit.path.match(/[a-z]+|\d+/gi)!
  if (keys.some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('Invalid step selector')
  const leaf = keys.pop()!
  let parent: unknown = scene
  for (const key of keys) {
    if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, key)) throw new Error(`${row.id}: step selector missing`)
    parent = (parent as Record<string, unknown>)[key]
  }
  if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, leaf)) throw new Error(`${row.id}: step selector missing`)
  const target = parent as Record<string, unknown>
  if (isDeepStrictEqual(target[leaf], edit.replace)) return
  if (!isDeepStrictEqual(target[leaf], edit.expect)) throw new Error(`${row.id} ${edit.path}: selected content changed`)
  target[leaf] = edit.replace
}

export function stageStationStory(out: string, storyRoot: string, packetRoot: string, revision: string) {
  const manifest = decode(readFileSync(join(packetRoot, 'cy126-story-manifest.json'))) as {
    packet: string; revision: string; files: { path: string; sha256: string }[]
  }
  if (manifest.packet !== 'CY126') throw new Error('Expected the CY126 Story manifest')
  const ledger = new Map(manifest.files.map(row => [row.path, row.sha256]))
  const source = ledger.get('cy126-story-export.json')
  if (!source) throw new Error('CY126 export is missing its pin')
  const handoff = decode(checked(join(packetRoot, 'cy126-story-export.json'), source)) as Export
  if (handoff.packet !== manifest.packet || handoff.schemaVersion !== 1 || handoff.revision !== manifest.revision) {
    throw new Error('CY126 manifest and export disagree')
  }

  const base = requireCampaignIdentity(parseCampaignRelease(decode(readFileSync(join(out, campaignPreviewIndex('four-act'))))), 'four-act')
  const read = (ref: CampaignReleaseFile) => decode(checked(join(out, ref.path), ref.sha256, ref.bytes))
  const values: Record<string, unknown> = {}
  if (base.storyPages) {
    for (const page of base.storyPages) Object.assign(values, documentsInStoryPage(page, read(page)))
    const config = base.files.find(row => row.source === 'campaign.json')
    if (!config) throw new Error('Missing selected campaign config pin')
    values[config.source] = read(config)
  } else for (const file of base.files) values[file.source] = read(file)
  for (const ref of base.files) {
    const selected = JSON.stringify(values[ref.source])
    if (selected === undefined || Buffer.byteLength(selected) !== ref.bytes || hash(selected) !== ref.sha256) {
      throw new Error(`${ref.source}: selected document failed integrity check`)
    }
  }

  const changes = []
  const transition = []
  for (const row of handoff.scenes) {
    if (row.status === 'new') {
      const chapter = row.chapter!
      if (!/^chapters\/cy126-[a-z-]+\.json$/.test(chapter) || !ledger.has(chapter)) throw new Error(`${row.id}: unverified chapter`)
      values[chapter] ??= decode(checked(join(storyRoot, chapter), ledger.get(chapter)!))
      if (!(values[chapter] as Chapter).scenes.some(scene => scene.id === row.id)) throw new Error(`${row.id}: missing scene`)
      transition.push({ key: row.key, scene: row.id })
      continue
    }
    const edits = row.fromPinnedRelease?.edits ?? row.edits
    if (!edits?.length) continue
    const chapter = row.source?.chapter ?? ''
    const scene = (values[chapter] as Chapter | undefined)?.scenes.find(scene => scene.id === row.id)
    if (!scene) throw new Error(`${row.id}: missing selected scene`)
    for (const edit of edits) applySceneEdit(scene, row, edit)
    changes.push({ scene: row.id, chapter, steps: edits.length })
  }
  const month = handoff.calendar.months.map(row => row.id)
  if (month.join(',') !== 'keel,signal,longlight,farwake' || handoff.calendar.months.some(row => row.days !== 30)) {
    throw new Error('Calendar does not match the campaign clock')
  }
  const { outfit, port } = handoff.openingExample.recruit
  const observances = handoff.calendar.events.map(event => {
    const actor = event.actors.find((id): id is number => typeof id === 'number')
    const local = event.id === 'lantern-tide'
    return { id: event.id, label: event.label, month: month.indexOf(event.month), day: event.day, earliestYear: event.fromYear ?? 1,
      makeupDays: local ? 119 : 7, scene: event.scene,
      ...(local ? { port, flag: event.prerequisites[0] } : {}), ...(actor === undefined ? {} : { actor }) }
  })
  const config = values['campaign.json'] as Record<string, unknown>
  const pinnedArt = new Set(base.assets.map(row => row.id))
  const transitionIds = new Set(transition.map(row => row.scene))
  const reuse = handoff.art.flatMap(row => transitionIds.has(row.scene) && row.sourceAsset && pinnedArt.has(row.sourceAsset)
    ? [{ scene: row.scene, backdrop: row.sourceAsset, portraits: [] }] : [])
  const pilotShip = handoff.scenes.find(row => row.key === 'errand-brief')?.vessel
  const commandWatches = handoff.catalog.operations.map(row => ({ id: row.id, watches: row.watches ?? 1 }))
  const existing = config.art as { scene: string }[]
  values['campaign.json'] = { ...config, art: [...existing, ...reuse.filter(row => !existing.some(current => current.scene === row.scene))],
    stationStory: { transition, observances, pilotShip, commandWatches, opening: { actor: outfit, port } } }
  const candidate = stageCampaignRevision(out, revision, base, values, 'four-act')
  const receipt = { base: base.release, release: candidate.release, story: handoff.revision, transition: transition.length,
    sharedBackdrops: reuse.length, operationTimings: commandWatches.length, edits: changes }
  writeFileSync(join(out, revision + '-story-receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  return receipt
}

const [releaseRoot, storyRoot, packetRoot, revision] = process.argv.slice(2)
if (!releaseRoot || !storyRoot || !packetRoot || !revision) {
  throw new Error('Use tsx scripts/story/station-revision.ts <local-release-root> <private-story-root> <private-packet-root> <revision>')
}
console.log(JSON.stringify(stageStationStory(resolve(releaseRoot), resolve(storyRoot), resolve(packetRoot), revision)))
