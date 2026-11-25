// Duties between the screens and the save (CY16): each Uma's duty profile from her crew view, auto-assign and presets,
// and the jump event waiting on the ship. Pure, tested headless; the rules are the domain's.
import {
  applyReward, assignPost, autoAssign, canTakeOrdinaryAssignment, GENERIC_EVENTS, holderOf, likedDuty, resolveChoice, shipPosts, type DutyInfo, type Post, type Save, type ShipEvent,
  type StoryPack,
} from '@cyber/domain'
import { giveRapport } from '../bonds/bonds'
import type { CrewView } from '../crew/view'

/** Each Uma's bands, role, running style and liked duty, for the watch's duties. */
export function dutyInfoFrom(views: readonly CrewView[]): (outfit: number) => DutyInfo | null {
  const by = new Map(views.map((v) => [v.outfit, { bands: v.bands, role: v.role, style: v.style, liked: likedDuty(v.bands) }]))
  return (outfit) => by.get(outfit) ?? null
}

/** Auto-assign (TC68): every post filled with the best fit among those not deployed; anyone left over off duty. */
export function autoAssignSave(save: Save, views: readonly CrewView[], deployed: readonly number[] = []): Save {
  const eligible = new Set(save.crew.filter(canTakeOrdinaryAssignment).map(member => member.outfit))
  const picks = autoAssign(shipPosts(save.ship), views.filter(view => eligible.has(view.outfit)).map((v) => ({
    outfit: v.outfit, bands: v.bands, role: v.role, liked: likedDuty(v.bands), strain: v.member.strain,
    mastery: v.member.post ? { [`${v.member.post.module}:${v.member.post.index}`]: v.member.post.mastery } : {},
  })), deployed)
  let next = save
  for (const v of views) next = assignPost(next, v.outfit, picks.get(v.outfit) ?? null)
  return next
}

export function savePreset(save: Save, index: number, name: string): Save {
  const posts: Record<string, Post> = {}
  for (const m of save.crew) if (m.post && canTakeOrdinaryAssignment(m)) posts[String(m.outfit)] = { module: m.post.module, index: m.post.index }
  const presets = [...save.dutyPresets]
  presets[index] = { name: name.trim().slice(0, 24) || `Preset ${index + 1}`, posts }
  return { ...save, dutyPresets: presets.slice(0, 2).map((p, i) => p ?? { name: `Preset ${i + 1}`, posts: {} }) }
}
export function loadPreset(save: Save, index: number): Save {
  const p = save.dutyPresets[index]
  if (!p) return save
  let next = save
  for (const m of save.crew) next = assignPost(next, m.outfit, (canTakeOrdinaryAssignment(m) ? p.posts[String(m.outfit)] : undefined) ?? null)
  return next
}

/** The event waiting on the ship, from its region's pool or the generic one. */
export function currentEvent(save: Save, pack: StoryPack | null): ShipEvent | null {
  const e = save.event
  if (!e) return null
  const pool = e.region ? pack?.events[e.region] ?? [] : GENERIC_EVENTS
  return pool.find((x) => x.id === e.id) ?? null
}

/** Answering it: the choice resolved by its post's holder, the reward applied (rapport to the holder, else the crew's
 * first), the event cleared. */
export function answerEvent(save: Save, pack: StoryPack | null, views: readonly CrewView[], choice: number): { save: Save; text: string; passed: boolean } | null {
  const ev = currentEvent(save, pack), c = ev?.choices[choice]
  if (!ev || !c) return null
  const held = save.crew.filter((m) => m.post && canTakeOrdinaryAssignment(m)).map((m) => ({ outfit: m.outfit, post: m.post! }))
  const holder = c.check ? holderOf(held, c.check.post) : null
  const bands = holder !== null ? views.find((v) => v.outfit === holder)?.bands ?? null : null
  const r = resolveChoice(c, bands)
  let next = applyReward({ ...save, event: null }, r.reward)
  const to = holder ?? save.crew[0]?.outfit
  if (r.reward.rapport && to !== undefined) next = giveRapport(next, pack, to, r.reward.rapport)
  return { save: next, text: r.text, passed: r.passed }
}
export const skipEvent = (save: Save): Save => ({ ...save, event: null })
