import {
  COMMAND_STATIONS, MAX_DRILLS, reactorPips, resumeCommand, commandTurn, setFlag,
  type CampaignSupply, type CommandAction, type CommandEncounter, type CommandInput, type CommandStation, type Save,
} from '@cyber/domain'
import { deploy, finishBattle, finishMission, recordAction } from '../mission/director'

export function assignOfficer(save: Save, station: CommandStation, outfit: number | null, ashore?: ReadonlySet<number>): Save {
  if (save.mission?.step !== 'deploy' || save.commandCrew[station]?.outfit === outfit) return save
  if (outfit !== null && (ashore?.has(outfit) || !save.crew.some((member) => member.outfit === outfit))) return save
  const commandCrew = { ...save.commandCrew }
  delete commandCrew[station]
  if (outfit !== null) {
    for (const role of COMMAND_STATIONS) if (commandCrew[role]?.outfit === outfit) delete commandCrew[role]
    commandCrew[station] = { outfit, drills: 0, trainedDay: null }
  }
  return { ...save, commandCrew }
}

export function drillOfficer(save: Save, station: CommandStation, ashore?: ReadonlySet<number>): Save {
  const officer = save.commandCrew[station]
  if (save.mission?.step !== 'deploy' || !officer || ashore?.has(officer.outfit) || !save.crew.some((member) => member.outfit === officer.outfit)
    || officer.drills >= MAX_DRILLS || officer.trainedDay === save.campaignDay.day) return save
  return { ...save, commandCrew: { ...save.commandCrew, [station]: { ...officer, drills: officer.drills + 1, trainedDay: save.campaignDay.day } } }
}

export function canLaunch(supply: CampaignSupply, encounter: CommandEncounter): boolean {
  return supply.fuel >= encounter.cost.fuel && supply.provisions >= encounter.cost.provisions
}

export function launchCommand(save: Save, supply: CampaignSupply, encounter: CommandEncounter,
  support?: { ashore: ReadonlySet<number>; relay: number }): Save {
  if (save.mission?.step !== 'deploy' || save.mission.id !== encounter.id || !canLaunch(supply, encounter)) return save
  const officers = Object.fromEntries(COMMAND_STATIONS.map((station) => {
    const assigned = save.commandCrew[station]
    return [station, assigned && !support?.ashore.has(assigned.outfit) && save.crew.some((member) => member.outfit === assigned.outfit) ? assigned.drills : 0]
  })) as CommandInput['officers']
  const setup = { transport: encounter.transport + (support?.relay ?? 0), enemy: encounter.enemy, threats: encounter.threats,
    reactor: Math.max(3, reactorPips(save.ship)), officers }
  const assault = encounter.assault
  const input: CommandInput = assault ? { ...setup, version: 2, assault: { emitter: assault.emitter, disabledFlag: assault.disabledFlag } }
    : { ...setup, version: 1 }
  const campaignSupply = { ...supply, fuel: supply.fuel - encounter.cost.fuel, provisions: supply.provisions - encounter.cost.provisions }
  return deploy({ ...save, campaignSupply }, input)
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
  return state.result ? finishBattle(next, state.result === 'won') : next
}

export function settleCommand(save: Save, encounter: string): Save {
  if (save.mission?.step !== 'results' || save.mission.id !== encounter || !save.mission.won) return save
  const missions = save.worlds.missions.includes(encounter) ? save.worlds.missions : [...save.worlds.missions, encounter]
  const battle = save.mission.battle
  const run = battle && resumeCommand(battle.input, battle.actions)
  if (!run || run.state.result !== 'won') return save
  const story = run.input.version === 2 && run.state.emitter === 0 ? setFlag(save.story, run.input.assault.disabledFlag) : save.story
  return finishMission({ ...save, story, worlds: { ...save.worlds, missions } })
}
