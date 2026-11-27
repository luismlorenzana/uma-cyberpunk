import {
  awayMembers, canTakeOrdinaryAssignment, COMMAND_STATIONS, crewSpeaker, MAX_DRILLS, reactorPips, resumeCommand, shipWith, commandTurn, setFlag,
  STARTER_CUTTER, type CampaignBook, type CombatAct, type CommandCast, type CampaignSupply, type CommandAction, type CommandEncounter, type CommandInput, type CommandStation, type Save,
} from '@cyber/domain'
import { deploy, finishBattle, finishMission, recordAction, retry, setSquad } from '../mission/director'
import { expeditionOfficer } from './expedition'
import { creditCampaignClear } from './progression'
import { advanceStationWatches, stationOf } from './watch'

export function missionOfficer(save: Save, station: CommandStation) {
  const override = save.mission?.callUp?.stations?.[station]
  if (override === undefined) return save.commandCrew[station]
  if (override === null) return
  return { outfit: override, ...(save.commandTraining[override]?.[station] ?? { drills: 0, trainedDay: null }) }
}

export function assignOfficer(save: Save, station: CommandStation, outfit: number | null, ashore?: ReadonlySet<number>): Save {
  if (save.expedition || save.mission?.step !== 'deploy' || missionOfficer(save, station)?.outfit === outfit) return save
  if (outfit !== null && (ashore?.has(outfit) || awayMembers(save.operations, save.squads).includes(outfit) || !canTakeOrdinaryAssignment(save.crew.find(member => member.outfit === outfit)))) return save
  if (save.mission.callUp) {
    const stations = { ...save.mission.callUp.stations, [station]: outfit }
    for (const role of COMMAND_STATIONS) {
      if (role !== station && outfit !== null && missionOfficer(save, role)?.outfit === outfit) stations[role] = null
    }
    return { ...save, mission: { ...save.mission, callUp: { ...save.mission.callUp, stations } } }
  }
  const commandCrew = { ...save.commandCrew }
  const commandTraining = { ...save.commandTraining }
  for (const role of COMMAND_STATIONS) {
    const old = commandCrew[role]
    if (old) commandTraining[old.outfit] = { ...commandTraining[old.outfit], [role]: { drills: old.drills, trainedDay: old.trainedDay } }
  }
  delete commandCrew[station]
  if (outfit !== null) {
    for (const role of COMMAND_STATIONS) if (commandCrew[role]?.outfit === outfit) delete commandCrew[role]
    commandCrew[station] = { outfit, ...(commandTraining[outfit]?.[station] ?? { drills: 0, trainedDay: null }) }
  }
  return { ...save, commandCrew, commandTraining }
}

export function drillOfficer(save: Save, station: CommandStation, ashore?: ReadonlySet<number>): Save {
  const officer = save.commandCrew[station]
  if (save.expedition || save.mission?.step !== 'deploy' || save.mission.callUp || !officer || ashore?.has(officer.outfit) || awayMembers(save.operations, save.squads).includes(officer.outfit) || !canTakeOrdinaryAssignment(save.crew.find(member => member.outfit === officer.outfit))
    || officer.drills >= MAX_DRILLS || officer.trainedDay === save.campaignDay.day) return save
  const record = { drills: officer.drills + 1, trainedDay: save.campaignDay.day }
  return { ...save, commandCrew: { ...save.commandCrew, [station]: { outfit: officer.outfit, ...record } },
    commandTraining: { ...save.commandTraining, [officer.outfit]: { ...save.commandTraining[officer.outfit], [station]: record } } }
}

export function canLaunch(supply: CampaignSupply, encounter: CommandEncounter): boolean {
  return supply.fuel >= encounter.cost.fuel && supply.provisions >= encounter.cost.provisions
}

export function launchCommand(save: Save, supply: CampaignSupply, encounter: CommandEncounter,
  support?: { ashore: ReadonlySet<number>; relay: number; preparation?: { alloy: number; integrity: number };
    qualifications?: ReadonlyMap<number, CommandStation>; contributions?: string[]; cast?: CommandCast; requiredLead?: number;
    vessel?: CommandInput['vessel'] }): Save {
  if (save.mission?.step !== 'deploy' || save.mission.id !== encounter.id) return save
  const commandCinema = { fast: save.commandCinema.fast, retries: 0, pending: null }
  if (save.expedition) {
    const current = save.expedition
    if (current.berthed || !canLaunch({ ...supply, fuel: current.fuel, provisions: current.provisions }, encounter)) return save
    const presentation = support?.cast
    if (!presentation) return save
    const officers = Object.fromEntries(COMMAND_STATIONS.map(station => [station, presentation.crew[station] ? expeditionOfficer(current, station).drills : 0])) as CommandInput['officers']
    const input = commandSnapshot(shipWith(['bridge']), encounter, presentation, officers, Number(!!current.reinforced), [], support?.vessel)
    return deploy({ ...save, commandCinema,
      expedition: { ...current, fuel: current.fuel - encounter.cost.fuel, provisions: current.provisions - encounter.cost.provisions } }, input)
  }
  if (!canLaunch(supply, encounter)) return save
  const cost = support?.preparation?.alloy ?? 0
  if (save.wallet.alloy < cost) return save
  const away = new Set(awayMembers(save.operations, save.squads))
  const requiredLead = support?.requiredLead
  const available = save.crew.filter(member => canTakeOrdinaryAssignment(member) && !support?.ashore.has(member.outfit) && !away.has(member.outfit)
    && (requiredLead === undefined || !member.heroine))
  if (requiredLead !== undefined && (save.mission.squad[0] !== requiredLead || !available.some(member => member.outfit === requiredLead))) return save
  const byMember = new Map(available.map(member => {
    const speaker = crewSpeaker(member)
    return [member.outfit, { speaker, name: support?.cast?.present.find(actor => actor.speaker === speaker)?.name ?? 'Crew officer' }]
  }))
  const present = [...byMember.values()]
  const crew = Object.fromEntries(COMMAND_STATIONS.flatMap(station => {
    const assigned = missionOfficer(save, station), actor = assigned && byMember.get(assigned.outfit)
    return actor ? [[station, actor]] : []
  }))
  const presentation: CommandCast = { crew, present, objective: support?.cast?.objective ?? (encounter.assault ? 'Boarding shuttle' : 'Protected vessel'),
    ...(support?.cast?.commander ? { commander: { ...support.cast.commander } } : {}) }
  const officers = Object.fromEntries(COMMAND_STATIONS.map((station) => {
    const assigned = missionOfficer(save, station)
    const qualified = assigned && support?.qualifications?.get(assigned.outfit) === station
    return [station, assigned && byMember.has(assigned.outfit) ? Math.min(MAX_DRILLS, assigned.drills + Number(!!qualified)) : 0]
  })) as CommandInput['officers']
  const input = commandSnapshot(save.ship, encounter, presentation, officers,
    (support?.relay ?? 0) + (support?.preparation?.integrity ?? 0), support?.contributions ?? [], support?.vessel)
  const campaignSupply = { ...supply, fuel: supply.fuel - encounter.cost.fuel, provisions: supply.provisions - encounter.cost.provisions }
  const wallet = cost ? { ...save.wallet, alloy: save.wallet.alloy - cost } : save.wallet
  return deploy({ ...setSquad(save, save.mission.squad), campaignSupply, wallet, commandCinema }, input)
}

/** Freeze the chosen ship and cast before the battle starts or the player reloads. */
export function commandSnapshot(ship: Save['ship'], encounter: CommandEncounter, presentation: CommandCast,
  officers: CommandInput['officers'], transportBonus: number, contributions: readonly string[], vessel?: CommandInput['vessel']): CommandInput {
  const setup = { presentation, ...(vessel ? { vessel } : {}), transport: encounter.transport + transportBonus, enemy: encounter.enemy,
    threats: encounter.threats.map(threat => ({ ...threat })), reactor: Math.max(3, reactorPips(ship)), officers }
  const assault = encounter.assault
  if (!assault) return { ...setup, version: 1 }
  const target = { emitter: assault.emitter, disabledFlag: assault.disabledFlag, ...(assault.emitterRequired ? { emitterRequired: true as const } : {}) }
  return assault.fighterTarget ? { ...setup, version: 3, assault: target, contributions: [...contributions] }
    : { ...setup, version: 2, assault: target }
}

export function issueCommand(save: Save, encounter: string, turn: number, action: CommandAction): Save {
  const mission = save.mission
  if (!mission?.battle || mission.step !== 'battle' || mission.id !== encounter) return save
  const battle = resumeCommand(mission.battle.input, mission.battle.actions)
  if (!battle || battle.state.turn !== turn) return save
  const state = commandTurn(battle.input, battle.state, action)
  if (state === battle.state) return save
  const { target, ...order } = action
  const next = recordAction(save, target ? { ...order, target } : order)
  const committed = { ...next, commandCinema: { ...next.commandCinema, pending: { encounter, turn: state.turn, beat: next.commandCinema.fast ? 3 : 0 } } }
  return state.result ? finishBattle(committed, state.result === 'won') : committed
}

export function settleCommand(save: Save, encounter: string, progression?: { requiredLead?: number; book?: CampaignBook; act?: CombatAct }): Save {
  if (save.mission?.step !== 'results' || save.mission.id !== encounter || !save.mission.won) return save
  const first = !save.worlds.missions.includes(encounter)
  const missions = first ? [...save.worlds.missions, encounter] : save.worlds.missions
  const battle = save.mission.battle
  const run = battle && resumeCommand(battle.input, battle.actions)
  if (!run || run.state.result !== 'won') return save
  const story = run.input.version !== 1 && run.state.emitter === 0 ? setFlag(save.story, run.input.assault.disabledFlag) : save.story
  const officers = Object.values(run.input.presentation?.crew ?? {}).flatMap(actor => actor ? [actor.speaker] : [])
  const lead = progression?.requiredLead
  const credited = progression && first
    ? creditCampaignClear(save, lead === undefined ? officers : [lead, ...officers], progression.act) : save
  const finished = finishMission({ ...credited, story, worlds: { ...save.worlds, missions } })
  const book = progression?.book, vessel = run.input.vessel
  if (!book?.fourAct || !vessel) return finished
  const integrity = run.state.hull
  let ship = finished
  if (finished.expedition?.ship === vessel.id) ship = { ...finished, expedition: { ...finished.expedition, integrity } }
  else if (vessel.id === STARTER_CUTTER.id) ship = { ...finished, station: { ...stationOf(finished, book), integrity } }
  else {
    const duo = finished.finaleProgress?.duo
    if (duo && book.fourAct.duos.get(duo)?.expedition?.ship === vessel.id) {
      const hull = finished.fleet?.[duo] ?? { ship: vessel.id, condition: 'commissioned' }
      ship = { ...finished, fleet: { ...finished.fleet, [duo]: { ...hull, integrity } } }
    }
  }
  return advanceStationWatches(ship, book, book.stationStory?.commandWatches?.get(encounter) ?? 1)
}
