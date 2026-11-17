#!/usr/bin/env node
// Builds the private cast pack the sandbox uses to show a name and a face for every id in the story:
// - the Umas: the Ranker's ten batches (its 100 Playable Umas, each outfit as the Uma she is, a sister under her own
//   name) and the Uma NPCs board, keyed by outfit id as the story keys them;
// - the heroines: every unit on the Ranker's boss, key and regular boards, keyed by board id;
// - the pictures uma-quest's cast pack already holds for those ids (never downloaded again);
// - for every heroine, the pictures she still lacks (face, figure art, splash) from the Ranker's own local mirror
//   (copied, never downloaded), so the Foes page and her profile show her;
// - the profiles' facts: a sister's own profile (the Ranker's profiles.json), each Uma's running style and uma-quest's
//   personality and story tags (its tags.json, read in place), each heroine's franchise details.
//
//   node scripts/story/import-cast.mjs
//
// Sources: the Ranker's plan as `pnpm ranker:pull` leaves it in uma-platform (UMA_RANKER_PLAN, default
// ../uma-platform/content/authoring/tiers/plan.json), the mirror beside it (UMA_RANKER_DIR, default
// ../uma-platform/content/authoring/ranker) and uma-quest's stories folder (UMA_QUEST_STORIES, default
// ../uma-quest/content/stories). Target: content/stories/cast-pack/ here (UMA_CYBER_STORIES). All of it is ignored by git.
import { copyFile, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PACK_KIND, parseCastPack } from './cast-model.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
const planPath = resolve(process.env.UMA_RANKER_PLAN ?? join(repo, '../uma-platform/content/authoring/tiers/plan.json'))
const quest = resolve(process.env.UMA_QUEST_STORIES ?? join(repo, '../uma-story-authoring/content/quest/stories'))
const ranker = resolve(process.env.UMA_RANKER_DIR ?? join(repo, '../uma-platform/content/authoring/ranker'))
const target = join(resolve(process.env.UMA_CYBER_STORIES ?? join(repo, '../uma-story-authoring/content/cyberpunk/stories')), 'cast-pack')

/** The pack's Umas and heroines from the Ranker's plan. Pure, so it can be tested on an invented plan. */
export function castFromPlan(plan) {
  if (plan?.kind !== 'tier-plan' || !Array.isArray(plan.boards)) throw new Error('Not the Ranker’s plan (kind tier-plan)')
  const board = (id) => plan.boards.find((b) => b.id === id)?.order ?? []
  const umas = [], seen = new Set()
  for (const e of board('umas')) {
    if (!Number.isSafeInteger(e.batch) || !Number.isSafeInteger(e.outfitId)) continue // F and the unranked are in no batch
    umas.push({ outfit: e.outfitId, characterId: e.characterId, identity: e.identity ?? String(e.characterId), name: e.name, title: e.title ?? '', tier: e.tier, batch: e.batch, order: e.order, sister: e.sister === true, playstyle: e.playstyle ?? null, board: 'umas' })
    seen.add(e.outfitId)
  }
  for (const e of board('npcs')) {
    if (!Number.isSafeInteger(e.defaultOutfit) || seen.has(e.defaultOutfit)) continue
    umas.push({ outfit: e.defaultOutfit, characterId: e.characterId, identity: String(e.characterId), name: e.name, title: '', tier: e.tier, batch: null, order: e.order, sister: false, playstyle: e.playstyle ?? null, board: 'npcs' })
    seen.add(e.defaultOutfit)
  }
  const heroines = [], known = new Set()
  // A unit is taken from the first board that ranks her: her boss board, then Key enemies, then Regular enemies.
  const boards = [...plan.boards.filter((b) => b.id.endsWith('-bosses')), ...plan.boards.filter((b) => b.id === 'key-enemies' || b.id === 'regular-enemies')]
  for (const b of boards) for (const e of b.order ?? []) {
    if (known.has(e.id)) continue
    known.add(e.id)
    heroines.push({ id: e.id, name: e.name, franchise: e.franchise ?? '', category: e.category ?? '', board: b.id, tier: e.tier })
  }
  const revision = plan.boards.find((b) => b.id === 'umas')?.revision ?? null
  return { umas, heroines, ranker: { boardRevision: revision, profilesRevision: plan.profilesRevision ?? null, generatedAt: plan.generatedAt ?? null } }
}

/** The pictures another pack holds for these ids: an Uma's only when it shows this very outfit. */
export function picturesFrom(questPack, cast) {
  const heroes = new Map(), others = new Map()
  for (const c of questPack?.characters ?? []) (c.role === 'hero' ? heroes.set(c.outfit?.id, c) : others.set(c.id, c))
  let found = 0
  const take = (record, source) => { if (source?.images && Object.keys(source.images).length) { record.images = { ...source.images }; found++ } }
  for (const u of cast.umas) take(u, heroes.get(u.outfit))
  for (const x of cast.heroines) take(x, others.get(x.id))
  return found
}

const RANKER_IMAGE = /^assets\/[A-Za-z0-9._/-]+\.(png|webp|jpg)$/

/** For each heroine, the pictures she still lacks (her face, figure art and splash) from the Ranker's mirror (`units`
 * are its catalog and imports, each with `images` relative to the mirror). Sets her images and returns the copies. */
export function picturesFromRanker(units, cast) {
  const byId = new Map((units ?? []).map((u) => [u.id, u.images ?? {}]))
  const copies = []
  for (const x of cast.heroines) {
    const images = { ...(x.images ?? {}) }
    let added = false
    for (const kind of ['face', 'art', 'splash']) {
      if (images[kind]) continue
      const from = byId.get(x.id)?.[kind]
      const ext = typeof from === 'string' && RANKER_IMAGE.test(from) && !from.includes('..') ? RANKER_IMAGE.exec(from)[1] : null
      if (!ext) continue
      images[kind] = `images/${x.id}-${kind}.${ext}`
      copies.push({ from, to: images[kind] })
      added = true
    }
    if (added) x.images = images
  }
  return copies
}

/** The profiles' facts, from Uma Studio's data: a sister's own profile (the Ranker's `profiles.json`), each Uma's
 * personality and story tags (uma-quest's `tags.json`, by the Ranker's identity), and each heroine's details from her
 * franchise's import (or the catalog's source tier). Pure; returns how many records gained something. */
export function profilesFrom({ sisters, tags, units }, cast) {
  const sisterBy = new Map((sisters ?? []).map((s) => [s.outfitId, s]))
  const vocab = (list) => new Map((list ?? []).map((v) => [v.id, v.name]))
  const names = { class: vocab(tags?.vocabularies?.classes), personality: vocab(tags?.vocabularies?.personalities), story: vocab(tags?.vocabularies?.storyTypes) }
  const unitBy = new Map((units ?? []).map((u) => [u.id, u]))
  let found = 0
  for (const u of cast.umas) {
    const about = {}
    const s = sisterBy.get(u.outfit)
    if (s) about.sister = { relation: String(s.relation ?? ''), era: String(s.age ?? ''), text: String(s.profile ?? '') }
    const t = tags?.umas?.[u.identity]
    if (t) {
      const picked = ['class', 'personality', 'story'].filter((k) => typeof t[k]?.id === 'string')
      if (picked.length) about.tags = Object.fromEntries(picked.map((k) => [k, { id: t[k].id, name: names[k].get(t[k].id) ?? t[k].id, why: String(t[k].why ?? '') }]))
    }
    if (Object.keys(about).length) { u.about = about; found++ }
  }
  for (const x of cast.heroines) {
    const src = unitBy.get(x.id)
    const details = (Array.isArray(src?.details) ? src.details : src?.sourceTier ? [src.sourceTier] : []).filter((d) => typeof d === 'string')
    if (details.length) { x.details = details; found++ }
  }
  return found
}

async function rankerUnits() {
  const units = []
  const read = async (path) => { try { units.push(...(JSON.parse(await readFile(path, 'utf8')).units ?? [])) } catch { /* not there */ } }
  await read(join(ranker, 'catalog/enemies.json'))
  for (const name of await readdir(join(ranker, 'imports')).catch(() => [])) if (name.endsWith('.json')) await read(join(ranker, 'imports', name))
  return units
}

async function newestQuestPack() {
  const packs = []
  for (const name of await readdir(join(quest, 'packs')).catch(() => [])) {
    try { const pack = JSON.parse(await readFile(join(quest, 'packs', name, 'pack.json'), 'utf8')); if (pack.kind === 'story-pack') packs.push({ name, pack }) } catch { /* not a pack */ }
  }
  return packs.sort((a, b) => String(b.pack.exportedAt).localeCompare(String(a.pack.exportedAt)))[0] ?? null
}

async function main() {
  let plan
  try { plan = JSON.parse(await readFile(planPath, 'utf8')) } catch { throw new Error(`No Ranker plan at ${planPath}: run pnpm ranker:pull in uma-platform first.`) }
  const cast = castFromPlan(plan)
  const source = await newestQuestPack()
  const withPictures = picturesFrom(source?.pack, cast)
  const fromQuest = new Set([...cast.umas, ...cast.heroines].flatMap((c) => Object.values(c.images ?? {})))
  const units = await rankerUnits()
  const fromRanker = picturesFromRanker(units, cast)
  const json = async (path) => { try { return JSON.parse(await readFile(path, 'utf8')) } catch { return null } }
  const profiles = profilesFrom({ sisters: (await json(join(ranker, 'profiles.json')))?.sisters, tags: await json(join(quest, 'tags.json')), units }, cast)
  const pack = parseCastPack({ schemaVersion: 1, kind: PACK_KIND, id: `ranker-${new Date().toISOString().slice(0, 10)}`, builtAt: new Date().toISOString(), pictures: source?.pack.id ?? null, ...cast })

  await mkdir(join(target, 'images'), { recursive: true })
  let copied = 0, missing = 0
  for (const path of fromQuest) {
    try { await copyFile(join(quest, 'packs', source.name, path), join(target, path)); copied++ } catch { missing++ }
  }
  for (const { from, to } of fromRanker) {
    try { await copyFile(join(ranker, from), join(target, to)); copied++ } catch { missing++ }
  }
  await writeFile(join(target, 'pack.json.part'), `${JSON.stringify(pack, null, 2)}\n`)
  await rename(join(target, 'pack.json.part'), join(target, 'pack.json'))
  const pictured = pack.heroines.filter((x) => x.images).length + pack.umas.filter((u) => u.images).length
  console.log(`Cast pack ${pack.id}: ${pack.umas.length} Umas, ${pack.heroines.length} heroines, ${pictured} with pictures (${withPictures} from uma-quest's pack, the heroines' others and splashes from the Ranker's mirror; ${copied} files${missing ? `, ${missing} missing` : ''}), ${profiles} with profile facts → ${target}`)
  if (!source) console.log('No uma-quest cast pack found, so there are no pictures yet: ids show as initials.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
