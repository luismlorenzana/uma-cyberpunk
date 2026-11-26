import { P } from './parse'
import type { Scene } from './types'

export interface StationObservance {
  id: string
  label: string
  month: number
  day: number
  scene: string
  earliestYear: number
  makeupDays: number
  port?: string
  actor?: number
  flag?: string
}

export interface StationStory {
  transition: ReadonlyMap<string, string>
  observances: readonly StationObservance[]
  opening?: { actor: number; port: string }
  pilotShip?: string
  commandWatches?: ReadonlyMap<string, number>
}

export function parseStationStory(raw: unknown, scenes: ReadonlyMap<string, Scene>, ports: ReadonlySet<string>,
  commands: ReadonlySet<string>, ships: ReadonlySet<string>): StationStory {
  const p = new P('campaign.json station')
  const data = p.object(raw, 'station', ['transition', 'observances', 'opening', 'pilotShip', 'commandWatches'], ['transition', 'observances'])
  const transition = new Map<string, string>()
  const known = (value: unknown, path: string) => {
    const id = p.slug(value, path)
    if (!scenes.has(id)) return p.fail(path, 'missing scene')
    return id
  }
  const port = (value: unknown, path: string) => {
    const id = p.slug(value, path)
    if (!ports.has(id)) return p.fail(path, 'missing port')
    return id
  }
  const rows = p.list(data.transition, 'transition', (raw, path) => {
    const row = p.object(raw, path, ['key', 'scene'])
    return { key: p.slug(row.key, path + '.key'), scene: known(row.scene, path + '.scene') }
  }, 40)
  for (const row of rows) {
    if (transition.has(row.key)) p.fail('transition', 'duplicate transition')
    transition.set(row.key, row.scene)
  }
  const observances = p.list(data.observances, 'observances', (raw, path) => {
    const row = p.object(raw, path, ['id', 'label', 'month', 'day', 'scene', 'earliestYear', 'makeupDays', 'port', 'actor', 'flag'],
      ['id', 'label', 'month', 'day', 'scene', 'earliestYear', 'makeupDays'])
    return { id: p.slug(row.id, path + '.id'), label: p.text(row.label, path + '.label', 60), scene: known(row.scene, path + '.scene'),
      month: p.int(row.month, path + '.month', 0, 3), day: p.int(row.day, path + '.day', 1, 30),
      earliestYear: p.int(row.earliestYear, path + '.earliestYear', 1, 999),
      makeupDays: p.int(row.makeupDays, path + '.makeupDays', 0, 119),
      ...(row.port === undefined ? {} : { port: port(row.port, path + '.port') }),
      ...(row.actor === undefined ? {} : { actor: p.int(row.actor, path + '.actor', 1, 99999999) }),
      ...(row.flag === undefined ? {} : { flag: p.slug(row.flag, path + '.flag') }) }
  }, 24)
  if (new Set(observances.map(row => row.id)).size !== observances.length) p.fail('observances', 'duplicate event')
  const start = data.opening === undefined ? undefined : p.object(data.opening, 'opening', ['actor', 'port'])
  const pilotShip = data.pilotShip === undefined ? undefined : p.slug(data.pilotShip, 'pilotShip')
  if (pilotShip && !ships.has(pilotShip)) p.fail('pilotShip', 'missing expedition cutter')
  const commandWatches = new Map<string, number>()
  if (data.commandWatches !== undefined) for (const row of p.list(data.commandWatches, 'commandWatches', (raw, path) => {
    const value = p.object(raw, path, ['id', 'watches'])
    return { id: p.slug(value.id, path + '.id'), watches: p.int(value.watches, path + '.watches', 0, 12) }
  }, 256)) {
    if (!commands.has(row.id) || commandWatches.has(row.id)) p.fail('commandWatches', 'unknown or duplicate operation ' + row.id)
    commandWatches.set(row.id, row.watches)
  }
  return { transition, observances, ...(pilotShip ? { pilotShip } : {}), ...(commandWatches.size ? { commandWatches } : {}),
    ...(start ? { opening: { actor: p.int(start.actor, 'opening.actor', 1, 99999999), port: port(start.port, 'opening.port') } } : {}) }
}
