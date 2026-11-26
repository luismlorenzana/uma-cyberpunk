import { replayBattle, type BattleAction, type BattleInput } from '@cyber/battle'
import { CAMPAIGN_WORKSHOP_ALLOY_MAX, awayMembers, campaignSupport, canTakeOrdinaryAssignment, resting,
  type CampaignBook, type GroundEncounter, type Mission, type Save } from '@cyber/domain'
import { finishMission } from '../mission/director'
import { advanceStationWatches, stationOf, voyageCrew } from './watch'

const contracts = {
  'dock-recovery': { title: 'Recover the salvage cache', scenario: 'drydock-receiver', kind: 'reach', alloy: 2, base: false },
  'dock-defense': { title: 'Defend the salvage crew', scenario: 'foundry-hold', kind: 'hold', alloy: 2, base: false },
  'base-recovery': { title: 'Recover base stock', scenario: 'drydock-receiver', kind: 'reach', alloy: 3, base: true },
} as const
export type SalvageContract = keyof typeof contracts
export const salvageContracts = Object.keys(contracts) as SalvageContract[]

export const salvageRecipes = [
  { contract: 'dock-recovery', part: 'legs-runner', slot: 'legs', alloy: 3, icon: '' },
  { contract: 'dock-defense', part: 'legs-anchor', slot: 'legs', alloy: 4, icon: '' },
  { contract: 'base-recovery', part: 'core-reactor', slot: 'core', alloy: 5, icon: '' },
] as const

export function salvageSite(save: Save, book: CampaignBook) {
  const port = save.campaignSupply?.port
  if (!book.fourAct || !port || !save.worlds.missions.some(id => book.ground.has(id))) return
  const station = stationOf(save, book)
  const docked = station.anchor === port
  const base = (book.projects ?? []).some(project => project.base?.port === port && save.campaignProjects[project.id] === 0)
  return { port, docked, base }
}

export function salvageOptions(save: Save, book: CampaignBook) {
  const site = salvageSite(save, book)
  if (!site) return []
  return salvageContracts.filter(key => contracts[key].base ? site.base : site.docked).map(key => ({
    key, ...contracts[key], reward: Math.min(contracts[key].alloy, CAMPAIGN_WORKSHOP_ALLOY_MAX - save.campaignGear.alloy),
    recipe: salvageRecipes.find(row => row.contract === key),
  }))
}

export function salvageCrew(save: Save, book: CampaignBook): number[] {
  const ashore = campaignSupport(book, save).ashore
  const away = new Set(awayMembers(save.operations, save.squads))
  const voyages = voyageCrew(save)
  return save.crew.filter(member => !member.heroine && canTakeOrdinaryAssignment(member) && !resting(member)
    && !ashore.has(member.outfit) && !away.has(member.outfit) && !voyages.has(member.outfit)).map(member => member.outfit)
}

export function startSalvage(save: Save, book: CampaignBook, release: string, key: SalvageContract, outfit: number): Save {
  if (save.mission || save.salvage?.active || save.expedition || save.campaignDay.pending || save.pairScene || !salvageCrew(save, book).includes(outfit)) return save
  const offer = salvageOptions(save, book).find(row => row.key === key)
  const port = save.campaignSupply?.port
  if (!port || !offer?.reward) return save
  const station = stationOf(save, book)
  if (station.appointments?.some(row => row.at === station.absoluteWatch)) return save
  const sequence = (save.salvage?.sequence ?? 0) + 1
  const id = `salvage-${sequence}`
  const started: Save = { ...save, salvage: { sequence, clears: save.salvage?.clears ?? {},
    active: { id, contract: key, port, release, alloy: offer.reward } },
    mission: { chapter: 'salvage', id, squad: [outfit], step: 'briefing', battle: null, won: null } }
  return advanceStationWatches(started, book, 1)
}

export function salvageDeployment(save: Save): { mission: Mission; ground: GroundEncounter } | undefined {
  const active = save.salvage?.active
  if (!active || !Object.hasOwn(contracts, active.contract) || active.id !== save.mission?.id) return
  const offer = contracts[active.contract as SalvageContract]
  return { mission: { id: active.id, place: active.port, objective: { kind: offer.kind },
    brief: offer.kind === 'hold' ? 'Keep the recovery team safe until the hold ends.' : 'Reach the cache marked on the board.',
    enemies: [], fixedSquad: null, side: [], scenario: offer.scenario },
    ground: { id: active.id, title: offer.title, win: {} } }
}

export function closeSalvage(save: Save, attempt: string, claim: boolean): Save {
  const state = save.salvage, mission = save.mission
  if (!state?.active || state.active.id !== attempt || mission?.id !== attempt) return save
  const { active, ...closed } = state
  if (!claim) return finishMission({ ...save, salvage: closed })
  if (mission.step !== 'results' || !mission.won || !mission.battle) return save
  try {
    const result = replayBattle(mission.battle.input as BattleInput, mission.battle.actions as BattleAction[])
    if (result.error || result.state.result?.winner !== 'squad') return save
  } catch { return save }
  const alloy = Math.min(CAMPAIGN_WORKSHOP_ALLOY_MAX, save.campaignGear.alloy + active.alloy)
  return finishMission({ ...save, campaignGear: { ...save.campaignGear, alloy },
    salvage: { ...closed, clears: { ...state.clears, [active.contract]: (state.clears[active.contract] ?? 0) + 1 } } })
}
