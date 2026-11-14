// The director (CY10, uma-quest's director.ts in shape): the flow's rules between the screens and the save, with no React
// and no three.js. What's due at a node or after a mission, what a story step changes (the story state, the crew, the
// rooms), and the mission's steps: briefing → deploy → battle → results → aboard. Every function returns a new save.
import type { BattleInput } from '@cyber/battle'
import {
  addCamaraderie, addDeck, addItem, afterMission as crewAfterMission, PARTNER_TUNING, settlePartners, earn, fillFile, finishedChapters, gainLead, modulesOpenedBy, newMember, openModule, passWatch, resting, resultsPay, seeScene,
  drawEvent, GENERIC_EVENTS, runDuties, setAnomaly, setFlag, shipCapabilities, awayMembers, cohesionAfter, keyMet, moveStandingIn, placeNewcomer, readinessNow, returnOperations, standingNow, systemsBuilt, unmetNeeds, type Chapter, type FinaleCondition, type ReadinessNeed, type DutyInfo, type EffectStep, missionItem, restedStrain, type Mission, type MissionState, type Save, type Scene, type Step, type StoryPack, type Trigger, type WorldProgress,
} from '@cyber/domain'
import { afterBattleBonds, giveRapport } from '../bonds/bonds'

export type Due = { kind: 'scene'; chapter: Chapter; scene: Scene } | { kind: 'mission'; chapter: Chapter; mission: Mission } | { kind: 'none' }

export const progressOf = (pack: StoryPack, save: Save): WorldProgress =>
  ({ missions: save.worlds.missions, chapters: finishedChapters(pack, save.story), capabilities: shipCapabilities(save.ship), standing: standingNow(pack, save) })

const chaptersOn = (pack: StoryPack, world: string): Chapter[] =>
  Object.values(pack.chapters).filter((c) => c.world === world).sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))

const needsMet = (pack: StoryPack, save: Save, c: Chapter): boolean => {
  const p = progressOf(pack, save)
  return c.needs.every((k) => keyMet(k, save.story, p))
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

/** The XP a newcomer joins at (TC51, D16): the squad's level, never level 1 after a fight: the crew's average XP, or the
 * XP of the mission she just fought in (its scene aboard is where leads come aboard), whichever is higher. */
export function joiningXp(save: Save, outfit: number): number {
  const mean = save.crew.length ? Math.floor(save.crew.reduce((n, m) => n + m.xp, 0) / save.crew.length) : 0
  const m = save.mission
  const fought = m?.won && m.squad.includes(outfit) ? rewards((m.battle?.input ?? null) as BattleInput | null, true).xp : 0
  return Math.max(mean, fought)
}

/** A story step's change: the story state, the crew (join, aboard: she joins at the squad's level and takes her place
 * in a squad, CY18), whose coming aboard opens her modules (placed at once where a slot is free, CY15), the ship (a refit
 * adds a deck), or a faction's standing (CY18). */
export function applyStep(save: Save, pack: StoryPack, step: EffectStep): Save {
  if (step.kind === 'join' || step.kind === 'aboard') {
    const fresh = !save.crew.some((m) => m.outfit === step.outfit)
    const crew = fresh ? [...save.crew, { ...newMember(step.outfit), xp: joiningXp(save, step.outfit) }] : save.crew
    const ship = step.kind === 'aboard' ? modulesOpenedBy(pack.casting, step.outfit).reduce(openModule, save.ship) : save.ship
    const squads = fresh ? placeNewcomer(save.squads, pack.casting.squads ?? [], crew.map((m) => m.outfit), step.outfit) : save.squads
    return { ...save, crew, ship, squads }
  }
  if (step.kind === 'refit') return { ...save, ship: addDeck(save.ship) }
  if (step.kind === 'standing') return moveStandingIn(pack, save, step.faction, step.by)
  const s = save.story
  const story = step.kind === 'flag' ? setFlag(s, step.flag, step.set) : step.kind === 'lead' ? gainLead(s, step.lead) : step.kind === 'file' ? fillFile(s, step.file, step.line) : setAnomaly(s, step.anomaly, step.open)
  return { ...save, story }
}

export const markSeen = (save: Save, scene: string): Save => ({ ...save, story: seeScene(save.story, scene) })

/** The order interjection slots prefer (TC51): the casting's crew order, anyone else after, as they were. */
export function squadOrder(pack: StoryPack, outfits: readonly number[]): number[] {
  const rank = (o: number) => { const i = pack.casting.crewOrder.indexOf(o); return i < 0 ? Number.MAX_SAFE_INTEGER : i }
  return [...outfits].sort((a, b) => rank(a) - rank(b))
}
/** Who a scene's slots hear: the mission's squad for its scene aboard, else the crew aboard. */
export const sceneSquad = (pack: StoryPack, save: Save, squad?: readonly number[]): number[] => squadOrder(pack, squad ?? save.crew.map((m) => m.outfit))

// --- Debriefs ------------------------------------------------------------------------------------------------------------

export const debriefId = (chapter: Chapter): string => `${chapter.id}-debrief`
/** A chapter's debrief as a scene the player plays aboard, and the Log replays. */
export const debriefScene = (chapter: Chapter): Scene => ({ id: debriefId(chapter), place: 'aboard', trigger: { after: chapter.id }, cast: chapter.leads.map((outfit) => ({ outfit })), steps: chapter.debrief.steps })
/** The debrief due aboard: a finished chapter's, not yet seen. */
export function debriefDue(pack: StoryPack, save: Save): Chapter | null {
  const done = finishedChapters(pack, save.story)
  return Object.values(pack.chapters).find((c) => done.includes(c.id) && c.debrief.steps.length > 0 && !save.story.seen.includes(debriefId(c))) ?? null
}
/** The Log's Timeline: each chapter's scenes seen, in order, then its debrief once seen. */
export function timeline(pack: StoryPack, save: Save): Scene[] {
  return Object.values(pack.chapters).sort((a, b) => a.world.localeCompare(b.world) || a.number - b.number)
    .flatMap((c) => [...c.scenes, ...(c.debrief.steps.length ? [debriefScene(c)] : [])]).filter((s) => save.story.seen.includes(s.id))
}

/** The worlds the star map shows: the known ones; a new game knows the first lead's world and stands on it. */
export function ensureWorld(save: Save, pack: StoryPack): Save {
  if (Object.keys(save.worlds.known).length > 0) return save
  const first = pack.casting.leads[0]?.world
  if (!first || !pack.worlds[first]) return save
  return { ...save, worlds: { ...save.worlds, current: first, known: { [first]: { cleared: [] } } } }
}

/** What a watch's duties need from the screens (CY16): each Uma's duty profile (master data's bands, role, running style),
 * and the squad of the battle that ends the watch. Without it, every Uma works at band 3. */
export interface WatchContext { info?: (outfit: number) => DutyInfo | null; deployed?: readonly number[] }

/** A watch passes (CY13, CY15, CY16, CY18): the counter; every build and the Lab's project a watch on; every post's
 * output on one ship-log card (a squad away holds its posts at half), and a liked duty's rapport through the bonds'
 * rules; then the squads due back return, each with its report on the card. */
export function passAWatch(save: Save, pack: StoryPack | null = null, ctx: WatchContext = {}): Save {
  const ticked: Save = { ...save, watch: save.watch + 1, ship: passWatch(save.ship).ship }
  const away = awayMembers(save.operations, save.squads)
  const r = runDuties(ticked, ctx.info ?? (() => null), pack?.casting.chiefs ?? {}, [...(ctx.deployed ?? []), ...away])
  let next = r.save
  for (const [outfit, amount] of r.rapport) next = giveRapport(next, pack, outfit, amount)
  if (!pack || !next.operations.some((o) => o.back <= next.watch)) return next
  const back = returnOperations(pack, next, progressOf(pack, next))
  const log = back.save.log?.watch === next.watch ? back.save.log : { watch: next.watch, lines: [], gains: { credits: 0, alloy: 0, data: 0 }, read: false }
  // The card's wallet line counts what the operations brought back too.
  const w = back.save.wallet, was = next.wallet
  const gains = { credits: log.gains.credits + w.credits - was.credits, alloy: log.gains.alloy + w.alloy - was.alloy, data: log.gains.data + w.data - was.data }
  return { ...back.save, log: { ...log, gains, read: false, reports: [...(log.reports ?? []), ...back.reports] } }
}

/** A jump: the ship is at the world, which is known from now on, a watch passes (CY13), and one jump in three draws an
 * event card from the world's region's pool, else the generic one (CY16, TC66). */
export function travel(save: Save, world: string, pack: StoryPack | null = null, ctx: WatchContext = {}): Save {
  const moved = passAWatch(save, pack, ctx)
  const region = pack?.worlds[world]?.region ?? null
  const pool = region && pack?.events[region]?.length ? pack.events[region]! : GENERIC_EVENTS
  const ev = drawEvent(moved.watch, world, pool)
  return {
    ...moved, event: ev ? { id: ev.id, region: pool === GENERIC_EVENTS ? null : region } : moved.event,
    worlds: { ...save.worlds, current: world, known: save.worlds.known[world] ? save.worlds.known : { ...save.worlds.known, [world]: { cleared: [] } } },
  }
}

/** Worlds a lead's chapter has opened (any chapter whose needs are met, on a world not yet known), so the star map shows
 * them once reachable. */
export function reachableWorlds(save: Save, pack: StoryPack): string[] {
  const known = new Set(Object.keys(save.worlds.known))
  const p = progressOf(pack, save)
  return Object.values(pack.worlds).filter((w) => !known.has(w.id) && w.locations.some((l) => l.needs.length > 0 && l.needs.every((k) => keyMet(k, save.story, p)))).map((w) => w.id)
}

// --- The mission -------------------------------------------------------------------------------------------------------

/** The squad a mission starts with: its fixed squad (a flash-forward, TC32), else the chapter's leads, then their squads'
 * members (CY18), then the crew not resting (Strain 3, TC27) and not away on an operation, four at most. */
export function defaultSquad(save: Save, chapter: Chapter, mission: Mission): number[] {
  if (mission.fixedSquad) return [...mission.fixedSquad]
  const away = awayMembers(save.operations, save.squads)
  const free = (o: number) => !away.includes(o) && !resting(save.crew.find((m) => m.outfit === o) ?? newMember(o))
  const theirs = save.squads.filter((s) => s.members.some((m) => chapter.leads.includes(m))).flatMap((s) => s.members)
  return [...new Set([...chapter.leads, ...theirs.filter(free), ...save.crew.map((m) => m.outfit).filter(free)])].slice(0, 4)
}

/** Why a member can't join the squad now, or null: resting at Strain 3 (a locked lead deploys anyway), or a rig problem
 * (over Capacity, a two-handed weapon with a full left hand). */
export function cantDeploy(save: Save, outfit: number, locked: readonly number[], rigProblem: string | null): string | null {
  const run = save.operations.find((r) => save.squads.find((s) => s.id === r.squad)?.members.includes(outfit))
  if (run) return `Away on an operation until watch ${run.back}: recall her squad from Comms`
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
/** Leaves the results: the crew takes its XP and Strain (the squad in full and +1 Strain, the bench half and a rest), the
 * Umas aboard who fought take the battle's rapport and send a message (CY13), a watch passes; then a win counts the
 * mission and goes aboard (its next scene) and a loss ends the mission. */
export function closeResults(save: Save, pack: StoryPack | null = null, rapport: ReadonlyMap<number, number> | null = null, lights: ((outfit: number) => number) | null = null,
  info: ((outfit: number) => DutyInfo | null) | null = null, camaraderie: ReadonlyMap<string, number> | null = null): Save {
  const m = save.mission
  if (!m) return save
  const input = (m.battle?.input ?? null) as BattleInput | null
  // Resting, an Uma sheds Strain by her cabin's Comfort (CY14): 1 at three lights, all of it at five.
  const crew = crewAfterMission(save.crew, m.squad, rewards(input, !!m.won).xp, lights ? (x) => restedStrain(x.strain, lights(x.outfit)) : undefined)
  // The results pay into the wallet (CY15): credits, salvage as Alloy, and Data.
  const r = rewards(input, !!m.won)
  const watched = passAWatch({ ...save, crew, wallet: earn(save.wallet, resultsPay(r.credits, r.salvage, !!m.won)) }, pack, { info: info ?? undefined, deployed: m.squad })
  // Camaraderie from the battle (CY17), and partners levelled to it.
  const cam = camaraderie ? addCamaraderie(watched.camaraderie, camaraderie) : watched.camaraderie
  // Cohesion (CY18): +1 for each squad that fought with three or more of its members, won or lost.
  const bonded = afterBattleBonds({ ...watched, camaraderie: cam, squads: m.battle ? cohesionAfter(watched.squads, m.squad) : watched.squads,
    partners: settlePartners(watched.partners, cam, watched.ship.research.done.includes(PARTNER_TUNING.level3)) }, pack, rapport)
  if (!m.won) return { ...bonded, mission: null }
  const first = !save.worlds.missions.includes(m.id)
  const missions = first ? [...save.worlds.missions, m.id] : save.worlds.missions
  // A first win brings one item for the cabins (CY14, by a fixed table over the mission's id).
  const items = first ? addItem(bonded.items, missionItem(m.id)) : bonded.items
  // The battle stays until the mission ends: a lead who fought it comes aboard at its XP (`joiningXp`).
  return { ...bonded, items, worlds: { ...save.worlds, missions }, mission: { ...m, step: 'aboard' } }
}
export const finishMission = (save: Save): Save => withMission(save, null)

/** The place on the current world where the next scene waits, or null. */
export function nextPlace(pack: StoryPack, save: Save): string | null {
  const world = save.worlds.current
  if (!world) return null
  for (const c of chaptersOn(pack, world)) {
    if (!needsMet(pack, save, c)) continue
    const next = c.scenes.find((s) => !save.story.seen.includes(s.id))
    if (next) return 'arrive' in next.trigger ? next.trigger.arrive : 'talk' in next.trigger ? next.trigger.talk : null
  }
  return null
}

/** A new game's opening (TC36): nothing seen yet and no mission, so the ship goes straight to the first scene. */
export const opening = (pack: StoryPack, save: Save): string | null => (save.story.seen.length === 0 && !save.mission ? nextPlace(pack, save) : null)

/** What the ship's Continue card says is waiting: the mission in progress, the debrief, the next scene, else a world to
 * jump to. */
export function waiting(pack: StoryPack, save: Save): { text: string; to: string } | null {
  const m = save.mission
  if (m) {
    const words = { briefing: 'the briefing', deploy: 'deploying the squad', battle: 'the battle in progress', results: 'the results', aboard: 'the scene aboard' }[m.step]
    return { text: `Continue ${m.id}: ${words}`, to: '/mission' }
  }
  const debrief = debriefDue(pack, save)
  if (debrief) return { text: `Debrief: ${debrief.id}`, to: '/' }
  const place = nextPlace(pack, save)
  if (place) return { text: `Next: ${place} on ${save.worlds.current}`, to: `/room/bridge?node=${place}` }
  const open = reachableWorlds(save, pack)
  if (open[0]) return { text: `Next: jump to ${open[0]} from the Bridge's star map`, to: '/room/bridge?view=stars' }
  return null
}

// --- Readiness (CY18, TC64) --------------------------------------------------------------------------------------------

/** A finale's readiness needs, each met or not now; an unmet one adds its harsh condition to the battle. */
export function finaleNeeds(pack: StoryPack, save: Save, mission: Mission): { need: ReadinessNeed; met: boolean }[] {
  if (!mission.finale) return []
  const ctx = { systems: systemsBuilt(save), standing: standingNow(pack, save), total: readinessNow(pack, save) }
  const unmet = unmetNeeds(mission.readiness ?? [], ctx)
  return (mission.readiness ?? []).map((need) => ({ need, met: !unmet.includes(need) }))
}
export const finaleConditions = (pack: StoryPack, save: Save, mission: Mission): FinaleCondition[] => finaleNeeds(pack, save, mission).filter((n) => !n.met).map((n) => n.need.else)

/** The next finale waiting in the story (a chapter's finale mission not won yet whose world is known or reachable), for
 * the Bridge's readiness meter: its needs and the total it measures. */
export function nextFinale(pack: StoryPack, save: Save): { chapter: Chapter; mission: Mission } | null {
  for (const c of Object.values(pack.chapters).sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))) {
    const m = c.missions.find((x) => x.finale && !save.worlds.missions.includes(x.id))
    if (m) return { chapter: c, mission: m }
  }
  return null
}
