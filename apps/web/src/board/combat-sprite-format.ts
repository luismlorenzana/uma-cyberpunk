// Browser-safe v1 manifest reader adapted from Uma Art Authoring's CY71 parser (fd85755).
export const FACINGS = ['S', 'W', 'N', 'E'] as const
export const RIG_SLOTS = {
  core: 'core', leftArm: 'arm', rightArm: 'arm', legs: 'legs', visor: 'visor',
  leftHand: 'hand', rightHand: 'hand', back: 'back', coat: 'coat',
} as const

type Facing = typeof FACINGS[number]
export type Slot = keyof typeof RIG_SLOTS
export type Rig = Record<Slot, string | null>
export type Point = [number, number]
type Rect = [number, number, number, number]
type Row = Record<string, unknown>
type Page = { file: string; sha256: string; bytes: number; width: number; height: number }
export type Layer = { page: string; rect: Rect; at: Point; when?: { slot: Slot; part: string }; limb?: 'leftArm' | 'rightArm' | 'legs'; effect?: true }
export type Frame = { layers: Layer[]; anchors: Record<string, Point> }
export type Clip = { frames: { frame: string; ms: number }[]; loop: boolean; events: { frame: number; cue: string }[] }
export type Track = { frames: Record<string, Frame>; clips: Record<string, Clip> }
type Fitting = { id: string; label: string; motion: string; rig: Rig; note?: string }

export interface SpriteBundle {
  schemaVersion: 1
  kind: 'combat-sprite-bundle'
  universe: 'cyberpunk'
  character: string
  outfit: number | string
  look: 'armor-helmet'
  version: string
  status: 'draft' | 'approved'
  cell: Point
  foot: Point
  figureHeight: number
  reviewHeight: number
  sources: { label: string; sha256: string }[]
  pages: Record<string, Page>
  motions: Record<string, Record<Facing, Track>>
  fittings: Fitting[]
  composition?: { body: string; rifle: string; blade: string }
}

export interface EffectTrack { frames: Layer[]; ms: (number | null)[] }
export interface CombatEffects {
  origin: Point
  barrier: Record<Facing, EffectTrack>
  recipient: Record<'mend' | 'med-reboot' | 'order-reboot', EffectTrack>
}

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const version = /^v\d{3,6}$/
const hash = /^[a-f0-9]{64}$/
const path = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\.png$/
const maxPageBytes = 12 * 1024 * 1024

function invalid(field: string): never { throw new Error(field + ': invalid combat sprite bundle value') }

function object(value: unknown, field: string, allowed?: readonly string[]): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field)
  const row = value as Row
  if (allowed && Object.keys(row).some(key => !allowed.includes(key))) invalid(field)
  return row
}

function string(value: unknown, field: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || (pattern && !pattern.test(value))) invalid(field)
  return value
}

function number(value: unknown, field: string, low: number, high: number, integer = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value))) invalid(field)
  return value
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(field)
  return value
}

function list<T>(value: unknown, field: string, min: number, max: number, parse: (v: unknown, field: string) => T): T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid(field)
  return value.map((v, i) => parse(v, field + '[' + i + ']'))
}

function point(value: unknown, field: string, width: number, height: number, integer = true): Point {
  const [x, y] = list(value, field, 2, 2, v => number(v, field, 0, Math.max(width, height), integer))
  return [number(x, field, 0, width, integer), number(y, field, 0, height, integer)]
}

function record<T>(value: unknown, field: string, min: number, max: number, parse: (v: unknown, field: string) => T): Record<string, T> {
  const entries = Object.entries(object(value, field))
  if (entries.length < min || entries.length > max) invalid(field)
  return Object.fromEntries(entries.map(([key, v]) => [
    string(key, field, slug), parse(v, field + '.' + key),
  ]))
}

function rigOf(value: unknown, field: string): Rig {
  const row = object(value, field, Object.keys(RIG_SLOTS))
  return Object.fromEntries(Object.entries(RIG_SLOTS).map(([slot, family]) => {
    const part = row[slot]
    if (part === null && ['leftHand', 'rightHand', 'back', 'coat'].includes(slot)) return [slot, null]
    const id = string(part, field + '.' + slot, slug)
    if (!id.startsWith(family + '-')) invalid(field + '.' + slot)
    return [slot, id]
  })) as Rig
}

function whenOf(value: unknown, field: string): NonNullable<Layer['when']> {
  const row = object(value, field, ['slot', 'part'])
  if (typeof row.slot !== 'string' || !Object.hasOwn(RIG_SLOTS, row.slot)) invalid(field + '.slot')
  const slot = row.slot as Slot
  const part = string(row.part, field + '.part', slug)
  if (!part.startsWith(RIG_SLOTS[slot] + '-')) invalid(field + '.part')
  return { slot, part }
}

export function parseCombatEffects(value: unknown, bundle: SpriteBundle): CombatEffects {
  const row = object(value, 'placements')
  if (row.schemaVersion !== 1 || row.unit !== 'native pixels') invalid('placements identity')
  const origin = point(row.origin, 'placements origin', bundle.cell[0], bundle.cell[1])
  if (origin.some((v, i) => v !== bundle.foot[i])) invalid('placements registration')
  function track(value: unknown, field: string, held: boolean): EffectTrack {
    const t = object(value, field)
    const frames = list(t.frames, field, 1, 16, (v, f): Layer => {
      const l = object(v, f)
      const page = string(l.page, f, slug), p = bundle.pages[page]
      if (!p || !Object.hasOwn(bundle.pages, page)) invalid(f)
      const [x = 0, y = 0, w = 0, h = 0] = list(l.rect, f, 4, 4, v => number(v, f, 0, 2048))
      if (!w || !h || x + w > p.width || y + h > p.height) invalid(f)
      return { page, rect: [x, y, w, h], at: point(l.at, f, bundle.cell[0] - w, bundle.cell[1] - h) }
    })
    const ms = list(t.ms, field, frames.length, frames.length, (v, f) => v === null ? null : number(v, f, 1, 5000, false))
    if (ms.some((v, i) => (v === null) !== (held && i === ms.length - 1))) invalid(field + ' timing')
    return { frames, ms }
  }
  const walls = object(row.barrier, 'barrier'), effects = object(row.recipientEffects, 'recipientEffects')
  return {
    origin,
    barrier: Object.fromEntries(FACINGS.map(d => [d, track(walls[d], 'barrier.' + d, true)])) as CombatEffects['barrier'],
    recipient: {
      mend: track(effects.mend, 'mend', false),
      'med-reboot': track(effects['med-reboot'], 'med-reboot', false),
      'order-reboot': track(effects['order-reboot'], 'order-reboot', false),
    },
  }
}

/** The checked wire format shared by the gallery, bundle check command, and future release reader. */
export function parseSpriteBundle(value: unknown): SpriteBundle {
  const root = object(value, 'bundle', ['schemaVersion', 'kind', 'universe', 'character', 'outfit', 'look', 'version', 'status',
    'cell', 'foot', 'figureHeight', 'reviewHeight', 'sources', 'pages', 'motions', 'fittings', 'composition'])
  if (root.schemaVersion !== 1 || root.kind !== 'combat-sprite-bundle' || root.universe !== 'cyberpunk' || root.look !== 'armor-helmet') invalid('bundle identity')
  if (root.status !== 'draft' && root.status !== 'approved') invalid('status')
  const cell = point(root.cell, 'cell', 1024, 1024)
  const [width, height] = cell
  if (!width || !height) invalid('cell')
  const foot = point(root.foot, 'foot', width - 1, height - 1)
  const figureHeight = number(root.figureHeight, 'figureHeight', 1, height)
  const reviewHeight = number(root.reviewHeight, 'reviewHeight', 40, 200)
  const sources = list(root.sources, 'sources', 1, 64, (value, field) => {
    const row = object(value, field, ['label', 'sha256'])
    return { label: string(row.label, field + '.label'), sha256: string(row.sha256, field + '.sha256', hash) }
  })
  const pages = record(root.pages, 'pages', 1, 96, (value, field) => {
    const row = object(value, field, ['file', 'sha256', 'bytes', 'width', 'height'])
    return {
      file: string(row.file, field + '.file', path), sha256: string(row.sha256, field + '.sha256', hash),
      bytes: number(row.bytes, field + '.bytes', 24, maxPageBytes),
      width: number(row.width, field + '.width', 1, 2048), height: number(row.height, field + '.height', 1, 2048),
    }
  })
  if (new Set(Object.values(pages).map(page => page.file)).size !== Object.keys(pages).length) invalid('pages: duplicate files')

  function readLayer(value: unknown, field: string): Layer {
    const row = object(value, field, ['page', 'rect', 'at', 'when', 'limb', 'effect'])
    const key = string(row.page, field + '.page', slug), page = pages[key]
    if (!page || !Object.hasOwn(pages, key)) invalid(field + '.page')
    const [x, y, w, h] = list(row.rect, field + '.rect', 4, 4, v => number(v, field + '.rect', 0, 2048))
    if (x === undefined || y === undefined || !w || !h || x + w > page.width || y + h > page.height || w > width || h > height) invalid(field + '.rect')
    const at = point(row.at, field + '.at', width - w, height - h)
    const limb = row.limb
    if (limb !== undefined && limb !== 'leftArm' && limb !== 'rightArm' && limb !== 'legs') invalid(field + '.limb')
    if (row.effect !== undefined && (row.effect !== true || row.when === undefined)) invalid(field + '.effect')
    return { page: key, rect: [x, y, w, h], at, ...(row.when === undefined ? {} : { when: whenOf(row.when, field + '.when') }),
      ...(limb ? { limb } : {}), ...(row.effect ? { effect: true } : {}) }
  }

  function readTrack(value: unknown, field: string): Track {
    const track = object(value, field, ['frames', 'clips'])
    const frames = record(track.frames, field + '.frames', 1, 512, (value, name) => {
      const frame = object(value, name, ['layers', 'anchors'])
      const layers = list(frame.layers, name + '.layers', 1, 24, readLayer)
      const anchors = frame.anchors === undefined ? {} : record(frame.anchors, name + '.anchors', 0, 16,
        (v, f) => point(v, f, width, height, false))
      return { layers, anchors }
    })
    const clips = record(track.clips, field + '.clips', 1, 32, (value, name) => {
      const clip = object(value, name, ['frames', 'loop', 'events'])
      const cels = list(clip.frames, name + '.frames', 1, 160, (v, f) => {
        const row = object(v, f, ['frame', 'ms'])
        const frame = string(row.frame, f + '.frame', slug)
        if (!Object.hasOwn(frames, frame)) invalid(f + '.frame')
        return { frame, ms: number(row.ms, f + '.ms', 1, 5000, false) }
      })
      const events = clip.events === undefined ? [] : list(clip.events, name + '.events', 0, 24, (v, f) => {
        const row = object(v, f, ['frame', 'cue'])
        return { frame: number(row.frame, f + '.frame', 0, cels.length - 1), cue: string(row.cue, f + '.cue', slug) }
      })
      return { frames: cels, loop: bool(clip.loop, name + '.loop'), events }
    })
    for (const name of ['idle', 'walk', 'settle', 'attack']) if (!clips[name]) invalid(field + '.clips.' + name)
    return { frames, clips }
  }

  const motions = record(root.motions, 'motions', 1, 24, (value, field) => {
    const row = object(value, field, FACINGS)
    return Object.fromEntries(FACINGS.map(facing => [facing, readTrack(row[facing], field + '.' + facing)])) as Record<Facing, Track>
  })
  const fittings = list(root.fittings, 'fittings', 1, 64, (value, field) => {
    const row = object(value, field, ['id', 'label', 'motion', 'rig', 'note'])
    const motion = string(row.motion, field + '.motion', slug)
    if (!Object.hasOwn(motions, motion)) invalid(field + '.motion')
    const note = row.note === undefined ? undefined : string(row.note, field + '.note')
    return { id: string(row.id, field + '.id', slug), label: string(row.label, field + '.label'),
      motion, rig: rigOf(row.rig, field + '.rig'), ...(note ? { note } : {}) }
  })
  if (new Set(fittings.map(f => f.id)).size !== fittings.length ||
    new Set(fittings.map(f => JSON.stringify(f.rig))).size !== fittings.length) invalid('fittings: duplicate IDs or rigs')

  const usedPages = new Set<string>()
  for (const [motion, directions] of Object.entries(motions)) {
    const compatible = fittings.filter(fitting => fitting.motion === motion)
    if (!compatible.length) invalid('motions.' + motion + ': unused')
    for (const track of Object.values(directions)) for (const frame of Object.values(track.frames)) {
      for (const { when, page } of frame.layers) {
        usedPages.add(page)
        if (when && !compatible.some(fitting => fitting.rig[when.slot] === when.part)) invalid('motion layer: no fitting uses conditional part')
      }
      if (compatible.some(fitting => !frame.layers.some(layer => !layer.when || fitting.rig[layer.when.slot] === layer.when.part))) {
        invalid('motion frame: no visible layers for fitting')
      }
    }
  }
  if (usedPages.size !== Object.keys(pages).length) invalid('pages: unreferenced texture')
  const outfit = typeof root.outfit === 'string' ? string(root.outfit, 'outfit', slug) : number(root.outfit, 'outfit', 1, Number.MAX_SAFE_INTEGER)
  const composition = root.composition === undefined ? undefined : (() => {
    const row = object(root.composition, 'composition', ['body', 'rifle', 'blade'])
    const motion = (key: string) => {
      const id = string(row[key], 'composition.' + key, slug)
      if (!Object.hasOwn(motions, id)) invalid('composition.' + key)
      return id
    }
    const body = motion('body')
    for (const facing of FACINGS) {
      const track = motions[body]![facing]
      for (const name of ['attack-left', 'attack-right', 'attack-back']) if (!track.clips[name]) invalid('composition.' + name)
      for (const frame of Object.values(track.frames)) {
        if (!frame.anchors['left-grip'] || !frame.anchors['right-grip'] || !frame.anchors['back-mount']) invalid('composition: grip and mount anchors')
      }
    }
    return { body, rifle: motion('rifle'), blade: motion('blade') }
  })()
  return {
    schemaVersion: 1, kind: root.kind, universe: root.universe, look: root.look, status: root.status,
    character: string(root.character, 'character', slug), outfit, version: string(root.version, 'version', version),
    cell, foot, figureHeight, reviewHeight, sources, pages, motions, fittings, ...(composition ? { composition } : {}),
  }
}
