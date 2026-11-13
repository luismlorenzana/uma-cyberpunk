// The director (CY10, uma-quest's director.ts in shape): the flow's rules between the screens and the save, with no React
// and no three.js. What's due at a node or after a mission, what a story step changes (the story state, the crew, the
// rooms), and the mission's steps: briefing → deploy → battle → results → aboard. Every function returns a new save.
import type { BattleInput } from '@cyber/battle'
import {
  afterMission as crewAfterMission, fillFile, finishedChapters, gainLead, newMember, resting, roomsOpenedBy, seeScene, setAnomaly, setFlag, type Chapter,
  type Mission, type MissionState, type Save, type Scene, type Step, type StoryPack, type Trigger, type WorldProgress,
} from '@cyber/domain'

export type Due = { kind: 'scene'; chapter: Chapter; scene: Scene } | { kind: 'mission'; chapter: Chapter; mission: Mission } | { kind: 'none' }

export const progressOf = (pack: StoryPack, save: Save): WorldProgress => ({ missions: save.worlds.missions, chapters: finishedChapters(pack, save.story) })

const chaptersOn = (pack: StoryPack, world: string): Chapter[] =>
  Object.values(pack.chapters).filter((c) => c.world === world).sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))

const needsMet = (pack: StoryPack, save: Save, c: Chapter): boolean => {
  const p = progressOf(pack, save)
  return c.needs.every((k) => { const [kind, id] = k.split(':') as [string, string]; return kind === 'chapter' ? p.chapters.includes(id) : kind === 'mission' ? p.missions.includes(id) : (save.story.files[id]?.length ?? 0) > 0 })
}

const matches = (t: Trigger, want: Trigger): boolean =>
  ('arrive' in t && 'arrive' in want && t.arrive === want.arrive) || ('talk' in t && 'talk' in want && t.talk === want.talk) || ('after' in t && 'after' in want && t.after === want.after)

/** The scene due for a trigger: a chapter's scenes play in order, so only the first unseen one of each chapter can be. */
export function sceneFor(pack: StoryPack, save: Save, world: string, trigger: Trigger): Due {
  for (const c of chaptersOn(pack, world)) {
    if (!needsMet(pack, save, c)) continue
    const next = c.scenes.find((s) => !save.story.seen.includes(s.id))
    if (next && matches(next.trigger, trigger)) return { kind: 'scene', chapter: c, scene: next }
  }
  return { kind: 'none' }
}

/** A tap on a node: the scene due there (talk, then arrive), else a mission there not yet won. */
export function atNode(pack: StoryPack, save: Save, world: string, place: string): Due {
  const scene = sceneFor(pack, save, world, { talk: place })
  if (scene.kind !== 'none') return scene
  const arrive = sceneFor(pack, save, world, { arrive: place })
  if (arrive.kind !== 'none') return arrive
  for (const c of chaptersOn(pack, world)) {
    const m = c.missions.find((x) => x.place === place && !save.worlds.missions.includes(x.id) && c.scenes.some((s) => s.steps.some((st) => st.kind === 'battle' && st.mission === x.id) && save.story.seen.includes(s.id)))
    if (m) return { kind: 'mission', chapter: c, mission: m }
  }
  return { kind: 'none' }
}

/** What plays after a mission is won: the scene triggered by it. */
export const afterMission = (pack: StoryPack, save: Save, world: string, mission: string): Due => sceneFor(pack, save, world, { after: mission })

/** The chapter a mission belongs to. */
export const chapterOf = (pack: StoryPack, mission: string): Chapter | undefined => Object.values(pack.chapters).find((c) => c.missions.some((m) => m.id === mission))

// --- Story steps -------------------------------------------------------------------------------------------------------

/** A story step's change: the story state, or the crew (join, aboard), whose coming aboard opens her rooms. */
export function applyStep(save: Save, pack: StoryPack, step: Extract<Step, { kind: 'flag' | 'lead' | 'file' | 'anomaly' | 'join' | 'aboard' }>): Save {
  if (step.kind === 'join' || step.kind === 'aboard') {
    const crew = save.crew.some((m) => m.outfit === step.outfit) ? save.crew : [...save.crew, newMember(step.outfit)]
    const rooms = step.kind === 'aboard' ? [...new Set([...save.ship.rooms, ...roomsOpenedBy(pack.casting, step.outfit)])] : save.ship.rooms
    return { ...save, crew, ship: { rooms } }
  }
  const s = save.story
  const story = step.kind === 'flag' ? setFlag(s, step.flag, step.set) : step.kind === 'lead' ? gainLead(s, step.lead) : step.kind === 'file' ? fillFile(s, step.file, step.line) : setAnomaly(s, step.anomaly, step.open)
  return { ...save, story }
}

export const markSeen = (save: Save, scene: string): Save => ({ ...save, story: seeScene(save.story, scene) })

/** The worlds the star map shows: the known ones; a new game knows the first lead's world and stands on it. */
export function ensureWorld(save: Save, pack: StoryPack): Save {
  if (Object.keys(save.worlds.known).length > 0) return save
  const first = pack.casting.leads[0]?.world
  if (!first || !pack.worlds[first]) return save
  return { ...save, worlds: { ...save.worlds, current: first, known: { [first]: { cleared: [] } } } }
}

export const travel = (save: Save, world: string): Save =>
  ({ ...save, worlds: { ...save.worlds, current: world, known: save.worlds.known[world] ? save.worlds.known : { ...save.worlds.known, [world]: { cleared: [] } } } })

/** Worlds a lead's chapter has opened (any chapter whose needs are met, on a world not yet known), so the star map shows
 * them once reachable. */
export function reachableWorlds(save: Save, pack: StoryPack): string[] {
  const known = new Set(Object.keys(save.worlds.known))
  const open = Object.values(pack.worlds).filter((w) => !known.has(w.id) && w.locations.some((l) => l.needs.length > 0 && l.needs.every((k) => {
    const [kind, id] = k.split(':') as [string, string]
    const p = progressOf(pack, save)
    return kind === 'chapter' ? p.chapters.includes(id) : kind === 'mission' ? p.missions.includes(id) : (save.story.files[id]?.length ?? 0) > 0
  })))
  return open.map((w) => w.id)
}

// --- The mission -------------------------------------------------------------------------------------------------------

/** The squad a mission starts with: its fixed squad (a flash-forward, TC32), else the chapter's leads, then the crew not
 * resting (Strain 3, TC27), four at most. */
export function defaultSquad(save: Save, chapter: Chapter, mission: Mission): number[] {
  if (mission.fixedSquad) return [...mission.fixedSquad]
  return [...new Set([...chapter.leads, ...save.crew.filter((m) => !resting(m)).map((m) => m.outfit)])].slice(0, 4)
}

/** Why a member can't join the squad now, or null: resting at Strain 3 (a locked lead deploys anyway), or a rig problem
 * (over Capacity, a two-handed weapon with a full left hand). */
export function cantDeploy(save: Save, outfit: number, locked: readonly number[], rigProblem: string | null): string | null {
  const m = save.crew.find((x) => x.outfit === outfit)
  if (m && resting(m) && !locked.includes(outfit)) return 'Resting: Strain 3, she sits this mission out'
  return rigProblem ? `${rigProblem}: fix her rig in the Hangar` : null
}

/** A mission's rewards as plain numbers (the economy is Phase 5): a win 100 XP and 10 a foe, 50 credits and 1 salvage a
 * foe; a loss keeps 5 XP a foe (TC25). */
export function rewards(input: BattleInput | null, won: boolean): { xp: number; credits: number; salvage: number } {
  const foes = (input?.units ?? []).filter((u) => u.side === 'enemy').length
  return won ? { xp: 100 + 10 * foes, credits: 50 * foes, salvage: foes } : { xp: 5 * foes, credits: 0, salvage: 0 }
}

/** Members a player can't swap out: a flash-forward's whole squad, else the chapter's leads. */
export const lockedMembers = (chapter: Chapter, mission: Mission): number[] => mission.fixedSquad ? [...mission.fixedSquad] : [...chapter.leads]

const withMission = (save: Save, mission: MissionState | null): Save => ({ ...save, mission })

export function startMission(save: Save, chapter: Chapter, mission: Mission): Save {
  return withMission(save, { id: mission.id, chapter: chapter.id, step: 'briefing', squad: defaultSquad(save, chapter, mission), battle: null, won: null })
}
export const toDeploy = (save: Save): Save => (save.mission ? withMission(save, { ...save.mission, step: 'deploy' }) : save)
export const setSquad = (save: Save, squad: number[]): Save => (save.mission ? withMission(save, { ...save.mission, squad }) : save)
/** Deploys: the battle's frozen input (built by the caller from the mission's scenario and the squad), no actions yet. */
export const deploy = (save: Save, input: unknown): Save => (save.mission ? withMission(save, { ...save.mission, step: 'battle', battle: { input, actions: [] }, won: null }) : save)
export const recordAction = (save: Save, action: unknown): Save =>
  (save.mission?.battle ? withMission(save, { ...save.mission, battle: { ...save.mission.battle, actions: [...save.mission.battle.actions, action] } }) : save)
export const finishBattle = (save: Save, won: boolean): Save => (save.mission ? withMission(save, { ...save.mission, step: 'results', won }) : save)
/** Retry after a loss: the same squad and the same battle, from its start. */
export const retry = (save: Save): Save => (save.mission?.battle ? withMission(save, { ...save.mission, step: 'battle', battle: { ...save.mission.battle, actions: [] }, won: null }) : save)
/** Leaves the results: the crew takes its XP and Strain (the squad in full and +1 Strain, the bench half and a rest), then
 * a win counts the mission and goes aboard (its next scene) and a loss ends the mission. */
export function closeResults(save: Save): Save {
  const m = save.mission
  if (!m) return save
  const crew = crewAfterMission(save.crew, m.squad, rewards((m.battle?.input ?? null) as BattleInput | null, !!m.won).xp)
  if (!m.won) return { ...save, crew, mission: null }
  const missions = save.worlds.missions.includes(m.id) ? save.worlds.missions : [...save.worlds.missions, m.id]
  return { ...save, crew, worlds: { ...save.worlds, missions }, mission: { ...m, step: 'aboard', battle: null } }
}
export const finishMission = (save: Save): Save => withMission(save, null)

/** What the ship's Continue card says is waiting. */
export function waiting(pack: StoryPack, save: Save): { text: string; to: string } | null {
  const m = save.mission
  if (m) {
    const words = { briefing: 'the briefing', deploy: 'deploying the squad', battle: 'the battle in progress', results: 'the results', aboard: 'the scene aboard' }[m.step]
    return { text: `Continue ${m.id}: ${words}`, to: '/mission' }
  }
  const world = save.worlds.current
  if (!world) return null
  for (const c of chaptersOn(pack, world)) {
    if (!needsMet(pack, save, c)) continue
    const next = c.scenes.find((s) => !save.story.seen.includes(s.id))
    if (next) return { text: `Next: ${next.place} on ${world}`, to: '/room/bridge' }
  }
  return null
}
