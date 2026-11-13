// The story's strict parser (CY9, uma-quest's way): every shape checked, unknown keys refused, and every error names its
// file and path, as `chapters/w1-ch1.json: scenes[0].steps[3].slot.lines["1002"]: expected text of 160 characters at most`.
import type { Role } from '@cyber/battle'
import type { BondFile, Call, CaptainOption, CastMember, Casting, Chapter, ChoiceOption, EnemySlot, Layer, Location, LogFile, Mission, Scene, Step, StoryPack, Tone, Trigger, World } from './types'
import { LAYERS, MISSION_OBJECTIVES, TONES } from './types'

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

/** A line's longest text (TC36's short beats). */
export const LINE_MAX = 160
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
type Obj = Record<string, unknown>

class P {
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
  const o = p.object(v, path, ['id', 'place', 'trigger', 'cast', 'steps'])
  return { id: p.slug(o.id, `${path}.id`), place: p.slug(o.place, `${path}.place`), trigger: trigger(p, o.trigger, `${path}.trigger`), cast: p.list(o.cast, `${path}.cast`, (c, cp) => cast(p, c, cp), 12), steps: p.steps(o.steps, `${path}.steps`) }
}

function enemy(p: P, v: unknown, path: string): EnemySlot {
  const o = p.object(v, path, ['slot', 'pool', 'job', 'count', 'faction'], ['slot'])
  if (o.slot === 'boss') return { slot: 'boss', pool: p.list(o.pool, `${path}.pool`, (x, xp) => p.slug(x, xp), 12) }
  if (o.slot === 'regular') return { slot: 'regular', job: p.slug(o.job, `${path}.job`), count: p.int(o.count, `${path}.count`, 1, 8), faction: p.slug(o.faction, `${path}.faction`) }
  return p.fail(`${path}.slot`, 'expected boss or regular')
}

function mission(p: P, v: unknown, path: string): Mission {
  const o = p.object(v, path, ['id', 'place', 'objective', 'brief', 'enemies', 'fixedSquad', 'side', 'scenario'], ['id', 'place', 'objective', 'brief', 'enemies'])
  const obj = p.object(o.objective, `${path}.objective`, ['kind'])
  if (!MISSION_OBJECTIVES.includes(obj.kind as never)) p.fail(`${path}.objective.kind`, `expected one of ${MISSION_OBJECTIVES.join(', ')}`)
  return {
    id: p.slug(o.id, `${path}.id`), place: p.slug(o.place, `${path}.place`), objective: { kind: obj.kind as Mission['objective']['kind'] },
    brief: p.text(o.brief, `${path}.brief`, 600), enemies: p.list(o.enemies, `${path}.enemies`, (e, ep) => enemy(p, e, ep), 12),
    fixedSquad: o.fixedSquad === undefined || o.fixedSquad === null ? null : p.list(o.fixedSquad, `${path}.fixedSquad`, (x, xp) => p.outfit(x, xp), 5),
    side: o.side === undefined ? [] : p.list(o.side, `${path}.side`, (x, xp) => { const s = p.object(x, xp, ['kind', 'gives']); return { kind: p.slug(s.kind, `${xp}.kind`), gives: p.slug(s.gives, `${xp}.gives`) } }, 6),
    ...(o.scenario !== undefined ? { scenario: p.slug(o.scenario, `${path}.scenario`) } : {}),
  }
}

export function parseChapter(value: unknown, file = 'chapter'): Chapter {
  const p = new P(file)
  const o = p.object(value, 'chapter', ['schemaVersion', 'id', 'world', 'leads', 'number', 'danger', 'needs', 'scenes', 'missions', 'debrief', 'layer'], ['schemaVersion', 'id', 'world', 'leads', 'number', 'danger', 'scenes'])
  p.version(o)
  const debrief = o.debrief === undefined ? { steps: [] } : (() => { const d = p.object(o.debrief, 'debrief', ['steps']); return { steps: p.steps(d.steps, 'debrief.steps') } })()
  const chapter: Chapter = {
    schemaVersion: 1, id: p.slug(o.id, 'id'), world: p.slug(o.world, 'world'), leads: p.list(o.leads, 'leads', (x, xp) => p.outfit(x, xp), 2),
    number: p.int(o.number, 'number', 1, 99), danger: p.int(o.danger, 'danger', 1, 99), needs: o.needs === undefined ? [] : p.list(o.needs, 'needs', (x, xp) => {
      if (typeof x !== 'string' || !/^(chapter|mission|file):[a-z0-9][a-z0-9-]{0,63}$/.test(x)) p.fail(xp, 'expected chapter:, mission: or file: and a slug')
      return x as string
    }, 12),
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
  const o = p.object(value, 'world', ['schemaVersion', 'id', 'look', 'mood', 'locations', 'factions', 'layer', 'x', 'y'], ['schemaVersion', 'id', 'locations', 'factions'])
  p.version(o)
  const locations = p.list(o.locations, 'locations', (l, lp): Location => {
    const x = p.object(l, lp, ['id', 'danger', 'needs', 'links', 'x', 'y'], ['id', 'danger'])
    return {
      id: p.slug(x.id, `${lp}.id`), danger: p.int(x.danger, `${lp}.danger`, 1, 99), needs: x.needs === undefined ? [] : p.list(x.needs, `${lp}.needs`, (n, np) => {
        if (typeof n !== 'string' || !/^(chapter|mission|file):[a-z0-9][a-z0-9-]{0,63}$/.test(n)) p.fail(np, 'expected chapter:, mission: or file: and a slug')
        return n as string
      }, 6), links: x.links === undefined ? [] : p.list(x.links, `${lp}.links`, (n, np) => p.slug(n, np), 8),
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
  return world
}

export function parseCasting(value: unknown, file = 'casting.json'): Casting {
  const p = new P(file)
  const o = p.object(value, 'casting', ['schemaVersion', 'leads', 'crewOrder', 'roles', 'bondGates', 'heroines', 'minor', 'labels', 'layer'], ['schemaVersion', 'leads'])
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
    }, 200),
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
  const o = p.object(value, 'bond', ['schemaVersion', 'outfit', 'scenes', 'epilogue', 'layer'], ['schemaVersion', 'outfit', 'scenes'])
  p.version(o)
  const b: BondFile = {
    schemaVersion: 1, outfit: p.outfit(o.outfit, 'outfit'),
    scenes: p.list(o.scenes, 'scenes', (s, sp) => {
      const x = p.object(s, sp, ['rank', 'place', 'steps'])
      const rank = p.int(x.rank, `${sp}.rank`, 2, 10)
      if (rank % 2 !== 0) p.fail(`${sp}.rank`, 'expected 2, 4, 6, 8 or 10')
      return { rank, place: p.slug(x.place, `${sp}.place`), steps: p.steps(x.steps, `${sp}.steps`) }
    }, 5),
  }
  if (o.epilogue !== undefined) b.epilogue = p.text(o.epilogue, 'epilogue', 400)
  const layer = p.layer(o.layer, 'layer')
  if (layer) b.layer = layer
  return b
}

/** The pack from its files, by path relative to content/stories/ (`casting.json`, `worlds/…`, `chapters/…`, `log/…`,
 * `calls/…`); other files are left alone. Parse errors are collected, not thrown, so the check can list them all. */
export function parsePack(files: Record<string, unknown>): { pack: StoryPack | null; errors: StoryParseError[] } {
  const errors: StoryParseError[] = []
  const pack: StoryPack = { casting: { schemaVersion: 1, leads: [], crewOrder: [], heroines: [], minor: [] }, worlds: {}, chapters: {}, files: {}, calls: {}, bonds: {} }
  let casting = false
  const id = (path: string) => path.split('/').pop()!.replace(/\.json$/, '')
  for (const [path, value] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    try {
      if (path === 'casting.json') { pack.casting = parseCasting(value, path); casting = true }
      else if (/^worlds\/[^/]+\.json$/.test(path)) { const w = parseWorld(value, path); if (w.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.worlds[w.id] = w }
      else if (/^chapters\/[^/]+\.json$/.test(path)) { const c = parseChapter(value, path); if (c.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.chapters[c.id] = c }
      else if (/^log\/[^/]+\.json$/.test(path)) { const f = parseLogFile(value, path); if (f.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.files[f.id] = f }
      else if (/^calls\/[^/]+\.json$/.test(path)) { const c = parseCall(value, path); if (c.id !== id(path)) throw new StoryParseError(path, 'id', `expected ${id(path)}, the file's name`); pack.calls[c.id] = c }
      else if (/^bonds\/[^/]+\.json$/.test(path)) { const b = parseBondFile(value, path); if (String(b.outfit) !== id(path)) throw new StoryParseError(path, 'outfit', `expected ${id(path)}, the file's name`); pack.bonds[String(b.outfit)] = b }
    } catch (e) {
      if (e instanceof StoryParseError) errors.push(e)
      else throw e
    }
  }
  if (!casting) errors.push(new StoryParseError('casting.json', 'casting', 'is missing'))
  return { pack: errors.length ? null : pack, errors }
}
