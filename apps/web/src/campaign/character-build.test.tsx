import { STAND_IN_BANDS, issuedCampaignRig, newMember, newSave, parseCampaignBook, parseSave, startSupply, STAND_IN_FILES,
  type CampaignBook, type Save } from '@cyber/domain'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { characterBuild, characterRigProblem, fitCharacterRig, saveCharacterLoadout, wearCharacterLoadout } from './character-build'
import { campaignSquadInput, groundInput } from './training'
import { indexCampaignNavigation, type CharacterTab } from './navigation'
import RosterScreen from './RosterScreen'

const ada = 9000771, bea = 9000772
const base = parseCampaignBook({ ...STAND_IN_FILES, 'campaign.json': {
  schemaVersion: 1, draft: true, opening: 'opening', quests: [{ id: 'opening', title: 'First Watch', scene: 'sw1-ch1-s1' }], art: [], assets: [],
} })
const stock = { fuel: 8, provisions: 8, alloy: 8 }
const noStock = { fuel: 0, provisions: 0, alloy: 0 }
const book: CampaignBook = { ...base, supply: { after: 'opening', start: 'dock', routes: [], ports: [
  { id: 'dock', name: 'Dock', scene: 'sw1-ch1-s1', stock, reserve: noStock, upkeep: noStock, produces: noStock },
] }, ground: new Map([['capture', { id: 'capture', title: 'Capture', win: {} }]]),
  fourAct: { schemaVersion: 1, arcs: new Map(), systems: new Map(), duos: new Map(), personalQuestOwners: new Map() } }
const context = { actor: ada, bands: STAND_IN_BANDS, variant: 0 }
const prepared = (): Save => ({ ...newSave('character-menu', '2026-11-26T00:00:00Z'), campaignCurve: 1, crew: [{ ...newMember(ada), xp: 750 }, newMember(bea)],
  worlds: { current: null, known: {}, missions: ['capture'] }, campaignSupply: startSupply(book.supply!),
  campaignGear: { alloy: 1, parts: ['legs-runner', 'arm-guard'] }, combatTraining: { [ada]: { rank: 4, subclass: 'heal' } } })

it('compares the same character’s equipped armor, levels and Laser against an owned prospective fit', () => {
  const save = prepared()
  const build = characterBuild(save, context)!
  const desired = { ...build.rig, legs: 'legs-runner', leftArm: 'arm-guard' }
  const preview = build.compare(desired)
  expect(preview.hp.leftArm - build.stats.hp.leftArm).toBe(6)
  expect(preview.load - build.stats.load).toBe(3)
  expect(preview.weapons).toEqual(build.stats.weapons)
  expect(preview.weapons[0]?.damage).toBe(7)
  const equipped = fitCharacterRig(save, book, context, desired)
  const frozen = campaignSquadInput(groundInput('training', ada, 'Lead', 'hand-rifle', 'back-bulwark'), equipped, { useFitted: true })
  expect(frozen.units[0]?.frozenRig).toMatchObject({ ...desired, rightHand: 'hand-rifle' })
  expect(characterBuild(equipped, context)?.stats).toEqual(preview)
})

it('saves and reapplies a named loadout across reload while guarding ownership and keeping role weapons issued', () => {
  const current = prepared()
  const build = characterBuild(current, context)!
  const upgraded = fitCharacterRig(current, book, context, { ...build.rig, legs: 'legs-runner' })
  const saved = saveCharacterLoadout(upgraded, context, 0, '  Scout  ')
  const restored = parseSave(JSON.parse(JSON.stringify(fitCharacterRig(saved, book, context, build.issued))))
  expect(restored.crew[0]?.presets[0]).toMatchObject({ name: 'Scout', rig: { legs: 'legs-runner' } })
  const holder = { ...context, actor: bea }
  const busy = fitCharacterRig(restored, book, holder, { ...characterBuild(restored, holder)!.rig, legs: 'legs-runner' })
  expect(wearCharacterLoadout(busy, book, context, 0)).toBe(busy)
  expect(characterRigProblem(busy, book, context, restored.crew[0]!.presets[0]!.rig)).toMatch(/another character/)
  const reapplied = wearCharacterLoadout(restored, book, context, 0)
  expect(reapplied.crew[0]?.rig).toMatchObject({ legs: 'legs-runner', rightHand: 'hand-rifle' })
  const legacy = { ...restored, crew: [{ ...restored.crew[0]!, presets: [
    { name: 'Previous build', rig: { ...issuedCampaignRig('hand-greatblade'), legs: 'legs-runner' } },
  ] }, restored.crew[1]!] }
  expect(wearCharacterLoadout(legacy, book, context, 0).crew[0]?.rig).toMatchObject({ legs: 'legs-runner', rightHand: 'hand-rifle' })
})

it('refuses duplicate or unavailable parts, over-capacity fits, and changes while away', () => {
  const save = prepared()
  const build = characterBuild(save, context)!
  expect(characterRigProblem(save, book, context, { ...build.rig, leftArm: 'arm-guard', rightArm: 'arm-guard' })).toMatch(/Only one/)
  expect(characterRigProblem(save, book, context, { ...build.rig, core: 'core-harness' })).toMatch(/unavailable/)
  const low = { ...context, bands: { ...STAND_IN_BANDS, power: 1 as const } }
  expect(characterRigProblem(save, book, low, { ...characterBuild(save, low)!.rig, leftArm: 'arm-guard' })).toMatch(/Capacity/)
  const away = { ...save, campaignSupply: { ...save.campaignSupply!, port: 'elsewhere' } }
  expect(fitCharacterRig(away, book, context, { ...build.rig, legs: 'legs-runner' })).toBe(away)
})

it('retains the selected identity across the four character panels and marks current progression', () => {
  const save = prepared(), navigation = indexCampaignNavigation(book)
  navigation.roster.push({ speaker: ada, kind: 'Uma', quests: ['opening'] }, { speaker: bea, kind: 'Uma', quests: [] })
  const common = { book, save, assets: new Map(), complete: new Set<string>(), navigation, open: () => {}, travel: () => {}, onBrowse: () => {} }
  const tabs: CharacterTab[] = ['Stats', 'Equipment', 'Progression', 'Story']
  const output = tabs.map(tab => renderToStaticMarkup(<RosterScreen {...common} browse={{ kind: 'Uma', search: '', page: 0, selected: ada, tab }} />))
  for (const [index, markup] of output.entries()) {
    expect(markup).toContain(`data-character="${ada}"`)
    expect(markup).toContain(`data-character-pane="${tabs[index]}"`)
  }
  expect(output[0]).toContain('aria-label="Power"')
  expect(output[1]).toContain('Equipped &amp; owned')
  expect(output[2]).toContain('aria-label="Experience to next level"')
  expect(output[2]).toContain('aria-current="step"')
  expect(output[3]).toContain('First Watch')
})
