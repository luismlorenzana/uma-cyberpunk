import { startBattle } from '@cyber/battle'
import {
  finishCampaignNightScene, loadShipment, newMember, newSave, parseSave, setFlag, startCampaignNight, startSupply, storesAt,
  type CampaignBook, type CampaignDate, type CampaignWorkshop, type Save, type SupplyNetwork,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { deploy, finishBattle, retry } from '../mission/director'
import { creditCampaignDates, dateAvailable, dateProgress, recordDateScene } from './dates'
import { groundInput } from './training'
import { settleCampaignDay } from './watch'
import { craftCampaignPart, fitCampaignPart, fittedGroundRig, sendWorkshopAlloy } from './workshop'

const outfit = 9000301
const second = 9000302
const mission = { id: 'boarding', place: 'relay', objective: { kind: 'defeat-leader' as const }, brief: 'Reach the commander.',
  enemies: [], fixedSquad: [outfit], side: [], scenario: 'quarantine-board-cargo' }
const workshop: CampaignWorkshop = { after: 'workshop', port: 'relay', missions: [mission.id], recipes: [
  { part: 'arm-guard', slot: 'leftArm', alloy: 3, icon: 'guard' },
  { part: 'back-missiles', slot: 'back', alloy: 4, icon: 'pod' },
] }
const date: CampaignDate = {
  companion: outfit, after: 'recruitment', awards: [{ quest: 'convoy', rapport: 250 }],
  milestones: [
    { title: 'First', scene: 'first-date', morning: 'first-morning', rank: 1, rapport: 100, legacyFlag: 'legacy-visit' },
    { title: 'Trust', scene: 'trust-date', morning: null, rank: 2, rapport: 350 },
    { title: 'Convoy', scene: 'convoy-date', morning: null, rank: 4, rapport: 550, after: 'convoy' },
    { title: 'Future', scene: 'future-date', morning: null, rank: 6, rapport: 500 },
    { title: 'Choice', scene: 'choice-date', morning: 'choice-morning', rank: 8, rapport: 0 },
  ],
  regular: { title: 'Quiet evening', scene: 'quiet-evening', morning: null },
}
const port = { id: 'relay', name: 'Relay', scene: 'landing',
  stock: { fuel: 10, provisions: 10, alloy: 11 }, produces: { fuel: 1, provisions: 1, alloy: 2 },
  upkeep: { fuel: 1, provisions: 1, alloy: 1 }, reserve: { fuel: 0, provisions: 0, alloy: 2 } }
const supply: SupplyNetwork = { after: 'recruitment', start: 'relay', ports: [port], routes: [] }
const book: CampaignBook = {
  opening: 'recruitment', draft: true, assets: [], art: [], scenes: new Map(), commands: new Map(), pairs: [], dates: [date], workshop, supply,
  quests: [
    { id: 'recruitment', title: 'Recruitment', scene: 'recruited' },
    { id: 'convoy', title: 'Convoy debrief', scene: 'convoy-cleared', after: 'recruitment' },
    { id: 'workshop', title: 'Workshop', scene: 'workshop-tour', after: 'recruitment', port: 'relay' },
  ],
  ground: new Map([[mission.id, { id: mission.id, title: 'Boarding', alternate: { flag: 'emitter', scenario: 'quarantine-board-maintenance',
    label: 'Hatch open' }, win: {} }]]),
  story: { casting: { schemaVersion: 1, leads: [], crewOrder: [outfit, second], heroines: [], minor: [] }, worlds: {},
    chapters: { relay: { id: 'relay', schemaVersion: 1, world: 'relay', leads: [outfit], number: 2, danger: 1, needs: [],
      scenes: [], missions: [mission], debrief: { steps: [] } } }, files: {}, calls: {}, bonds: {}, events: {} },
}
function recruited(): Save {
  const save = newSave('captain', '2026-11-17T00:00:00Z')
  return { ...save, crew: [newMember(outfit), newMember(second)], campaignSupply: startSupply(supply),
    story: { ...save.story, seen: ['recruited', 'workshop-tour'] } }
}
const restored = (save: Save) => parseSave(JSON.parse(JSON.stringify(save)))

describe('Captain evenings in the campaign', () => {
  it.each(['trust', 'heart'] as const)('earns the %s path with one award per milestone and one upkeep per night', (path) => {
    let save = recruited()
    expect(dateAvailable(save, book, date)).toBe(true)
    function visit(scene: string) {
      const found = dateProgress(save, book, date).visit
      expect(found.scene).toBe(scene)
      const pending = { kind: 'visit' as const, companion: outfit, scene, morning: found.morning }
      const before = restored({ ...save, campaignDay: startCampaignNight(save.campaignDay, pending) })
      const finish = finishCampaignNightScene(before.campaignDay, before.campaignDay.day, pending)
      const next = recordDateScene(before, book, date, scene, [], scene === 'choice-date' ? [{ kind: 'path', path }] : [])
      expect(recordDateScene(next, book, date, scene, [], [])).toBe(next)
      save = restored(settleCampaignDay(next, finish, book))
      if (save.campaignDay.pending) {
        const day = save.campaignDay.day
        const morning = save.campaignDay.pending
        save = restored({ ...recordDateScene(save, book, date, morning.scene, [], []), campaignDay: finishCampaignNightScene(save.campaignDay, day, morning) })
        expect(save.campaignDay.day).toBe(day)
      }
    }
    visit('first-date')
    expect(save.crew[0]?.bond.rank).toBe(2)
    visit('trust-date')
    expect(save.crew[0]?.bond.rank).toBe(4)
    expect(dateProgress(save, book, date).visit.scene).toBe('quiet-evening')
    save = creditCampaignDates({ ...save, story: { ...save.story, seen: [...save.story.seen, 'convoy-cleared'] } }, book)
    expect(creditCampaignDates(save, book)).toBe(save)
    visit('convoy-date')
    visit('future-date')
    visit('choice-date')
    expect(save.crew[0]?.bond).toMatchObject({ rank: 8, path })
    expect(save.crew[1]?.bond.path).toBeNull()
    expect(save.campaignDay.day).toBe(6)
    expect(save.campaignSupply?.provisions).toBe(0)
    expect(save.story.seen).toContain('choice-morning')
  })

  it('credits an earlier campaign visit once while keeping a saved pending morning', () => {
    const { campaignGear: _gear, ...old } = recruited()
    const before = parseSave({ ...old, version: 14, story: setFlag(old.story, 'legacy-visit'),
      campaignDay: { day: 3, pending: { kind: 'morning', companion: outfit, scene: 'first-morning' } } })
    const migrated = creditCampaignDates(before, book)
    expect(migrated.crew[0]?.bond.rank).toBe(2)
    expect(migrated.campaignDay).toEqual(before.campaignDay)
    expect(dateProgress(migrated, book, date).visit.scene).toBe('trust-date')
    expect(creditCampaignDates(restored(migrated), book)).toEqual(migrated)
  })
})

describe('planet-funded campaign equipment', () => {
  it('moves port stock into the Hangar once per shipment and spends it on a single persistent part', () => {
    const save = recruited()
    expect(craftCampaignPart(save, book, 'arm-guard')).toBe(save)
    const shipped = restored(sendWorkshopAlloy(save, book))
    expect(storesAt(shipped.campaignSupply!, port).alloy).toBe(7)
    expect(shipped.wallet).toEqual(save.wallet)
    expect(shipped.campaignGear).toEqual({ alloy: 4, parts: [] })
    const crafted = restored(craftCampaignPart(shipped, book, 'arm-guard'))
    expect(crafted.campaignGear).toEqual({ alloy: 1, parts: ['arm-guard'] })
    expect(craftCampaignPart(crafted, book, 'arm-guard')).toBe(crafted)
    const fitted = restored(fitCampaignPart(crafted, book, outfit, 'arm-guard', true))
    expect(fitted.crew[0]?.rig?.leftArm).toBe('arm-guard')
    expect(fitCampaignPart(fitted, book, second, 'arm-guard', true)).toBe(fitted)
    const more = sendWorkshopAlloy(fitted, book)
    const normal = loadShipment(more.campaignSupply!, port, 'alloy')
    expect(normal).toBeNull()
    const upgraded = craftCampaignPart(more, book, 'back-missiles')
    const rigged = restored(fitCampaignPart(upgraded, book, outfit, 'back-missiles', true))
    expect(rigged.campaignGear).toEqual({ alloy: 1, parts: ['arm-guard', 'back-missiles'] })
    const scenario = mission.scenario
    const rig = fittedGroundRig(rigged.crew[0]?.rig, scenario)!
    expect(rig.back).toBe('back-missiles')
    const fittedInput = groundInput(scenario, outfit, 'Lead', 'hand-rifle', 'back-bulwark', undefined, [], rig)
    const issuedInput = groundInput(scenario, outfit, 'Lead', 'hand-rifle', 'back-bulwark')
    expect(fittedInput.units[0]?.loadout.leftArm.hp).toBe(6)
    expect(issuedInput.units[0]?.loadout.leftArm.hp).toBeUndefined()
    expect(startBattle(fittedInput).state.input.units[0]?.loadout.back.weapon?.band).toBe('long')
    expect(startBattle(issuedInput).state.input.units[0]?.loadout.back.kind).toBe('bulwark')
    const marked: Save = { ...rigged, mission: { id: mission.id, chapter: 'relay', step: 'deploy', squad: [outfit], battle: null, won: null } }
    const failed = restored(finishBattle(deploy(marked, fittedInput), false))
    const replayed = restored(retry(failed))
    expect(replayed.mission?.battle?.input).toEqual(fittedInput)
    expect(replayed.campaignGear).toEqual(rigged.campaignGear)
    expect(replayed.campaignSupply).toEqual(rigged.campaignSupply)
    expect(fitCampaignPart(replayed, book, outfit, 'arm-guard', false)).toBe(replayed)
  })
})
