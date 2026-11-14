// A watch's duties (CY16, TC67): every held post makes its output, all of it applied at once and listed on one ship-log
// card; mastery grows, Umas posted together build camaraderie, a liked duty pays a little rapport. And the jump's event
// card (TC66): one in three jumps, a short choice resolved by who holds a named post. Pure and deterministic.
import type { OpReport } from '../crew/operations'
import type { Bands, Role } from '@cyber/battle'
import type { Strategy } from '@luismlorenzana/uma-data'
import { addItem } from '../cabins/cabins'
import { FURNITURE } from '../cabins/items'
import type { Save } from '../save/save'
import { aptitude, DUTY_TUNING, holderOf, mealOf, outputFactor, pairKey, partnersOn, postKind, POSTS, shipHasPost, type HeldPost, type Meal, type Post, type PostKind } from './duties'
import { earn, type Ship, type Wallet } from './hull'
import type { ModuleId } from './modules'

export interface DutyInfo { bands: Bands; role: Role; style: Strategy | null; liked: PostKind | null }
export interface LogLine { outfit: number; post: PostKind; text: string; half: boolean }
/** A watch's ship-log card: every post's line, the watch's gains, and the operations back this watch (CY18). */
export interface ShipLog { watch: number; lines: LogLine[]; gains: Wallet; read: boolean; reports?: OpReport[] }

const ZERO: Wallet = { credits: 0, alloy: 0, data: 0 }
const DEFAULT_INFO: DutyInfo = { bands: { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 }, role: 'striker', style: null, liked: null }

/** Builds a watch faster: every running build's watches left drop by `n` (finishing at 0). */
export function speedBuilds(ship: Ship, n: number, max = Infinity): Ship {
  let done = 0
  return { ...ship, modules: ship.modules.map((m) => {
    if (!m.building || done >= max) return m
    done++
    const left = m.building.left - n
    return left <= 0 ? { ...m, level: m.building.level, building: null } : { ...m, building: { ...m.building, left } }
  }) }
}

/**
 * Every post's output for the watch that just passed (`save.watch`, already counted), applied: the wallet, the ship's
 * builds, Strain, the bench's XP, the meal, items; mastery +1 at each post; camaraderie for Umas posted together; and the
 * card. `info` gives each Uma's bands, role, running style and liked duty (master data, the web's); `deployed` the squad
 * of the battle that ends this watch (none for a jump). Rapport for liked duties comes back to be applied through the
 * bonds' rules.
 */
export function runDuties(save: Save, info: (outfit: number) => DutyInfo | null, chiefs: Partial<Record<string, ModuleId>>, deployed: readonly number[]):
  { save: Save; log: ShipLog; rapport: Map<number, number> } {
  const watch = save.watch
  let wallet = save.wallet, ship = save.ship, items = save.items, meal: Meal | null = save.meal
  const lines: LogLine[] = [], rapport = new Map<number, number>()
  const gains = { ...ZERO }
  let crew = save.crew
  const held = crew.filter((m) => m.post && shipHasPost(ship, m.post)).map((m) => ({ outfit: m.outfit, post: m.post! }))
  const bench = crew.filter((m) => !deployed.includes(m.outfit)).map((m) => m.outfit)
  for (const h of held) {
    const kind = postKind(h.post)
    if (!kind) continue
    const def = POSTS[kind], i = info(h.outfit) ?? DEFAULT_INFO
    const worker = { outfit: h.outfit, bands: i.bands, role: i.role, style: i.style, post: h.post, deployed: deployed.includes(h.outfit), chief: chiefs[String(h.outfit)] ?? null, liked: i.liked }
    const f = outputFactor(worker, watch), apt = aptitude(kind, i.bands), perk = def.role === i.role
    const half = worker.deployed && i.style !== 'pace'
    const amount = Math.round(def.amount * f * (apt === 3 ? 1.5 : 1) * (perk ? 1.25 : 1))
    /** Discrete outputs: every watch at full, every other watch at half; every watch at band 4–5. */
    const lands = apt === 3 || f >= 0.75 || watch % 2 === 0
    let text = ''
    switch (def.yields) {
      case 'credits': case 'alloy': case 'data': gains[def.yields] += amount; text = `+${amount} ${def.yields}`; break
      case 'build': {
        if (!ship.modules.some((m) => m.building)) { text = 'No build to speed'; break }
        ship = speedBuilds(ship, lands ? 1 : 0, apt === 3 ? 2 : 1)
        text = lands ? (apt === 3 ? 'Two builds a watch faster' : 'A build a watch faster') : 'Half a watch on the build'
        break
      }
      case 'strain': {
        const target = kind === 'stargazer' ? crew.find((m) => m.outfit === h.outfit) : [...crew].sort((a, b) => b.strain - a.strain || a.outfit - b.outfit)[0]
        const n = lands ? (apt === 3 || perk ? 2 : 1) : 0
        if (!target || target.strain === 0 || n === 0) { text = 'No one to treat'; break }
        crew = crew.map((m) => (m.outfit === target.outfit ? { ...m, strain: Math.max(0, m.strain - n) } : m))
        text = `−${Math.min(n, target.strain)} Strain for ${target.outfit === h.outfit ? 'herself' : `#${target.outfit}`}`
        break
      }
      case 'xp': {
        const xp = amount, to = bench.filter((o) => o !== h.outfit)
        crew = crew.map((m) => (to.includes(m.outfit) ? { ...m, xp: m.xp + xp } : m))
        text = to.length ? `+${xp} XP to ${to.length} on the bench` : 'No one on the bench'
        break
      }
      case 'meal': meal = mealOf(i.bands); text = `Cooked for the next battle: ${meal}`; break
      case 'item': case 'plant': {
        if (!lands) { text = 'Still working on it'; break }
        const id = def.yields === 'item' ? FURNITURE[(watch * 7 + h.outfit) % FURNITURE.length]!.id : (watch % 4 < 2 ? 'gift-succulent' : 'gift-seeds')
        items = addItem(items, id)
        text = `Made: ${id}`
        break
      }
      default: text = def.does
    }
    lines.push({ outfit: h.outfit, post: kind, text, half })
    if (i.liked === kind) rapport.set(h.outfit, (rapport.get(h.outfit) ?? 0) + DUTY_TUNING.likedRapport)
  }
  wallet = earn(wallet, gains)
  // Mastery at each held post; camaraderie between Umas on the same module.
  const heldSet = new Map(held.map((h) => [h.outfit, h.post]))
  crew = crew.map((m) => (heldSet.has(m.outfit) && m.post ? { ...m, post: { ...m.post, mastery: m.post.mastery + 1 } } : m))
  const camaraderie = { ...save.camaraderie }
  for (const k of partnersOn(held)) camaraderie[k] = (camaraderie[k] ?? 0) + DUTY_TUNING.camaraderie
  const log: ShipLog = { watch, lines, gains, read: lines.length === 0 }
  return { save: { ...save, crew, wallet, ship, items, meal, camaraderie, log }, log, rapport }
}

/** Puts an Uma on a post (taking it from whoever held it), or off duty with null. Her tenure starts this watch. */
export function assignPost(save: Save, outfit: number, post: Post | null): Save {
  const key = post ? `${post.module}:${post.index}` : null
  return { ...save, crew: save.crew.map((m) => {
    if (m.outfit === outfit) {
      if (!post) return { ...m, post: null }
      const same = m.post && m.post.module === post.module && m.post.index === post.index
      return { ...m, post: same ? m.post : { module: post.module, index: post.index, since: save.watch + 1, mastery: m.post && same ? m.post.mastery : 0 } as HeldPost }
    }
    return key && m.post && `${m.post.module}:${m.post.index}` === key ? { ...m, post: null } : m
  }) }
}

// --- Jump events (TC66) ------------------------------------------------------------------------------------------------

export interface Reward { credits?: number; alloy?: number; data?: number; item?: string; rapport?: number; lead?: string }
export interface EventChoice { text: string; check?: { post: PostKind; band: keyof Bands; at: number }; pass: Reward; fail?: Reward; passText: string; failText?: string }
export interface ShipEvent { id: string; title: string; text: string; choices: EventChoice[] }

/** The generic pool (invented, in git): drawn where a world names no region with a pool of its own. */
export const GENERIC_EVENTS: readonly ShipEvent[] = [
  { id: 'debris-field', title: 'A debris field', text: 'The jump drops the ship beside a drifting wreck.', choices: [
    { text: 'Thread through for salvage', check: { post: 'pilot', band: 'speed', at: 4 }, pass: { alloy: 25 }, fail: { alloy: 5 }, passText: 'The pilot slips between the plates; the claws come back full.', failText: 'Too tight: only scraps from the edge.' },
    { text: 'Go around', pass: {}, passText: 'Nothing gained, nothing scratched.' }] },
  { id: 'distress-beacon', title: 'A distress beacon', text: 'A faint call on an old band.', choices: [
    { text: 'Trace it', check: { post: 'navigator', band: 'wit', at: 3 }, pass: { data: 20, credits: 40 }, fail: { data: 5 }, passText: 'A stranded courier, grateful and paying.', failText: 'The signal fades; a fragment of a log is all.' },
    { text: 'Log it and move on', pass: { data: 5 }, passText: 'Noted for the authorities.' }] },
  { id: 'customs', title: 'A customs patrol', text: 'A patrol cutter wants to inspect the hold.', choices: [
    { text: 'Talk your way through', check: { post: 'trader', band: 'guts', at: 4 }, pass: { credits: 60 }, fail: { credits: -40 }, passText: 'They leave with a handshake and pay a finder’s fee.', failText: 'A "processing fee" leaves with them.' },
    { text: 'Pay the toll', pass: { credits: -20 }, passText: 'Twenty credits lighter, no questions.' }] },
  { id: 'solar-flare', title: 'A solar flare', text: 'Instruments light up: a flare is coming.', choices: [
    { text: 'Ride it out behind the shields', check: { post: 'engineer', band: 'power', at: 3 }, pass: { data: 15 }, fail: { alloy: -10 }, passText: 'The readings are worth a fortune to the Lab.', failText: 'Patches on the hull: some Alloy spent.' },
    { text: 'Jump early', pass: {}, passText: 'Away before it hits.' }] },
  { id: 'black-market', title: 'A black-market drone', text: 'A drone offers crates, no labels.', choices: [
    { text: 'Buy a crate', pass: { credits: -50, item: 'neon-light' }, passText: 'Inside: a string of neon lights.' },
    { text: 'Wave it off', pass: {}, passText: 'It buzzes away.' }] },
  { id: 'old-relay', title: 'An old relay', text: 'A dead communications relay drifts by.', choices: [
    { text: 'Splice into it', check: { post: 'signals', band: 'wit', at: 4 }, pass: { data: 30 }, fail: { data: 5 }, passText: 'Years of traffic, decrypted.', failText: 'Mostly static.' },
    { text: 'Strip it for parts', check: { post: 'mechanic', band: 'power', at: 3 }, pass: { alloy: 20 }, fail: { alloy: 5 }, passText: 'Good copper and better alloy.', failText: 'Corroded through.' }] },
  { id: 'stowaway', title: 'A stowaway', text: 'A kid hides in the cargo bay, scared and hungry.', choices: [
    { text: 'Feed them and drop them at the next port', check: { post: 'cook', band: 'guts', at: 3 }, pass: { rapport: 10 }, passText: 'The cook makes a friend for life; the crew is quieter, warmer.', fail: { rapport: 5 }, failText: 'Burnt toast, but kindly meant.' },
    { text: 'Hand them to the port authority', pass: { credits: 20 }, passText: 'A small reward, a long silence aboard.' }] },
  { id: 'meteor-shower', title: 'A meteor shower', text: 'Bright streaks ahead.', choices: [
    { text: 'Dodge through', check: { post: 'pilot', band: 'speed', at: 3 }, pass: { data: 10 }, fail: { alloy: -10 }, passText: 'A clean run, and good footage.', failText: 'A few dents to patch.' },
    { text: 'Wait it out', pass: {}, passText: 'An hour lost, nothing more.' }] },
  { id: 'trader-convoy', title: 'A trader convoy', text: 'A convoy hails: they want to trade.', choices: [
    { text: 'Trade Alloy for credits', pass: { alloy: -10, credits: 80 }, passText: 'A fair deal.' },
    { text: 'Trade credits for a keepsake', pass: { credits: -40, item: 'keepsake-starmap' }, passText: 'A hand-drawn star map, beautifully done.' }] },
  { id: 'ghost-signal', title: 'A ghost signal', text: 'A voice on the comms, repeating a name nobody knows.', choices: [
    { text: 'Record and analyse it', check: { post: 'archivist', band: 'wit', at: 4 }, pass: { data: 25 }, fail: { data: 5 }, passText: 'An old ship’s log, recovered.', failText: 'Noise, in the end.' },
    { text: 'Shut it off', pass: {}, passText: 'The silence after is loud.' }] },
  { id: 'medical-call', title: 'A medical call', text: 'A mining barge has injured aboard.', choices: [
    { text: 'Send the medic over', check: { post: 'medic', band: 'stamina', at: 3 }, pass: { credits: 50, rapport: 5 }, fail: { credits: 10 }, passText: 'Everyone walks off the barge.', failText: 'You did what you could.' },
    { text: 'Send supplies', pass: { credits: -20, rapport: 5 }, passText: 'They’ll remember the ship.' }] },
  { id: 'quiet-jump', title: 'A quiet jump', text: 'Nothing on the scopes. The crew gathers at the window.', choices: [
    { text: 'Let them rest', pass: { rapport: 5 }, passText: 'An easy hour, everyone together.' }] },
]

/** Whether a jump draws an event, and which (TC66): one jump in three by a fixed hash over the watch and the world. */
export function drawEvent(watch: number, world: string, pool: readonly ShipEvent[]): ShipEvent | null {
  if (pool.length === 0) return null
  const h = [...`${world}:${watch}`].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 11)
  if (h % DUTY_TUNING.eventEvery !== 0) return null
  return pool[(h >>> 4) % pool.length]!
}

/** A choice resolved: pass when the post's holder has the band, else fail; no holder fails a check. */
export function resolveChoice(choice: EventChoice, holderBands: Bands | null): { reward: Reward; passed: boolean; text: string } {
  if (!choice.check) return { reward: choice.pass, passed: true, text: choice.passText }
  const passed = !!holderBands && holderBands[choice.check.band] >= choice.check.at
  return passed ? { reward: choice.pass, passed, text: choice.passText } : { reward: choice.fail ?? {}, passed, text: choice.failText ?? 'It didn’t work out.' }
}

/** A reward into the save (the wallet never below zero); rapport goes to the holder, applied by the caller. */
export function applyReward(save: Save, reward: Reward): Save {
  const w = save.wallet
  return {
    ...save,
    wallet: { credits: Math.max(0, w.credits + (reward.credits ?? 0)), alloy: Math.max(0, w.alloy + (reward.alloy ?? 0)), data: Math.max(0, w.data + (reward.data ?? 0)) },
    items: reward.item ? addItem(save.items, reward.item) : save.items,
  }
}

export { holderOf, pairKey }
