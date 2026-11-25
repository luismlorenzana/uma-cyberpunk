// The story's strict parser (CY9, uma-quest's way): every shape checked, unknown keys refused, and every error names its
// file and path, as `chapters/w1-ch1.json: scenes[0].steps[3].slot.lines["1002"]: expected text of 160 characters at most`.
import type { Role } from '@cyber/battle'
import type { BondFile, Call, CaptainOption, CastMember, Casting, Chapter, ChoiceOption, EnemySlot, Layer, Location, LogFile, Mission, Scene, Step, StoryPack, Tone, Trigger, World } from './types'
import { LAYERS, MISSION_OBJECTIVES, TONES } from './types'
import { DECOR_STYLES, GIFT_KINDS, TOPICS, type GiftKind, type Style, type Topic } from '../cabins/items'
import { LOOKS, type Look } from '../looks'
import type { ReadinessNeed } from '../crew/squads'
import { MODULE_POSTS, POST_KINDS, type PostKind } from '../ship/duties'
import type { ModuleId } from '../ship/modules'
import type { EventChoice, Reward, ShipEvent } from '../ship/watch'
import { ITEMS_BY_ID } from '../cabins/items'

/** A finale's readiness need (CY18): a system built, a faction's standing at a level, or the readiness total; with the
 * harsh condition an unmet need adds. */
function readinessNeed(p: P, v: unknown, path: string): ReadinessNeed {
  const o = p.object(v, path, ['system', 'standing', 'at', 'total', 'else'], ['else'])
  const cond = o.else as string
  if (!['fog', 'hazards', 'no-reinforcements'].includes(cond)) p.fail(`${path}.else`, 'expected fog, hazards or no-reinforcements')
  const c = cond as ReadinessNeed['else']
  if (o.system !== undefined) return { system: p.slug(o.system, `${path}.system`), else: c }
  if (o.standing !== undefined) return { standing: p.slug(o.standing, `${path}.standing`), at: p.int(o.at, `${path}.at`, -2, 2), else: c }
  if (o.total !== undefined) return { total: p.int(o.total, `${path}.total`, 0, 999), else: c }
  return p.fail(path, 'expected a system, a standing or a total')
}

/** A scene's `look` (D24): one of the five, or nothing. */
function look(p: P, v: unknown, path: string): { look?: Look } {
  if (v === undefined) return {}
  if (!LOOKS.includes(v as Look)) p.fail(path, `expected one of ${LOOKS.join(', ')}`)
  return { look: v as Look }
}

export class StoryParseError extends Error {
  readonly file: string
  readonly path: string
  constructor(file: string, path: string, message: string) {
    super(`${file}: ${path}: ${message}`)
    this.name = 'StoryParseError'
    this.file = file
    this.path = path
  }
}

/** A key in `needs`: a chapter, a mission or a File the story names, or (CY15) a ship capability, `ship:storm`. */
const NEEDS_KEY = /^((chapter|mission|file|ship):[a-z0-9][a-z0-9-]{0,63}|standing:[a-z0-9][a-z0-9-]{0,63}:-?[0-2])$/
/** A list of keys in `needs`: chapter:, mission:, file:, ship: and a slug, or standing:<faction>:<−2..2> (CY18). */
function needsKeys(p: P, v: unknown, path: string, max = 6): string[] {
  return p.list(v, path, (x, xp) => {
    if (typeof x !== 'string' || !NEEDS_KEY.test(x)) p.fail(xp, 'expected chapter:, mission:, file: or ship: and a slug, or standing:<faction>:<level>')
    return x as string
  }, max)
}

/** A line's longest text (TC36's short beats). */
export const LINE_MAX = 160
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
type Obj = Record<string, unknown>

export class P {
  constructor(readonly file: string) {}
  fail(path: string, message: string): never { throw new StoryParseError(this.file, path, message) }
  object(v: unknown, path: string, keys: readonly string[], required: readonly string[] = keys): Obj {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) this.fail(path, 'expected an object')
    const o = v as Obj
    const extra = Object.keys(o).filter((k) => !keys.includes(k))
    if (extra.length) this.fail(path, `unknown keys ${extra.join(', ')}`)
    for (const k of required) if (!(k in o)) this.fail(`${path}.${k}`, 'is missing')
    return o
  }
  list<T>(v: unknown, path: string, each: (x: unknown, p: string) => T, max = 500): T[] {
    if (!Array.isArray(v) || v.length > max) this.fail(path, `expected a list of up to ${max}`)
    return v.map((x, i) => each(x, `${path}[${i}]`))
  }
  slug(v: unknown, path: string): string { if (typeof v !== 'string' || !SLUG.test(v)) this.fail(path, 'expected a lowercase slug'); return v }
  outfit(v: unknown, path: string): number { if (!Number.isSafeInteger(v) || (v as number) < 1) this.fail(path, 'expected an outfit id'); return v as number }
  int(v: unknown, path: string, min: number, max: number): number { if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) this.fail(path, `expected a whole number ${min}–${max}`); return v as number }
  text(v: unknown, path: string, max = LINE_MAX): string { if (typeof v !== 'string' || v.trim().length === 0 || v.length > max) this.fail(path, `expected text of ${max} characters at most`); return v }
  speaker(v: unknown, path: string): number | string {
    if (typeof v === 'number') return this.outfit(v, path)
    if (typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v)) return v
    return this.fail(path, 'expected an outfit id, a board id or a slug')
  }
  layer(v: unknown, path: string): Layer | undefined {
    if (v === undefined) return undefined
    if (!LAYERS.includes(v as Layer)) this.fail(path, `expected one of ${LAYERS.join(', ')}`)
    return v as Layer
  }
  version(o: Obj) { if (o.schemaVersion !== 1) this.fail('schemaVersion', 'expected 1') }

  step(v: unknown, path: string): Step {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) this.fail(path, 'expected a step')
    const keys = Object.keys(v as Obj)
    if (keys.length !== 1) this.fail(path, 'expected one step kind')
    const kind = keys[0]!
    const x = (v as Obj)[kind]
    const p = `${path}.${kind}`
    switch (kind) {
      case 'line': case 'thought': { const o = this.object(x, p, ['speaker', 'text']); return { kind, speaker: this.speaker(o.speaker, `${p}.speaker`), text: this.text(o.text, `${p}.text`) } }
      case 'slot': {
        const o = this.object(x, p, ['lines', 'fallback'])
        const lines = this.object(o.lines, `${p}.lines`, Object.keys((o.lines ?? {}) as Obj), [])
        const out: Record<string, string> = {}
        for (const [k, t] of Object.entries(lines)) {
          if (!/^[1-9][0-9]*$/.test(k)) this.fail(`${p}.lines["${k}"]`, 'expected an outfit id as the key')
          out[k] = this.text(t, `${p}.lines["${k}"]`)
        }
        return { kind, lines: out, fallback: this.text(o.fallback, `${p}.fallback`) }
      }
      case 'narrate': return { kind, text: this.text(x, p, 240) }
      case 'emote': { const o = this.object(x, p, ['actor', 'emote']); return { kind, actor: this.speaker(o.actor, `${p}.actor`), emote: this.slug(o.emote, `${p}.emote`) } }
      case 'illustration': return { kind, asset: x === null ? null : this.slug(x, p) }
      case 'wait': return { kind, ms: this.int(x, p, 0, 10_000) }
      case 'choice': return { kind, options: this.list(x, p, (c, cp) => this.option(c, cp), 4) }
      case 'flag': {
        if (typeof x === 'string') return { kind, flag: this.slug(x, p), set: true }
        const o = this.object(x, p, ['flag', 'set'])
        if (typeof o.set !== 'boolean') this.fail(`${p}.set`, 'expected true or false')
        return { kind, flag: this.slug(o.flag, `${p}.flag`), set: o.set }
      }
      case 'lead': return { kind, lead: this.slug(x, p) }
      case 'file': { const o = this.object(x, p, ['file', 'line']); return { kind, file: this.slug(o.file, `${p}.file`), line: this.int(o.line, `${p}.line`, 0, 99) } }
      case 'anomaly': {
        const o = this.object(x, p, ['anomaly', 'open'])
        if (typeof o.open !== 'boolean') this.fail(`${p}.open`, 'expected true or false')
        return { kind, anomaly: this.slug(o.anomaly, `${p}.anomaly`), open: o.open }
      }
      case 'join': case 'aboard': return { kind, outfit: this.outfit(x, p) }
      case 'call': return { kind, call: this.slug(x, p) }
      case 'refit': if (x !== true) this.fail(p, 'expected true'); return { kind }
      case 'standing': { const o = this.object(x, p, ['faction', 'by']); return { kind, faction: this.slug(o.faction, `${p}.faction`), by: this.int(o.by, `${p}.by`, -4, 4) } }
      case 'battle': return { kind, mission: this.slug(x, p) }
      case 'captain': {
        const options = this.list(x, p, (c, cp) => this.captainOption(c, cp), 3)
        if (options.length < 2) this.fail(p, 'expected two or three options')
        return { kind, options }
      }
      case 'path': { const o = this.object(x, p, ['trust', 'heart']); return { kind, trust: this.steps(o.trust, `${p}.trust`), heart: this.steps(o.heart, `${p}.heart`) } }
      default: return this.fail(path, `unknown step kind ${kind}`)
    }
  }
  option(v: unknown, path: string): ChoiceOption {
    const o = this.object(v, path, ['text', 'lead', 'then'], ['text'])
    return { text: this.text(o.text, `${path}.text`, 60), ...(o.lead !== undefined ? { lead: this.slug(o.lead, `${path}.lead`) } : {}), then: o.then === undefined ? [] : this.steps(o.then, `${path}.then`) }
  }
  captainOption(v: unknown, path: string): CaptainOption {
    const o = this.object(v, path, ['tone', 'text', 'rapport', 'then'], ['tone', 'text'])
    if (!TONES.includes(o.tone as Tone)) this.fail(`${path}.tone`, `expected one of ${TONES.join(', ')}`)
    return { tone: o.tone as Tone, text: this.text(o.text, `${path}.text`, 80), rapport: o.rapport === undefined ? 0 : this.int(o.rapport, `${path}.rapport`, 0, 30), then: o.then === undefined ? [] : this.steps(o.then, `${path}.then`) }
  }
  steps(v: unknown, path: string): Step[] { return this.list(v, path, (s, p) => this.step(s, p), 400) }
}

function trigger(p: P, v: unknown, path: string): Trigger {
  const o = p.object(v, path, ['arrive', 'after', 'talk'], [])
  const keys = Object.keys(o)
  if (keys.length !== 1) p.fail(path, 'expected one of arrive, after or talk')
  const k = keys[0] as 'arrive' | 'after' | 'talk'
  return { [k]: p.slug(o[k], `${path}.${k}`) } as Trigger
}

function cast(p: P, v: unknown, path: string): CastMember {
  const o = p.object(v, path, ['outfit', 'heroine', 'minor'], [])
  if (Object.keys(o).length !== 1) p.fail(path, 'expected one of outfit, heroine or minor')
  if (o.outfit !== undefined) return { outfit: p.outfit(o.outfit, `${path}.outfit`) }
  if (o.heroine !== undefined) return { heroine: p.slug(o.heroine, `${path}.heroine`) }
  return { minor: p.slug(o.minor, `${path}.minor`) }
}

function scene(p: P, v: unknown, path: string): Scene {
  const o = p.object(v, path, ['id', 'place', 'trigger', 'cast', 'steps', 'look'], ['id', 'place', 'trigger', 'cast', 'steps'])
  return { id: p.slug(o.id, `${path}.id`), place: p.slug(o.place, `${path}.place`), trigger: trigger(p, o.trigger, `${path}.trigger`), cast: p.list(o.cast, `${path}.cast`, (c, cp) => cast(p, c, cp), 12), steps: p.steps(o.steps, `${path}.steps`), ...look(p, o.look, `${path}.look`) }
}

function enemy(p: P, v: unknown, path: string): EnemySlot {
  const o = p.object(v, path, ['slot', 'pool', 'job', 'count', 'faction'], ['slot'])
  if (o.slot === 'boss') return { slot: 'boss', pool: p.list(o.pool, `${path}.pool`, (x, xp) => p.slug(x, xp), 12) }
  if (o.slot === 'regular') return { slot: 'regular', job: p.slug(o.job, `${path}.job`), count: p.int(o.count, `${path}.count`, 1, 8), faction: p.slug(o.faction, `${path}.faction`) }
  return p.fail(`${path}.slot`, 'expected boss or regular')
}

function mission(p: P, v: unknown, path: string): Mission {
  const o = p.object(v, path, ['id', 'place', 'objective', 'brief', 'enemies', 'fixedSquad', 'side', 'scenario', 'finale', 'readiness'], ['id', 'place', 'objective', 'brief', 'enemies'])
  const obj = p.object(o.objective, `${path}.objective`, ['kind'])
  if (!MISSION_OBJECTIVES.includes(obj.kind as never)) p.fail(`${path}.objective.kind`, `expected one of ${MISSION_OBJECTIVES.join(', ')}`)
  return {
    id: p.slug(o.id, `${path}.id`), place: p.slug(o.place, `${path}.place`), objective: { kind: obj.kind as Mission['objective']['kind'] },
    brief: p.text(o.brief, `${path}.brief`, 600), enemies: p.list(o.enemies, `${path}.enemies`, (e, ep) => enemy(p, e, ep), 12),
    fixedSquad: o.fixedSquad === undefined || o.fixedSquad === null ? null : p.list(o.fixedSquad, `${path}.fixedSquad`, (x, xp) => p.outfit(x, xp), 5),
    side: o.side === undefined ? [] : p.list(o.side, `${path}.side`, (x, xp) => { const s = p.object(x, xp, ['kind', 'gives']); return { kind: p.slug(s.kind, `${xp}.kind`), gives: p.slug(s.gives, `${xp}.gives`) } }, 6),
    ...(o.scenario !== undefined ? { scenario: p.slug(o.scenario, `${path}.scenario`) } : {}),
    ...(o.finale === true ? { finale: true } : {}),
    ...(o.readiness !== undefined ? { readiness: p.list(o.readiness, `${path}.readiness`, (r, rp) => readinessNeed(p, r, rp), 4) } : {}),
  }
}

export function parseChapter(value: unknown, file = 'chapter'): Chapter {
  const p = new P(file)
  const o = p.object(value, 'chapter', ['schemaVersion', 'id', 'world', 'leads', 'number', 'danger', 'needs', 'scenes', 'missions', 'debrief', 'layer'], ['schemaVersion', 'id', 'world', 'leads', 'number', 'danger', 'scenes'])
  p.version(o)
  const debrief = o.debrief === undefined ? { steps: [] } : (() => { const d = p.object(o.debrief, 'debrief', ['steps']); return { steps: p.steps(d.steps, 'debrief.steps') } })()
  const chapter: Chapter = {
    schemaVersion: 1, id: p.slug(o.id, 'id'), world: p.slug(o.world, 'world'), leads: p.list(o.leads, 'leads', (x, xp) => p.outfit(x, xp), 2),
    number: p.int(o.number, 'number', 1, 99), danger: p.int(o.danger, 'danger', 1, 99), needs: o.needs === undefined ? [] : needsKeys(p, o.needs, 'needs', 12),
    scenes: p.list(o.scenes, 'scenes', (s, sp) => scene(p, s, sp), 40), missions: o.missions === undefined ? [] : p.list(o.missions, 'missions', (m, mp) => mission(p, m, mp), 12),
    debrief,
  }
  if (chapter.leads.length === 0) p.fail('leads', 'expected one lead, or two for crossed paths')
  const layer = p.layer(o.layer, 'layer')
  if (layer) chapter.layer = layer
  return chapter
}

export function parseWorld(value: unknown, file = 'world'): World {
  const p = new P(file)
  const o = p.object(value, 'world', ['schemaVersion', 'id', 'look', 'mood', 'locations', 'factions', 'layer', 'x', 'y', 'region', 'operations'], ['schemaVersion', 'id', 'locations', 'factions'])
  p.version(o)
  const locations = p.list(o.locations, 'locations', (l, lp): Location => {
    const x = p.object(l, lp, ['id', 'danger', 'needs', 'links', 'x', 'y'], ['id', 'danger'])
    return {
      id: p.slug(x.id, `${lp}.id`), danger: p.int(x.danger, `${lp}.danger`, 1, 99), needs: x.needs === undefined ? [] : needsKeys(p, x.needs, `${lp}.needs`), links: x.links === undefined ? [] : p.list(x.links, `${lp}.links`, (n, np) => p.slug(n, np), 8),
      ...(x.x !== undefined ? { x: p.int(x.x, `${lp}.x`, 0, 100) } : {}), ...(x.y !== undefined ? { y: p.int(x.y, `${lp}.y`, 0, 100) } : {}),
    }
  }, 40)
  const world: World = { schemaVersion: 1, id: p.slug(o.id, 'id'), locations, factions: p.list(o.factions, 'factions', (f, fp) => p.slug(f, fp), 4) }
  if (o.look !== undefined) world.look = p.text(o.look, 'look', 400)
  if (o.mood !== undefined) world.mood = p.text(o.mood, 'mood', 400)
  if (o.x !== undefined) world.x = p.int(o.x, 'x', 0, 100)
  if (o.y !== undefined) world.y = p.int(o.y, 'y', 0, 100)
  const layer = p.layer(o.layer, 'layer')
  if (layer) world.layer = layer
  if (o.region !== undefined) world.region = p.slug(o.region, 'region')
  if (o.operations !== undefined) world.operations = p.list(o.operations, 'operations', (q, qp) => {
    const x = p.object(q, qp, ['id', 'title', 'faction', 'danger', 'watches', 'reward', 'needs'], ['id', 'title', 'danger', 'watches', 'reward'])
    const r = p.object(x.reward, `${qp}.reward`, ['credits', 'alloy', 'data', 'standing'])
    return {
      id: p.slug(x.id, `${qp}.id`), title: p.text(x.title, `${qp}.title`, 60), ...(x.faction !== undefined ? { faction: p.slug(x.faction, `${qp}.faction`) } : {}),
      danger: p.int(x.danger, `${qp}.danger`, 1, 9), watches: p.int(x.watches, `${qp}.watches`, 1, 3),
      reward: { credits: p.int(r.credits, `${qp}.reward.credits`, 0, 2000), alloy: p.int(r.alloy, `${qp}.reward.alloy`, 0, 500), data: p.int(r.data, `${qp}.reward.data`, 0, 500), standing: p.int(r.standing, `${qp}.reward.standing`, -1, 1) },
      ...(x.needs !== undefined ? { needs: needsKeys(p, x.needs, `${qp}.needs`) } : {}),
    }
  }, 6)
  return world
}

export function parseCasting(value: unknown, file = 'casting.json'): Casting {
  const p = new P(file)
  const o = p.object(value, 'casting', ['schemaVersion', 'leads', 'crewOrder', 'roles', 'bondGates', 'tastes', 'chiefs', 'squads', 'standing', 'heroines', 'minor', 'labels', 'layer'], ['schemaVersion', 'leads'])
  p.version(o)
  const casting: Casting = {
    schemaVersion: 1,
    leads: p.list(o.leads, 'leads', (l, lp) => {
      const x = p.object(l, lp, ['outfit', 'world', 'opens', 'talent'], ['outfit', 'world'])
      return { outfit: p.outfit(x.outfit, `${lp}.outfit`), world: p.slug(x.world, `${lp}.world`), ...(x.opens !== undefined ? { opens: p.slug(x.opens, `${lp}.opens`) } : {}), ...(x.talent !== undefined ? { talent: p.slug(x.talent, `${lp}.talent`) } : {}) }
    }, 60),
    crewOrder: o.crewOrder === undefined ? [] : p.list(o.crewOrder, 'crewOrder', (x, xp) => p.outfit(x, xp), 60),
    heroines: o.heroines === undefined ? [] : p.list(o.heroines, 'heroines', (h, hp) => {
      const x = p.object(h, hp, ['board', 'faction', 'hold'])
      if (!['anchor', 'collar', 'none'].includes(x.hold as string)) p.fail(`${hp}.hold`, 'expected anchor, collar or none')
      return { board: p.slug(x.board, `${hp}.board`), faction: p.slug(x.faction, `${hp}.faction`), hold: x.hold as 'anchor' | 'collar' | 'none' }
    }, 256),
    minor: o.minor === undefined ? [] : p.list(o.minor, 'minor', (x, xp) => p.slug(x, xp), 200),
  }
  if (o.bondGates !== undefined) {
    const gates = p.object(o.bondGates, 'bondGates', ['4', '6', '8', '10'], [])
    casting.bondGates = Object.fromEntries(Object.entries(gates).map(([rank, key]) => {
      if (typeof key !== 'string' || !/^(chapter|mission|file):[a-z0-9][a-z0-9-]{0,63}$/.test(key)) p.fail(`bondGates["${rank}"]`, 'expected a key: chapter:…, mission:… or file:…')
      return [rank, key as string]
    }))
  }
  if (o.roles !== undefined) {
    const roles = p.object(o.roles, 'roles', Object.keys((o.roles ?? {}) as Obj), [])
    const ROLE_IDS = ['vanguard', 'striker', 'gunner', 'netrunner', 'medic']
    casting.roles = Object.fromEntries(Object.entries(roles).map(([k, v]) => {
      p.outfit(Number(k), `roles["${k}"]`)
      if (!ROLE_IDS.includes(v as string)) p.fail(`roles["${k}"]`, `expected one of ${ROLE_IDS.join(', ')}`)
      return [k, v as Role]
    }))
  }
  if (o.tastes !== undefined) {
    const tastes = p.object(o.tastes, 'tastes', Object.keys((o.tastes ?? {}) as Obj), [])
    casting.tastes = Object.fromEntries(Object.entries(tastes).map(([k, v]) => {
      p.outfit(Number(k), `tastes["${k}"]`)
      const tp = `tastes["${k}"]`
      const x = p.object(v, tp, ['favourite', 'disliked', 'gift', 'topics'])
      if (!DECOR_STYLES.includes(x.favourite as Style)) p.fail(`${tp}.favourite`, `expected one of ${DECOR_STYLES.join(', ')}`)
      if (!DECOR_STYLES.includes(x.disliked as Style) || x.disliked === x.favourite) p.fail(`${tp}.disliked`, 'expected a style other than her favourite')
      if (!GIFT_KINDS.includes(x.gift as GiftKind)) p.fail(`${tp}.gift`, `expected one of ${GIFT_KINDS.join(', ')}`)
      const topics = x.topics as unknown[]
      if (!Array.isArray(topics) || topics.length !== 2 || topics[0] === topics[1] || !topics.every((t) => TOPICS.includes(t as Topic))) p.fail(`${tp}.topics`, `expected two different topics of ${TOPICS.join(', ')}`)
      return [k, { favourite: x.favourite as Style, disliked: x.disliked as Style, gift: x.gift as GiftKind, topics: [topics[0] as Topic, topics[1] as Topic] as [Topic, Topic] }]
    }))
  }
  if (o.chiefs !== undefined) {
    const chiefs = p.object(o.chiefs, 'chiefs', Object.keys((o.chiefs ?? {}) as Obj), [])
    casting.chiefs = Object.fromEntries(Object.entries(chiefs).map(([k, v]) => {
      p.outfit(Number(k), `chiefs["${k}"]`)
      if (typeof v !== 'string' || !MODULE_POSTS[v as ModuleId]) p.fail(`chiefs["${k}"]`, 'expected a module with posts')
      return [k, v as ModuleId]
    }))
  }
  if (o.squads !== undefined) {
    casting.squads = p.list(o.squads, 'squads', (q, qp) => {
      const x = p.object(q, qp, ['id', 'name', 'banner', 'leader', 'members'])
      const members = p.list(x.members, `${qp}.members`, (m, mp) => p.outfit(m, mp), 4)
      const leader = p.outfit(x.leader, `${qp}.leader`)
      if (!members.includes(leader)) p.fail(`${qp}.leader`, 'expected one of the members')
      return { id: p.slug(x.id, `${qp}.id`), name: p.text(x.name, `${qp}.name`, 24), banner: p.slug(x.banner, `${qp}.banner`), leader, members }
    }, 4)
  }
  if (o.standing !== undefined) {
    const st = p.object(o.standing, 'standing', Object.keys((o.standing ?? {}) as Obj), [])
    casting.standing = Object.fromEntries(Object.entries(st).map(([f, v]) => [p.slug(f, `standing["${f}"]`), p.int(v, `standing["${f}"]`, -2, 2)]))
  }
  if (o.labels !== undefined) {
    const labels = p.object(o.labels, 'labels', Object.keys((o.labels ?? {}) as Obj), [])
    casting.labels = Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, p.text(v, `labels["${k}"]`, 40)]))
  }
  const layer = p.layer(o.layer, 'layer')
  if (layer) casting.layer = layer
  return casting
}

export function parseLogFile(value: unknown, file = 'log'): LogFile {
  const p = new P(file)
  const o = p.object(value, 'file', ['schemaVersion', 'id', 'world', 'lines', 'layer'], ['schemaVersion', 'id', 'lines'])
  p.version(o)
  const f: LogFile = { schemaVersion: 1, id: p.slug(o.id, 'id'), lines: p.list(o.lines, 'lines', (l, lp) => {
    const x = p.object(l, lp, ['text', 'redacted'])
    if (typeof x.redacted !== 'boolean') p.fail(`${lp}.redacted`, 'expected true or false')
    return { text: p.text(x.text, `${lp}.text`, 240), redacted: x.redacted as boolean }
  }, 100) }
  if (o.world !== undefined) f.world = p.slug(o.world, 'world')
  const layer = p.layer(o.layer, 'layer')
  if (layer) f.layer = layer
  return f
}

export function parseCall(value: unknown, file = 'call'): Call {
  const p = new P(file)
  const o = p.object(value, 'call', ['schemaVersion', 'id', 'question', 'voters', 'branches', 'layer'], ['schemaVersion', 'id', 'question', 'voters', 'branches'])
  p.version(o)
  const c: Call = {
    schemaVersion: 1, id: p.slug(o.id, 'id'), question: p.text(o.question, 'question'),
    voters: p.list(o.voters, 'voters', (v, vp) => { const x = p.object(v, vp, ['outfit', 'argument']); return { outfit: p.outfit(x.outfit, `${vp}.outfit`), argument: p.text(x.argument, `${vp}.argument`) } }, 12),
    branches: p.list(o.branches, 'branches', (b, bp) => { const x = p.object(b, bp, ['id', 'text', 'then'], ['id', 'text']); return { id: p.slug(x.id, `${bp}.id`), text: p.text(x.text, `${bp}.text`, 60), then: x.then === undefined ? [] : p.steps(x.then, `${bp}.then`) } }, 4),
  }
  const layer = p.layer(o.layer, 'layer')
  if (layer) c.layer = layer
  return c
}

/** A bond file (CY13): her scenes at ranks 2, 4, 6, 8 and 10, and her epilogue card. */
export function parseBondFile(value: unknown, file = 'bond'): BondFile {
  const p = new P(file)
  const o = p.object(value, 'bond', ['schemaVersion', 'outfit', 'scenes', 'epilogue', 'talk', 'layer'], ['schemaVersion', 'outfit', 'scenes'])
  p.version(o)
  const b: BondFile = {
    schemaVersion: 1, outfit: p.outfit(o.outfit, 'outfit'),
    scenes: p.list(o.scenes, 'scenes', (s, sp) => {
      const x = p.object(s, sp, ['rank', 'place', 'steps', 'look'], ['rank', 'place', 'steps'])
      const rank = p.int(x.rank, `${sp}.rank`, 2, 10)
      if (rank % 2 !== 0) p.fail(`${sp}.rank`, 'expected 2, 4, 6, 8 or 10')
      return { rank, place: p.slug(x.place, `${sp}.place`), steps: p.steps(x.steps, `${sp}.steps`), ...look(p, x.look, `${sp}.look`) }
    }, 5),
  }
  if (o.epilogue !== undefined) b.epilogue = p.text(o.epilogue, 'epilogue', 400)
  if (o.talk !== undefined) {
    const talk = p.object(o.talk, 'talk', TOPICS, [])
    b.talk = Object.fromEntries(Object.entries(talk).map(([t, lines]) => [t, p.list(lines, `talk.${t}`, (l, lp) => p.text(l, lp, 160), 4)]))
  }
  const layer = p.layer(o.layer, 'layer')
  if (layer) b.layer = layer
  return b
}

/** A region's jump events (CY16): `events/<region>.json`, each a title, a line and two or three choices, a choice maybe
 * checked by the holder of a post's band, paying a reward (credits, Alloy and Data may be negative), an item or rapport. */
export function parseEvents(value: unknown, file = 'events'): { region: string; events: ShipEvent[] } {
  const p = new P(file)
  const o = p.object(value, 'events', ['schemaVersion', 'region', 'events'])
  p.version(o)
  const reward = (v: unknown, path: string): Reward => {
    const x = p.object(v, path, ['credits', 'alloy', 'data', 'item', 'rapport', 'lead'], [])
    const out: Reward = {}
    for (const k of ['credits', 'alloy', 'data'] as const) if (x[k] !== undefined) out[k] = p.int(x[k], `${path}.${k}`, -500, 500)
    if (x.rapport !== undefined) out.rapport = p.int(x.rapport, `${path}.rapport`, 0, 40)
    if (x.item !== undefined) { if (typeof x.item !== 'string' || !ITEMS_BY_ID.has(x.item)) p.fail(`${path}.item`, 'expected an item id'); out.item = x.item as string }
    if (x.lead !== undefined) out.lead = p.slug(x.lead, `${path}.lead`)
    return out
  }
  const events = p.list(o.events, 'events', (e, ep): ShipEvent => {
    const x = p.object(e, ep, ['id', 'title', 'text', 'choices'])
    return {
      id: p.slug(x.id, `${ep}.id`), title: p.text(x.title, `${ep}.title`, 60), text: p.text(x.text, `${ep}.text`, 240),
      choices: p.list(x.choices, `${ep}.choices`, (c, cp): EventChoice => {
        const y = p.object(c, cp, ['text', 'check', 'pass', 'fail', 'passText', 'failText'], ['text', 'pass', 'passText'])
        const choice: EventChoice = { text: p.text(y.text, `${cp}.text`, 80), pass: reward(y.pass, `${cp}.pass`), passText: p.text(y.passText, `${cp}.passText`, 200) }
        if (y.check !== undefined) {
          const ch = p.object(y.check, `${cp}.check`, ['post', 'band', 'at'])
          if (!POST_KINDS.includes(ch.post as PostKind)) p.fail(`${cp}.check.post`, `expected a post: ${POST_KINDS.join(', ')}`)
          if (!['speed', 'stamina', 'power', 'guts', 'wit'].includes(ch.band as string)) p.fail(`${cp}.check.band`, 'expected a band')
          choice.check = { post: ch.post as PostKind, band: ch.band as EventChoice['check'] extends infer C ? C extends { band: infer B } ? B : never : never, at: p.int(ch.at, `${cp}.check.at`, 1, 5) }
          if (y.fail !== undefined) choice.fail = reward(y.fail, `${cp}.fail`)
          if (y.failText !== undefined) choice.failText = p.text(y.failText, `${cp}.failText`, 200)
        }
        return choice
      }, 3),
    }
  }, 40)
  return { region: p.slug(o.region, 'region'), events }
}

/** The pack from its files, by path relative to content/stories/ (`casting.json`, `worlds/…`, `chapters/…`, `log/…`,
 * `calls/…`); other files are left alone. Parse errors are collected, not thrown, so the check can list them all. */
export function parsePack(files: Record<string, unknown>): { pack: StoryPack | null; errors: StoryParseError[] } {
  const errors: StoryParseError[] = []
  const pack: StoryPack = { casting: { schemaVersion: 1, leads: [], crewOrder: [], heroines: [], minor: [] }, worlds: {}, chapters: {}, files: {}, calls: {}, bonds: {}, events: {} }
  let casting = false
  const id = (path: string) => path.split('/').pop()!.replace(/\.json$/, '')
  for (const [path, value] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      if (path === 'casting.json') { pack.casting = parseCasting(value, path); casting = true }
      else if (/^worlds\/[^/]+\.json$/.test(path)) { const w = parseWorld(value, path); if (w.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.worlds[w.id] = w }
      else if (/^chapters\/[^/]+\.json$/.test(path)) { const c = parseChapter(value, path); if (c.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.chapters[c.id] = c }
      else if (/^log\/[^/]+\.json$/.test(path)) { const f = parseLogFile(value, path); if (f.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.files[f.id] = f }
      else if (/^calls\/[^/]+\.json$/.test(path)) { const c = parseCall(value, path); if (c.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.calls[c.id] = c }
      else if (/^events\/[^/]+\.json$/.test(path)) { const e = parseEvents(value, path); if (e.region !== id(path)) throw new StoryParseError(path, 'region', `expected ${id(path)}, the file's name`); pack.events[e.region] = e.events }
      else if (/^bonds\/[^/]+\.json$/.test(path)) { const b = parseBondFile(value, path); if (String(b.outfit) !== id(path)) throw new StoryParseError(path, 'outfit', `expected ${id(path)}, the file's name`); pack.bonds[String(b.outfit)] = b }
    } catch (e) {
      if (e instanceof StoryParseError) errors.push(e)
      else throw e
    }
  }
  if (!casting) errors.push(new StoryParseError('casting.json', 'casting', 'is missing'))
  return { pack: errors.length ? null : pack, errors }
}
