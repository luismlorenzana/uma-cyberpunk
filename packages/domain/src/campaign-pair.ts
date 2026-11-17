import type { CampaignVisit } from './campaign-day'
import type { StoryState } from './story/state'

export interface PairMember { outfit: number; trust: string }
export interface PairRoom { move: string; visit: string; morning: string }
export interface PendingPairScene { pair: string; scene: string }

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
  const next = recovery < pair.recovery.length ? null : !released ? pair.release : !bond ? pair.bond.scene
    : !residency ? pair.residency.scene : !moved ? room!.move : null
  return { recovery, released, bond, residency, moved, next,
    trust: pair.members.map((person) => story.flags.includes(person.trust)) }
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
