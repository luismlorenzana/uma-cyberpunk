// Cabins between the screens and the save (CY14, TC60, TC61): her tastes and Comfort, decorating, theme kits, and the
// visit's four choices with their result card. Pure, tested headless; the rules are the domain's, the rapport goes
// through the bonds' `giveRapport` (so the catch-up and the story's gates apply).
import {
  catchUpFactor, comfortOf, decorateRapport, DECORATE_LINES, giftRapport, grantRequest, INVITE_LINES, ITEMS_BY_ID, KEEPSAKE_LINE, LINE_SLOTS, pickFor, place, reveal,
  takeGift, talkLine, talkRapport, tastesOf, themeKit, TOPIC_NAME, useVisit, visitRapport, visitRequest, visitsLeft, VISIT_TUNING, type Comfort, type CrewMember,
  type Reveal, type Save, type Slot, type StoryPack, type Tastes, type Topic,
} from '@cyber/domain'
import { bondFileOf, giveRapport } from '../bonds/bonds'
import type { CrewView } from '../crew/view'

/** Her tastes: the story's, else derived from her running style, role and bands. */
export const tastesFor = (pack: StoryPack | null, view: Pick<CrewView, 'outfit' | 'style' | 'role' | 'bands'>): Tastes =>
  tastesOf(pack?.casting.tastes?.[String(view.outfit)], view.outfit, view.style, view.role, view.bands)
export const comfortFor = (pack: StoryPack | null, view: CrewView): Comfort => comfortOf(view.member.cabin, tastesFor(pack, view))

const withMember = (save: Save, outfit: number, change: (m: CrewMember) => CrewMember): Save =>
  ({ ...save, crew: save.crew.map((m) => (m.outfit === outfit ? change(m) : m)) })
const member = (save: Save, outfit: number): CrewMember | undefined => save.crew.find((m) => m.outfit === outfit)

/** Decorating by hand (never a visit): an item from the stock into a slot, or the slot emptied. The same save when it can't. */
export function placeItem(save: Save, outfit: number, slot: Slot, itemId: string | null): Save {
  const m = member(save, outfit)
  const placed = m ? place(m.cabin, save.items, slot, itemId) : null
  return placed ? { ...withMember(save, outfit, (x) => ({ ...x, cabin: placed.cabin })), items: placed.stock } : save
}

/** A theme kit: her favourite line from the stock, in one tap. */
export function applyThemeKit(save: Save, pack: StoryPack | null, view: CrewView): Save {
  const m = member(save, view.outfit)
  if (!m) return save
  const kit = themeKit(m.cabin, save.items, tastesFor(pack, view))
  return { ...withMember(save, view.outfit, (x) => ({ ...x, cabin: kit.cabin })), items: kit.stock }
}

/** Granting her request from the stock: +30 and the slot filled. Not a visit. */
export function grantItem(save: Save, pack: StoryPack | null, outfit: number, itemId: string): Save {
  const m = member(save, outfit)
  const granted = m ? grantRequest(m.cabin, save.items, itemId) : null
  if (!granted) return save
  return giveRapport({ ...withMember(save, outfit, (x) => ({ ...x, cabin: granted.cabin })), items: granted.stock }, pack, outfit, VISIT_TUNING.request)
}

// --- Visits ------------------------------------------------------------------------------------------------------------

export type VisitChoice = { kind: 'talk'; topic: Topic } | { kind: 'gift'; item: string } | { kind: 'decorate' } | { kind: 'invite' }

export interface VisitResult {
  kind: VisitChoice['kind']
  /** Rapport as it landed: the base, half again at Comfort 4+, doubled below the crew's median rank. */
  rapport: number
  strainShed: number
  /** What she says. */
  lines: string[]
  revealed: Reveal[]
  /** A slot she asks for, at the end. */
  request: Slot | null
  /** What changed in the cabin, for the card. */
  placed: { slot: Slot; item: string } | null
}

export const canInvite = (m: CrewMember): boolean => m.bond.rank >= VISIT_TUNING.inviteRank
export const visitsLeftNow = (save: Save): number => visitsLeft(save.visits, save.watch)

/**
 * One visit (TC61): the choice's rapport (with Comfort 4+'s half again and the catch-up), what she reveals and says, a
 * request one visit in five, and a visit used this watch. Null when no visit is left, the choice can't be made (no gift of
 * that id, no item to decorate with, an invitation before rank 4), or she isn't aboard.
 */
export function visit(save: Save, pack: StoryPack | null, view: CrewView, choice: VisitChoice): { save: Save; result: VisitResult } | null {
  const m = member(save, view.outfit)
  if (!m || visitsLeftNow(save) === 0) return null
  const tastes = tastesFor(pack, view)
  const lights = comfortOf(m.cabin, tastes).lights
  const used = save.visits.watch === save.watch ? save.visits.used : 0
  const seed = view.outfit * 31 + save.watch * 7 + used
  let cabin = m.cabin, items = save.items, base = 0, strainShed = 0
  const lines: string[] = [], revealed: Reveal[] = []
  let placed: VisitResult['placed'] = null
  const reveals = (r: Reveal) => { if (!cabin.revealed.includes(r)) revealed.push(r); cabin = reveal(cabin, r) }

  if (choice.kind === 'talk') {
    const loved = tastes.topics.includes(choice.topic)
    base = talkRapport(choice.topic, tastes)
    lines.push(talkLine(choice.topic, bondFileOf(pack, view.outfit)?.talk, loved, seed))
    if (loved) reveals(`topic:${choice.topic}`)
  } else if (choice.kind === 'gift') {
    const next = takeGift(items, choice.item)
    if (!next) return null
    items = next
    base = giftRapport(ITEMS_BY_ID.get(choice.item), tastes)
    lines.push(base === VISIT_TUNING.giftFavourite ? 'Oh. You remembered. Thank you.' : 'For me? Thanks. I’ll find a place for it.')
    reveals('gift')
  } else if (choice.kind === 'decorate') {
    // She picks for the slot where her pick does the most: an empty one first, else one her pick would improve.
    const slots: Slot[] = [...LINE_SLOTS, 'keepsake']
    const options = slots.map((slot) => ({ slot, item: pickFor(slot, items, tastes) })).filter((o) => o.item && o.item.id !== cabin.slots[o.slot])
    const gain = (o: (typeof options)[number]) => comfortOf({ ...cabin, slots: { ...cabin.slots, [o.slot]: o.item!.id } }, tastes).points - comfortOf(cabin, tastes).points
    const best = options.filter((o) => !cabin.slots[o.slot]).sort((a, b) => gain(b) - gain(a))[0] ?? options.filter((o) => gain(o) > 0).sort((a, b) => gain(b) - gain(a))[0]
    if (!best) return null
    const done = place(cabin, items, best.slot, best.item!.id)
    if (!done) return null
    cabin = done.cabin; items = done.stock
    placed = { slot: best.slot, item: best.item!.id }
    base = decorateRapport(best.item!, tastes)
    lines.push(best.item!.kind === 'furniture' ? DECORATE_LINES[best.item!.style] : KEEPSAKE_LINE)
    reveals('styles')
  } else {
    if (!canInvite(m)) return null
    base = VISIT_TUNING.invite
    lines.push(...INVITE_LINES)
    strainShed = Math.min(1, m.strain)
  }

  const request = visitRequest(cabin, view.outfit, save.watch, used)
  if (request) cabin = { ...cabin, request }
  const factor = catchUpFactor(m.bond.rank, save.crew.map((x) => x.bond.rank))
  const amount = visitRapport(base, lights)
  let next: Save = { ...withMember(save, view.outfit, (x) => ({ ...x, cabin, strain: x.strain - strainShed })), items, visits: useVisit(save.visits, save.watch) }
  next = giveRapport(next, pack, view.outfit, amount)
  return { save: next, result: { kind: choice.kind, rapport: amount * factor, strainShed, lines, revealed, request, placed } }
}

/** A reveal, said plainly for the card and the profile. */
export function revealText(r: Reveal, tastes: Tastes): string {
  if (r === 'gift') return `She loves ${tastes.gift === 'keepsakes' ? 'keepsakes' : tastes.gift}`
  if (r === 'styles') return `Her style: ${tastes.favourite}; she dislikes ${tastes.disliked}`
  return `She loves talking about ${TOPIC_NAME[r.slice(6) as Topic].toLowerCase()}`
}

/** Her Comfort lights by outfit, for the mission's rest (`closeResults`). */
export const lightsFrom = (pack: StoryPack | null, views: readonly CrewView[]) => {
  const by = new Map(views.map((v) => [v.outfit, comfortFor(pack, v).lights]))
  return (outfit: number): number => by.get(outfit) ?? 0
}
