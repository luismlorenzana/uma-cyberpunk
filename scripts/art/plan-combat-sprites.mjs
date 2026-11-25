import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [art, release, output] = process.argv.slice(2)
if (!art || !release || !output) throw new Error('Pass the Art universe root, local campaign release root and private output file')

const read = path => JSON.parse(readFileSync(path, 'utf8'))
const artPath = (...parts) => resolve(art, ...parts)
const roster = read(artPath('cast', 'roster.json'))
const wardrobe = new Map(read(artPath('cast', 'wardrobe-status.json')).entries.map(entry => [entry.id, entry]))
const pointer = read(resolve(release, 'campaign/pilot.json'))
const campaign = read(resolve(release, pointer.files.find(row => row.source === 'campaign.json').path))
const album = artPath('categories', 'combat-sprites', 'characters')
const entries = roster.characters.map(character => {
  const entry = wardrobe.get(character.id)
  assert(entry?.status === 'approved' && entry.tier === character.tier, character.name)
  const helmet = entry.looks.find(look => look.outfit === 'armor-helmet')
  assert(helmet, 'Missing helmeted armor for ' + character.name)
  const image = artPath(helmet.image)
  assert.equal(createHash('sha256').update(readFileSync(image)).digest('hex'), helmet.sha256, image)
  const selected = join(album, entry.key, 'active-bundle.json')
  const localBundle = existsSync(selected) ? read(selected).version : null
  const recruit = campaign.recruits.find(row => row.outfit === character.outfitId)
  const capture = campaign.quests.find(quest => recruit?.story.includes(quest.id) &&
    campaign.ground.some(ground => ground.id === quest.encounter && ground.rescue))
  return {
    character: entry.key, outfit: character.outfitId, tier: character.tier, order: character.order,
    approvedArmor: { asset: helmet.id, image, sha256: helmet.sha256 },
    localBundle,
    boarding: capture ? { quest: capture.id, scene: capture.scene, encounter: capture.encounter } : null,
  }
})
assert.equal(new Set(entries.map(entry => entry.outfit)).size, entries.length, 'Duplicate canonical outfit')
writeFileSync(resolve(output), JSON.stringify({ schemaVersion: 1, artRoster: roster.sourceRelease, campaign: pointer.release, entries }, null, 2) + '\n')
console.log(`${entries.length} pinned armor references, ${entries.filter(entry => entry.localBundle).length} local bundles, ${entries.filter(entry => entry.boarding).length} playable boarding routes`)
