import type { CampaignVisit } from './campaign-day'
import type { StoryState } from './story/state'
import { SHIP_PROVISIONS_PER_NIGHT } from './campaign-supply'

export interface PairMember { outfit: number; trust: string }
export interface PairRoom { move: string; visit: string; morning: string }
export interface SharedEvening { visit: string; morning: string }
export interface PendingPairScene { pair: string; scene: string }

export interface CampaignHome {
  port: string
  base: string
  defense: string
  scene: string
  stayScene?: string
  resettle: { flag: string; debrief: string }
  stay: { flag: string; debrief: string }
  visit: string
  jobs: [string, string]
  support: { alloy: number; provisions: number; relay: number }
}

export interface CampaignPair {
  id: string
  after: string
  capture: string
  members: [PairMember, PairMember]
  recovery: [string, string]
  testimony: string
  release: string
  bond: { scene: string; romance: string; friendship: string }
  residency: { scene: string; shared: string; separate: string }
  rooms: { shared: PairRoom; separate: PairRoom }
  sharedEvenings?: Record<'romance' | 'friendship', [SharedEvening, SharedEvening]>
  home?: CampaignHome
}

export function homeOutcome(home: CampaignHome, story: StoryState): 'resettle' | 'stay' | null {
  const resettled = story.flags.includes(home.resettle.flag)
  const aboard = story.flags.includes(home.stay.flag)
  if (resettled === aboard) return null
  if (resettled) return story.seen.includes(home.scene) ? 'resettle' : null
  return story.seen.includes(home.scene) || (home.stayScene && story.seen.includes(home.stayScene)) ? 'stay' : null
}

export function campaignHomeSupport(pairs: readonly CampaignPair[], story: StoryState) {
  const ashore = new Set<number>()
  const localAlloy = new Map<string, number>()
  let provisions = SHIP_PROVISIONS_PER_NIGHT
  for (const { home, members } of pairs) {
    if (!home || homeOutcome(home, story) !== 'resettle') continue
    for (const { outfit } of members) ashore.add(outfit)
    localAlloy.set(home.port, home.support.alloy)
    provisions = Math.max(1, provisions - home.support.provisions)
  }
  return { ashore, localAlloy, provisions }
}

const outcome = <A extends string, B extends string>(story: StoryState, scene: string, a: A, b: B, flags: Record<A | B, string>): A | B | null => {
  const hasA = story.flags.includes(flags[a]), hasB = story.flags.includes(flags[b])
  return !story.seen.includes(scene) || hasA === hasB ? null : hasA ? a : b
}

/** Stable authored scenes and flags hold the milestones, including the two independent decisions. */
export function pairProgress(pair: CampaignPair, story: StoryState) {
  const recovery = pair.recovery.filter((scene) => story.seen.includes(scene)).length
  const released = story.seen.includes(pair.release)
  const bond = released ? outcome(story, pair.bond.scene, 'romance', 'friendship', pair.bond) : null
  const residency = bond ? outcome(story, pair.residency.scene, 'shared', 'separate', pair.residency) : null
  const room = residency ? pair.rooms[residency] : null
  const moved = !!room && story.seen.includes(room.move)
  const evenings = moved && bond ? pair.sharedEvenings?.[bond] : undefined
  const upcoming = evenings?.findIndex(({ visit, morning }) => !story.seen.includes(visit) || !story.seen.includes(morning)) ?? -1
  const shared = evenings ? {
    complete: upcoming === -1 ? evenings.length : upcoming,
    total: evenings.length,
    next: evenings[upcoming],
  } : null
  const next = recovery < pair.recovery.length ? null : !released ? pair.release : !bond ? pair.bond.scene
    : !residency ? pair.residency.scene : !moved ? room!.move : null
  return { recovery, released, bond, residency, moved, shared, next,
    trust: pair.members.map((person) => story.flags.includes(person.trust)) }
}

export function sharedPairVisit(pair: CampaignPair, story: StoryState, aboard: readonly number[]): Extract<CampaignVisit, { kind: 'pair-visit' }> | null {
  if (!pair.members.every(({ outfit }) => aboard.includes(outfit)) || (pair.home && homeOutcome(pair.home, story) === 'resettle')) return null
  const next = pairProgress(pair, story).shared?.next
  return next ? { kind: 'pair-visit', pair: pair.id, scene: next.visit, morning: next.morning } : null
}

export function pairVisit(pair: CampaignPair, story: StoryState, aboard: readonly number[]): Extract<CampaignVisit, { kind: 'pair-visit' }> | null {
  const progress = pairProgress(pair, story)
  if (!aboard.includes(pair.members[0].outfit)) return null
  const recovery = pair.recovery[progress.recovery]
  if (!progress.released && recovery) return { kind: 'pair-visit', pair: pair.id, scene: recovery, morning: null }
  if (!progress.moved || !progress.residency || !aboard.includes(pair.members[1].outfit)) return null
  const room = pair.rooms[progress.residency]
  return { kind: 'pair-visit', pair: pair.id, scene: room.visit, morning: room.morning }
}
