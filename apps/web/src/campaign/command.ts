import {
  awayMembers, COMMAND_STATIONS, MAX_DRILLS, reactorPips, resumeCommand, commandTurn, setFlag,
  type CommandCast, type CampaignSupply, type CommandAction, type CommandEncounter, type CommandInput, type CommandStation, type Save,
} from '@cyber/domain'
import { deploy, finishBattle, finishMission, recordAction, retry } from '../mission/director'

export function assignOfficer(save: Save, station: CommandStation, outfit: number | null, ashore?: ReadonlySet<number>): Save {
  if (save.mission?.step !== 'deploy' || save.commandCrew[station]?.outfit === outfit) return save
  if (outfit !== null && (ashore?.has(outfit) || awayMembers(save.operations, save.squads).includes(outfit) || !save.crew.some((member) => member.outfit === outfit))) return save
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
  if (save.mission?.step !== 'deploy' || !officer || ashore?.has(officer.outfit) || awayMembers(save.operations, save.squads).includes(officer.outfit) || !save.crew.some((member) => member.outfit === officer.outfit)
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
    qualifications?: ReadonlyMap<number, CommandStation>; contributions?: string[]; cast?: CommandCast }): Save {
  if (save.mission?.step !== 'deploy' || save.mission.id !== encounter.id || !canLaunch(supply, encounter)) return save
  const cost = support?.preparation?.alloy ?? 0
  if (save.wallet.alloy < cost) return save
  const available = save.crew.filter(member => !support?.ashore.has(member.outfit) && !awayMembers(save.operations, save.squads).includes(member.outfit))
  const present = available.map(member => ({ speaker: member.outfit, name: support?.cast?.present.find(actor => actor.speaker === member.outfit)?.name ?? 'Crew officer' }))
  const crew = Object.fromEntries(COMMAND_STATIONS.flatMap(station => {
    const assigned = save.commandCrew[station], actor = assigned && present.find(actor => actor.speaker === assigned.outfit)
    return actor ? [[station, actor]] : []
  }))
  const presentation: CommandCast = { crew, present, objective: support?.cast?.objective ?? (encounter.assault ? 'Boarding shuttle' : 'Protected vessel'),
    ...(support?.cast?.commander ? { commander: { ...support.cast.commander } } : {}) }
  const officers = Object.fromEntries(COMMAND_STATIONS.map((station) => {
    const assigned = save.commandCrew[station]
    const qualified = assigned && support?.qualifications?.get(assigned.outfit) === station
    return [station, assigned && !support?.ashore.has(assigned.outfit) && !awayMembers(save.operations, save.squads).includes(assigned.outfit) && save.crew.some((member) => member.outfit === assigned.outfit) ? Math.min(MAX_DRILLS, assigned.drills + Number(!!qualified)) : 0]
  })) as CommandInput['officers']
  const setup = { presentation, transport: encounter.transport + (support?.relay ?? 0) + (support?.preparation?.integrity ?? 0), enemy: encounter.enemy, threats: encounter.threats,
    reactor: Math.max(3, reactorPips(save.ship)), officers }
  const assault = encounter.assault
  const input: CommandInput = assault ? assault.fighterTarget
    ? { ...setup, version: 3, assault: { emitter: assault.emitter, disabledFlag: assault.disabledFlag }, contributions: support?.contributions ?? [] }
    : { ...setup, version: 2, assault: { emitter: assault.emitter, disabledFlag: assault.disabledFlag } }
    : { ...setup, version: 1 }
  const campaignSupply = { ...supply, fuel: supply.fuel - encounter.cost.fuel, provisions: supply.provisions - encounter.cost.provisions }
  const wallet = cost ? { ...save.wallet, alloy: save.wallet.alloy - cost } : save.wallet
  return deploy({ ...save, campaignSupply, wallet, commandCinema: { ...save.commandCinema, retries: 0, pending: null } }, input)
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

export function settleCommand(save: Save, encounter: string): Save {
  if (save.mission?.step !== 'results' || save.mission.id !== encounter || !save.mission.won) return save
  const missions = save.worlds.missions.includes(encounter) ? save.worlds.missions : [...save.worlds.missions, encounter]
  const battle = save.mission.battle
  const run = battle && resumeCommand(battle.input, battle.actions)
  if (!run || run.state.result !== 'won') return save
  const story = run.input.version !== 1 && run.state.emitter === 0 ? setFlag(save.story, run.input.assault.disabledFlag) : save.story
  return finishMission({ ...save, story, worlds: { ...save.worlds, missions } })
}
