// The cast pack's import, on an invented Ranker plan and an invented uma-quest pack.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { castFromPlan, picturesFrom, picturesFromRanker, profilesFrom } from './import-cast.mjs'

test('the Ranker’s own pictures fill in what a heroine lacks: face, art and splash, keeping uma-quest’s', () => {
  const cast = castFromPlan(planForRanker())
  picturesFrom({ characters: [{ role: 'boss', id: 'al-two', images: { face: 'images/al-two-face.png' } }] }, cast)
  const copies = picturesFromRanker([
    { id: 'al-one', images: { face: 'assets/enemies/al-one-face.ab12.webp', art: 'assets/enemies/al-one-art.cd34.webp', splash: 'assets/enemies/al-one-splash.ef56.webp' } },
    { id: 'al-two', images: { face: 'assets/enemies/al-two-face.0000.webp', art: 'assets/enemies/al-two-art.1111.webp' } },
    { id: 'al-three', images: { face: '../outside/al-three-face.webp', art: 'assets/enemies/al-three-art.gif' } },
  ], cast)
  assert.deepEqual(copies, [
    { from: 'assets/enemies/al-one-face.ab12.webp', to: 'images/al-one-face.webp' },
    { from: 'assets/enemies/al-one-art.cd34.webp', to: 'images/al-one-art.webp' },
    { from: 'assets/enemies/al-one-splash.ef56.webp', to: 'images/al-one-splash.webp' },
    { from: 'assets/enemies/al-two-art.1111.webp', to: 'images/al-two-art.webp' },
  ])
  assert.deepEqual(cast.heroines.map((x) => x.images ?? null), [
    { face: 'images/al-one-face.webp', art: 'images/al-one-art.webp', splash: 'images/al-one-splash.webp' },
    { face: 'images/al-two-face.png', art: 'images/al-two-art.webp' },
    null,
  ])
  assert.deepEqual(picturesFromRanker(null, castFromPlan(planForRanker())), [])
})

test('profile facts: a sister’s own profile, uma-quest’s tags by identity with their names, a heroine’s details', () => {
  const cast = castFromPlan(plan)
  const found = profilesFrom({
    sisters: [{ outfitId: 900000102, relation: 'younger sister', age: 'an era', profile: 'Her own words.' }],
    tags: {
      vocabularies: { classes: [{ id: 'ranger', name: 'Ranger' }], personalities: [{ id: 'quiet', name: 'Quiet' }], storyTypes: [] },
      umas: { 9000001: { class: { id: 'ranger', why: 'A' }, personality: { id: 'quiet', why: 'B' } }, s900000102: { story: { id: 'fate', why: 'C' } } },
    },
    units: [{ id: 'al-one', details: ['5★', 'Flame'] }, { id: 'al-two', sourceTier: 'subboss' }],
  }, cast)
  assert.equal(found, 4)
  assert.deepEqual(cast.umas[0].about, { tags: { class: { id: 'ranger', name: 'Ranger', why: 'A' }, personality: { id: 'quiet', name: 'Quiet', why: 'B' } } })
  assert.deepEqual(cast.umas[1].about, { sister: { relation: 'younger sister', era: 'an era', text: 'Her own words.' }, tags: { story: { id: 'fate', name: 'fate', why: 'C' } } })
  assert.equal(cast.umas[2].about, undefined)
  assert.deepEqual(cast.heroines.map((x) => x.details ?? null), [['5★', 'Flame'], ['subboss'], null])
  assert.deepEqual([cast.umas[0].playstyle, cast.umas[1].identity], ['pace-late', 's900000102'])
})

function planForRanker() {
  return { kind: 'tier-plan', boards: [
    { id: 'alpha-bosses', order: [{ order: 1, id: 'al-one', tier: 'SS', name: 'Foe One', franchise: 'alpha' }] },
    { id: 'key-enemies', order: [{ order: 1, id: 'al-two', tier: 'A', name: 'Foe Two', franchise: 'alpha' }] },
    { id: 'regular-enemies', order: [{ order: 1, id: 'al-three', tier: 'B', name: 'Foe Three', franchise: 'alpha' }] },
  ] }
}

const plan = {
  kind: 'tier-plan', generatedAt: '2026-11-12T00:00:00.000Z', profilesRevision: 6,
  boards: [
    { id: 'umas', revision: 337, order: [
      { order: 1, id: '900000101', tier: 'T1', batch: 1, name: 'Runner One', title: 'Look', outfitId: 900000101, characterId: 9000001, identity: '9000001', sister: false, playstyle: 'pace-late' },
      { order: 2, id: '900000102', tier: 'T2', batch: 2, name: 'Runner One’s sister', outfitId: 900000102, characterId: 9000001, identity: 's900000102', sister: true },
      { order: 150, id: '900000201', tier: 'F', name: 'Runner Two', outfitId: 900000201, characterId: 9000002, sister: false },
    ] },
    { id: 'npcs', order: [
      { order: 1, id: '9000003', tier: 'SS', name: 'Rival Three', characterId: 9000003, defaultOutfit: 900000301 },
      { order: 2, id: '9000001', tier: 'S', name: 'Runner One', characterId: 9000001, defaultOutfit: 900000101 },
    ] },
    { id: 'alpha-bosses', order: [{ order: 1, id: 'al-one', tier: 'SS', name: 'Foe One', franchise: 'alpha', category: 'boss' }] },
    { id: 'key-enemies', order: [{ order: 1, id: 'al-one', tier: 'S', name: 'Foe One' }, { order: 2, id: 'al-two', tier: 'A', name: 'Foe Two', franchise: 'alpha', category: 'subboss' }] },
    { id: 'regular-enemies', order: [{ order: 1, id: 'al-three', tier: 'B', name: 'Foe Three', franchise: 'alpha', category: 'regular' }] },
  ],
}

test('the cast comes from the Ranker: its batches and the NPCs by outfit, every board unit once', () => {
  const cast = castFromPlan(plan)
  assert.deepEqual(cast.umas.map((u) => [u.outfit, u.name, u.batch, u.sister, u.board]), [
    [900000101, 'Runner One', 1, false, 'umas'],
    [900000102, 'Runner One’s sister', 2, true, 'umas'],
    [900000301, 'Rival Three', null, false, 'npcs'],
  ])
  assert.deepEqual(cast.heroines.map((x) => [x.id, x.board]), [['al-one', 'alpha-bosses'], ['al-two', 'key-enemies'], ['al-three', 'regular-enemies']])
  assert.deepEqual(cast.ranker, { boardRevision: 337, profilesRevision: 6, generatedAt: '2026-11-12T00:00:00.000Z' })
  assert.throws(() => castFromPlan({ kind: 'tier-board' }), /Ranker’s plan/)
})

test('pictures come from uma-quest’s pack only for the very outfit, and for the same board id', () => {
  const cast = castFromPlan(plan)
  const questPack = { characters: [
    { role: 'hero', id: '9000001', outfit: { id: 900000101 }, images: { face: 'images/9000001-face.png', art: 'images/9000001-art.png' } },
    { role: 'hero', id: '9000003', outfit: { id: 900000399 }, images: { face: 'images/9000003-face.png' } },
    { role: 'boss', id: 'al-two', images: { face: 'images/al-two-face.png' } },
  ] }
  assert.equal(picturesFrom(questPack, cast), 2)
  assert.deepEqual(cast.umas.map((u) => u.images?.face ?? null), ['images/9000001-face.png', null, null])
  assert.deepEqual(cast.heroines.map((x) => x.images?.face ?? null), [null, 'images/al-two-face.png', null])
  assert.equal(picturesFrom(null, castFromPlan(plan)), 0)
})
