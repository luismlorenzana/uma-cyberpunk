import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { require as loadTs } from 'tsx/cjs/api'

const { sha, parsePublishConfig } = loadTs('./model.ts', import.meta.url)
const { loadSelected, publishArtCandidate, rollbackArt } = loadTs('./publish.ts', import.meta.url)
const { resolveArt } = loadTs('./sources.ts', import.meta.url)
const { syncWardrobes } = loadTs('./sync.ts', import.meta.url)
const { CAMPAIGN_PREFIX: PREFIX, GenerationConflict, GcsArtStorage } = loadTs('./storage.ts', import.meta.url)
const { STAND_IN_FILES } = loadTs('../../packages/domain/src/story/stand-in.ts', import.meta.url)
const encode = value => Buffer.from(JSON.stringify(value))

class MemoryStorage {
  objects = new Map()
  writes = []
  seq = 1
  add(path, bytes) { this.objects.set(path, { bytes: Buffer.from(bytes), generation: String(this.seq++) }) }
  async read(path) { return this.objects.get(path) ?? null }
  async put(path, bytes, generation) {
    assert(path.startsWith(PREFIX), 'only Cyberpunk campaign writes')
    if ((this.objects.get(path)?.generation ?? '0') !== generation) throw new GenerationConflict('stale generation')
    this.writes.push(path)
    this.add(path, bytes)
  }
}
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
  const nativeRow = { id: 'commander-watch', unitId: 'stand-in-1', character: 'Commander', look: 'watch-suit',
    path: `images/commander.${sha(f.newer).slice(0, 16)}.png`, sha256: sha(f.newer), bytes: f.newer.length, approvedOn: '2026-11-21' }
  f.storage.add('enemy-art/cyberpunk/index.json', encode({ universe: 'cyberpunk', looks: [nativeRow] }))
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
    routes: [{ scene: 'sw1-ch1-s1', outfit: 'watch-suit' }] }] })
  const options = selected => ({ event: 'enemies', only: ['stand-in-1'], contentRoot: '/unused', wardrobe: selected.book.wardrobe,
    currentImages: new Map(selected.release.assets.map(row => [row.id, row.sha256])) })
  const resolved = await resolveArt(f.storage, config, options(f.selected))
  await publishArtCandidate(f.storage, f.selected, resolved)
  const selected = await loadSelected(f.storage), look = selected.book.wardrobe.members[0].looks['watch-suit']
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
    assert.equal(args[args.indexOf('--only') + 1], 'commander')
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
  assert.equal(pending[1][pending[1].indexOf('--only') + 1], 'commander')
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
