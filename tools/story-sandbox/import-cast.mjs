#!/usr/bin/env node
// Builds the private cast pack the sandbox uses to show a name and a face for every id in the story:
// - the Umas: the Ranker's ten batches (its 100 Playable Umas, each outfit as the Uma she is, a sister under her own
//   name) and the Uma NPCs board, keyed by outfit id as the story keys them;
// - the heroines: every unit on the Ranker's boss, key and regular boards, keyed by board id;
// - the pictures uma-quest's cast pack already holds for those ids (never downloaded again).
//
//   node tools/story-sandbox/import-cast.mjs
//
// Sources: the Ranker's plan as `pnpm ranker:pull` leaves it in uma-platform (UMA_RANKER_PLAN, default
// ../uma-platform/content/authoring/tiers/plan.json) and uma-quest's stories folder (UMA_QUEST_STORIES, default
// ../uma-quest/content/stories). Target: content/stories/cast-pack/ here (UMA_CYBER_STORIES). All of it is ignored by git.
import { copyFile, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PACK_KIND, parseCastPack } from './lib/model.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
const planPath = resolve(process.env.UMA_RANKER_PLAN ?? join(repo, '../uma-platform/content/authoring/tiers/plan.json'))
const quest = resolve(process.env.UMA_QUEST_STORIES ?? join(repo, '../uma-quest/content/stories'))
const target = join(resolve(process.env.UMA_CYBER_STORIES ?? join(repo, 'content/stories')), 'cast-pack')

/** The pack's Umas and heroines from the Ranker's plan. Pure, so it can be tested on an invented plan. */
export function castFromPlan(plan) {
  if (plan?.kind !== 'tier-plan' || !Array.isArray(plan.boards)) throw new Error('Not the Ranker’s plan (kind tier-plan)')
  const board = (id) => plan.boards.find((b) => b.id === id)?.order ?? []
  const umas = [], seen = new Set()
  for (const e of board('umas')) {
    if (!Number.isSafeInteger(e.batch) || !Number.isSafeInteger(e.outfitId)) continue // F and the unranked are in no batch
    umas.push({ outfit: e.outfitId, characterId: e.characterId, name: e.name, title: e.title ?? '', tier: e.tier, batch: e.batch, order: e.order, sister: e.sister === true, board: 'umas' })
    seen.add(e.outfitId)
  }
  for (const e of board('npcs')) {
    if (!Number.isSafeInteger(e.defaultOutfit) || seen.has(e.defaultOutfit)) continue
    umas.push({ outfit: e.defaultOutfit, characterId: e.characterId, name: e.name, title: '', tier: e.tier, batch: null, order: e.order, sister: false, board: 'npcs' })
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
  const pack = parseCastPack({ schemaVersion: 1, kind: PACK_KIND, id: `ranker-${new Date().toISOString().slice(0, 10)}`, builtAt: new Date().toISOString(), pictures: source?.pack.id ?? null, ...cast })

  await mkdir(join(target, 'images'), { recursive: true })
  let copied = 0, missing = 0
  for (const path of new Set([...pack.umas, ...pack.heroines].flatMap((c) => Object.values(c.images ?? {})))) {
    try { await copyFile(join(quest, 'packs', source.name, path), join(target, path)); copied++ } catch { missing++ }
  }
  await writeFile(join(target, 'pack.json.part'), `${JSON.stringify(pack, null, 2)}\n`)
  await rename(join(target, 'pack.json.part'), join(target, 'pack.json'))
  console.log(`Cast pack ${pack.id}: ${pack.umas.length} Umas, ${pack.heroines.length} heroines, ${withPictures} with pictures (${copied} files${missing ? `, ${missing} missing` : ''}) → ${target}`)
  if (!source) console.log('No uma-quest cast pack found, so there are no pictures yet: ids show as initials.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
