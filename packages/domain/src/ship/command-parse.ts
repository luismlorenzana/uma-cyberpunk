import type { CommandCast, CommandParticipant } from './command-cinema'
import { P } from '../story/parse'
import { COMMAND_ORDERS, COMMAND_STATIONS, MAX_DRILLS, replayCommand, type CommandAction, type CommandEncounter,
  type CommandInput, type CommandOrder, type CommandStation, type ShipThreat } from './command'

function threats(p: P, value: unknown, path: string): ShipThreat[] {
  const waves = p.list(value, path, (value, field): ShipThreat => {
    const wave = p.object(value, field, ['section', 'power', 'fighters'])
    if (wave.section !== 'fore' && wave.section !== 'aft') return p.fail(`${field}.section`, 'expected fore or aft')
    return { section: wave.section, power: p.int(wave.power, `${field}.power`, 1, 12), fighters: p.int(wave.fighters, `${field}.fighters`, 0, 6) }
  }, 12)
  return waves.length > 0 ? waves : p.fail(path, 'expected at least one wave')
}

const durability = (p: P, value: unknown, field: string) => p.int(value, field, 1, 99)

function parseAssault(p: P, value: unknown, path: string, authored: boolean) {
  const fields = ['emitter', 'disabledFlag']
  const a = p.object(value, path, authored ? [...fields, 'call', 'fighterTarget'] : fields, authored ? [...fields, 'call'] : fields)
  if (a.fighterTarget !== undefined && a.fighterTarget !== true) p.fail(`${path}.fighterTarget`, 'expected true')
  return { emitter: durability(p, a.emitter, `${path}.emitter`), disabledFlag: p.slug(a.disabledFlag, `${path}.disabledFlag`),
    ...(authored ? { call: p.text(a.call, `${path}.call`), ...(a.fighterTarget ? { fighterTarget: true } : {}) } : {}) }
}

export function parseCommandEncounter(p: P, value: unknown, path: string): CommandEncounter {
  const fields = ['id', 'cost', 'transport', 'enemy', 'threats', 'calls']
  const encounter = p.object(value, path, [...fields, 'assault'], fields)
  const cost = p.object(encounter.cost, `${path}.cost`, ['fuel', 'provisions'])
  const calls = p.object(encounter.calls, `${path}.calls`, COMMAND_ORDERS)
  const assault = encounter.assault === undefined ? undefined : parseAssault(p, encounter.assault, `${path}.assault`, true)
  return {
    id: p.slug(encounter.id, `${path}.id`),
    cost: { fuel: p.int(cost.fuel, `${path}.cost.fuel`, 0, 10), provisions: p.int(cost.provisions, `${path}.cost.provisions`, 0, 10) },
    transport: durability(p, encounter.transport, `${path}.transport`), enemy: durability(p, encounter.enemy, `${path}.enemy`),
    threats: threats(p, encounter.threats, `${path}.threats`),
    calls: Object.fromEntries(COMMAND_ORDERS.map((order) => [order, p.text(calls[order], `${path}.calls.${order}`)])) as Record<CommandOrder, string>,
    ...(assault ? { assault: { ...assault, call: assault.call! } } : {}),
  }
}

export function resumeCommand(value: unknown, actions: readonly unknown[]) {
  const p = new P('ship encounter')
  try {
    const fields = ['version', 'transport', 'enemy', 'reactor', 'threats', 'officers']
    const o = p.object(value, 'input', [...fields, 'assault', 'contributions', 'presentation'], fields)
    if ((o.version !== 1 && o.version !== 2 && o.version !== 3) || (o.version === 1 && o.assault !== undefined) || (o.version !== 3 && o.contributions !== undefined)) return null
    const officers = p.object(o.officers, 'officers', COMMAND_STATIONS)
    const participant = (value: unknown, field: string): CommandParticipant => {
      const row = p.object(value, field, ['speaker', 'name'])
      return { speaker: p.speaker(row.speaker, field + '.speaker'), name: p.text(row.name, field + '.name', 80) }
    }
    const presentation: CommandCast | undefined = o.presentation === undefined ? undefined : (() => {
      const row = p.object(o.presentation, 'presentation', ['crew', 'present', 'objective', 'commander'], ['crew', 'present', 'objective'])
      const crew = p.object(row.crew, 'presentation.crew', [...COMMAND_STATIONS], [])
      const present = p.list(row.present, 'presentation.present', participant, 200)
      if (new Set(present.map(x => x.speaker)).size !== present.length) p.fail('presentation.present', 'duplicate participant')
      const parsed = Object.fromEntries(Object.entries(crew).map(([station, actor]) => [station, participant(actor, 'presentation.crew.' + station)]))
      const ids = Object.values(parsed).map(x => x.speaker)
      if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'number' || !present.some(x => x.speaker === id))) p.fail('presentation.crew', 'crew must be distinct present officers')
      return { crew: parsed, present, objective: p.text(row.objective, 'presentation.objective', 80),
        ...(row.commander === undefined ? {} : { commander: participant(row.commander, 'presentation.commander') }) }
    })()
    const setup = { ...(presentation ? { presentation } : {}), transport: durability(p, o.transport, 'transport'), enemy: durability(p, o.enemy, 'enemy'),
      reactor: p.int(o.reactor, 'reactor', 1, 12), threats: threats(p, o.threats, 'threats'),
      officers: Object.fromEntries(COMMAND_STATIONS.map((station) => [station, p.int(officers[station], `officers.${station}`, 0, MAX_DRILLS)])) as Record<CommandStation, number> }
    const input: CommandInput = o.version === 1 ? { ...setup, version: 1 } : o.version === 2
      ? { ...setup, version: 2, assault: parseAssault(p, o.assault, 'assault', false) }
      : { ...setup, version: 3, assault: parseAssault(p, o.assault, 'assault', false),
        contributions: p.list(o.contributions, 'contributions', (value, path) => p.text(value, path, 160), 24) }
    const parsed = p.list(actions, 'actions', (value, field): CommandAction => {
      const fields = ['order', 'shields', 'guns', 'fighters']
      const a = p.object(value, field, [...fields, 'target'], fields)
      const order = a.order as CommandOrder
      if (!COMMAND_ORDERS.includes(order)) p.fail(`${field}.order`, 'unknown order')
      if (a.target !== undefined && (input.version === 1 || a.target !== 'emitter')) p.fail(`${field}.target`, 'invalid emitter target')
      return { order, shields: p.int(a.shields, `${field}.shields`, 0, 15), guns: p.int(a.guns, `${field}.guns`, 0, 15), fighters: p.int(a.fighters, `${field}.fighters`, 0, 15),
        ...(a.target === 'emitter' ? { target: 'emitter' } : {}) }
    }, 12)
    const state = replayCommand(input, parsed)
    return state ? { input, state } : null
  } catch { return null }
}
