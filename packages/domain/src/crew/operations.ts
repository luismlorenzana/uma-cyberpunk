// Operations and standing through the save (CY18, TC70, TC71): what Comms offers on the worlds visited, sending a squad
// and recalling it, its return on a watch with a deterministic outcome and a report, each faction's standing as it
// stands now (the story's start, the moves, heroines freed), and the readiness total. Pure (D31).
import { levelOf, STRAIN_REST } from './crew'
import {
  clampStanding, genericOperations, outcomeOf, outcomePay, readinessOf, squadPower, SQUAD_TUNING, type Operation, type OperationRun, type Outcome, type Squad,
} from './squads'
import { earn } from '../ship/hull'
import { MODULES_BY_ID, type SystemId } from '../ship/modules'
import type { Save } from '../save/save'
import type { StoryPack } from '../story/types'
import { keyMet, type WorldProgress } from '../worlds/map'

/** A returned operation's report, on the watch's ship-log card. */
export interface OpReport { op: string; title: string; squad: string; outcome: Outcome; text: string }

// --- Standing ----------------------------------------------------------------------------------------------------------

/** Every faction the story names: its worlds' and its heroines'. */
export const factionsOf = (pack: StoryPack): string[] =>
  [...new Set([...Object.values(pack.worlds).flatMap((w) => w.factions), ...pack.casting.heroines.map((h) => h.faction)])].sort()

/** Heroines freed: those whose boss battle has been won (her board in a won mission's boss pool). */
export function heroinesFreed(pack: StoryPack, won: readonly string[]): string[] {
  const boards = new Set(pack.casting.heroines.map((h) => h.board))
  const out = new Set<string>()
  for (const c of Object.values(pack.chapters)) for (const m of c.missions) {
    if (!won.includes(m.id)) continue
    for (const e of m.enemies) if (e.slot === 'boss') for (const b of e.pool) if (boards.has(b)) out.add(b)
  }
  return [...out].sort()
}

/** Each faction's standing now: the story's start (−1 when it names none), as moved since, and +1 once three of its
 * heroines are freed; −2 to +2. */
export function standingNow(pack: StoryPack, save: Save): Record<string, number> {
  const freed = heroinesFreed(pack, save.worlds.missions)
  const out: Record<string, number> = {}
  for (const f of factionsOf(pack)) {
    const base = save.standing[f] ?? pack.casting.standing?.[f] ?? SQUAD_TUNING.standing.start
    const n = pack.casting.heroines.filter((h) => h.faction === f && freed.includes(h.board)).length
    out[f] = clampStanding(base + (n >= SQUAD_TUNING.freedForStanding ? 1 : 0))
  }
  return out
}

/** A standing move (a story step, an operation): stored as the faction's value before the heroines' bonus. */
export function moveStandingIn(pack: StoryPack, save: Save, faction: string, by: number): Save {
  const base = save.standing[faction] ?? pack.casting.standing?.[faction] ?? SQUAD_TUNING.standing.start
  return { ...save, standing: { ...save.standing, [faction]: clampStanding(base + by) } }
}

// --- Operations --------------------------------------------------------------------------------------------------------

/** Every operation a world can offer: the story's (needs met, not won yet) and then the generic table's. */
function worldOperations(pack: StoryPack, save: Save, world: string, progress: WorldProgress): Operation[] {
  const w = pack.worlds[world]
  if (!w) return []
  const danger = Math.max(1, Math.min(...w.locations.map((l) => l.danger)))
  const story = (w.operations ?? []).filter((o) => !save.operationsWon.includes(o.id) && (o.needs ?? []).every((k) => keyMet(k, save.story, progress)))
    .map((o) => ({ id: o.id, world, title: o.title, faction: o.faction ?? null, danger: o.danger, watches: o.watches, reward: { ...o.reward } }))
  return [...story, ...genericOperations(world, danger, w.factions[0] ?? null)]
}

/** What Comms offers now: two to four operations on the worlds visited, the current world first, none already running. */
export function offeredOperations(pack: StoryPack, save: Save, progress: WorldProgress): Operation[] {
  const worlds = Object.keys(save.worlds.known).sort((a, b) => (a === save.worlds.current ? -1 : b === save.worlds.current ? 1 : a.localeCompare(b)))
  const running = new Set(save.operations.map((r) => r.id))
  return worlds.flatMap((w) => worldOperations(pack, save, w, progress)).filter((o) => !running.has(o.id)).slice(0, SQUAD_TUNING.offered.max)
}

/** Finds an operation by id (a running one may no longer be offered). */
export function operationById(pack: StoryPack, save: Save, id: string, progress: WorldProgress): Operation | null {
  for (const w of Object.keys(save.worlds.known)) { const o = worldOperations(pack, save, w, progress).find((x) => x.id === id); if (o) return o }
  return null
}

/** The squad's power as the save has it: levels, bond ranks, cohesion and partner pairs. */
export function powerOf(save: Save, squad: Squad): number {
  const m = (o: number) => save.crew.find((x) => x.outfit === o)
  return squadPower(squad, (o) => levelOf(m(o)?.xp ?? 0), (o) => m(o)?.bond.rank ?? 1,
    (a, b) => save.partners.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)))
}

/** Why a squad can't go now, or null: already away, a member resting (Strain 3) or in the mission under way. */
export function sendProblem(save: Save, squad: Squad): string | null {
  if (save.operations.some((r) => r.squad === squad.id)) return `${squad.name} is already away`
  if (save.operations.length >= SQUAD_TUNING.maxSquads) return 'Every squad is away'
  const busy = squad.members.find((o) => save.mission?.squad.includes(o))
  if (busy !== undefined) return `${busy} is in the mission under way`
  const tired = squad.members.find((o) => (save.crew.find((x) => x.outfit === o)?.strain ?? 0) >= STRAIN_REST)
  return tired !== undefined ? `${tired} is resting (Strain 3)` : null
}

/** Sends a squad: back after the operation's watches. */
export function sendSquad(save: Save, squad: Squad, op: Operation): Save {
  if (sendProblem(save, squad)) return save
  return { ...save, operations: [...save.operations, { id: op.id, squad: squad.id, back: save.watch + op.watches }] }
}

/** Resolves one run: the outcome (a recall is always thin), its pay into the wallet, Strain on each member, the
 * faction's standing, and the operation counted as won in full. */
function resolve(pack: StoryPack, save: Save, run: OperationRun, op: Operation, recalled: boolean): { save: Save; report: OpReport } {
  const squad = save.squads.find((s) => s.id === run.squad)
  const outcome: Outcome = recalled || !squad ? 'thin' : outcomeOf(powerOf(save, squad), op.danger)
  const pay = outcomePay(op, outcome)
  let next: Save = {
    ...save, operations: save.operations.filter((r) => r !== run), wallet: earn(save.wallet, pay),
    crew: save.crew.map((m) => (squad?.members.includes(m.outfit) ? { ...m, strain: Math.min(STRAIN_REST, m.strain + pay.strain) } : m)),
    operationsWon: outcome === 'full' && !save.operationsWon.includes(op.id) ? [...save.operationsWon, op.id] : save.operationsWon,
  }
  if (op.faction && pay.standing) next = moveStandingIn(pack, next, op.faction, pay.standing)
  const word = { full: 'a full success', partial: 'a partial success', thin: 'thin pickings' }[outcome]
  const gains = [pay.credits && `+${pay.credits} credits`, pay.alloy && `+${pay.alloy} alloy`, pay.data && `+${pay.data} data`, pay.standing && `${op.faction} ${pay.standing > 0 ? '+' : ''}${pay.standing}`, pay.strain && `+${pay.strain} Strain each`].filter(Boolean).join(', ')
  return { save: next, report: { op: op.id, title: op.title, squad: run.squad, outcome, text: `${squad?.name ?? 'The squad'} is back from ${op.title.toLowerCase()}: ${word}${recalled ? ' (recalled)' : ''}. ${gains}.`.slice(0, 160) } }
}

/** Squads due back by this watch return; each report joins the watch's ship-log card. */
export function returnOperations(pack: StoryPack, save: Save, progress: WorldProgress): { save: Save; reports: OpReport[] } {
  let next = save
  const reports: OpReport[] = []
  for (const run of save.operations.filter((r) => r.back <= save.watch)) {
    const op = operationById(pack, next, run.id, progress)
    if (!op) { next = { ...next, operations: next.operations.filter((r) => r !== run) }; continue }
    const r = resolve(pack, next, run, op, false)
    next = r.save
    reports.push(r.report)
  }
  return { save: next, reports }
}

/** Recalls a squad now (a lead needed for a mission, say): back at once with thin rewards. Never anyone lost. */
export function recallSquad(pack: StoryPack, save: Save, squad: string, progress: WorldProgress): { save: Save; report: OpReport | null } {
  const run = save.operations.find((r) => r.squad === squad)
  const op = run && operationById(pack, save, run.id, progress)
  if (!run || !op) return { save: run ? { ...save, operations: save.operations.filter((r) => r !== run) } : save, report: null }
  return resolve(pack, save, run, op, true)
}

// --- Readiness (TC64) --------------------------------------------------------------------------------------------------

/** The battle systems built (level 1 or more). */
export const systemsBuilt = (save: Save): SystemId[] =>
  save.ship.modules.filter((m) => m.level >= 1 && MODULES_BY_ID.get(m.id)?.kind === 'system').map((m) => m.id as SystemId)

/** The ship's readiness for the next finale: standings, operations won in full, battle systems built. */
export const readinessNow = (pack: StoryPack, save: Save): number => readinessOf(standingNow(pack, save), save.operationsWon.length, systemsBuilt(save).length)
