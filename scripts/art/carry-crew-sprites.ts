import { resolve } from 'node:path'
import { campaignPreviewIndex, campaignReleasePath, combatSpriteKey, parseCampaignRelease } from '../../packages/domain/src/story/index'
import { parseCombatEffects, parseSpriteBundle } from '../../apps/web/src/board/combat-sprite-format'
import { concurrent } from './concurrent'
import { withCombatSprites } from './combat-sprites'
import { immutable, loadSelected, verify } from './publish'
import { CAMPAIGN_PREFIX, GcsArtStorage, type ArtStorage } from './storage'

/** Adopt previously published native crew bundles for the same recruited outfit IDs. */
export async function carryPublishedCrewSprites(store: ArtStorage, stageOnly = false) {
  const campaign = 'four-act' as const
  const selected = await loadSelected(store, campaign)
  const prior = await store.read(CAMPAIGN_PREFIX + campaignPreviewIndex('current'))
  if (!prior) throw new Error('The former Cyberpunk campaign has no published sprite references')
  const source = parseCampaignRelease(JSON.parse(prior.bytes.toString()))
  const allowed = new Set(selected.book.recruits?.map(row => row.outfit))
  const sprites = new Map((selected.release.combatSprites ?? []).map(row => [combatSpriteKey(row), row]))
  const incoming = (source.combatSprites ?? []).filter(row => typeof row.outfit === 'number' && allowed.has(row.outfit) && !sprites.has(combatSpriteKey(row)))
  const read = async (ref: { path: string; bytes: number; sha256: string }) => {
    const stored = await store.read(CAMPAIGN_PREFIX + ref.path)
    if (!stored) throw new Error(`Published sprite payload missing at ${ref.path}`)
    verify(ref, stored.bytes)
    return stored.bytes
  }
  await concurrent(incoming, async row => {
    const bundle = parseSpriteBundle(JSON.parse((await read(row.manifest)).toString()))
    if (bundle.outfit !== row.outfit || bundle.status !== 'approved') throw new Error(`Published sprite identity disagrees for ${row.outfit}`)
    parseCombatEffects(JSON.parse((await read(row.placements)).toString()), bundle)
    const pages = Object.values(bundle.pages)
    if (pages.length !== row.pages.length || pages.some(page => !row.pages.some(ref => ref.file === page.file && ref.sha256 === page.sha256 && ref.bytes === page.bytes))) {
      throw new Error(`Published sprite atlas disagrees for ${row.outfit}`)
    }
    await concurrent(row.pages, async page => { await read(page) }, 4)
    sprites.set(combatSpriteKey(row), row)
  }, 6)
  const release = withCombatSprites(selected.release, sprites)
  if (release === selected.release) return { release: release.release, added: 0, selected: false }
  const manifest = Buffer.from(JSON.stringify(release))
  await immutable(store, CAMPAIGN_PREFIX + campaignReleasePath(release.release, campaign), manifest)
  if (!stageOnly) {
    const pointer = CAMPAIGN_PREFIX + campaignPreviewIndex(campaign)
    await store.put(pointer, manifest, selected.pointer.generation)
    if (!(await store.read(pointer))?.bytes.equals(manifest)) throw new Error('Crew sprite selection readback failed')
  }
  return { release: release.release, added: incoming.length, selected: !stageOnly }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  void carryPublishedCrewSprites(new GcsArtStorage(), process.argv.includes('--stage-only'))
    .then(result => console.log(JSON.stringify(result)), (error: Error) => { console.error(error.message); process.exitCode = 1 })
}
