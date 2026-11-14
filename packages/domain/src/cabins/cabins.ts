// Cabins (CY14, TC60, TC61): every Uma's cabin with six slots, her tastes (from the story, else derived), Comfort, and
// the visit: talk, a gift, decorating together, an invitation out. Pure; the screens and the save call these.
import type { Bands, Role } from '@cyber/battle'
import type { Strategy } from '@luismlorenzana/uma-data'
import {
  FURNITURE, GIFT_KINDS, ITEMS_BY_ID, LINE_SLOTS, OPPOSITE, placeable, SLOTS, DECOR_STYLES, TOPICS, type Cabin, type Furniture, type GiftKind, type Item, type Keepsake,
  type Reveal, type Slot, type Style, type Topic,
} from './items'

// --- Tastes ------------------------------------------------------------------------------------------------------------

export interface Tastes { favourite: Style; disliked: Style; gift: GiftKind; topics: [Topic, Topic] }

const hash = (n: number, salt: number): number => {
  let h = (n ^ (salt * 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}
const STYLE_INDEX: Record<Strategy, number> = { front: 3, pace: 1, late: 4, end: 5 }
const ROLE_GIFT: Record<Role, GiftKind> = { vanguard: 'gear', striker: 'snacks', gunner: 'music', netrunner: 'books', medic: 'plants' }
const STRATEGY_TOPIC: Record<Strategy, Topic> = { front: 'racing', pace: 'training', late: 'stars', end: 'games' }
const BAND_TOPIC: Record<keyof Bands, Topic> = { speed: 'racing', stamina: 'nature', power: 'food', guts: 'crew', wit: 'tech' }

/**
 * Her tastes when the story writes none (TC61): a fixed table over what the game knows of her, so the same Uma always
 * derives the same tastes. Her running style picks the favourite style, nudged by her role; the disliked style is its
 * opposite. Her role picks the gift kind (a keepsake for one in six, by her id). Her running style and her best band pick
 * the two topics. An Uma with no known running style derives everything from her id.
 */
export function deriveTastes(outfit: number, style: Strategy | null, role: Role, bands: Bands): Tastes {
  const roleShift = (['vanguard', 'striker', 'gunner', 'netrunner', 'medic'] as const).indexOf(role)
  const favourite = DECOR_STYLES[style ? (STYLE_INDEX[style] + (roleShift === 4 ? 1 : 0)) % DECOR_STYLES.length : hash(outfit, 1) % DECOR_STYLES.length]!
  const gift = hash(outfit, 2) % 6 === 0 ? 'keepsakes' : style ? ROLE_GIFT[role] : GIFT_KINDS[hash(outfit, 3) % GIFT_KINDS.length]!
  const best = (Object.keys(bands) as (keyof Bands)[]).reduce((a, b) => (bands[b] > bands[a] ? b : a))
  let first: Topic = style ? STRATEGY_TOPIC[style] : TOPICS[hash(outfit, 4) % TOPICS.length]!
  let second: Topic = style ? BAND_TOPIC[best] : TOPICS[hash(outfit, 5) % TOPICS.length]!
  if (second === first) second = TOPICS[(TOPICS.indexOf(first) + 1 + (hash(outfit, 6) % (TOPICS.length - 1))) % TOPICS.length]!
  if (second === first) first = 'home'
  return { favourite, disliked: OPPOSITE[favourite], gift, topics: [first, second] }
}

/** Her tastes: the casting's when the story writes them (`tastes` by outfit id), else derived. */
export const tastesOf = (written: Tastes | undefined, outfit: number, style: Strategy | null, role: Role, bands: Bands): Tastes =>
  written ?? deriveTastes(outfit, style, role, bands)

// --- The cabin ---------------------------------------------------------------------------------------------------------

/** Every Comfort number in one table (D25). */
export const COMFORT_TUNING = {
  favourite: 2, disliked: -1, set: 2,
  /** The points each light needs: five lights in all. */
  lights: [6, 10, 14, 18, 22] as const,
  /** At this many lights, resting through a mission sheds 1 Strain even below 3; at `clears`, all of it. */
  sheds: 3, clears: 5,
  /** A visit at this many lights earns half again as much rapport. */
  visitBonus: 4, visitFactor: 1.5,
} as const

export interface Comfort { points: number; lights: number; set: Style | null }

/** Her cabin's Comfort (TC61): each item's comfort, +2 each in her favourite style, −1 each in the one she dislikes, +2 for
 * a full line of one style; five lights by the thresholds. */
export function comfortOf(cabin: Cabin, tastes: Tastes): Comfort {
  let points = 0
  const styles: (Style | null)[] = []
  for (const slot of SLOTS) {
    const item = cabin.slots[slot] ? ITEMS_BY_ID.get(cabin.slots[slot]!) : undefined
    if (!placeable(item)) { if (slot !== 'keepsake') styles.push(null); continue }
    points += item.comfort
    if (item.kind === 'furniture') {
      styles.push(item.style)
      if (item.style === tastes.favourite) points += COMFORT_TUNING.favourite
      if (item.style === tastes.disliked) points += COMFORT_TUNING.disliked
    }
  }
  const set = styles.length === LINE_SLOTS.length && styles.every((s) => s && s === styles[0]) ? styles[0]! : null
  if (set) points += COMFORT_TUNING.set
  points = Math.max(0, points)
  return { points, lights: COMFORT_TUNING.lights.filter((t) => points >= t).length, set }
}

/** Strain after resting through a mission (TC61 on TC27): Comfort 5 clears it; Comfort 3 sheds 1 even below 3; Strain 3
 * always clears. */
export function restedStrain(strain: number, lights: number): number {
  if (strain >= 3 || lights >= COMFORT_TUNING.clears) return 0
  if (lights >= COMFORT_TUNING.sheds) return Math.max(0, strain - 1)
  return strain
}

export type Stock = Record<string, number>

/** Places an item from the stock in her cabin; the item it replaces goes back to the stock. Null when it can't. */
export function place(cabin: Cabin, stock: Stock, slot: Slot, itemId: string | null): { cabin: Cabin; stock: Stock } | null {
  const next = { ...stock }
  if (itemId !== null) {
    const item = ITEMS_BY_ID.get(itemId)
    if (!placeable(item) || item.slot !== slot || (next[itemId] ?? 0) < 1) return null
    next[itemId] = next[itemId]! - 1
    if (next[itemId] === 0) delete next[itemId]
  }
  const old = cabin.slots[slot]
  if (old) next[old] = (next[old] ?? 0) + 1
  return { cabin: { ...cabin, slots: { ...cabin.slots, [slot]: itemId } }, stock: next }
}

/** What she'd pick for a slot from the stock (TC61's decorate): her favourite style first, then the most comfort, never her
 * disliked style if anything else fits; null when the stock holds nothing for it. */
export function pickFor(slot: Slot, stock: Stock, tastes: Tastes): Furniture | Keepsake | null {
  const options = [...Object.keys(stock)].map((id) => ITEMS_BY_ID.get(id)).filter((i): i is Furniture | Keepsake => placeable(i) && i.slot === slot && (stock[i.id] ?? 0) > 0)
  const score = (i: Furniture | Keepsake) => i.comfort + (i.kind === 'furniture' ? (i.style === tastes.favourite ? 10 : i.style === tastes.disliked ? -10 : 0) : 0)
  return options.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0] ?? null
}

/** A theme kit (TC61): one tap furnishes every regular slot from the stock in her favourite style where the stock has it,
 * keeping what's there otherwise. */
export function themeKit(cabin: Cabin, stock: Stock, tastes: Tastes): { cabin: Cabin; stock: Stock } {
  let state = { cabin, stock }
  for (const slot of LINE_SLOTS) {
    const want = FURNITURE.find((f) => f.slot === slot && f.style === tastes.favourite)!
    if (state.cabin.slots[slot] === want.id || (state.stock[want.id] ?? 0) < 1) continue
    state = place(state.cabin, state.stock, slot, want.id) ?? state
  }
  return state
}

export const reveal = (cabin: Cabin, r: Reveal): Cabin => (cabin.revealed.includes(r) ? cabin : { ...cabin, revealed: [...cabin.revealed, r] })

// --- Visits ------------------------------------------------------------------------------------------------------------

/** Every visit number in one table (D25). */
export const VISIT_TUNING = {
  perWatch: 3,
  talkLoved: 30, talkOther: 15, giftFavourite: 40, giftOther: 15, decorate: 20, decorateFavourite: 30, invite: 40, request: 30,
  /** The bond rank that opens invitations. */
  inviteRank: 4,
  /** One visit in this many ends with a request (by a fixed hash, so a replayed visit asks the same). */
  requestEvery: 5,
} as const

export interface Visits { watch: number; used: number }
/** Visits left this watch: three, reset when the watch moves on. */
export const visitsLeft = (visits: Visits, watch: number): number => (visits.watch === watch ? Math.max(0, VISIT_TUNING.perWatch - visits.used) : VISIT_TUNING.perWatch)
export const useVisit = (visits: Visits, watch: number): Visits => ({ watch, used: (visits.watch === watch ? visits.used : 0) + 1 })

/** The three topics a talk offers (TC61): two in three visits one of them is a topic she loves, by a fixed hash. */
export function talkTopics(tastes: Tastes, outfit: number, watch: number, used: number): Topic[] {
  const seed = hash(outfit * 7 + watch * 3 + used, 9)
  const others = TOPICS.filter((t) => !tastes.topics.includes(t))
  const start = seed % others.length
  const picks = [0, 3, 7].map((k) => others[(start + k) % others.length]!)
  if (seed % 3 !== 0) picks[(seed >>> 2) % 3] = tastes.topics[(seed >>> 4) % 2]!
  return picks
}

/** A visit's rapport before the bond's catch-up: half again at Comfort 4+. */
export const visitRapport = (base: number, lights: number): number =>
  Math.round(base * (lights >= COMFORT_TUNING.visitBonus ? COMFORT_TUNING.visitFactor : 1))

export const talkRapport = (topic: Topic, tastes: Tastes): number => (tastes.topics.includes(topic) ? VISIT_TUNING.talkLoved : VISIT_TUNING.talkOther)
export const giftRapport = (item: Item | undefined, tastes: Tastes): number => (item?.kind === 'gift' && item.gift === tastes.gift ? VISIT_TUNING.giftFavourite : VISIT_TUNING.giftOther)
export const decorateRapport = (item: Item | undefined, tastes: Tastes): number =>
  (item?.kind === 'furniture' && item.style === tastes.favourite ? VISIT_TUNING.decorateFavourite : VISIT_TUNING.decorate)

/** Whether a visit ends with a request, and for which slot (an empty one first). */
export function visitRequest(cabin: Cabin, outfit: number, watch: number, used: number): Slot | null {
  if (cabin.request) return null
  const h = hash(outfit * 13 + watch * 5 + used, 11)
  if (h % VISIT_TUNING.requestEvery !== 0) return null
  const empty = LINE_SLOTS.filter((s) => !cabin.slots[s])
  const from = empty.length ? empty : LINE_SLOTS
  return from[(h >>> 4) % from.length]!
}

/** Granting her request with an item from the stock: the slot filled, the request cleared. Null when the item doesn't fit. */
export function grantRequest(cabin: Cabin, stock: Stock, itemId: string): { cabin: Cabin; stock: Stock } | null {
  if (!cabin.request) return null
  const placed = place(cabin, stock, cabin.request, itemId)
  return placed ? { cabin: { ...placed.cabin, request: null }, stock: placed.stock } : null
}

/** Gives a gift from the stock: one fewer, or null when the stock has none. */
export function takeGift(stock: Stock, itemId: string): Stock | null {
  const item = ITEMS_BY_ID.get(itemId)
  if (item?.kind !== 'gift' || (stock[itemId] ?? 0) < 1) return null
  const next = { ...stock, [itemId]: stock[itemId]! - 1 }
  if (next[itemId] === 0) delete next[itemId]
  return next
}

export const addItem = (stock: Stock, itemId: string, n = 1): Stock => (ITEMS_BY_ID.has(itemId) ? { ...stock, [itemId]: (stock[itemId] ?? 0) + n } : stock)
