// Duties (CY16, TC67, TC68): posts in the ship's modules, each held by one Uma until changed; aptitude by band thresholds,
// a matching role's perk, her running style as tenure, mastery stars, station chiefs; one output a watch per post, all on
// one ship-log card; auto-assign and presets so it never becomes a chore; camaraderie between Umas posted together; the
// cook's meal for the next battle. Deterministic: no failure rolls. Every number in one table (D27).
import type { Bands, Role } from '@cyber/battle'
import type { Strategy } from '@luismlorenzana/uma-data'
import { MODULES_BY_ID, type ModuleId } from './modules'
import { moduleLevel, type Ship } from './hull'

export type PostKind = 'pilot' | 'navigator' | 'engineer' | 'mechanic' | 'archivist' | 'trader' | 'signals' | 'coach' | 'researcher' | 'medic' | 'cook' | 'artisan'
  | 'gardener' | 'gunner' | 'stargazer'
export type Yield = 'credits' | 'alloy' | 'data' | 'item' | 'plant' | 'strain' | 'meal' | 'build' | 'xp' | 'none'

export interface PostDef {
  kind: PostKind
  name: string
  /** The band (or two: the better counts) the post asks for. */
  bands: readonly (keyof Bands)[]
  /** A role whose holder gets the named perk. */
  role?: Role
  perk: string
  /** What it makes a watch, and how much at full output. */
  yields: Yield
  amount: number
  /** What a watch at band 4–5 adds. */
  extra: string
  does: string
}

export const POSTS: Readonly<Record<PostKind, PostDef>> = {
  pilot: { kind: 'pilot', name: 'Pilot', bands: ['speed'], role: 'striker', perk: 'Jump events lean her way', yields: 'credits', amount: 20, extra: 'A better choice in jump events', does: 'Flies the jumps: charter fees, and she answers the jump events that ask for a pilot' },
  navigator: { kind: 'navigator', name: 'Navigator', bands: ['wit'], role: 'gunner', perk: 'Reads a world’s threats sooner', yields: 'data', amount: 6, extra: 'Navigation data doubles', does: 'Charts the next jump: Data, and the events that ask for a navigator' },
  engineer: { kind: 'engineer', name: 'Engineer', bands: ['power', 'wit'], role: 'vanguard', perk: 'Builds go a watch faster still', yields: 'build', amount: 1, extra: 'A second build moves faster too', does: 'Moves the builds on: a build a watch faster' },
  mechanic: { kind: 'mechanic', name: 'Mechanic', bands: ['power'], role: 'vanguard', perk: 'Salvages more', yields: 'alloy', amount: 10, extra: 'More Alloy from the scrap', does: 'Strips salvage: Alloy' },
  archivist: { kind: 'archivist', name: 'Archivist', bands: ['wit'], role: 'netrunner', perk: 'Decrypts more', yields: 'data', amount: 10, extra: 'More Data from the records', does: 'Works the records: Data' },
  trader: { kind: 'trader', name: 'Trader', bands: ['guts', 'wit'], role: 'striker', perk: 'Haggles harder', yields: 'credits', amount: 60, extra: 'Better margins', does: 'Runs the Store: credits' },
  signals: { kind: 'signals', name: 'Signals', bands: ['wit'], role: 'netrunner', perk: 'Picks up more traffic', yields: 'data', amount: 6, extra: 'Clearer intercepts', does: 'Listens in: Data and intel' },
  coach: { kind: 'coach', name: 'Coach', bands: ['guts', 'stamina'], role: 'medic', perk: 'Drills the whole bench', yields: 'xp', amount: 20, extra: 'Harder drills', does: 'Drills the bench: XP for every Uma resting' },
  researcher: { kind: 'researcher', name: 'Researcher', bands: ['wit'], role: 'netrunner', perk: 'Finds shortcuts', yields: 'data', amount: 8, extra: 'More Data for the projects', does: 'Feeds the Lab: Data' },
  medic: { kind: 'medic', name: 'Medic', bands: ['stamina'], role: 'medic', perk: 'Treats one more', yields: 'strain', amount: 1, extra: 'Treats one more', does: 'Treats the most strained Uma: a point of Strain off' },
  cook: { kind: 'cook', name: 'Cook', bands: ['guts', 'stamina'], role: 'medic', perk: 'Cooks for a crowd', yields: 'meal', amount: 1, extra: 'A richer dish', does: 'Cooks the next battle’s meal (played in CY17)' },
  artisan: { kind: 'artisan', name: 'Artisan', bands: ['power', 'wit'], role: 'netrunner', perk: 'Works faster', yields: 'item', amount: 1, extra: 'A piece every watch', does: 'Makes a piece of furniture every two watches' },
  gardener: { kind: 'gardener', name: 'Gardener', bands: ['stamina'], role: 'medic', perk: 'Green fingers', yields: 'plant', amount: 1, extra: 'A plant every watch', does: 'Grows a plant gift every two watches' },
  gunner: { kind: 'gunner', name: 'Gunner', bands: ['power'], role: 'gunner', perk: 'The orbital strike hits harder (CY17)', yields: 'alloy', amount: 5, extra: 'Keeps the Battery warm', does: 'Crews the Battery: some Alloy from target practice' },
  stargazer: { kind: 'stargazer', name: 'Stargazer', bands: ['wit', 'stamina'], perk: 'Calms the crew', yields: 'strain', amount: 1, extra: 'Calms another', does: 'Rests at the window: sheds her own Strain' },
}
export const POST_KINDS = Object.keys(POSTS) as PostKind[]

/** Each module's posts, in order: a module at level L holds its first `postsAt` of them. */
export const MODULE_POSTS: Partial<Record<ModuleId, readonly PostKind[]>> = {
  bridge: ['pilot', 'navigator', 'pilot'], engineering: ['engineer', 'engineer', 'engineer'], hangar: ['mechanic', 'mechanic', 'mechanic'],
  log: ['archivist', 'archivist', 'archivist'], store: ['trader', 'trader', 'trader'], comms: ['signals', 'signals', 'signals'], simpod: ['coach', 'coach', 'coach'],
  lab: ['researcher', 'researcher', 'researcher'], medbay: ['medic', 'medic', 'medic'], galley: ['cook', 'cook', 'cook'], workshop: ['artisan', 'artisan', 'artisan'],
  garden: ['gardener', 'gardener', 'gardener'], observation: ['stargazer', 'stargazer', 'stargazer'],
  battery: ['gunner'], sensors: ['navigator'], shield: ['engineer'], drones: ['mechanic'], engines: ['pilot'],
}

/** Every duty number in one table (D27). */
export const DUTY_TUNING = {
  half: 0.5, deployed: 0.5,
  late: { after: 2, bonus: 0.5 }, end: { step: 0.1, cap: 0.5 },
  stars: [3, 8, 15] as const, starBonus: 0.1, chief: 0.25,
  likedRapport: 5, camaraderie: 1,
  /** A jump draws an event one time in this many (by a fixed hash). */
  eventEvery: 3,
} as const

export interface Post { module: ModuleId; index: number }
export interface HeldPost extends Post { since: number; mastery: number }
export const postKey = (p: Post) => `${p.module}:${p.index}`

/** Every post the ship holds now: each running module's first `postsAt` posts. */
export function shipPosts(ship: Ship): (Post & { kind: PostKind })[] {
  const out: (Post & { kind: PostKind })[] = []
  for (const m of ship.modules) {
    const kinds = MODULE_POSTS[m.id], def = MODULES_BY_ID.get(m.id)!
    if (!kinds || m.level < 1) continue
    const n = def.kind === 'system' ? 1 : Math.min(kinds.length, m.level)
    for (let index = 0; index < n; index++) out.push({ module: m.id, index, kind: kinds[index]! })
  }
  return out
}
export const postKind = (p: Post): PostKind | null => MODULE_POSTS[p.module]?.[p.index] ?? null

/** Aptitude (TC67) as a three-step mark: 1 works at half (band 2 or less), 2 does the job (band 3), 3 adds its extra (4–5). */
export function aptitude(kind: PostKind, bands: Bands): 1 | 2 | 3 {
  const best = Math.max(...POSTS[kind].bands.map((b) => bands[b]))
  return best >= 4 ? 3 : best === 3 ? 2 : 1
}

/** Her running style's tenure at a post she's held `watches` watches in a row (counting this one). */
export function tenure(style: Strategy | null, watches: number): number {
  if (style === 'late') return watches > DUTY_TUNING.late.after ? 1 + DUTY_TUNING.late.bonus : 1
  if (style === 'end') return 1 + Math.min(DUTY_TUNING.end.cap, DUTY_TUNING.end.step * Math.max(0, watches - 1))
  return 1
}
export const stars = (mastery: number): number => DUTY_TUNING.stars.filter((t) => mastery >= t).length

export interface Worker { outfit: number; bands: Bands; role: Role; style: Strategy | null; post: HeldPost; deployed: boolean; chief: ModuleId | null; liked: PostKind | null }

/** Her output's factor this watch: aptitude (half at band 2 or less), tenure, mastery stars, a chief's share, and half when
 * she was deployed in the battle that ends the watch (a Pace Chaser never halves). */
export function outputFactor(w: Worker, watch: number): number {
  const kind = postKind(w.post)
  if (!kind) return 0
  const apt = aptitude(kind, w.bands) === 1 ? DUTY_TUNING.half : 1
  const held = watch - w.post.since + 1
  const deployed = w.deployed && w.style !== 'pace' ? DUTY_TUNING.deployed : 1
  const chief = w.chief === w.post.module ? 1 + DUTY_TUNING.chief : 1
  return apt * tenure(w.style, held) * (1 + DUTY_TUNING.starBonus * stars(w.post.mastery)) * deployed * chief
}

/** Her liked duty (CY14's tastes gain it): the post that asks for her best band. */
export function likedDuty(bands: Bands): PostKind {
  const order: (keyof Bands)[] = ['speed', 'stamina', 'power', 'guts', 'wit']
  const best = order.reduce((a, b) => (bands[b] > bands[a] ? b : a))
  return ({ speed: 'pilot', stamina: 'medic', power: 'mechanic', guts: 'trader', wit: 'archivist' } as const)[best]
}

// --- Meals (TC64's battle meals, played by CY17) ---------------------------------------------------------------------------

export type Meal = 'noodles' | 'stew' | 'skewers' | 'curry' | 'salad' | 'feast'
export const MEALS: Readonly<Record<Meal, { name: string; does: string }>> = {
  noodles: { name: 'Night-market noodles', does: '+1 Move on the first turn' }, stew: { name: 'Hull-heater stew', does: '+10% Core HP' },
  skewers: { name: 'Neon skewers', does: '+5% melee damage' }, curry: { name: 'Docker’s curry', does: '+1 Charge at the start' },
  salad: { name: 'Hydroponic salad', does: '+5% hit' }, feast: { name: 'Captain’s feast', does: 'Two of the above' },
}
/** The cook's dish, by her best band; a feast at band 5. */
export function mealOf(bands: Bands): Meal {
  const order: (keyof Bands)[] = ['speed', 'stamina', 'power', 'guts', 'wit']
  const best = order.reduce((a, b) => (bands[b] > bands[a] ? b : a))
  if (bands[best] >= 5) return 'feast'
  return ({ speed: 'noodles', stamina: 'stew', power: 'skewers', guts: 'curry', wit: 'salad' } as const)[best]
}

// --- Auto-assign (TC68) ------------------------------------------------------------------------------------------------

export interface Candidate { outfit: number; bands: Bands; role: Role; mastery: Partial<Record<string, number>>; liked: PostKind | null; strain: number }

/**
 * Fills every post with the best fit among those not deployed (TC68): aptitude, then mastery at that post, then her liked
 * duty, then the earlier outfit. An Uma at Strain 3 goes to the Med Bay or the Observation Deck first when one is open.
 * Returns outfit → post; anyone left over holds none. Deterministic.
 */
export function autoAssign(posts: readonly (Post & { kind: PostKind })[], crew: readonly Candidate[], deployed: readonly number[]): Map<number, Post> {
  const free = crew.filter((c) => !deployed.includes(c.outfit))
  const out = new Map<number, Post>()
  const taken = new Set<string>()
  const restful = posts.filter((p) => p.module === 'medbay' || p.module === 'observation')
  for (const c of free.filter((x) => x.strain >= 3)) {
    const p = restful.find((x) => !taken.has(postKey(x)))
    if (p) { out.set(c.outfit, { module: p.module, index: p.index }); taken.add(postKey(p)) }
  }
  const score = (c: Candidate, p: Post & { kind: PostKind }) =>
    aptitude(p.kind, c.bands) * 1000 + (POSTS[p.kind].role === c.role ? 100 : 0) + Math.min(99, c.mastery[postKey(p)] ?? 0) + (c.liked === p.kind ? 1 : 0)
  // Greedy over every (Uma, post) pair, best first; on a tie, the post fewer Umas fit at their best goes first, so a
  // specialist isn't spent on a post someone else could hold.
  const scarcity = new Map(posts.map((p) => [postKey(p), free.filter((c) => aptitude(p.kind, c.bands) === 3).length]))
  const pairs = posts.flatMap((p) => free.map((c) => ({ p, c, s: score(c, p) })))
    .sort((a, b) => b.s - a.s || scarcity.get(postKey(a.p))! - scarcity.get(postKey(b.p))! || a.c.outfit - b.c.outfit || postKey(a.p).localeCompare(postKey(b.p)))
  for (const { p, c } of pairs) {
    if (out.has(c.outfit) || taken.has(postKey(p))) continue
    out.set(c.outfit, { module: p.module, index: p.index })
    taken.add(postKey(p))
  }
  return out
}

/** A module's posts that are held by more than one Uma at once: two Umas on one room's posts build camaraderie (TC58). */
export const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
export function partnersOn(held: readonly { outfit: number; post: Post }[]): string[] {
  const by = new Map<ModuleId, number[]>()
  for (const h of held) by.set(h.post.module, [...(by.get(h.post.module) ?? []), h.outfit])
  return [...by.values()].flatMap((os) => os.flatMap((a, i) => os.slice(i + 1).map((b) => pairKey(a, b)))).sort()
}

/** The Engines' and Bridge's pilot, if any: who answers a jump event that asks for one. */
export const holderOf = (held: readonly { outfit: number; post: Post }[], kind: PostKind): number | null =>
  held.find((h) => postKind(h.post) === kind)?.outfit ?? null

export const shipHasPost = (ship: Ship, p: Post): boolean => moduleLevel(ship, p.module) >= 1 && shipPosts(ship).some((x) => postKey(x) === postKey(p))
