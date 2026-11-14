// The life-aboard loop, headless (CY19, TC74, Phase 4's exit): a new game on the stand-in plays both Chapter 1s and the
// storm-ridge finale through the director, every battle at rules version 3 with the ship's life frozen into its input,
// and at every stop aboard: the log and an event card, duties by auto-assign, three visits (a talk, a gift, a
// decoration), replies, bond scenes, a build or a project when the wallet allows, an operation when a squad is free, and
// the systems powered. Between chapters the ship jumps between known worlds while the builds finish. Every save goes
// through JSON and the parser, as resume would, and each stop's taps are counted against TC72's five minutes.
import { applyBattleAction, chooseAction, startBattle, TUNING, type Band, type BattleAction, type BattleInput } from '@cyber/battle'
import {
  assignPost, freePlace, FURNITURE, loadoutOf, MODULES_BY_ID, newMember, newSave, parsePack, parseSave, postKind, POSTS, readinessNow, sceneSeconds, shipCapabilities, standingNow, STAND_IN_FILES, systemsBuilt,
  type Chapter, type Mission, type ModuleId, type PostKind, type Save, type Scene, type ShipLog, type StoryPack, type SystemId,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { applyBondEffect, bondFileOf, bondSceneDone, readyBondScene, replyTo } from '../bonds/bonds'
import { battleCamaraderie, battleRapport } from '../bonds/battleRapport'
import { resume } from '../battle/session'
import { comfortFor, lightsFrom, placeItem, tastesFor, visit, visitsLeftNow } from '../cabins/cabins'
import { crewViews, infoFrom, memberView, type CrewView } from '../crew/view'
import { moveToSquad } from '../crew/squads'
import { autoAssignSave, answerEvent, currentEvent, dutyInfoFrom } from '../ship/duties'
import { placeOnShip, researchOnShip, setPowered } from '../ship/build'
import { expectedOutcome, offersNow, sendOperation } from '../ship/operations'
import { playScene, type SceneUi } from '../story/runner'
import { lifeAboardInput, missionInput } from './battleInput'
import {
  afterMission, applyStep, atNode, closeResults, debriefDue, debriefScene, deploy, ensureWorld, finaleConditions, finishBattle, finishMission, markSeen, nextPlace,
  reachableWorlds, recordAction, sceneSquad, startMission, toDeploy, travel, waiting,
} from './director'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-13T12:00:00.000Z'
const roundTrip = (s: Save): Save => parseSave(JSON.parse(JSON.stringify(s)))
const info = infoFrom(null)
const LEAD_A = 9000001, LEAD_B = 9000002
/** TC72's pace: a tap is about 2.5 s (open, choose, read the card); a scene line at the scene check's pace. */
const TAP_SECONDS = 2.5

interface Stop { watch: number; taps: number; seconds: number }

async function playLifeAboard() {
  let save = roundTrip(ensureWorld(roundTrip(newSave('u', T0)), pack))
  const views = (): CrewView[] => crewViews(save, pack, info, (o) => `Uma ${o}`)
  const logs: ShipLog[] = [], stops: Stop[] = [], reports: string[] = [], paths: number[] = [], conditions: string[][] = [], finaleInputs: BattleInput[] = []
  const resumed = { build: false, operation: false, battle: false, bond: false }
  const set = (s: Save) => { save = roundTrip(s) }
  const afterWatch = () => { if (save.log) logs.push(save.log) }

  const ui = (scene?: { id: string }): SceneUi => ({
    line: async () => {}, emote: async () => {}, wait: async () => {}, choose: async () => 0, call: async () => 0,
    effect: (step) => set(applyStep(save, pack, step)),
    battle: async (missionId) => {
      if (scene) set(markSeen(save, scene.id))
      const chapter = Object.values(pack.chapters).find((c) => c.missions.some((m) => m.id === missionId))!
      await runMission(chapter, chapter.missions.find((m) => m.id === missionId)!)
    },
  })
  const play = async (scene: Scene, squad?: readonly number[]) => {
    await playScene(scene, ui(scene), { pack, squad: sceneSquad(pack, save, squad), skipping: () => false, stopSkipping: () => {} })
    if (!save.story.seen.includes(scene.id)) set(markSeen(save, scene.id))
  }

  /** A mission at rules version 3: the squad by default (squads first, the away left out), the ship's life in the input. */
  async function runMission(chapter: Chapter, mission: Mission) {
    for (let attempt = 1; attempt <= 6; attempt++) {
      set(toDeploy(startMission(save, chapter, mission)))
      const squad = save.mission!.squad
      const all = views(), sq = squad.map((o) => all.find((v) => v.outfit === o) ?? memberView(newMember(o), pack, info, (x) => `Uma ${x}`))
      const bench = all.filter((v) => !squad.includes(v.outfit))
      const base = missionInput(mission.scenario!, sq.map((v) => ({ outfit: v.outfit, label: v.name, bands: v.bands, loadout: loadoutOf(v.rig), stride: v.stride })), bench.map((v) => v.role), `${mission.id}:${attempt}`)
      const bandOfPost = (post: PostKind) => { const h = all.find((v) => v.member.post && postKind(v.member.post) === post); return h ? Math.max(...POSTS[post].bands.map((b) => h.bands[b])) as Band : null }
      if (mission.finale) conditions.push(finaleConditions(pack, save, mission))
      const input = lifeAboardInput(base, save, bandOfPost, finaleConditions(pack, save, mission))
      expect(input.rulesVersion).toBe(3)
      if (mission.finale) finaleInputs.push(input)
      set({ ...deploy(save, input), meal: null })
      let state = startBattle(input).state
      while (!state.result && state.time < 60 * TUNING.roundTicks) {
        const action: BattleAction = chooseAction(state)
        const r = applyBattleAction(state, action)
        expect(r.error ?? null).toBeNull()
        state = r.state
        save = recordAction(save, action)
        // Resume mid-battle: the saved input and actions replay to the same state.
        if (!resumed.battle && save.mission!.battle!.actions.length === 6) {
          const back = roundTrip(save), s = resume(back.mission!.battle!.input as BattleInput, back.mission!.battle!.actions as BattleAction[])
          expect('error' in s).toBe(false)
          if (!('error' in s)) expect(JSON.stringify(s.state)).toBe(JSON.stringify(state))
          resumed.battle = true
        }
      }
      set(finishBattle(save, state.result?.winner === 'squad'))
      const won = !!save.mission?.won
      const actions = save.mission!.battle!.actions as BattleAction[]
      set(closeResults(save, pack, battleRapport(input, actions), lightsFrom(pack, views()), dutyInfoFrom(views()), battleCamaraderie(input, actions)))
      afterWatch()
      if (!won) continue
      const next = afterMission(pack, save, chapter.world, mission.id)
      if (next.kind === 'scene') await play(next.scene, save.mission!.squad)
      set(finishMission(save))
      return
    }
    throw new Error(`${mission.id} never won in six attempts`)
  }

  async function playWorld() {
    for (let guard = 0; guard < 20; guard++) {
      const world = save.worlds.current!
      const place = nextPlace(pack, save) ?? pack.worlds[world]!.locations.map((l) => l.id).find((id) => atNode(pack, save, world, id).kind !== 'none')
      if (!place) break
      const due = atNode(pack, save, world, place)
      if (due.kind === 'scene') await play(due.scene)
      else if (due.kind === 'mission') await runMission(due.chapter, due.mission)
      else break
    }
    const debrief = debriefDue(pack, save)
    if (debrief) await play(debriefScene(debrief))
  }

  /** A bond scene, its captain's choices (the first) and Trust or Heart at rank 8 (Heart for Lead A), then done. */
  async function playBond(outfit: number, rank: number): Promise<number> {
    const scene = bondFileOf(pack, outfit)!.scenes.find((sc) => sc.rank === rank)!
    const bondUi: SceneUi = { ...ui(), captain: async () => 0, path: async () => (outfit === LEAD_A ? 'heart' : 'trust'), bond: (e) => set(applyBondEffect(save, pack, outfit, e)) }
    // Resume mid-scene: a reload before it's done plays it again from its start.
    if (!resumed.bond) { expect(readyBondScene(pack, roundTrip(save).crew.find((m) => m.outfit === outfit)!)).toBe(rank); resumed.bond = true }
    await playScene(scene, bondUi, { pack, squad: sceneSquad(pack, save), skipping: () => false, stopSkipping: () => {} })
    set(bondSceneDone(save, outfit, rank))
    if (rank === 8) paths.push(outfit)
    return sceneSeconds(scene)
  }

  /** What the Engineering bay and the Lab take on next, when the wallet allows: the Lab, the Sensors, the Shield Projector
   * (after its research), the Engines and the Workshop (after theirs). One build at a time. */
  const PLAN: ModuleId[] = ['lab', 'sensors', 'shield', 'engines', 'workshop']
  const RESEARCH = ['shield-projector', 'engines', 'workshop']
  function buildAndResearch(): number {
    let taps = 0
    const building = save.ship.modules.some((m) => m.building)
    const next = PLAN.find((id) => !save.ship.modules.some((m) => m.id === id))
    if (!building && next) {
      const at = freePlace(save.ship, next)
      const s = at ? placeOnShip(save, next, at.deck, at.slot) : save
      if (s !== save) { set(s); taps += 3 }
    }
    if (!save.ship.research.current && save.ship.modules.some((m) => m.id === 'lab' && m.level >= 1)) {
      const project = RESEARCH.find((p) => !save.ship.research.done.includes(p))
      const s = project ? researchOnShip(save, project) : save
      if (s !== save) { set(s); taps += 3 }
    }
    if (!resumed.build && save.ship.modules.some((m) => m.building)) { expect(roundTrip(save).ship).toEqual(save.ship); resumed.build = true }
    return taps
  }

  /** A stop aboard: everything a player does between battles, with its taps. */
  async function stop(): Promise<void> {
    let taps = 0, seconds = 0
    if (save.log && !save.log.read) { set({ ...save, log: { ...save.log, read: true } }); taps += 1 }
    if (currentEvent(save, pack)) { set(answerEvent(save, pack, views(), 0)!.save); taps += 2 }
    set(autoAssignSave(save, views(), [])); taps += 3
    // The Workshop's artisan makes the furniture the cabins need: Lead B takes the post when Auto-assign leaves it empty.
    if (save.ship.modules.some((m) => m.id === 'workshop' && m.level >= 1) && !save.crew.some((m) => m.post?.module === 'workshop')) { set(assignPost(save, LEAD_B, { module: 'workshop', index: 0 })); taps += 2 }
    for (const o of save.inbox) { set(replyTo(save, pack, o)); taps += 2 }
    // Three visits: Lead A gets a talk on a topic she loves and a decoration (or a gift once her cabin glows at three);
    // the Uma with the lowest bond gets a talk on hers.
    const view = (o: number) => views().find((v) => v.outfit === o)!
    const low = [...save.crew].sort((x, y) => x.bond.rank - y.bond.rank || x.bond.rapport - y.bond.rapport || x.outfit - y.outfit)[0]!.outfit
    const topic = (o: number) => tastesFor(pack, view(o)).topics[0]!
    const gift = Object.keys(save.items).find((id) => id.startsWith('gift-')) ?? null
    const second = comfortFor(pack, view(LEAD_A)).lights >= 3 && gift ? { kind: 'gift' as const, item: gift } : { kind: 'decorate' as const }
    const choices: [number, Parameters<typeof visit>[3]][] = [[LEAD_A, { kind: 'talk', topic: topic(LEAD_A) }], [LEAD_A, second], [low === LEAD_A ? save.crew[0]!.outfit : low, { kind: 'talk', topic: topic(low) }], [LEAD_A, { kind: 'decorate' }]]
    for (const [o, c] of choices) {
      if (visitsLeftNow(save) === 0) break
      const r = visit(save, pack, view(o), c)
      if (r) { set(r.save); taps += 4 }
    }
    // The Decorate tab: a piece in her favourite style goes in wherever it raises her Comfort.
    const fav = tastesFor(pack, view(LEAD_A)).favourite
    for (const f of FURNITURE.filter((x) => x.style === fav && (save.items[x.id] ?? 0) > 0)) {
      const before = comfortFor(pack, view(LEAD_A)).points, tried = placeItem(save, LEAD_A, f.slot, f.id)
      if (tried !== save && comfortFor(pack, crewViews(tried, pack, info, String).find((v) => v.outfit === LEAD_A)!).points > before) { set(tried); taps += 2 }
    }
    // Bond scenes ready, any Uma's.
    for (const m of save.crew) { const rank = readyBondScene(pack, m); if (rank !== null) { seconds += await playBond(m.outfit, rank); taps += 2 } }
    taps += buildAndResearch()
    // An operation when no story mission waits and a squad is free (never Lead B's: she leads the finale), only one Comms
    // shows as a full success, so nobody comes back strained.
    const free = save.squads.find((s) => !s.members.includes(LEAD_B) && !save.operations.some((r) => r.squad === s.id))
    const op = free && !save.mission && waiting(pack, save) === null ? offersNow(pack, save).find((o) => expectedOutcome(save, free.id, o) === 'full') : undefined
    if (free && op) {
      set(sendOperation(pack, save, free.id, op.id)); taps += 3
      if (!resumed.operation) { expect(roundTrip(save).operations).toEqual(save.operations); resumed.operation = true }
    }
    // Power the systems built, as many as the reactor takes.
    const built = systemsBuilt(save) as SystemId[]
    for (let n = built.length; n > 0; n--) { const s = setPowered(save, built.slice(0, n)); if (s !== save) { set(s); taps += 1; break } }
    stops.push({ watch: save.watch, taps, seconds: seconds + taps * TAP_SECONDS })
    if (save.log?.reports?.length) for (const r of save.log.reports) if (!reports.includes(r.op + '@' + save.log.watch)) reports.push(r.op + '@' + save.log.watch)
  }
  const jump = (world: string) => { set(travel(save, world, pack, { info: dutyInfoFrom(views()) })); afterWatch() }

  // Chapter 1 on sw1, a stop, the jump, Chapter 1 on sw2, a stop.
  await playWorld()
  await stop()
  jump('sw2'); await stop()
  await playWorld()
  // Lead B gets her own squad, so the Vanguard can run operations while she waits for the finale.
  set(moveToSquad(save, LEAD_B, 'new'))
  await stop()
  // Between chapters: jumps between the known worlds while the builds finish, a stop at each, until the finale opens.
  const before = { readiness: readinessNow(pack, save), conditions: finaleConditions(pack, save, pack.chapters['sw2-ch2']!.missions[0]!) }
  let sawSw3 = false
  for (let i = 0; i < 40; i++) {
    if (save.worlds.current === 'sw2' && nextPlace(pack, save) === 'sw2-storm-ridge' && !save.operations.length) break
    const open = reachableWorlds(save, pack)
    const to = open.includes('sw3') && !sawSw3 ? 'sw3' : save.worlds.current === 'sw2' ? 'sw1' : 'sw2'
    if (to === 'sw3') sawSw3 = true
    jump(to); await stop()
  }
  await playWorld()
  // After the finale, on until the Engines' drive reaches the third world and Lead A's bond reaches its rank-8 choice.
  const glowing = () => comfortFor(pack, views().find((v) => v.outfit === LEAD_A)!).lights >= 3
  for (let i = 0; i < 60 && !(sawSw3 && paths.includes(LEAD_A) && glowing()); i++) {
    const to = reachableWorlds(save, pack).includes('sw3') ? 'sw3' : save.worlds.current === 'sw2' ? 'sw1' : 'sw2'
    if (to === 'sw3') sawSw3 = true
    jump(to); await stop()
  }
  return { save, logs, stops, reports, paths, conditions, before, sawSw3, resumed, finaleInputs }
}

describe('the life-aboard loop (Phase 4’s exit)', () => {
  it('plays every system of ship life on the stand-in, and the finale feels the readiness', async () => {
    const r = await playLifeAboard()
    const s = r.save
    // The story: both Chapter 1s and the finale won; the third world reached by the drive.
    expect(s.worlds.missions).toEqual(expect.arrayContaining(['sw1-ch1-m1', 'sw2-ch1-m1', 'sw2-ch2-m1']))
    expect(r.sawSw3).toBe(true)
    expect(Object.keys(s.worlds.known)).toEqual(expect.arrayContaining(['sw1', 'sw2', 'sw3']))
    expect(shipCapabilities(s.ship)).toEqual(expect.arrayContaining(['storm', 'drive-1', 'sensors']))
    // Bonds: every rank rose, and a rank-8 path was chosen (Heart for Lead A).
    expect(s.crew.every((m) => m.bond.rank >= 2)).toBe(true)
    expect(r.paths).toContain(LEAD_A)
    expect(s.crew.find((m) => m.outfit === LEAD_A)!.bond.path).toBe('heart')
    // A cabin at Comfort 3 or more.
    const lead = crewViews(s, pack, info, String).find((v) => v.outfit === LEAD_A)!
    expect(comfortFor(pack, lead).lights).toBeGreaterThanOrEqual(3)
    // The ship log pays every watch once the posts are held.
    const paid = r.logs.slice(1)
    expect(paid.length).toBeGreaterThan(10)
    for (const log of paid) expect(log.gains.credits + log.gains.alloy + log.gains.data, `watch ${log.watch}`).toBeGreaterThan(0)
    // A module and a project finished: the Lab, the Sensors, the Shield and the Engines built; both projects done.
    for (const id of ['lab', 'sensors', 'shield', 'engines', 'workshop'] as ModuleId[]) expect(s.ship.modules.find((m) => m.id === id)?.level, MODULES_BY_ID.get(id)!.name).toBeGreaterThanOrEqual(1)
    expect(s.ship.research.done).toEqual(expect.arrayContaining(['shield-projector', 'engines', 'workshop']))
    // An operation reported, and standing moved: the union by the debrief and the patrol, the muster both ways.
    expect(r.reports.length).toBeGreaterThan(0)
    expect(s.operationsWon.length).toBeGreaterThan(0)
    const standing = standingNow(pack, s)
    expect(standing['dock-union']).toBeGreaterThanOrEqual(1)
    // The muster: +1 after the finale, then −1 for cutting its supply lines (won in full): Hostile again, and moved.
    expect('steel-muster' in s.standing).toBe(true)
    expect(standing['steel-muster']).toBe(s.operationsWon.includes('sw1-op-lines') ? -2 : -1)
    // The finale's conditions followed the readiness: fog while the Sensors weren't built, none at the finale.
    expect(r.before.conditions).toContain('fog')
    expect(r.conditions[0]).toEqual([])
    expect(readinessNow(pack, s)).toBeGreaterThan(r.before.readiness)
    // The battle feels it: the finale's input carries the bonds, the Orders and the powered systems (the simulator's
    // balance pass measures what they're worth: +20.6 points on average, D31).
    const finale = r.finaleInputs[0]!
    expect(finale.units.filter((u) => u.side === 'squad' && u.bond).length).toBeGreaterThan(0)
    expect(finale.orders?.slots).toBeGreaterThan(0)
    expect(finale.systems?.length).toBeGreaterThan(0)
    // Squads: the Vanguard fought together to cohesion 1 or more.
    expect(s.squads.find((q) => q.id === 'sw-vanguard')!.cohesion).toBeGreaterThanOrEqual(2)
    // Resume at every point: mid-build, mid-operation, mid-battle and mid-scene.
    expect(r.resumed).toEqual({ build: true, operation: true, battle: true, bond: true })
    // Time aboard (TC72): every stop well under five minutes at the scene check's pace.
    for (const st of r.stops) expect(st.seconds, `the stop at watch ${st.watch}`).toBeLessThan(300)
    expect(Math.max(...r.stops.map((st) => st.taps))).toBeLessThanOrEqual(40)
    expect(s.mission).toBeNull()
  }, 120_000)
})
