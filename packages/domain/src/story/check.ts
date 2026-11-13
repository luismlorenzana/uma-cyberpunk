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
    if (step.kind === 'captain') for (const [j, o] of step.options.entries()) yield* walkSteps(o.then, `${p}.captain[${j}].then`)
    if (step.kind === 'path') { yield* walkSteps(step.trust, `${p}.path.trust`); yield* walkSteps(step.heart, `${p}.path.heart`) }
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
  for (const b of Object.values(pack.bonds)) out[`bond:${b.outfit}`] = b.layer ?? 'scripted'
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
      // The flow hands off to the mission at a battle step, and its next scene follows the mission (`after`).
      const b = s.steps.findIndex((st) => st.kind === 'battle')
      if (b >= 0 && b !== s.steps.length - 1) err(file, `scenes[${i}].steps[${b}]`, 'a battle step is its scene’s last step; what follows goes in a scene triggered after the mission')
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
  // Bonds (CY13): gates name real keys; each file's scenes at distinct ranks; the path only at rank 8 (or 10 to change
  // it), exactly once at 8; no battles or arrivals in a bond scene; the captain's placeholders spelled right.
  for (const [rank, k] of Object.entries(pack.casting.bondGates ?? {})) if (!key(k)) err('casting.json', `bondGates["${rank}"]`, `no ${k}`)
  const crew = new Set([...leads, ...pack.casting.crewOrder])
  for (const b of Object.values(pack.bonds)) {
    const file = `bonds/${b.outfit}.json`
    if (!crew.has(b.outfit)) todo(file, 'outfit', `${b.outfit} isn't a lead or in the crew order`)
    const ranks = new Set<number>()
    b.scenes.forEach((sc, i) => {
      if (ranks.has(sc.rank)) err(file, `scenes[${i}].rank`, `a second scene at rank ${sc.rank}`)
      ranks.add(sc.rank)
      const paths = [...walkSteps(sc.steps, `scenes[${i}].steps`)].filter((w) => w.step.kind === 'path')
      if (sc.rank === 8 && paths.length !== 1) err(file, `scenes[${i}]`, 'the rank-8 scene has exactly one path step (Trust or Heart)')
      if (sc.rank !== 8 && sc.rank !== 10 && paths.length) err(file, paths[0]!.path, 'a path step only comes at rank 8, or at 10 to change it')
      for (const { step, path: p } of walkSteps(sc.steps, `scenes[${i}].steps`)) {
        if (step.kind === 'battle' || step.kind === 'aboard' || step.kind === 'join') err(file, p, `no ${step.kind} step in a bond scene`)
        if (step.kind === 'slot') for (const k of Object.keys(step.lines)) if (!leads.has(Number(k))) err(file, `${p}.slot.lines["${k}"]`, `${k} isn't a lead`)
      }
      const secs = sceneSeconds(sc)
      if (secs > 150) todo(file, `scenes[${i}]`, `likely ${Math.round(secs / 60)} minutes; bond scenes run one to two (TC57)`)
    })
  }
  for (const l of pack.casting.leads) if (!pack.bonds[String(l.outfit)]) todo('casting.json', `leads.${l.outfit}`, 'no bond scenes yet (TC57)')
  // The captain's placeholders (TC55), anywhere a line is written.
  const placeholder = /\{([^}]*)\}/g
  const okWord = /^(captain|they|them|their|theirs|they're)$/i
  const texts: { file: string; where: string; text: string }[] = []
  const collect = (file: string, base: string, steps: readonly Step[]) => {
    for (const { step, path: p } of walkSteps(steps, base)) {
      if ('text' in step) texts.push({ file, where: p, text: step.text })
      if (step.kind === 'slot') { texts.push({ file, where: p, text: step.fallback }); for (const t of Object.values(step.lines)) texts.push({ file, where: p, text: t }) }
      if (step.kind === 'choice') step.options.forEach((o, j) => texts.push({ file, where: `${p}.choice[${j}]`, text: o.text }))
      if (step.kind === 'captain') step.options.forEach((o, j) => texts.push({ file, where: `${p}.captain[${j}]`, text: o.text }))
    }
  }
  for (const c of Object.values(pack.chapters)) { c.scenes.forEach((sc, i) => collect(`chapters/${c.id}.json`, `scenes[${i}].steps`, sc.steps)); collect(`chapters/${c.id}.json`, 'debrief.steps', c.debrief.steps) }
  for (const b of Object.values(pack.bonds)) b.scenes.forEach((sc, i) => collect(`bonds/${b.outfit}.json`, `scenes[${i}].steps`, sc.steps))
  for (const t of texts) for (const m of t.text.matchAll(placeholder)) if (!okWord.test(m[1]!)) err(t.file, t.where, `unknown placeholder {${m[1]}}: use {captain}, {they}, {them}, {their}, {theirs} or {they're}`)
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
