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

export function parseCommandEncounter(p: P, value: unknown, path: string): CommandEncounter {
  const encounter = p.object(value, path, ['id', 'cost', 'transport', 'enemy', 'threats', 'calls'])
  const cost = p.object(encounter.cost, `${path}.cost`, ['fuel', 'provisions'])
  const calls = p.object(encounter.calls, `${path}.calls`, COMMAND_ORDERS)
  return {
    id: p.slug(encounter.id, `${path}.id`),
    cost: { fuel: p.int(cost.fuel, `${path}.cost.fuel`, 0, 10), provisions: p.int(cost.provisions, `${path}.cost.provisions`, 0, 10) },
    transport: durability(p, encounter.transport, `${path}.transport`), enemy: durability(p, encounter.enemy, `${path}.enemy`),
    threats: threats(p, encounter.threats, `${path}.threats`),
    calls: Object.fromEntries(COMMAND_ORDERS.map((order) => [order, p.text(calls[order], `${path}.calls.${order}`)])) as Record<CommandOrder, string>,
  }
}

export function resumeCommand(value: unknown, actions: readonly unknown[]) {
  const p = new P('ship encounter')
  try {
    const o = p.object(value, 'input', ['version', 'transport', 'enemy', 'reactor', 'threats', 'officers'])
    if (o.version !== 1) return null
    const officers = p.object(o.officers, 'officers', COMMAND_STATIONS)
    const input: CommandInput = { version: 1, transport: durability(p, o.transport, 'transport'), enemy: durability(p, o.enemy, 'enemy'),
      reactor: p.int(o.reactor, 'reactor', 1, 12), threats: threats(p, o.threats, 'threats'),
      officers: Object.fromEntries(COMMAND_STATIONS.map((station) => [station, p.int(officers[station], `officers.${station}`, 0, MAX_DRILLS)])) as Record<CommandStation, number> }
    const parsed = p.list(actions, 'actions', (value, field): CommandAction => {
      const a = p.object(value, field, ['order', 'shields', 'guns', 'fighters'])
      const order = a.order as CommandOrder
      if (!COMMAND_ORDERS.includes(order)) p.fail(`${field}.order`, 'unknown order')
      return { order, shields: p.int(a.shields, `${field}.shields`, 0, 15), guns: p.int(a.guns, `${field}.guns`, 0, 15), fighters: p.int(a.fighters, `${field}.fighters`, 0, 15) }
    }, 12)
    const state = replayCommand(input, parsed)
    return state ? { input, state } : null
  } catch { return null }
}
