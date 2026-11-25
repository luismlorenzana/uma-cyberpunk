import { parseComposition } from './composition'
import { COMMAND_ORDERS, COMMAND_STATIONS, type CommandOrder, type CommandStation } from '../ship/command'
import { COMMAND_EFFECT_KEYS, type CommandEffectKey, type CommandActorArt, type CommandCinematics } from '../ship/command-cinema'
import type { CampaignBook } from './campaign'
import { walkSteps } from './check'
import { P } from './parse'

export function parseCommandCinematics(value: unknown, book: Pick<CampaignBook, 'assets' | 'commands' | 'scenes' | 'story'>): CommandCinematics {
  const p = new P('campaign.json'), root = p.object(value, 'commandCinematics', ['stations', 'actors', 'encounters', 'effects'], ['stations', 'actors', 'encounters'])
  const assets = new Set(book.assets.map(({ id }) => id)), casting = book.story.casting
  const known = new Set([...casting.crewOrder, ...casting.leads.map(x => x.outfit), ...casting.heroines.map(x => x.board), ...casting.minor])
  const speaker = (value: unknown, path: string) => {
    const id = p.speaker(value, path)
    if (!known.has(id)) p.fail(path, 'unknown cast identity')
    return id
  }
  const asset = (value: unknown, path: string) => {
    const id = p.slug(value, path)
    if (!assets.has(id)) p.fail(path, 'unknown image')
    return id
  }
  const unique = <T>(values: T[], key: (row: T) => string, field: string) => {
    if (new Set(values.map(key)).size !== values.length) p.fail(field, 'duplicate binding')
    return values
  }
  const actors = unique(p.list(root.actors, 'commandCinematics.actors', (value, field): CommandActorArt => {
    const row = p.object(value, field, ['speaker', 'role', 'base', 'profile', 'poseSlot', 'pose', 'poseFallback', 'composition', 'orders', 'states'], ['speaker', 'role', 'base', 'poseSlot'])
    const role = row.role as CommandActorArt['role']
    if (!['crew', 'enemy', 'ally'].includes(role)) p.fail(field, 'unknown actor role')
    const actor = speaker(row.speaker, field + '.speaker')
    if (role === 'crew' && typeof actor !== 'number') p.fail(field, 'crew requires a playable officer')
    const orders = row.orders === undefined ? undefined : (() => {
      const orders = p.object(row.orders, field + '.orders', [...COMMAND_ORDERS])
      return Object.fromEntries(COMMAND_ORDERS.map(order => {
        const line = p.object(orders[order], field + '.orders.' + order, ['captain', 'acknowledgement', 'result'])
        return [order, { captain: p.text(line.captain, field, 320), acknowledgement: p.text(line.acknowledgement, field, 320), result: p.text(line.result, field, 320) }]
      })) as Record<CommandOrder, { captain: string; acknowledgement: string; result: string }>
    })()
    const states = row.states === undefined ? undefined : (() => {
      const states = p.object(row.states, field + '.states', ['victory', 'loss', 'disabled', 'damage', 'noDamage'], [])
      return Object.fromEntries(Object.entries(states).map(([key, value]) => [key, p.text(value, field + '.states.' + key, 320)]))
    })()
    return { speaker: actor, role, base: asset(row.base, field + '.base'), poseSlot: p.slug(row.poseSlot, field + '.poseSlot'),
      ...(row.profile === undefined ? {} : { profile: asset(row.profile, field + '.profile') }),
      ...(row.pose === undefined ? {} : { pose: asset(row.pose, field + '.pose') }),
      ...(row.poseFallback === undefined ? {} : { poseFallback: asset(row.poseFallback, field + '.poseFallback') }), ...(row.composition === undefined ? {} : { composition: parseComposition(p, row.composition, field + '.composition', asset) }), ...(orders ? { orders } : {}), ...(states ? { states } : {}) }
  }, 400), row => `${row.role}:${row.speaker}`, 'commandCinematics.actors')
  const scene = (value: unknown, field: string) => {
    const id = p.slug(value, field), scene = book.scenes.get(id)
    if (!scene) return p.fail(field, 'unknown scene')
    for (const { step } of walkSteps(scene.steps, '')) if (!['line', 'narrate', 'thought', 'emote', 'wait', 'choice', 'illustration', 'slot'].includes(step.kind)) {
      p.fail(field, 'ship context must have no gameplay effects, calls or battles')
    }
    return id
  }
  const encounters = unique(p.list(root.encounters, 'commandCinematics.encounters', (value, field) => {
    const row = p.object(value, field, ['encounter', 'objective', 'commander', 'preparation', 'victory', 'withdrawal', 'retry', 'disabled', 'enemy'], ['encounter', 'objective'])
    const encounter = p.slug(row.encounter, field + '.encounter')
    if (!book.commands.has(encounter)) p.fail(field, 'unknown ship encounter')
    const commander = row.commander === undefined ? undefined : speaker(row.commander, field + '.commander')
    if (commander !== undefined && !actors.some(actor => actor.speaker === commander && actor.role === 'enemy')) p.fail(field, 'commander needs exact enemy-role art')
    const enemy = row.enemy === undefined ? undefined : (() => {
      if (commander === undefined) p.fail(field, 'a named enemy call needs the actual commander')
      const lines = p.object(row.enemy, field + '.enemy', ['contact', 'disabled', 'withdrawal'])
      return { contact: p.text(lines.contact, field, 240), disabled: p.text(lines.disabled, field, 240), withdrawal: p.text(lines.withdrawal, field, 240) }
    })()
    const contexts = Object.fromEntries(['preparation', 'victory', 'withdrawal', 'retry', 'disabled'].flatMap(key => row[key] === undefined ? [] : [[key, scene(row[key], field + '.' + key)]]))
    if (row.disabled !== undefined && !book.commands.get(encounter)?.assault) p.fail(field, 'disabled context needs a real emitter')
    return { encounter, objective: p.text(row.objective, field + '.objective', 80), ...(commander === undefined ? {} : { commander }), ...(enemy ? { enemy } : {}), ...contexts }
  }, Math.max(64, book.commands.size)), row => row.encounter, 'commandCinematics.encounters')
  const stations = unique(p.list(root.stations, 'commandCinematics.stations', (value, field) => {
    const row = p.object(value, field, ['station', 'backdrop']), station = row.station as CommandStation
    if (!COMMAND_STATIONS.includes(station)) p.fail(field, 'unknown station')
    return { station, backdrop: asset(row.backdrop, field + '.backdrop') }
  }, 4), row => row.station, 'commandCinematics.stations')
  const effects = root.effects === undefined ? undefined : unique(p.list(root.effects, 'commandCinematics.effects', (value, field) => {
    const row = p.object(value, field, ['kind', 'slot', 'composition'], ['kind', 'slot']), kind = row.kind as CommandEffectKey
    if (!COMMAND_EFFECT_KEYS.includes(kind)) p.fail(field, 'unknown resolved effect')
    const composition = row.composition === undefined ? undefined : parseComposition(p, row.composition, field + '.composition', asset)
    if (composition && composition.layers.length > 2) p.fail(field, 'an effect supports at most two image layers')
    return { kind, slot: p.slug(row.slot, field + '.slot'), ...(composition ? { composition } : {}) }
  }, 9), row => row.kind, 'commandCinematics.effects')
  return { actors, encounters, stations, ...(effects ? { effects } : {}) }
}
