// Squads, operations, faction standing and readiness (CY18, TC69–TC71, TC64). Squads are named groups of the crew that
// grow cohesion by fighting together; a squad not deployed can run an operation on the star map, back after its watches
// with a deterministic outcome; each faction has a standing with the ship; and a finale measures the ship's readiness.
// Pure. Never anyone lost, never permadeath, no real-time timers. Every number in one table (D31).

export interface Squad { id: string; name: string; banner: string; leader: number; members: number[]; cohesion: number }
export interface Operation { id: string; world: string; title: string; faction: string | null; danger: number; watches: number; reward: { credits: number; alloy: number; data: number; standing: number } }
export interface OperationRun { id: string; squad: string; back: number }
export type Outcome = 'full' | 'partial' | 'thin'

/** Every CY18 number in one table (D31). */
export const SQUAD_TUNING = {
  maxSquads: 4, maxMembers: 4,
  /** Battles fought together (three or more members deployed) for cohesion levels 1–5. */
  cohesion: [2, 5, 9, 14, 20] as const,
  /** Operations offered at once on the visited worlds, and how many the generic table gives a world. */
  offered: { min: 2, max: 4 },
  /** A squad's power for an operation: a member's level, her bond rank, the squad's cohesion level, a partner pair. */
  power: { level: 1, bond: 2, cohesion: 3, partners: 4 },
  /** Power against danger × this: at least full, at least partial, else thin. */
  outcome: { full: 12, partial: 8 },
  /** What partial and thin pay, as a share of the full reward; and their Strain. */
  share: { partial: 0.6, thin: 0.3 }, strain: { partial: 1, thin: 1 },
  /** Faction standing's range and the default start. */
  standing: { min: -2, max: 2, start: -1 },
  /** Heroines freed from a faction for its +1. */
  freedForStanding: 3,
  /** Readiness points: each standing level above hostile, each operation won in full, each battle system built. */
  readiness: { standing: 2, operation: 3, system: 4 },
} as const

export const cohesionLevel = (battles: number): number => SQUAD_TUNING.cohesion.filter((t) => battles >= t).length

// --- Squads ------------------------------------------------------------------------------------------------------------

/** A new game's squad: the crew aboard (up to four), led by the first. */
export function firstSquad(crew: readonly number[]): Squad[] {
  return crew.length ? [{ id: 'squad-1', name: 'First Squad', banner: 'cyan', leader: crew[0]!, members: crew.slice(0, SQUAD_TUNING.maxMembers), cohesion: 0 }] : []
}
export const squadOf = (squads: readonly Squad[], outfit: number): Squad | null => squads.find((s) => s.members.includes(outfit)) ?? null

/** Why a squad can't be set this way, or null: four members at most, an Uma in one squad at a time, four squads at most. */
export function squadProblem(squads: readonly Squad[], next: Squad): string | null {
  if (next.members.length === 0 || next.members.length > SQUAD_TUNING.maxMembers) return `One to ${SQUAD_TUNING.maxMembers} members`
  if (!next.members.includes(next.leader)) return 'The leader is a member'
  if (!next.name.trim() || next.name.length > 24) return 'A name of 1–24 characters'
  const others = squads.filter((s) => s.id !== next.id)
  if (others.length >= SQUAD_TUNING.maxSquads && !squads.some((s) => s.id === next.id)) return `${SQUAD_TUNING.maxSquads} squads at most`
  const clash = next.members.find((m) => others.some((s) => s.members.includes(m)))
  return clash !== undefined ? `${clash} is already in another squad` : null
}
export function setSquad(squads: readonly Squad[], next: Squad): Squad[] {
  if (squadProblem(squads, next)) return [...squads]
  return squads.some((s) => s.id === next.id) ? squads.map((s) => (s.id === next.id ? next : s)) : [...squads, next]
}

/** Canonical squads (the casting's `squads`): each seeded when a newcomer completes it aboard, taking its members from
 * their squads; never from a squad away on an operation (`away`, squad ids), and never later behind the player's back:
 * the Quarters arrange it then. */
export function seedSquads(squads: readonly Squad[], canonical: readonly Omit<Squad, 'cohesion'>[], aboard: readonly number[], away: readonly string[] = []): Squad[] {
  let out = [...squads]
  for (const c of canonical) {
    if (out.some((s) => s.id === c.id) || !c.members.every((m) => aboard.includes(m))) continue
    if (out.some((s) => away.includes(s.id) && s.members.some((m) => c.members.includes(m)))) continue
    // A canonical squad takes its members from wherever they were (the first squad of a new game, usually).
    out = out.map((s) => ({ ...s, members: s.members.filter((m) => !c.members.includes(m)) })).filter((s) => s.members.length > 0)
      .map((s) => (s.members.includes(s.leader) ? s : { ...s, leader: s.members[0]! }))
    if (out.length < SQUAD_TUNING.maxSquads) out.push({ ...c, cohesion: 0 })
  }
  return out
}

const ORDINAL = ['First', 'Second', 'Third', 'Fourth'] as const
export const BANNERS = ['cyan', 'magenta', 'amber', 'lime'] as const

/** A newcomer's squad: canonical squads seed first; else she joins the first squad with room that isn't away; else a new
 * squad while there are fewer than four; else none (the Quarters place her). */
export function placeNewcomer(squads: readonly Squad[], canonical: readonly Omit<Squad, 'cohesion'>[], aboard: readonly number[], outfit: number, away: readonly string[] = []): Squad[] {
  const out = seedSquads(squads, canonical, aboard, away)
  if (squadOf(out, outfit)) return out
  const room = out.find((s) => s.members.length < SQUAD_TUNING.maxMembers && !away.includes(s.id))
  if (room) return out.map((s) => (s === room ? { ...s, members: [...s.members, outfit] } : s))
  return out.length < SQUAD_TUNING.maxSquads ? [...out, newSquad(out, outfit)] : out
}

/** A new squad led by an Uma: the first free id, an ordinal name and a banner not yet flown. */
export function newSquad(squads: readonly Squad[], leader: number): Squad {
  let k = 1
  while (squads.some((s) => s.id === `squad-${k}`)) k++
  const banner = BANNERS.find((b) => !squads.some((s) => s.banner === b)) ?? 'cyan'
  return { id: `squad-${k}`, name: `${ORDINAL[squads.length] ?? 'Spare'} Squad`, banner, leader, members: [leader], cohesion: 0 }
}

/** Takes an Uma out of her squad (an empty squad is disbanded; a leader leaving hands over to the next member). */
export function leaveSquad(squads: readonly Squad[], outfit: number): Squad[] {
  return squads.map((s) => ({ ...s, members: s.members.filter((m) => m !== outfit) })).filter((s) => s.members.length > 0)
    .map((s) => (s.members.includes(s.leader) ? s : { ...s, leader: s.members[0]! }))
}

/** After a battle: +1 cohesion for each squad with three or more members deployed. */
export function cohesionAfter(squads: readonly Squad[], deployed: readonly number[]): Squad[] {
  return squads.map((s) => (s.members.filter((m) => deployed.includes(m)).length >= 3 ? { ...s, cohesion: s.cohesion + 1 } : s))
}

// --- Operations (TC70) ---------------------------------------------------------------------------------------------------

const hash = (s: string): number => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)

/** The generic operations a world offers (invented, in git), shaped by its danger. */
export function genericOperations(world: string, danger: number, faction: string | null): Operation[] {
  const kinds = [
    { key: 'escort', title: 'Escort a convoy', watches: 2, reward: { credits: 120, alloy: 10, data: 5 } },
    { key: 'salvage', title: 'Salvage a wreck', watches: 2, reward: { credits: 40, alloy: 30, data: 0 } },
    { key: 'recon', title: 'Recon the outskirts', watches: 1, reward: { credits: 30, alloy: 0, data: 20 } },
    { key: 'raid', title: 'Raid a supply cache', watches: 3, reward: { credits: 160, alloy: 25, data: 10 } },
  ]
  const n = SQUAD_TUNING.offered.min + (hash(world) % (SQUAD_TUNING.offered.max - SQUAD_TUNING.offered.min + 1))
  return kinds.slice(0, n).map((k, i) => ({
    id: `${world}-${k.key}`, world, title: k.title, faction: k.key === 'raid' ? faction : null, danger: Math.max(1, danger + (i === 3 ? 1 : 0)),
    watches: k.watches, reward: { ...k.reward, standing: k.key === 'raid' ? -1 : 0 },
  }))
}

/** A squad's power for an operation: levels, bond ranks, cohesion and a partner pair inside it, in a fixed formula. */
export function squadPower(squad: Squad, levelOf: (o: number) => number, rankOf: (o: number) => number, partnered: (a: number, b: number) => boolean): number {
  const t = SQUAD_TUNING.power
  let p = squad.members.reduce((n, m) => n + t.level * levelOf(m) + t.bond * rankOf(m), 0) + t.cohesion * cohesionLevel(squad.cohesion)
  for (let i = 0; i < squad.members.length; i++) for (let j = i + 1; j < squad.members.length; j++) if (partnered(squad.members[i]!, squad.members[j]!)) p += t.partners
  return p
}

/** The outcome, deterministic: power against danger. */
export function outcomeOf(power: number, danger: number): Outcome {
  if (power >= SQUAD_TUNING.outcome.full * danger) return 'full'
  return power >= SQUAD_TUNING.outcome.partial * danger ? 'partial' : 'thin'
}

/** What an outcome pays (a share of the full reward; standing only in full) and the Strain it costs each member. */
export function outcomePay(op: Operation, outcome: Outcome): { credits: number; alloy: number; data: number; standing: number; strain: number } {
  const share = outcome === 'full' ? 1 : SQUAD_TUNING.share[outcome]
  const r = op.reward
  return {
    credits: Math.round(r.credits * share), alloy: Math.round(r.alloy * share), data: Math.round(r.data * share),
    standing: outcome === 'full' ? r.standing : 0, strain: outcome === 'full' ? 0 : SQUAD_TUNING.strain[outcome],
  }
}

/** Members away on an operation can't deploy (they hold posts at half). */
export const awayMembers = (runs: readonly OperationRun[], squads: readonly Squad[]): number[] =>
  runs.flatMap((r) => squads.find((s) => s.id === r.squad)?.members ?? [])

// --- Standing (TC71) and readiness (TC64) ---------------------------------------------------------------------------------

export const clampStanding = (n: number): number => Math.max(SQUAD_TUNING.standing.min, Math.min(SQUAD_TUNING.standing.max, n))
export const STANDING_NAME: Record<string, string> = { '-2': 'Hostile', '-1': 'Wary', '0': 'Neutral', '1': 'Friendly', '2': 'Allied' }
export function moveStanding(standing: Readonly<Record<string, number>>, faction: string, by: number): Record<string, number> {
  return { ...standing, [faction]: clampStanding((standing[faction] ?? SQUAD_TUNING.standing.start) + by) }
}

/** Readiness: standing above hostile, operations won in full, battle systems built, each worth points (a domain table). */
export function readinessOf(standing: Readonly<Record<string, number>>, operationsWon: number, systemsBuilt: number): number {
  const t = SQUAD_TUNING.readiness
  const fromStanding = Object.values(standing).reduce((n, v) => n + t.standing * (v - SQUAD_TUNING.standing.min), 0)
  return fromStanding + t.operation * operationsWon + t.system * systemsBuilt
}

export type FinaleCondition = 'fog' | 'hazards' | 'no-reinforcements'
export type ReadinessNeed = { system: string; else: FinaleCondition } | { standing: string; at: number; else: FinaleCondition } | { total: number; else: FinaleCondition }

/** Which of a finale's readiness needs are unmet now: each adds its harsh condition to the battle. Never permadeath. */
export function unmetNeeds(needs: readonly ReadinessNeed[], ctx: { systems: readonly string[]; standing: Readonly<Record<string, number>>; total: number }): ReadinessNeed[] {
  return needs.filter((n) => ('system' in n ? !ctx.systems.includes(n.system) : 'standing' in n ? (ctx.standing[n.standing] ?? SQUAD_TUNING.standing.start) < n.at : ctx.total < n.total))
}
