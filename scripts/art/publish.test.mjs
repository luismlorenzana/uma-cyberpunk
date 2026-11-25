import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { test } from 'node:test'
import sharp from 'sharp'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { require as loadTs } from 'tsx/cjs/api'

const { sha, parsePublishConfig } = loadTs('./model.ts', import.meta.url)
const { loadSelected, publishArtCandidate, rollbackArt } = loadTs('./publish.ts', import.meta.url)
const { resolveArt } = loadTs('./sources.ts', import.meta.url)
const { syncWardrobes } = loadTs('./sync.ts', import.meta.url)
const { CAMPAIGN_PREFIX: PREFIX, COMBAT_SPRITE_PREFIX: SPRITES, GenerationConflict, GcsArtStorage } = loadTs('./storage.ts', import.meta.url)
const { readSpriteApprovalIndex, publishCombatSprites } = loadTs('./combat-sprite-release.ts', import.meta.url)
const { main: publishCommand } = loadTs('./cli.ts', import.meta.url)
const { resolveSplashBindings } = loadTs('./splash-bindings.ts', import.meta.url)
const { STAND_IN_FILES } = loadTs('../../packages/domain/src/story/stand-in.ts', import.meta.url)
const encode = value => Buffer.from(JSON.stringify(value))
const runFile = promisify(execFile)

class MemoryStorage {
  objects = new Map()
  writes = []
  seq = 1
  constructor(prefix = PREFIX) { this.prefix = prefix }
  add(path, bytes) { this.objects.set(path, { bytes: Buffer.from(bytes), generation: String(this.seq++) }) }
  async read(path) { return this.objects.get(path) ?? null }
  async put(path, bytes, generation) {
    assert(path.startsWith(this.prefix), 'only the selected Cyberpunk prefix can be written')
    if ((this.objects.get(path)?.generation ?? '0') !== generation) throw new GenerationConflict('stale generation')
    this.writes.push(path)
    this.add(path, bytes)
  }
}

async function spriteFixture(t) {
  const f = await fixture()
  const folder = await mkdtemp(join(tmpdir(), 'cyberpunk-sprite-publish-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const platform = new MemoryStorage(SPRITES)
  const facings = ['S', 'W', 'N', 'E']
  const layer = { page: 'body', rect: [0, 0, 8, 8], at: [0, 0] }
  const clip = { frames: [{ frame: 'base', ms: 100 }], loop: false }
  const track = { frames: { base: { layers: [layer] } }, clips: { idle: clip, walk: clip, settle: clip, attack: clip } }
  const effect = { frames: [layer], ms: [100] }
  const assets = encode({ schemaVersion: 1, unit: 'native pixels', origin: [4, 7],
    barrier: Object.fromEntries(facings.map(facing => [facing, { ...effect, ms: [null] }])),
    recipientEffects: { mend: effect, 'med-reboot': effect, 'order-reboot': effect } })
  const page = { file: 'pages/body.png', sha256: sha(f.original), bytes: f.original.length, width: 40, height: 60 }
  const writeBundle = async (character, outfit, version, override = {}) => {
    const directory = join(folder, character, version)
    await mkdir(join(directory, 'pages'), { recursive: true })
    const manifest = encode({ schemaVersion: 1, kind: 'combat-sprite-bundle', universe: 'cyberpunk', look: 'armor-helmet',
      character, outfit, version, status: 'approved', cell: [8, 8], foot: [4, 7], figureHeight: 7, reviewHeight: 100,
      sources: [{ label: 'Synthetic source', sha256: page.sha256 }], pages: { body: page },
      motions: { body: Object.fromEntries(facings.map(facing => [facing, track])) }, fittings: [{ id: 'base', label: 'Base',
        motion: 'body', rig: { core: 'core-light', leftArm: 'arm-light', rightArm: 'arm-light', legs: 'legs-standard', visor: 'visor-aim',
          leftHand: null, rightHand: null, back: null, coat: null } }], ...override })
    await writeFile(join(directory, 'bundle.json'), manifest)
    await writeFile(join(directory, 'asset-placements.json'), assets)
    await writeFile(join(directory, page.file), f.original)
    return { character, outfit, version, directory, manifestSha256: sha(manifest), placementsSha256: sha(assets),
      pages: [{ file: page.file, sha256: page.sha256 }], approval: { by: 'owner', status: 'approved' } }
  }
  const path = join(folder, 'sources.json')
  const index = async (bundles, selectors = []) => {
    await writeFile(path, encode({ schemaVersion: 1, universe: 'cyberpunk', campaign: 'cyberpunk', revision: 'art-fixture-1', bundles }))
    return readSpriteApprovalIndex(path, selectors)
  }
  const publish = (sources, options, selected) => publishCombatSprites(f.storage, platform, selected ?? f.selected, sources, options)
  return { ...f, platform, writeBundle, index, publish, path }
}

test('local sprite review selects both verified receipts together and rejects a bad batch', async t => {
  const f = await spriteFixture(t)
  const local = join(dirname(f.path), 'local'), campaign = join(local, 'campaign')
  const preview = join(campaign, 'pilot.json'), original = encode(f.release)
  await mkdir(campaign, { recursive: true })
  await writeFile(preview, original)
  const one = await f.writeBundle('officer-one', 9000001, 'v001', { status: 'draft' })
  const two = await f.writeBundle('officer-two', 9000002, 'v001', { status: 'draft' })
  const receipt = async (bundle, file, outfit = bundle.outfit) => {
    const path = join(local, file)
    await writeFile(path, encode({ stagedRoot: bundle.directory, selectedManifestSha256: bundle.manifestSha256,
      placementSha256: bundle.placementsSha256, binding: { authoredOutfit: bundle.outfit, campaignOutfit: outfit } }))
    return path
  }
  const first = await receipt(one, 'one.json'), second = await receipt(two, 'two.json')
  const invalid = await receipt(two, 'invalid.json', one.outfit)
  const batch = (...args) => runFile(process.execPath, ['--import', 'tsx', 'scripts/art/combat-sprites.ts', ...args, '--local', local, '--pilot', '--select'])
  await assert.rejects(batch(first, invalid), /Combat sprite outfit disagrees with intake/)
  await assert.rejects(batch(first, first), /Duplicate outfit/)
  assert.deepEqual(await readFile(preview), original)
  const { stdout } = await batch(first, second)
  assert.deepEqual(JSON.parse(stdout).bundles.map(row => row.outfit), [one.outfit, two.outfit])
  const selected = JSON.parse(await readFile(preview))
  assert.deepEqual(selected.combatSprites.map(row => row.outfit), [one.outfit, two.outfit])
  assert.deepEqual(selected.files, f.release.files)
  assert.deepEqual(selected.assets, f.release.assets)
})

test('approved sprite events scope actors, stage both destinations, preserve gameplay, and rollback', async t => {
  const f = await spriteFixture(t)
  const one = await f.writeBundle('officer-one', 9000001, 'v001')
  const two = await f.writeBundle('officer-two', 9000002, 'v001')
  const first = await f.index([one, two], ['officer-one'])
  await assert.rejects(readSpriteApprovalIndex(f.path, ['missing']), /Unregistered combat sprite identity/)
  const planned = await f.publish(first, { dryRun: true })
  assert.equal(planned.status, 'planned')
  assert.equal(f.platform.writes.length + f.storage.writes.length, 0)
  const stages = []
  assert.equal((await f.publish(first, { stageOnly: true, report: async stage => { stages.push(stage) } })).status, 'staged')
  assert.deepEqual(stages, ['platform-staged', 'campaign-staged'])
  assert.equal(await f.platform.read(SPRITES + '9000001/index.json'), null)
  assert.equal((await loadSelected(f.storage)).release.release, 'baseline')
  await assert.rejects(f.publish(first, { stagedRelease: 'previous-review' }), /no longer produces the reviewed campaign release/)
  const page = PREFIX + 'campaign/files/pack.' + one.pages[0].sha256 + '.png'
  const stagedPage = await f.storage.read(page)
  assert(stagedPage)
  f.storage.add(page, Buffer.from('incorrect staged atlas'))
  await assert.rejects(f.publish(first, { stagedRelease: planned.release }), /Staged sprite publication does not match/)
  assert.equal(await f.platform.read(SPRITES + '9000001/index.json'), null)
  f.storage.add(page, stagedPage.bytes)
  const stagedWrites = f.platform.writes.length + f.storage.writes.length
  const selected = await f.publish(first, { stagedRelease: planned.release })
  assert.equal(f.platform.writes.length + f.storage.writes.length, stagedWrites + 2)
  assert(selected.promoted)
  assert.equal(selected.release, planned.release)
  assert.equal(await f.platform.read(SPRITES + '9000002/index.json'), null)
  const firstGame = await loadSelected(f.storage)
  assert.deepEqual(firstGame.files, f.selected.files)
  assert.deepEqual(firstGame.release.files, f.release.files)
  assert.deepEqual(firstGame.release.assets, f.release.assets)
  const writes = f.platform.writes.length + f.storage.writes.length
  assert.equal((await f.publish(first, {}, firstGame)).status, 'unchanged')
  assert.equal(f.platform.writes.length + f.storage.writes.length, writes)
  const second = await f.index([one, two], ['9000002'])
  assert((await f.publish(second, {}, firstGame)).promoted)
  const secondGame = await loadSelected(f.storage)
  assert.deepEqual(secondGame.release.combatSprites.map(row => row.outfit), [9000001, 9000002])
  assert.deepEqual(secondGame.release.combatSprites[0], firstGame.release.combatSprites[0])
  assert.deepEqual(secondGame.files, f.selected.files)
  const ordinaryArt = await publishArtCandidate(f.storage, secondGame, f.resolved)
  assert(ordinaryArt.promoted)
  assert.deepEqual(ordinaryArt.release.combatSprites, secondGame.release.combatSprites)
  await rollbackArt(f.storage, firstGame.release.release)
  assert.deepEqual((await loadSelected(f.storage)).release, firstGame.release)
})

test('sprite preflight refuses draft payloads, mismatched approvals and broken pages before writing either store', async t => {
  const f = await spriteFixture(t)
  const one = await f.writeBundle('officer-one', 9000001, 'v001')
  const draft = await f.writeBundle('officer-two', 9000002, 'v001', { status: 'draft' })
  const badCases = [
    [draft, /requires an approved bundle/],
    [{ ...one, manifestSha256: 'a'.repeat(64) }, /approval pins do not match/],
    [{ ...one, placementsSha256: 'a'.repeat(64) }, /approval pins do not match/],
    [{ ...one, pages: [{ ...one.pages[0], sha256: 'a'.repeat(64) }] }, /page pins disagree/],
    [{ ...one, character: 'wrong-officer' }, /identity disagrees/],
    [{ ...one, outfit: 9000099 }, /outside the selected campaign/],
  ]
  for (const [row, error] of badCases) await assert.rejects(f.publish(await f.index([row])), error)
  const sources = await f.index([one])
  await writeFile(join(one.directory, one.pages[0].file), Buffer.alloc(f.original.length))
  await assert.rejects(f.publish(sources), /Invalid combat sprite page/)
  await rm(join(one.directory, one.pages[0].file))
  await assert.rejects(f.publish(sources), /ENOENT/)
  assert.equal(f.platform.writes.length + f.storage.writes.length, 0)
})

test('one heroine form serves both boss roles and retains crew pins in a guarded pilot release', async t => {
  const f = await spriteFixture(t)
  const crew = await f.writeBundle('officer-one', 9000001, 'v001')
  await f.publish(await f.index([crew]))
  const live = await loadSelected(f.storage)
  const pilotPath = PREFIX + 'campaign/pilot.json'
  f.storage.add(pilotPath, live.pointer.bytes)
  const pilot = await loadSelected(f.storage, 'pilot')
  const heroine = pilot.book.story.casting.heroines[0].board
  const selected = { ...pilot, book: { ...pilot.book, ground: new Map([['board', {
    rescue: { unit: 'base', heroine }, formation: { ally: { heroine }, opponents: [] },
  }]]) } }
  const draft = await f.writeBundle('board-actor', heroine, 'v001')
  const row = { ...draft, form: 'standard', roles: ['boss-enemy', 'boss-ally'] }
  const forbidden = await f.index([{ ...row, roles: ['sub-boss'] }])
  await assert.rejects(f.publish(forbidden, { campaign: 'pilot' }, selected), /role\/form has no authored encounter/)
  const invalidFit = { ...selected, book: { ...selected.book,
    ground: new Map([['board', { rescue: { unit: 'incorrect', heroine }, formation: { ally: { heroine }, opponents: [] } }]]) } }
  const sources = await f.index([row])
  await assert.rejects(f.publish(sources, { campaign: 'pilot' }, invalidFit), /Missing fixed encounter fitting/)
  const staged = await f.publish(sources, { campaign: 'pilot', stageOnly: true }, selected)
  const platform = SPRITES + 'heroine/' + heroine + '/standard/index.json'
  assert.equal(await f.platform.read(platform), null)
  assert.equal((await loadSelected(f.storage, 'pilot')).release.release, live.release.release)
  assert((await f.publish(sources, { campaign: 'pilot', stagedRelease: staged.release }, selected)).promoted)
  const result = await loadSelected(f.storage, 'pilot')
  assert.deepEqual(result.release.combatSprites[0], live.release.combatSprites[0])
  assert.deepEqual(result.release.combatSprites[1].roles, row.roles)
  assert.deepEqual(JSON.parse((await f.platform.read(platform)).bytes).roles, row.roles)
  assert.equal((await loadSelected(f.storage)).release.release, live.release.release)
})

test('the normal producer CLI journals draft refusal before opening cloud storage', async t => {
  const f = await spriteFixture(t)
  const receipt = f.path + '.receipt'
  await writeFile(f.path, encode({ schemaVersion: 1, universe: 'cyberpunk', campaign: 'cyberpunk', revision: 'draft', bundles: [
    { character: 'officer-one', outfit: 9000001, version: 'v001', manifestSha256: 'a'.repeat(64), approval: { by: 'owner', status: 'draft' } },
  ] }))
  await assert.rejects(publishCommand(['--event', 'combat-sprites', '--only', 'officer-one', '--sprite-sources', f.path, '--receipt', receipt, '--dry-run']),
    /sprite payload approval is pending/)
  const journal = JSON.parse(await readFile(receipt, 'utf8'))
  assert.equal(journal.event, 'combat-sprites')
  assert.equal(journal.status, 'failed')
  assert.deepEqual(journal.only, ['officer-one'])
  assert.deepEqual(journal.stages, [])
})

test('sprite selection survives stale approval, campaign and Platform generations and repairs an interrupted dual delivery', async t => {
  const f = await spriteFixture(t)
  const one = await f.writeBundle('officer-one', 9000001, 'v001')
  const path = SPRITES + '9000001/index.json'
  const pointer = PREFIX + 'campaign/preview.json'
  let sources = await f.index([one])
  await assert.rejects(f.publish(sources, { report: async stage => {
    if (stage === 'platform-staged') await writeFile(f.path, '{}')
  } }), /approval index changed/)
  assert.equal(await f.platform.read(path), null)
  assert.equal((await loadSelected(f.storage)).release.release, 'baseline')
  sources = await f.index([one])
  await assert.rejects(f.publish(sources, { report: async stage => {
    if (stage === 'campaign-staged') f.storage.add(pointer, f.selected.pointer.bytes)
  } }), /Selection changed/)
  assert.equal(await f.platform.read(path), null)
  const current = await loadSelected(f.storage)
  await assert.rejects(f.publish(sources, { report: async stage => {
    if (stage === 'campaign-staged') f.platform.add(path, Buffer.from('different Platform selection'))
  } }, current), /Selection changed/)
  assert.equal((await loadSelected(f.storage)).release.release, 'baseline')
  f.platform.objects.delete(path)
  await assert.rejects(f.publish(sources, { report: async stage => {
    if (stage === 'platform-staged') {
      const payload = f.platform.writes.find(key => key.endsWith('.png'))
      f.platform.add(payload, Buffer.from('corrupt'))
    }
  } }, current), /Platform combat sprite payload changed/)
  assert.equal(await f.platform.read(path), null)
  const payload = f.platform.writes.find(key => key.endsWith('.png'))
  f.platform.add(payload, f.original)
  await assert.rejects(f.publish(sources, { report: async stage => {
    if (stage.startsWith('platform-selected:')) throw new Error('interrupted')
  } }, current), /interrupted/)
  assert.equal((await loadSelected(f.storage)).release.release, 'baseline')
  assert(await f.platform.read(path))
  assert((await f.publish(sources, {}, current)).promoted)
  assert.equal(f.platform.writes.filter(key => key === path).length, 1)
  assert.deepEqual((await loadSelected(f.storage)).files, f.selected.files)
})

test('an exact sprite withdrawal only removes the requested selection and keeps versioned payloads', async t => {
  const f = await spriteFixture(t)
  const one = await f.writeBundle('officer-one', 9000001, 'v001')
  const two = await f.writeBundle('officer-two', 9000002, 'v001')
  await f.publish(await f.index([one, two]))
  const current = await loadSelected(f.storage)
  const withdraw = { character: one.character, outfit: one.outfit, version: one.version,
    manifestSha256: one.manifestSha256, approval: { by: 'owner', status: 'withdrawn' } }
  await assert.rejects(f.publish(await f.index([{ ...withdraw, manifestSha256: 'b'.repeat(64) }]), {}, current), /no longer matches/)
  const sources = await f.index([withdraw])
  assert((await f.publish(sources, {}, current)).promoted)
  const selected = await loadSelected(f.storage)
  assert.deepEqual(selected.release.combatSprites, [current.release.combatSprites[1]])
  assert.equal(JSON.parse((await f.platform.read(SPRITES + '9000001/index.json')).bytes).status, 'withdrawn')
  assert(await f.storage.read(PREFIX + current.release.combatSprites[0].manifest.path))
  assert.equal((await f.publish(sources, {}, selected)).status, 'unchanged')
  await assert.rejects(f.publish(await f.index([one]), {}, selected), /already has this version or newer/)
})

test('scene splash intake verifies its album and Story pins and preserves backdrop and dialogue', async t => {
  const f = await fixture()
  const folder = await mkdtemp(join(tmpdir(), 'cyberpunk-splash-publish-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const ref = f.release.files.find(file => f.selected.files[file.source]?.scenes?.some(scene => scene.id === 'sw1-ch1-s1'))
  const digest = sha(f.newer), imageName = 'meeting.png'
  const local = { id: 'officer-one-meeting-v001', character: 'Officer One', outfitId: 9000001, outfit: 'street',
    scene: 'street-meeting', image: imageName, sha256: digest, width: 40, height: 60,
    approval: { status: 'approved', by: 'owner', imageSha256: digest } }
  const binding = { scene: 'sw1-ch1-s1', chapter: ref.source, chapterSha256: ref.sha256, place: 'sw1-docks', review: 'approved',
    from: { id: local.id, manifest: 'catalog.json', platformId: 'officer-one-splash-meeting-v001', actor: 9000001,
      role: 'crew', outfit: 'street', variant: 'street-meeting', sha256: digest } }
  const path = join(folder, 'bindings.json')
  await writeFile(join(folder, imageName), f.newer)
  await writeFile(join(folder, 'catalog.json'), encode({ assets: [local] }))
  const configure = async rows => writeFile(path, encode({ schemaVersion: 1, campaign: 'cyberpunk', bindings: rows }))
  const options = { localAssets: true, dryRun: true, only: ['9000001'] }
  await configure([binding])
  const localReview = await resolveSplashBindings(path, f.selected, f.storage, options)
  const preview = await publishArtCandidate(f.storage, f.selected, localReview, { dryRun: true })
  assert(preview.changes.includes('campaign:presentation'))
  assert.equal(f.storage.writes.length, 0)
  const prefix = 'art/universes/cyberpunk/'
  const remotePath = `images/meeting.${digest.slice(0, 16)}.png`
  f.storage.add(prefix + 'index.json', encode({ universe: 'cyberpunk', looks: [{ id: binding.from.platformId, kind: 'splash',
    character: local.character, outfit: local.outfit, path: remotePath, sha256: digest, bytes: f.newer.length }] }))
  f.storage.add(prefix + remotePath, f.newer)
  const cloud = { ...options, dryRun: false, localAssets: false }
  const ready = await resolveSplashBindings(path, f.selected, f.storage, cloud)
  const published = await publishArtCandidate(f.storage, f.selected, ready)
  assert.equal(published.release.release, preview.release.release)
  const after = await loadSelected(f.storage)
  const art = after.book.art.find(row => row.scene === binding.scene)
  assert.equal(art.backdrop, 'other')
  assert.deepEqual(art.portraits, f.selected.book.art[0].portraits)
  assert.equal(art.composition.layers[0].asset, localReview.sceneSplashes[0].asset)
  assert.deepEqual(after.files[ref.source], f.selected.files[ref.source])
  const repeated = await resolveSplashBindings(path, after, f.storage, cloud)
  assert.equal((await publishArtCandidate(f.storage, after, repeated)).changes.length, 0)
  await configure([{ ...binding, chapterSha256: 'f'.repeat(64) }])
  await assert.rejects(resolveSplashBindings(path, f.selected, f.storage, options), /Story source or setting/)
  await configure([{ ...binding, from: { ...binding.from, actor: 9000002 } }])
  await assert.rejects(resolveSplashBindings(path, f.selected, f.storage, { ...options, only: [] }), /actor is not in this Story scene/)
  await configure([{ ...binding, at: 'steps[999]' }])
  await assert.rejects(resolveSplashBindings(path, f.selected, f.storage, options), /valid step without a full composition/)
  await configure([{ ...binding, at: 'steps[0]' }])
  const cut = await resolveSplashBindings(path, f.selected, f.storage, options)
  assert.equal(cut.sceneSplashes[0].at, 'steps[0]')
  assert((await publishArtCandidate(f.storage, f.selected, cut, { dryRun: true })).changes.includes('campaign:presentation'))
  await configure([{ ...binding, review: 'review' }])
  await assert.rejects(resolveSplashBindings(path, f.selected, f.storage, cloud), /destination approval is pending/)
})
async function fixture(configure = () => {}) {
  const storage = new MemoryStorage()
  const original = await sharp({ create: { width: 40, height: 60, channels: 4, background: '#203040' } }).png().toBuffer()
  const newer = await sharp({ create: { width: 40, height: 60, channels: 4, background: '#805090' } }).png().toBuffer()
  const face = await sharp({ create: { width: 8, height: 10, channels: 4, background: '#df8050' } }).png().toBuffer()
  const files = { ...structuredClone(STAND_IN_FILES), 'campaign.json': { schemaVersion: 1, draft: true, opening: 'opening',
    quests: [{ id: 'opening', scene: 'sw1-ch1-s1', title: 'Opening' }],
    assets: [{ id: 'pilot', file: 'pilot.png' }, { id: 'other', file: 'other.png' }],
    art: [{ scene: 'sw1-ch1-s1', backdrop: 'other', portraits: [{ speaker: 9000001, asset: 'pilot' }] }] } }
  await configure(files['campaign.json'])
  const ref = (bytes, extension) => ({ path: `campaign/files/pack.${sha(bytes)}.${extension}`, sha256: sha(bytes), bytes: bytes.length })
  const release = { schemaVersion: 1, release: 'baseline', files: Object.entries(files).map(([source, data]) => {
    const bytes = encode(data), file = { source, ...ref(bytes, 'json') }; storage.add(PREFIX + file.path, bytes); return file
  }), assets: files['campaign.json'].assets.map(({ id }) => {
    const file = { id, ...ref(original, 'png') }; storage.add(PREFIX + file.path, original); return file
  }) }
  storage.add(PREFIX + 'campaign/preview.json', encode(release))
  storage.add(PREFIX + 'campaign/releases/baseline.json', encode(release))
  const selected = await loadSelected(storage)
  const images = [{ asset: 'pilot', bytes: newer, extension: '.png', width: 40, height: 60 }]
  const resolved = { images, portraits: [], skipped: [], sourceChecks: [] }
  return { storage, original, newer, face, release, selected, resolved }
}

test('publishes an art-only candidate, preserves every story/rule and unselected image, and is idempotent', async () => {
  const f = await fixture()
  const result = await publishArtCandidate(f.storage, f.selected, f.resolved)
  assert(result.promoted)
  assert.deepEqual(result.release.files, f.release.files)
  assert.deepEqual(result.release.assets.find(a => a.id === 'other'), f.release.assets.find(a => a.id === 'other'))
  assert.equal(f.storage.writes.at(-1), PREFIX + 'campaign/preview.json')
  const selected = await loadSelected(f.storage)
  assert.deepEqual(selected.files, f.selected.files)
  const writes = f.storage.writes.length
  assert.equal((await publishArtCandidate(f.storage, selected, f.resolved)).promoted, false)
  assert.equal(f.storage.writes.length, writes)
  await rollbackArt(f.storage, 'baseline')
  assert.equal((await loadSelected(f.storage)).release.release, 'baseline')
})

test('dry run writes nothing; staging verifies immutable payloads without selecting them', async () => {
  const f = await fixture()
  await publishArtCandidate(f.storage, f.selected, f.resolved, { dryRun: true })
  assert.equal(f.storage.writes.length, 0)
  const staged = await publishArtCandidate(f.storage, f.selected, f.resolved, { stageOnly: true })
  assert.equal(staged.promoted, false)
  assert.equal((await loadSelected(f.storage)).release.release, 'baseline')
  await publishArtCandidate(f.storage, f.selected, f.resolved)
  assert.equal((await loadSelected(f.storage)).release.release, staged.release.release)
})

test('a changed campaign or changed approval source prevents promotion; corrupt readback never replaces selection', async () => {
  for (const mode of ['selection', 'source', 'corrupt']) {
    const f = await fixture()
    if (mode === 'selection') f.storage.add(PREFIX + 'campaign/preview.json', encode(f.release))
    if (mode === 'source') f.resolved.sourceChecks.push(async () => { throw Error('source changed') })
    if (mode === 'corrupt') {
      const put = f.storage.put.bind(f.storage)
      f.storage.put = async (path, bytes, generation) => put(path, Buffer.from('corrupt'), generation)
    }
    await assert.rejects(publishArtCandidate(f.storage, f.selected, f.resolved))
    assert.equal(f.storage.writes.includes(PREFIX + 'campaign/preview.json'), false)
  }
})

test('published Cyberpunk selectors are scoped, verified and isolated from Farm', async () => {
  const f = await fixture()
  const path = `images/officer-pilot.${sha(f.newer).slice(0, 16)}.png`
  const row = { id: 'officer-pilot-v2', character: 'Officer One', outfit: 'pilot', path,
    sha256: sha(f.newer), bytes: f.newer.length, width: 40, height: 60, approvedOn: '2026-11-18' }
  f.storage.add('art/universes/cyberpunk/index.json', encode({ universe: 'cyberpunk', looks: [row, { ...row, id: 'officer-scene', kind: 'splash' }] }))
  f.storage.add('art/universes/cyberpunk/' + path, f.newer)
  const config = parsePublishConfig({ schemaVersion: 1, bindings: [
    { asset: 'pilot', from: { collection: 'looks', character: 'Officer One', outfit: 'pilot' } },
    { asset: 'other', from: { collection: 'looks', character: 'Not Published', outfit: 'pilot' } },
  ] })
  const result = await resolveArt(f.storage, config, { event: 'looks', only: ['officer-one'], contentRoot: '/unused' })
  assert.equal(result.images.length, 1)
  await publishArtCandidate(f.storage, f.selected, result)
  assert(f.storage.writes.every(path => path.startsWith(PREFIX)))
  f.storage.add('art/universes/cyberpunk/index.json', encode({ universe: 'farm-life', looks: [row] }))
  await assert.rejects(resolveArt(f.storage, config, { event: 'looks', only: ['officer-one'], contentRoot: '/unused' }), /wrong universe/)
})

test('portrait bases, approved expression placements and reviewed 192px profiles publish together', async () => {
  const f = await fixture()
  const basePath = `bases/officer-pilot.${sha(f.newer).slice(0, 16)}.png`
  const facePath = `faces/officer-happy.${sha(f.face).slice(0, 16)}.png`
  const piece = (id, path, bytes, dimensions) => ({ id, character: 'officer', path, bytes: bytes.length, sha256: sha(bytes), ...dimensions })
  const recipe = { universe: 'cyberpunk', approvedOn: '2026-11-18', characters: [{ id: 'officer', name: 'Officer' }],
    bases: [{ ...piece('base', basePath, f.newer, { width: 40, height: 60 }), outfit: 'pilot' }],
    faces: [{ ...piece('face', facePath, f.face, { width: 8, height: 10 }), expression: 'happy' }],
    states: [{ character: 'officer', outfit: 'pilot', expression: 'neutral', base: 'base', face: null, at: null },
      { character: 'officer', outfit: 'pilot', expression: 'happy', base: 'base', face: 'face', at: { x: 8, y: 10 }, approvedSha256: 'a'.repeat(64) }] }
  const root = 'art/universes/cyberpunk/portraits/'
  f.storage.add(root + 'index.json', encode(recipe)); f.storage.add(root + basePath, f.newer); f.storage.add(root + facePath, f.face)
  const config = parsePublishConfig({ schemaVersion: 1, bindings: [], portraits: [{ base: 'pilot', speaker: 9000001,
    character: 'officer', outfit: 'pilot', profile: { asset: 'pilot-profile', baseSha256: sha(f.newer), crop: { left: 0, top: 0, size: 40 } } }] })
  const result = await resolveArt(f.storage, config, { event: 'portraits', only: [], contentRoot: '/unused' })
  const profile = result.images.find(image => image.asset === 'pilot-profile')
  assert.equal((await sharp(profile.bytes).metadata()).width, 192)
  await publishArtCandidate(f.storage, f.selected, result)
  const selected = await loadSelected(f.storage)
  assert.equal(selected.book.art[0].portraits[0].profile, 'pilot-profile')
  assert.deepEqual(selected.book.portraitFaces[0].at, { x: 8, y: 10 })
  const changed = { ...f.resolved, images: [{ ...f.resolved.images[0], bytes: f.original }] }
  await assert.rejects(publishArtCandidate(f.storage, selected, changed), /recipe together/)
  recipe.states[1].at.x = 39
  f.storage.add(root + 'index.json', encode(recipe))
  await assert.rejects(resolveArt(f.storage, config, { event: 'portraits', only: [], contentRoot: '/unused' }), /exceeds/)
})

test('registered ally wardrobes discover approved outfits and sparse faces, preserve native framing, and refresh without a rebuild', async () => {
  const f = await fixture()
  const portrait = await sharp(f.newer).resize(20, 30).png().toBuffer()
  const nativeRow = { id: 'commander-watch', unitId: 'stand-in-1', character: 'Previous Name', look: 'watch-suit',
    path: `images/commander.${sha(f.newer).slice(0, 16)}.png`, sha256: sha(f.newer), bytes: f.newer.length, approvedOn: '2026-11-21' }
  const armorRow = { ...nativeRow, id: 'commander-armor', look: 'controlled-armor' }
  f.storage.add('enemy-art/cyberpunk/index.json', encode({ universe: 'cyberpunk', looks: [nativeRow, armorRow] }))
  f.storage.add('enemy-art/cyberpunk/' + nativeRow.path, f.newer)
  const base = { id: 'commander-watch-suit', character: 'commander', outfit: 'watch-suit',
    path: `bases/commander.${sha(portrait).slice(0, 16)}.png`, sha256: sha(portrait), bytes: portrait.length, width: 20, height: 30 }
  const face = { id: 'commander-relieved', character: 'commander', expression: 'relieved',
    path: `faces/commander.${sha(f.face).slice(0, 16)}.png`, sha256: sha(f.face), bytes: f.face.length, width: 8, height: 10 }
  const index = { universe: 'cyberpunk', approvedOn: '2026-11-21', characters: [{ id: 'commander', name: 'Commander' }], bases: [base], faces: [face], states: [
    { character: 'commander', outfit: 'watch-suit', expression: 'neutral', base: base.id, face: null, at: null },
    { character: 'commander', outfit: 'watch-suit', expression: 'relieved', base: base.id, face: face.id, at: { x: 4, y: 5 }, approvedSha256: sha(f.face) },
  ] }
  const root = 'art/universes/cyberpunk/portraits/'
  f.storage.add(root + 'index.json', encode(index)); f.storage.add(root + base.path, portrait); f.storage.add(root + face.path, f.face)
  const config = parsePublishConfig({ schemaVersion: 1, bindings: [], wardrobes: [{ speaker: 'stand-in-1', character: 'commander',
    from: { collection: 'enemies', unitId: 'stand-in-1' }, default: 'watch-suit', labels: { 'watch-suit': 'Watch Suit' },
    visibleLooks: ['watch-suit'], routes: [{ scene: 'sw1-ch1-s1', outfit: 'watch-suit' },
      { scene: 'sw1-ch1-s2', outfit: 'controlled-armor' }] }] })
  const options = selected => ({ event: 'enemies', only: ['commander'], contentRoot: '/unused', wardrobe: selected.book.wardrobe,
    currentImages: new Map(selected.release.assets.map(row => [row.id, row.sha256])) })
  const resolved = await resolveArt(f.storage, config, options(f.selected))
  await publishArtCandidate(f.storage, f.selected, resolved)
  const selected = await loadSelected(f.storage), look = selected.book.wardrobe.members[0].looks['watch-suit']
  assert.deepEqual(selected.book.wardrobe.members[0].visibleLooks, ['watch-suit'])
  assert(selected.book.wardrobe.members[0].looks['controlled-armor'])
  assert.equal(selected.book.wardrobe.scenes.find(row => row.scene === 'sw1-ch1-s2').outfits[0].look, 'controlled-armor')
  assert.notEqual(look.asset, look.portrait)
  assert.equal(look.label, 'Watch Suit')
  assert.equal(selected.release.assets.find(row => row.id === look.asset).sha256, sha(f.newer))
  assert.equal(selected.release.assets.find(row => row.id === look.portrait).sha256, sha(portrait))
  assert.deepEqual(selected.book.portraitFaces.map(row => row.emote), ['relieved'])
  assert.deepEqual(selected.files['casting.json'], f.selected.files['casting.json'])
  assert.deepEqual(selected.files['chapters/sw1-ch1.json'], f.selected.files['chapters/sw1-ch1.json'])
  assert.equal((await publishArtCandidate(f.storage, selected, await resolveArt(f.storage, config, options(selected)))).changes.length, 0)
  index.states.pop() // Withdrawing a state removes its placement; no unapproved missing expression is fabricated.
  f.storage.add(root + 'index.json', encode(index))
  await publishArtCandidate(f.storage, selected, await resolveArt(f.storage, config, options(selected)))
  assert.equal((await loadSelected(f.storage)).book.portraitFaces.length, 0)
  const wrong = structuredClone(config); wrong.wardrobes[0].speaker = 'not-cast'
  await assert.rejects(publishArtCandidate(f.storage, selected, await resolveArt(f.storage, wrong, options(selected))), /unknown cast identity/)
  index.states[0].at = { x: 0, y: 0 }
  f.storage.add(root + 'index.json', encode(index))
  await assert.rejects(resolveArt(f.storage, config, options(selected)), /invalid neutral/)
  index.bases = []; index.faces = []; index.states = []
  f.storage.add(root + 'index.json', encode(index))
  const current = await loadSelected(f.storage)
  await publishArtCandidate(f.storage, current, await resolveArt(f.storage, config, options(current)))
  const withdrawn = await loadSelected(f.storage)
  assert.equal(withdrawn.book.wardrobe.members[0].looks['watch-suit'].portrait, undefined)
  assert.equal(withdrawn.book.portraitFaces.length, 0)
  assert.equal(withdrawn.release.assets.find(row => row.id === look.asset).sha256, sha(f.newer))
})

test('a wardrobe can arrive before its expressions; malformed registries never infer a different cast identity', async () => {
  assert.throws(() => parsePublishConfig({ schemaVersion: 1, bindings: [], wardrobes: [
    { speaker: 'stand-in-1', character: 'commander', from: { collection: 'enemies', character: 'Commander' } },
  ] }), /wrong source identity key/)
  const f = await fixture()
  f.storage.add('enemy-art/cyberpunk/index.json', encode({ universe: 'cyberpunk', looks: [] }))
  const config = parsePublishConfig({ schemaVersion: 1, bindings: [], wardrobes: [{ speaker: 'stand-in-1', character: 'commander',
    from: { collection: 'enemies', unitId: 'stand-in-1' }, default: 'watch-suit' }] })
  const art = await resolveArt(f.storage, config, { event: 'enemies', only: [], contentRoot: '/unused' })
  assert.equal(art.wardrobe.members.length, 0)
  assert(art.skipped.some(row => row.includes('not yet published')))
})

test('wardrobe sync scopes all three producer stages and moves game selection only after they succeed', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wardrobe sync '))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'src')); await writeFile(join(root, 'src/push.ts'), '// synthetic producer')
  const config = parsePublishConfig({ schemaVersion: 1, bindings: [], wardrobes: [
    { speaker: 9000001, character: 'officer', from: { collection: 'looks', character: 'Officer' } },
    { speaker: 'stand-in-1', character: 'commander', from: { collection: 'enemies', unitId: 'stand-in-1' }, default: 'watch-suit' },
  ] })
  const calls = []
  const portraitCharacters = new Set(['officer', 'commander'])
  await syncWardrobes(config, { root, only: ['stand-in-1'], dryRun: true, portraitCharacters }, async args => { calls.push(args) }, async keys => { calls.push(keys) })
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[2], ['commander'])
  assert(calls[0].includes('--enemies')); assert(calls[1].includes('--portraits'))
  for (const args of calls.slice(0, 2)) {
    assert(args.includes('cyberpunk')); assert(args.includes('--no-release')); assert(args.includes('--dry-run'))
    assert.equal(args[args.indexOf('--only') + 1], args.includes('--enemies') ? 'stand-in-1' : 'commander')
    assert(!args.includes('farm-life'))
  }
  let promoted = false, stages = 0
  await assert.rejects(syncWardrobes(config, { root, only: ['9000001'], dryRun: false, portraitCharacters }, async () => {
    if (++stages === 2) throw Error('source failed')
  }, async () => { promoted = true }), /source failed/)
  assert.equal(promoted, false)
  await assert.rejects(syncWardrobes(config, { root, only: ['unknown'], dryRun: true, portraitCharacters }, async () => {}, async () => {}), /Unregistered/)
  const pending = []
  await syncWardrobes(config, { root, only: [], dryRun: true, portraitCharacters: new Set(['officer']) }, async args => { pending.push(args) }, async () => {})
  assert.equal(pending.length, 3)
  assert.equal(pending[0][pending[0].indexOf('--only') + 1], 'officer')
  assert.equal(pending[1][pending[1].indexOf('--only') + 1], 'stand-in-1')
  assert.equal(pending[2][pending[2].indexOf('--only') + 1], 'officer')
})

test('cloud adapter rejects non-Cyberpunk paths before obtaining credentials or making a request', async () => {
  const forbidden = () => { throw Error('must not contact cloud') }
  const storage = new GcsArtStorage(forbidden, forbidden)
  await assert.rejects(storage.put('art/universes/farm-life/index.json', Buffer.from('x'), '0'), /outside/)
  await assert.rejects(storage.put('channels/v1/latest.json', Buffer.from('x'), '0'), /outside/)
  await assert.rejects(storage.read('art/universes/farm-life/index.json'), /outside/)
  await assert.rejects(storage.read('campaign/cyberpunk/../farm/index.json'), /Unsafe/)
})

test('native replacement refreshes declared dialogue/profile crops, preserves gameplay and is a no-op on repeat', async () => {
  const configure = config => {
    config.assets.push({ id: 'dialogue', file: 'dialogue.png' }, { id: 'profile', file: 'profile.png' })
    config.wardrobe = { members: [{ speaker: 9000001, looks: Object.fromEntries(['street','ship-casual','quarters','pilot','armor','armor-helmet'].map(role => [role,{ asset:'pilot',dialogue:'dialogue',profile:'profile' }])) }],
      scenes: [{ scene: 'sw1-ch1-s1', context: 'bridge' }], crops: [{ base:'pilot',width:40,height:60,dialogue:{asset:'dialogue',left:4,top:6,width:32,height:40},profile:{asset:'profile',left:8,top:6,size:24} }] }
  }
  const f = await fixture(configure), before = f.selected.files['campaign.json'].wardrobe
  const result = await publishArtCandidate(f.storage, f.selected, f.resolved)
  assert(result.promoted)
  const selected = await loadSelected(f.storage)
  assert.deepEqual(selected.files['campaign.json'].wardrobe, before)
  for (const [id,width,height] of [['dialogue',32,40],['profile',192,192]]) {
    const ref = selected.release.assets.find(a=>a.id===id), bytes = (await f.storage.read(PREFIX+ref.path)).bytes
    const size = await sharp(bytes).metadata();assert.equal(size.width,width);assert.equal(size.height,height)
    assert.notEqual(ref.sha256,sha(f.original))
  }
  const writes = f.storage.writes.length
  assert.equal((await publishArtCandidate(f.storage, selected, f.resolved)).promoted,false)
  assert.equal(f.storage.writes.length,writes)
  const wrong = { ...f.resolved,images:[{ ...f.resolved.images[0],bytes:f.original,width:41 }] }
  await assert.rejects(publishArtCandidate(f.storage, selected, wrong),/framing needs review/)
  selected.book.portraitFaces = [{speaker:9000001,base:'dialogue',emote:'happy',asset:'other',at:{x:0,y:0}}]
  await assert.rejects(publishArtCandidate(f.storage, selected, { ...f.resolved, images:[{ ...f.resolved.images[0],bytes:f.original }] }),/recipe together/)
  assert.equal(f.storage.writes.length,writes)
  const withFaces = { ...f.resolved, images:[{ ...f.resolved.images[0],bytes:f.original }], portraits:[{
    base:'pilot',speaker:9000001,faces:[{emote:'happy',image:{asset:'happy-face',bytes:f.face,extension:'.png',width:8,height:10},at:{x:8,y:10}}],
  }] }
  await publishArtCandidate(f.storage, selected, withFaces)
  const refreshed = await loadSelected(f.storage)
  assert.deepEqual(refreshed.book.portraitFaces.find(face=>face.base==='dialogue').at,{x:4,y:4})
  assert.deepEqual(refreshed.book.portraitFaces.find(face=>face.base==='pilot').at,{x:8,y:10})
  assert.equal(refreshed.book.wardrobe.members[0].looks.pilot.profile,'profile')
})

test('selects and rolls back four-act image and sprite updates under their own pointer', async t => {
  const f = await spriteFixture(t)
  const fourAct = { ...f.release, campaign: 'four-act' }
  const path = PREFIX + 'campaign/four-act.json'
  const immutable = PREFIX + 'campaign/releases/four-act/'
  f.storage.add(path, f.selected.pointer.bytes)
  await assert.rejects(loadSelected(f.storage, 'four-act'), /does not belong/)
  f.storage.add(path, encode(fourAct))
  f.storage.add(immutable + fourAct.release + '.json', encode(fourAct))
  const base = await loadSelected(f.storage, 'four-act')
  const old = await loadSelected(f.storage)
  const published = await publishArtCandidate(f.storage, base, f.resolved)
  assert.equal(published.promoted, true)
  assert.equal(published.release.campaign, 'four-act')
  assert((await f.storage.read(immutable + published.release.release + '.json')))
  const crew = await f.writeBundle('officer-one', 9000001, 'v001')
  const sources = await f.index([crew])
  const selected = await loadSelected(f.storage, 'four-act')
  await assert.rejects(f.publish(sources, { campaign: 'current' }, selected), /does not match the selected campaign/)
  const sprites = await f.publish(sources, {}, selected)
  assert.equal(sprites.promoted, true)
  assert((await f.storage.read(immutable + sprites.release + '.json')))
  const result = await loadSelected(f.storage, 'four-act')
  assert.deepEqual(result.release.combatSprites.map(row => row.outfit), [9000001])
  assert.deepEqual(result.files, selected.files)
  assert.deepEqual((await loadSelected(f.storage)).pointer, old.pointer)
  const rolledBack = await rollbackArt(f.storage, fourAct.release, false, 'four-act')
  assert.equal(rolledBack.promoted, true)
  assert.deepEqual((await loadSelected(f.storage, 'four-act')).release, fourAct)
  assert.deepEqual((await loadSelected(f.storage)).pointer, old.pointer)
})

test('art publishing preserves paged Story pins and guards approved room backdrop replacements', async () => {
  const f = await fixture()
  const pointer = PREFIX + 'campaign/four-act.json'
  const stories = { ...f.selected.files }
  delete stories['campaign.json']
  const register = (documents) => {
    const bytes = encode(documents)
    const digest = sha(bytes), path = `campaign/files/pack.${digest}.json`
    f.storage.add(PREFIX + path, bytes)
    f.storage.add(pointer, encode({ ...f.release, campaign: 'four-act',
      storyPages: [{ sources: Object.keys(documents), path, sha256: digest, bytes: bytes.length }] }))
  }
  register(stories)
  const selected = await loadSelected(f.storage, 'four-act')
  assert.deepEqual(selected.files, f.selected.files)
  const scene = { scene: 'sw1-ch1-s1', asset: 'pilot', replaces: 'other' }
  await assert.rejects(publishArtCandidate(f.storage, selected, { ...f.resolved,
    sceneBackdrops: [{ ...scene, replaces: 'stale' }] }, { dryRun: true }), /backdrop destination no longer matches/)
  const result = await publishArtCandidate(f.storage, selected, { ...f.resolved, sceneBackdrops: [scene] })
  assert(result.promoted)
  assert.deepEqual(result.release.storyPages, selected.release.storyPages)
  const published = await loadSelected(f.storage, 'four-act')
  assert.equal(published.book.art[0].backdrop, 'pilot')
  assert.deepEqual(published.book.art[0].portraits, selected.book.art[0].portraits)
  const arbitrary = Object.keys(stories)[0]
  register({ ...stories, [arbitrary]: { ...stories[arbitrary], altered: true } })
  await assert.rejects(loadSelected(f.storage, 'four-act'), /integrity check failed/)
})

const { publishSplashAlbums, readSplashAlbums, SPLASH_INDEX, splashPlatformId } = loadTs('./splash-platform.ts', import.meta.url)

test('canonical album splashes publish privately and bind without the authoring checkout', async t => {
  const f = await fixture()
  const authoring = await mkdtemp(join(tmpdir(), 'cyberpunk-splash-source-'))
  t.after(() => rm(authoring, { recursive: true, force: true }))
  const root = join(authoring, 'character-universes', 'cyberpunk')
  const pin = sha(f.newer)
  const albums = async (folder, record) => {
    const path = join(root, folder)
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'frame.png'), f.newer)
    await writeFile(join(path, 'manifest.json'), encode({ assets: [{ ...record, image: 'frame.png', width: 40, height: 60, sha256: pin,
      approval: { by: 'owner', status: 'approved', imageSha256: pin } }] }))
  }
  await albums('splash-art', { id: 'solo-evening', outfitId: 9000001, outfit: 'quarters', scene: 'quarters-seated' })
  const ally = { id: 'ally-recovery', unitId: 'commander-one', role: 'boss-ally', outfit: 'reform-front', scene: 'spa-chair' }
  await albums('enemies/casual/splash-art', ally)
  await albums('enemies/splash-art', ally)
  const platform = new MemoryStorage(SPLASH_INDEX.slice(0, -'index.json'.length))
  const catalog = await readSplashAlbums(authoring)
  assert.equal(catalog.sources.length, 2)
  assert.equal((await publishSplashAlbums(catalog, platform)).changes, 2)
  const first = platform.writes.length
  assert.equal((await publishSplashAlbums(catalog, platform)).changes, 0)
  assert.equal(platform.writes.length, first)
  assert.equal(JSON.parse((await platform.read(SPLASH_INDEX)).bytes).assets.some(row => row.role === 'boss-enemy'), false)

  const scene = f.selected.book.scenes.get('sw1-ch1-s1')
  const chapter = f.release.files.find(row => row.source.startsWith('chapters/'))
  const registry = join(authoring, 'destinations.json')
  await writeFile(registry, encode({ schemaVersion: 1, campaign: 'cyberpunk', bindings: [{ scene: scene.id,
    chapter: chapter.source, chapterSha256: chapter.sha256, place: scene.place, review: 'approved',
    from: { role: 'crew', id: 'solo-evening', platformId: splashPlatformId('crew', 'solo-evening'), actor: 9000001,
      outfit: 'quarters', variant: 'quarters-seated', sha256: pin } }] }))
  const art = await resolveSplashBindings(registry, f.selected, platform, { localAssets: false, dryRun: false, only: [] })
  assert((await publishArtCandidate(f.storage, f.selected, art)).promoted)
  assert.equal((await loadSelected(f.storage)).book.art[0].composition.layers[0].asset, 'splash-' + pin.slice(0, 48))
})
