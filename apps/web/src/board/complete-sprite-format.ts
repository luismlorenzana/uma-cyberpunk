// Browser-safe manifest reader from Uma Art Authoring's approved complete sprite format.
export const QUARTER_VIEWS = ['front-left', 'front-right', 'rear-left', 'rear-right'] as const
type View = typeof QUARTER_VIEWS[number]
type Point = [number, number]
type Rect = [number, number, number, number]
type Row = Record<string, unknown>
type Page = { file: string; sha256: string; bytes: number; width: number; height: number }
type Cel = { page: string; rect: Rect; file: string; sha256: string }
type Clip = { frames: { frame: string; ms: number }[]; loop: boolean; events: { frame: number; cue: string; atMs: number }[]; durationMs: number }
type Loadout = { id: string; label: string; note?: string; frames: Record<View, Record<string, Cel>>; clips: Record<string, Clip> }
export interface CompleteSpriteBundle {
  schemaVersion: 2
  kind: 'complete-character-animation-bundle'
  universe: 'cyberpunk'
  character: string
  version: string
  status: 'draft' | 'approved'
  cell: Point
  foot: Point
  figureHeight: number
  reviewHeight: number
  views: typeof QUARTER_VIEWS
  wholeCharacterCelsOnly: true
  modularLayers: false
  sources: { label: string; sha256: string }[]
  pages: Record<string, Page>
  sets: Loadout[]
}
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const hash = /^[a-f0-9]{64}$/
const pngPath = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\.png$/
function invalid(field: string): never { throw new Error(field + ': invalid complete sprite bundle value') }
function row(value: unknown, field: string, allowed?: string[]): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field)
  const result = value as Row
  if (allowed && Object.keys(result).some(key => !allowed.includes(key))) invalid(field)
  return result
}
function str(value: unknown, field: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || (pattern && !pattern.test(value))) invalid(field)
  return value
}
function num(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) invalid(field)
  return value
}
function list<T>(value: unknown, field: string, min: number, max: number, parse: (v: unknown, f: string) => T): T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid(field)
  return value.map((v, i) => parse(v, field + '[' + i + ']'))
}
function record<T>(value: unknown, field: string, min: number, max: number, parse: (v: unknown, f: string) => T): Record<string, T> {
  const entries = Object.entries(row(value, field))
  if (entries.length < min || entries.length > max) invalid(field)
  return Object.fromEntries(entries.map(([key, v]) => [str(key, field, slug), parse(v, field + '.' + key)]))
}
function point(value: unknown, field: string, maxX: number, maxY: number): Point {
  const values = list(value, field, 2, 2, v => num(v, field, 0, Math.max(maxX, maxY)))
  return [num(values[0], field, 0, maxX), num(values[1], field, 0, maxY)]
}

/** Complete cels have one page rectangle each; no rig, assembly or cardinal-view conversion. */
export function parseCompleteSpriteBundle(value: unknown): CompleteSpriteBundle {
  const root = row(value, 'bundle', ['schemaVersion', 'kind', 'universe', 'character', 'version', 'status', 'cell', 'foot',
    'figureHeight', 'reviewHeight', 'views', 'wholeCharacterCelsOnly', 'modularLayers', 'sources', 'pages', 'sets'])
  if (root.schemaVersion !== 2 || root.kind !== 'complete-character-animation-bundle' || root.universe !== 'cyberpunk' ||
    root.wholeCharacterCelsOnly !== true || root.modularLayers !== false) invalid('bundle identity')
  if (root.status !== 'draft' && root.status !== 'approved') invalid('status')
  if (JSON.stringify(root.views) !== JSON.stringify(QUARTER_VIEWS)) invalid('views')
  const cell = point(root.cell, 'cell', 1024, 1024), [width, height] = cell
  if (!width || !height) invalid('cell')
  const foot = point(root.foot, 'foot', width - 1, height - 1)
  const pages = record(root.pages, 'pages', 1, 96, (v, f) => {
    const page = row(v, f, ['file', 'sha256', 'bytes', 'width', 'height'])
    return { file: str(page.file, f + '.file', pngPath), sha256: str(page.sha256, f + '.sha256', hash),
      bytes: num(page.bytes, f + '.bytes', 24, 12 * 1024 * 1024),
      width: num(page.width, f + '.width', 1, 2048), height: num(page.height, f + '.height', 1, 2048) }
  })
  if (new Set(Object.values(pages).map(page => page.file)).size !== Object.keys(pages).length) invalid('pages: duplicate files')
  const usedPages = new Set<string>()
  const sets = list(root.sets, 'sets', 1, 64, (v, f): Loadout => {
    const set = row(v, f, ['id', 'label', 'note', 'frames', 'clips'])
    const directions = row(set.frames, f + '.frames', [...QUARTER_VIEWS])
    const frames = Object.fromEntries(QUARTER_VIEWS.map(view => [view, record(directions[view], f + '.frames.' + view, 1, 512, (v, f) => {
      const cel = row(v, f, ['page', 'rect', 'file', 'sha256'])
      const key = str(cel.page, f + '.page', slug), page = pages[key]
      if (!page || !Object.hasOwn(pages, key)) invalid(f + '.page')
      const rect = list(cel.rect, f + '.rect', 4, 4, v => num(v, f + '.rect', 0, 2048)) as Rect
      if (rect[2] !== width || rect[3] !== height || rect[0] + width > page.width || rect[1] + height > page.height) invalid(f + '.rect')
      usedPages.add(key)
      return { page: key, rect, file: str(cel.file, f + '.file', pngPath), sha256: str(cel.sha256, f + '.sha256', hash) }
    })])) as Loadout['frames']
    const clips = record(set.clips, f + '.clips', 7, 32, (v, f): Clip => {
      const clip = row(v, f, ['frames', 'loop', 'events', 'durationMs'])
      const cels = list(clip.frames, f + '.frames', 1, 160, (v, f) => {
        const frame = row(v, f, ['frame', 'ms']), id = str(frame.frame, f + '.frame', slug)
        if (QUARTER_VIEWS.some(view => !Object.hasOwn(frames[view], id))) invalid(f + '.frame')
        return { frame: id, ms: num(frame.ms, f + '.ms', 1, 5000) }
      })
      const durationMs = cels.reduce((sum, cel) => sum + cel.ms, 0)
      if (clip.durationMs !== durationMs || typeof clip.loop !== 'boolean') invalid(f + '.timing')
      const events = list(clip.events, f + '.events', 0, 24, (v, f) => {
        const event = row(v, f, ['frame', 'cue', 'atMs'])
        const frame = num(event.frame, f + '.frame', 0, cels.length - 1)
        const atMs = cels.slice(0, frame).reduce((sum, cel) => sum + cel.ms, 0)
        if (event.atMs !== atMs) invalid(f + '.atMs')
        return { frame, cue: str(event.cue, f + '.cue', slug), atMs }
      })
      return { frames: cels, loop: clip.loop, events, durationMs }
    })
    for (const action of ['idle', 'walk', 'settle', 'attack', 'hurt', 'rig-break', 'down']) if (!clips[action]) invalid(f + '.clips.' + action)
    return { id: str(set.id, f + '.id', slug), label: str(set.label, f + '.label'), frames, clips,
      ...(set.note === undefined ? {} : { note: str(set.note, f + '.note') }) }
  })
  if (new Set(sets.map(set => set.id)).size !== sets.length) invalid('sets: duplicate IDs')
  if (usedPages.size !== Object.keys(pages).length) invalid('pages: unreferenced texture')
  const sources = list(root.sources, 'sources', 1, 64, (v, f) => {
    const source = row(v, f, ['label', 'sha256'])
    return { label: str(source.label, f + '.label'), sha256: str(source.sha256, f + '.sha256', hash) }
  })
  return { schemaVersion: 2, kind: 'complete-character-animation-bundle', universe: 'cyberpunk',
    character: str(root.character, 'character', slug), version: str(root.version, 'version', /^v\d{3,6}$/), status: root.status,
    cell, foot, figureHeight: num(root.figureHeight, 'figureHeight', 1, height),
    reviewHeight: num(root.reviewHeight, 'reviewHeight', 40, 200), views: QUARTER_VIEWS,
    wholeCharacterCelsOnly: true, modularLayers: false, sources, pages, sets }
}
