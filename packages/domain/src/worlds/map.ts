// A world's map (CY10, TC50, TC34): each location is locked, available or cleared, shows its danger, and a locked one
// names its key (a chapter, a mission or a File). A world never closes. Pure.
import type { Scene, StoryPack, World } from '../story/types'
import type { StoryState } from '../story/state'
import { CAPABILITY_NAME } from '../ship/modules'

export type NodeState = 'locked' | 'available' | 'cleared'

export interface WorldProgress {
  /** Missions won. */
  missions: readonly string[]
  /** Chapters finished (every scene seen). */
  chapters: readonly string[]
  /** The ship's capabilities (CY15, TC66): `ship:<capability>` keys. */
  capabilities?: readonly string[]
}

/** Whether a key in `needs` is met. */
export function keyMet(key: string, story: StoryState, progress: WorldProgress): boolean {
  const [kind, id] = key.split(':') as [string, string]
  if (kind === 'chapter') return progress.chapters.includes(id)
  if (kind === 'mission') return progress.missions.includes(id)
  if (kind === 'ship') return progress.capabilities?.includes(id) ?? false
  return (story.files[id]?.length ?? 0) > 0
}

/** A key in words, for a locked node. */
export function keyWords(key: string, pack: StoryPack): string {
  const [kind, id] = key.split(':') as [string, string]
  if (kind === 'chapter') { const c = pack.chapters[id]; return c ? `Finish Chapter ${c.number}${c.leads.length ? '' : ''} (${id})` : `Finish ${id}` }
  if (kind === 'mission') return `Win the mission ${id}`
  if (kind === 'ship') return `Needs ${CAPABILITY_NAME[id] ?? id}`
  return `Find the Log File ${id}`
}

/** What a tap at a location plays now (CY12: as the director does): in each of this world's chapters whose keys are met,
 * its next unseen scene when it's triggered by arriving at or talking at this place, and a mission here whose battle
 * step has played and that isn't won yet. */
export function pendingAt(pack: StoryPack, world: string, place: string, story: StoryState, progress: WorldProgress): { scenes: string[]; missions: string[] } {
  const chapters = Object.values(pack.chapters).filter((c) => c.world === world && c.needs.every((k) => keyMet(k, story, progress)))
  const at = (t: Scene['trigger']) => ('arrive' in t ? t.arrive : 'talk' in t ? t.talk : null)
  return {
    scenes: chapters.flatMap((c) => { const next = c.scenes.find((s) => !story.seen.includes(s.id)); return next && at(next.trigger) === place ? [next.id] : [] }),
    missions: chapters.flatMap((c) => c.missions.filter((m) => m.place === place && !progress.missions.includes(m.id)
      && c.scenes.some((s) => story.seen.includes(s.id) && s.steps.some((st) => st.kind === 'battle' && st.mission === m.id))).map((m) => m.id)),
  }
}

export interface NodeView { id: string; danger: number; state: NodeState; key: string | null; x: number; y: number; links: string[] }

/** Every location's state on a world. */
export function worldNodes(pack: StoryPack, world: World, story: StoryState, progress: WorldProgress): NodeView[] {
  return world.locations.map((l, i) => {
    const unmet = l.needs.find((k) => !keyMet(k, story, progress))
    const pending = pendingAt(pack, world.id, l.id, story, progress)
    const state: NodeState = unmet ? 'locked' : pending.scenes.length + pending.missions.length > 0 ? 'available' : 'cleared'
    return { id: l.id, danger: l.danger, state, key: unmet ? keyWords(unmet, pack) : null, x: l.x ?? 15 + ((i * 70) % 75), y: l.y ?? 20 + ((i * 37) % 60), links: l.links }
  })
}

/** Chapters whose every scene has been seen. */
export const finishedChapters = (pack: StoryPack, story: StoryState): string[] =>
  Object.values(pack.chapters).filter((c) => c.scenes.every((s) => story.seen.includes(s.id))).map((c) => c.id)
