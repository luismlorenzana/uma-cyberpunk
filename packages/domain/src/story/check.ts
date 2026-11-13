// The story check's cross-file rules (CY9; run by `pnpm story:check`): errors (every id resolves; a Chapter 1 ends with
// `aboard` and only a Chapter 1 has one; every key in `needs` is real; a slot keys only leads), todos (a scene likely
// over three minutes, TC36; a lead in fewer than two crossed paths; a Chapter 1 with more than two battles, TC51) and
// notes (counts). It builds Uma Story's `checks.json` (uma-platform P141) less the files' hashes, which the script adds.
import type { Chapter, Layer, Scene, Step, StoryPack } from './types'

export interface Finding { level: 'error' | 'todo' | 'note'; file: string; where: string; message: string }

export interface ChecksReport {
  schemaVersion: 1
  book: 'cyberpunk'
  checkedAt: string
  files: Record<string, string>
  findings: Finding[]
  layers: Record<string, Layer>
  counts: Record<string, Record<string, string[]>>
}

/** Every step, nested choices and branches included, with its path. */
export function* walkSteps(steps: readonly Step[], path: string): Generator<{ step: Step; path: string }> {
  for (const [i, step] of steps.entries()) {
    const p = `${path}[${i}]`
    yield { step, path: p }
    if (step.kind === 'choice') for (const [j, o] of step.options.entries()) yield* walkSteps(o.then, `${p}.choice[${j}].then`)
  }
}

/** A scene's likely length in seconds: four seconds a line and a second for every fifteen characters. */
export function sceneSeconds(scene: Pick<Scene, 'steps'>): number {
  let s = 0
  for (const { step } of walkSteps(scene.steps, 'steps')) {
    const text = 'text' in step ? step.text : step.kind === 'slot' ? step.fallback : ''
    if (text) s += 4 + text.length / 15
    if (step.kind === 'wait') s += step.ms / 1000
  }
  return Math.round(s)
}

const hasScripted = (c: Chapter) => c.scenes.some((s) => s.steps.length > 0) || c.debrief.steps.length > 0

/** The layer a file is at: its own, else inferred (a chapter with scripted steps is `scripted`, with only missions
 * `skeleton`; a world with a look or mood is a `bible`). */
export function layersOf(pack: StoryPack): Record<string, Layer> {
  const out: Record<string, Layer> = {}
  for (const w of Object.values(pack.worlds)) out[`world:${w.id}`] = w.layer ?? (w.look || w.mood ? 'bible' : 'skeleton')
  for (const c of Object.values(pack.chapters)) out[`chapter:${c.id}`] = c.layer ?? (hasScripted(c) ? 'scripted' : 'skeleton')
  for (const f of Object.values(pack.files)) out[`file:${f.id}`] = f.layer ?? 'scripted'
  for (const c of Object.values(pack.calls)) out[`call:${c.id}`] = c.layer ?? 'scripted'
  return out
}

export function checkPack(pack: StoryPack): Finding[] {
  const out: Finding[] = []
  const err = (file: string, where: string, message: string) => out.push({ level: 'error', file, where, message })
  const todo = (file: string, where: string, message: string) => out.push({ level: 'todo', file, where, message })
  const leads = new Set(pack.casting.leads.map((l) => l.outfit))
  const missionIds = new Set(Object.values(pack.chapters).flatMap((c) => c.missions.map((m) => m.id)))
  const key = (k: string): boolean => {
    const [kind, id] = k.split(':') as [string, string]
    return kind === 'chapter' ? !!pack.chapters[id] : kind === 'mission' ? missionIds.has(id) : !!pack.files[id]
  }
  for (const l of pack.casting.leads) if (!pack.worlds[l.world]) err('casting.json', `leads[${pack.casting.leads.indexOf(l)}].world`, `no world ${l.world}`)
  for (const w of Object.values(pack.worlds)) {
    const file = `worlds/${w.id}.json`
    const places = new Set(w.locations.map((l) => l.id))
    w.locations.forEach((l, i) => {
      for (const n of l.needs) if (!key(n)) err(file, `locations[${i}].needs`, `no ${n}`)
      for (const n of l.links) if (!places.has(n)) err(file, `locations[${i}].links`, `no location ${n} on this world`)
    })
  }
  for (const c of Object.values(pack.chapters)) {
    const file = `chapters/${c.id}.json`
    const world = pack.worlds[c.world]
    if (!world) err(file, 'world', `no world ${c.world}`)
    const places = new Set(world?.locations.map((l) => l.id) ?? [])
    c.leads.forEach((l, i) => { if (!leads.has(l)) err(file, `leads[${i}]`, `${l} isn't a lead in casting.json`) })
    for (const n of c.needs) if (!key(n)) err(file, 'needs', `no ${n}`)
    const own = new Set(c.missions.map((m) => m.id))
    c.missions.forEach((m, i) => { if (world && !places.has(m.place)) err(file, `missions[${i}].place`, `no location ${m.place} on ${c.world}`) })
    let aboard = 0, battles = 0
    const scan = (steps: readonly Step[], path: string) => {
      for (const { step, path: p } of walkSteps(steps, path)) {
        if (step.kind === 'slot') for (const k of Object.keys(step.lines)) if (!leads.has(Number(k))) err(file, `${p}.slot.lines["${k}"]`, `${k} isn't a lead`)
        if (step.kind === 'battle') { battles++; if (!own.has(step.mission)) err(file, `${p}.battle`, `no mission ${step.mission} in this chapter`) }
        if (step.kind === 'file' && !pack.files[step.file]) err(file, `${p}.file`, `no Log File ${step.file}`)
        if (step.kind === 'file' && pack.files[step.file] && step.line >= pack.files[step.file]!.lines.length) err(file, `${p}.file.line`, `${step.file} has ${pack.files[step.file]!.lines.length} lines`)
        if (step.kind === 'call' && !pack.calls[step.call]) err(file, `${p}.call`, `no Call ${step.call}`)
        if (step.kind === 'aboard') aboard++
      }
    }
    c.scenes.forEach((s, i) => {
      if (world && !places.has(s.place)) err(file, `scenes[${i}].place`, `no location ${s.place} on ${c.world}`)
      const t = s.trigger
      if ('arrive' in t && world && !places.has(t.arrive)) err(file, `scenes[${i}].trigger.arrive`, `no location ${t.arrive}`)
      if ('talk' in t && world && !places.has(t.talk)) err(file, `scenes[${i}].trigger.talk`, `no location ${t.talk}`)
      if ('after' in t && !missionIds.has(t.after)) err(file, `scenes[${i}].trigger.after`, `no mission ${t.after}`)
      scan(s.steps, `scenes[${i}].steps`)
      const secs = sceneSeconds(s)
      if (secs > 180) todo(file, `scenes[${i}]`, `likely ${Math.round(secs / 60)} minutes, over three (TC36)`)
    })
    scan(c.debrief.steps, 'debrief.steps')
    if (c.number === 1) {
      const last = c.scenes[c.scenes.length - 1]
      const end = last?.steps[last.steps.length - 1]
      if (aboard !== 1 || end?.kind !== 'aboard') err(file, 'scenes', "a Chapter 1 ends with one aboard step, her last scene's last step")
      if (battles > 2) todo(file, 'scenes', `${battles} battles: a Chapter 1 runs two at most (TC51)`)
    } else if (aboard > 0) err(file, 'scenes', 'only a Chapter 1 has an aboard step')
  }
  for (const call of Object.values(pack.calls)) call.voters.forEach((v, i) => { if (!leads.has(v.outfit)) err(`calls/${call.id}.json`, `voters[${i}].outfit`, `${v.outfit} isn't a lead`) })
  for (const l of pack.casting.leads) {
    const crossed = Object.values(pack.chapters).filter((c) => c.leads.length === 2 && c.leads.includes(l.outfit)).length
    if (crossed < 2) todo('casting.json', `leads.${l.outfit}`, `in ${crossed} crossed paths, fewer than two (TC51)`)
  }
  return out
}

/** The notes: counts per world, lead and layer. */
export function countsOf(pack: StoryPack): Record<string, Record<string, string[]>> {
  const byWorld: Record<string, string[]> = {}, byLead: Record<string, string[]> = {}, byLayer: Record<string, string[]> = {}
  for (const c of Object.values(pack.chapters)) {
    ;(byWorld[c.world] ??= []).push(c.id)
    for (const l of c.leads) (byLead[String(l)] ??= []).push(c.id)
  }
  for (const [id, layer] of Object.entries(layersOf(pack))) (byLayer[layer] ??= []).push(id)
  return { world: byWorld, lead: byLead, layer: byLayer }
}

/** The report, less the files' hashes. */
export function checksReport(pack: StoryPack | null, parseFindings: Finding[], checkedAt: string): ChecksReport {
  const findings = [...parseFindings, ...(pack ? checkPack(pack) : [])]
  const counts = pack ? countsOf(pack) : {}
  for (const [group, labels] of Object.entries(counts)) for (const [label, ids] of Object.entries(labels)) findings.push({ level: 'note', file: '', where: group, message: `${label}: ${ids.length}` })
  return { schemaVersion: 1, book: 'cyberpunk', checkedAt, files: {}, findings, layers: pack ? layersOf(pack) : {}, counts }
}
