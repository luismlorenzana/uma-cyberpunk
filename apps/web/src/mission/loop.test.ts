// The Chapter 1 loop, headless (CY12, TC51, Phase 3's exit): a new game on the stand-in plays Lead A's Chapter 1 on sw1
// to her pickup, her room and her debrief, jumps to sw2, and plays Lead B's to hers, through the director and the scene
// runner, every battle auto-played on fixed seeds. Every save goes through JSON and the parser, as resume would.
import { applyBattleAction, chooseTurn, startBattle, TUNING, type BattleAction } from '@cyber/battle'
import {
  levelOf, loadoutOf, newMember, newSave, parsePack, parseSave, sceneSeconds, STAND_IN_FILES, worldNodes, type Chapter, type Mission, type Save, type Scene,
  type StoryPack,
} from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { infoFrom, memberView } from '../crew/view'
import { playScene, slotLine, type SceneUi } from '../story/runner'
import { battleRapport } from '../bonds/battleRapport'
import { missionInput, SCENARIOS } from './battleInput'
import {
  afterMission, applyStep, atNode, closeResults, debriefDue, debriefScene, defaultSquad, deploy, ensureWorld, finishBattle, finishMission, markSeen, nextPlace,
  opening, reachableWorlds, recordAction, sceneSquad, startMission, timeline, toDeploy, travel, waiting,
} from './director'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const T0 = '2026-11-12T12:00:00.000Z'
const roundTrip = (s: Save): Save => parseSave(JSON.parse(JSON.stringify(s)))
const info = infoFrom(null)

/** Plays the whole stand-in loop; `withLeadA` decides whether Lead A goes on Lead B's mission. */
async function playLoop(withLeadA: boolean) {
  let save = roundTrip(newSave('u', T0))
  const lines: { scene: string; speaker: number | string | null; text: string }[] = []
  const log: string[] = []
  let firstBattleSeconds: number | null = null
  let seconds = 0

  const ui = (scene: Scene): SceneUi => ({
    line: async (speaker, text) => { lines.push({ scene: scene.id, speaker, text }) },
    emote: async () => {}, wait: async () => {},
    choose: async () => 0, call: async () => 0,
    effect: (step) => { save = roundTrip(applyStep(save, pack, step)) },
    battle: async (missionId) => {
      firstBattleSeconds ??= seconds
      const chapter = Object.values(pack.chapters).find((c) => c.missions.some((m) => m.id === missionId))!
      save = roundTrip(markSeen(save, scene.id))
      await runMission(chapter, chapter.missions.find((m) => m.id === missionId)!)
    },
  })
  const play = async (scene: Scene, squad?: readonly number[]) => {
    seconds += sceneSeconds(scene)
    log.push(scene.id)
    await playScene(scene, ui(scene), { pack, squad: sceneSquad(pack, save, squad), skipping: () => false, stopSkipping: () => {} })
    if (!save.story.seen.includes(scene.id)) save = roundTrip(markSeen(save, scene.id))
  }

  async function runMission(chapter: Chapter, mission: Mission) {
    for (let attempt = 1; attempt <= 6; attempt++) {
      save = roundTrip(toDeploy(startMission(save, chapter, mission)))
      let squad = defaultSquad(save, chapter, mission)
      if (chapter.id === 'sw2-ch1' && !withLeadA) squad = squad.filter((o) => o !== 9000001)
      if (chapter.id === 'sw2-ch1' && withLeadA && !squad.includes(9000001)) squad = [...squad.slice(0, 3), 9000001]
      const views = squad.map((o) => memberView(save.crew.find((m) => m.outfit === o) ?? newMember(o), pack, info, (x) => `Uma ${x}`))
      for (const v of views) expect(v.stats.problem, `${v.name}'s rig`).toBeNull()
      const bench = save.crew.filter((m) => !squad.includes(m.outfit)).map((m) => memberView(m, pack, info, String).role)
      const input = missionInput(mission.scenario!, views.map((v) => ({ outfit: v.outfit, label: v.name, bands: v.bands, loadout: loadoutOf(v.rig), stride: v.stride })), bench, `${mission.id}:${attempt}`)
      save = roundTrip(deploy({ ...save, mission: { ...save.mission!, squad } }, input))
      // Auto on both sides, every action saved as the screen does.
      let state = startBattle(input).state
      while (!state.result && state.time < 60 * TUNING.roundTicks) {
        const action: BattleAction = chooseTurn(state)
        const r = applyBattleAction(state, action)
        expect(r.error ?? null).toBeNull()
        state = r.state
        save = recordAction(save, action)
      }
      save = roundTrip(finishBattle(save, state.result?.winner === 'squad'))
      const won = !!save.mission?.won
      save = roundTrip(closeResults(save, pack, battleRapport(input, save.mission!.battle!.actions as BattleAction[])))
      if (!won) continue
      const next = afterMission(pack, save, chapter.world, mission.id)
      expect(next.kind).toBe('scene')
      if (next.kind === 'scene') await play(next.scene, save.mission!.squad)
      save = roundTrip(finishMission(save))
      return
    }
    throw new Error(`${mission.id} never won in six attempts`)
  }

  /** Plays everything due on the current world, node by node, as the Continue card leads. */
  async function playWorld() {
    for (let guard = 0; guard < 20; guard++) {
      const place = nextPlace(pack, save) ?? pack.worlds[save.worlds.current!]!.locations.map((l) => l.id).find((id) => atNode(pack, save, save.worlds.current!, id).kind !== 'none')
      if (!place) return
      const due = atNode(pack, save, save.worlds.current!, place)
      if (due.kind === 'scene') await play(due.scene)
      else if (due.kind === 'mission') await runMission(due.chapter, due.mission)
      else return
    }
  }

  // A new game: the first lead's world, and straight into her first scene.
  save = roundTrip(ensureWorld(save, pack))
  expect(save.worlds.current).toBe('sw1')
  expect(opening(pack, save)).toBe('sw1-docks')
  await playWorld()
  const afterA = structuredClone(save)
  expect(debriefDue(pack, save)?.id).toBe('sw1-ch1')
  await play(debriefScene(pack.chapters['sw1-ch1']!))
  const toB = waiting(pack, save)
  expect(reachableWorlds(save, pack)).toEqual(['sw2'])
  save = roundTrip(travel(save, 'sw2'))
  await playWorld()
  expect(debriefDue(pack, save)?.id).toBe('sw2-ch1')
  await play(debriefScene(pack.chapters['sw2-ch1']!))
  return { save, afterA, toB, lines, log, firstBattleSeconds }
}

describe('the Chapter 1 loop (Phase 3’s exit)', () => {
  it('plays both Chapter 1s: two pickups, two rooms, two debriefs in the Timeline, a crew Uma by join in each', async () => {
    const { save, afterA, toB, log, firstBattleSeconds } = await playLoop(true)
    expect(log).toEqual(['sw1-ch1-s1', 'sw1-ch1-s2', 'sw1-ch1-s3', 'sw1-ch1-debrief', 'sw2-ch1-s1', 'sw2-ch1-s2', 'sw2-ch1-s3', 'sw2-ch1-debrief'])
    // Lead A aboard, her room open, after her chapter only.
    expect(afterA.crew.map((m) => m.outfit)).toEqual([9000003, 9000001])
    expect(afterA.ship.rooms).toContain('comms')
    expect(afterA.ship.rooms).not.toContain('store')
    expect(toB).toEqual({ text: "Next: jump to sw2 from the Bridge's star map", to: '/room/bridge?view=stars' })
    // Both leads and both crew Umas aboard, both rooms open, both missions won.
    expect(save.crew.map((m) => m.outfit)).toEqual([9000003, 9000001, 9000004, 9000002])
    expect(save.ship.rooms).toEqual(expect.arrayContaining(['comms', 'store']))
    expect(save.worlds.missions).toEqual(['sw1-ch1-m1', 'sw2-ch1-m1'])
    expect(timeline(pack, save).map((s) => s.id)).toEqual(log)
    expect(save.mission).toBeNull()
    expect(waiting(pack, save)).toBeNull()
    // The first battle comes within two minutes of a new game (TC36).
    expect(firstBattleSeconds).toBeLessThan(120)
  })

  it('brings each lead aboard at the squad’s level, never level 1', async () => {
    const { save, afterA } = await playLoop(true)
    const lead = (s: Save, o: number) => s.crew.find((m) => m.outfit === o)!
    expect(levelOf(lead(afterA, 9000001).xp)).toBeGreaterThan(1)
    expect(levelOf(lead(save, 9000002).xp)).toBeGreaterThan(1)
    expect(lead(save, 9000002).xp).toBeGreaterThanOrEqual(Math.floor(save.crew.filter((m) => m.outfit !== 9000002).reduce((n, m) => n + m.xp, 0) / 3) - 1)
  })

  it('plays Lead A’s interjection when she’s in the squad, the fallback when not (TC51)', async () => {
    const slotIn = (lines: Awaited<ReturnType<typeof playLoop>>['lines']) => lines.filter((l) => l.scene === 'sw2-ch1-s3')[0]
    const withA = await playLoop(true)
    expect(slotIn(withA.lines)).toMatchObject({ speaker: 9000001, text: 'Not bad. The ship could use someone who keeps us standing.' })
    const withoutA = await playLoop(false)
    expect(slotIn(withoutA.lines)).toMatchObject({ speaker: null, text: 'Lead B looks up at the ship for a long moment.' })
    // On the map, the slot hears the crew aboard: Lead A, after her pickup.
    expect(withA.lines.find((l) => l.scene === 'sw2-ch1-s1' && l.speaker === 9000001)).toBeDefined()
    expect(slotLine({ kind: 'slot', lines: { '9000001': 'x' }, fallback: 'y' }, [9000003])).toEqual({ speaker: null, text: 'y' })
  })

  it('names every locked node’s key and danger on both worlds, and every mission’s scenario exists', () => {
    const save = ensureWorld(newSave('u', T0), pack)
    const progress = { missions: save.worlds.missions, chapters: [] }
    const keys = Object.values(pack.worlds).flatMap((w) => worldNodes(pack, w, save.story, progress)).filter((n) => n.state === 'locked').map((n) => [n.id, n.danger, n.key])
    expect(keys).toEqual([
      ['sw1-underlevels', 2, expect.stringMatching(/sw1-file-1/)],
      ['sw2-gate', 2, expect.stringMatching(/sw1-ch1/)],
      ['sw2-yards', 2, expect.stringMatching(/sw1-ch1/)],
      ['sw2-spire', 3, expect.stringMatching(/sw2-ch1-m1/)],
    ])
    for (const c of Object.values(pack.chapters)) for (const m of c.missions) expect(SCENARIOS[m.scenario!], m.id).toBeDefined()
  })
})
