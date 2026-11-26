import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { delimiter, resolve } from 'node:path'
import { chooseAction, legalTurns, maxHpOf, objectiveProgress, type BattleInput, type TurnAction } from '@cyber/battle'
import { CAMPAIGN_XP_THRESHOLDS, campaignLevel, chooseSubclass, migrateCampaignXp, newMember, newSave, parseSave, resumeCommand,
  startSupply, type CampaignBook, type ExpeditionRun, type GroundEncounter, type Mission, type Save } from '@cyber/domain'
import { describe, expect, it, vi } from 'vitest'
import { act, resume, startSession } from '../battle/session'
import { deploy, finishBattle, recordAction, retry, toDeploy } from '../mission/director'
import { lifeAboardInput } from '../mission/battleInput'
import { commitExpedition, expeditionSquad } from './expedition'
import { settleGround } from './ground'
import { loadCampaign } from './load'
import { combatReadiness, indexCampaignNavigation } from './navigation'
import { campaignBattleProgression, initializeCampaignCurve } from './progression'
import { closeSalvage, salvageDeployment, startSalvage } from './salvage'
import { campaignSquadInput, expeditionGroundInput, groundInput } from './training'
import { craftCampaignPart, fitCampaignPart } from './workshop'
import { stationOf } from './watch'

vi.mock('../content/client', () => ({ CONTENT: {} }))

const lead = 9000771
const second = 9000772
const story: CampaignBook['story'] = { casting: { schemaVersion: 1, leads: [], crewOrder: [], heroines: [], minor: [] },
  worlds: {}, chapters: {}, calls: {}, bonds: {}, events: {}, files: {} }
const capture: GroundEncounter = { id: 'capture', title: 'Capture', win: { flag: 'captured' },
  rescue: { unit: 'station-commander', heroine: 'fixture-general', label: 'General' } }
const formation: ExpeditionRun['members'] = [{ role: 'uma', outfit: lead }, { role: 'uma', outfit: second },
  ...(['boss-ally', 'melee-shield', 'ranged-medic', 'long-range'] as const).flatMap(role =>
    [1, 2].map(index => ({ role, heroine: `fixture-${role}-${index}` })))]
const duo = { id: 'duo', system: 'fixture-system', umas: [lead, second] as const, returns: [], expedition: { ship: 'cutter', members: formation,
  route: { name: 'Test expedition', launch: 'lift-off', stops: [], return: 'return', cargo: { fuel: 2, provisions: 2 } } } }
const book: CampaignBook = { opening: 'opening', draft: false, quests: [], assets: [], art: [], pairs: [], story, scenes: new Map(),
  commands: new Map(), ground: new Map([[capture.id, capture]]),
  fourAct: { schemaVersion: 1, systems: new Map(), arcs: new Map(), duos: new Map([[duo.id, duo]]), personalQuestOwners: new Map() },
  supply: { after: 'opening', start: 'dock', routes: [], ports: [{ id: 'dock', name: 'Dock', scene: 'arrive',
    stock: { fuel: 8, provisions: 8, alloy: 3 }, reserve: { fuel: 0, provisions: 0, alloy: 0 },
    upkeep: { fuel: 0, provisions: 0, alloy: 0 }, produces: { fuel: 0, provisions: 0, alloy: 0 } }] } }
const fresh = () => ({ ...newSave('cy129-fixture', '2026-11-26T00:00:00Z'), crew: [newMember(lead)], campaignSupply: startSupply(book.supply!) })
const deployAt = (save: Save, id: string, squad: number[] = [lead]): Save => ({ ...save,
  mission: { chapter: 'fixture', id, squad, step: 'deploy', battle: null, won: null } })
const revive = (save: Save) => parseSave(JSON.parse(JSON.stringify(save)))
const expeditionMission = (scenario = 'expedition-reach'): Mission => ({ id: 'expedition-test', scenario, place: 'Relay',
  objective: { kind: 'reach' }, brief: '', enemies: [], fixedSquad: null, side: [] })

function play(input: BattleInput, limit = 160) {
  let { session } = startSession(input)
  for (let turn = 0; turn < limit && !session.state.result; turn++) {
    const state = session.state
    let action = chooseAction(state)
    const active = state.units.find(unit => unit.id === state.active)!
    const objective = input.objective
    if (active.side === 'squad' && (objective.kind === 'reach' || objective.kind === 'hack')) {
      const legal = legalTurns(state)
      const hack = objective.kind === 'hack' && legal.find(row => row.act.kind === 'hack' && !state.field?.hacked.includes(row.act.terminal))
      const terminal = objective.kind === 'hack' && input.units.find(unit => unit.id === active.id)?.loadout.back.kind === 'deck'
        ? input.map.props?.find(row => row.kind === 'terminal' && !state.field?.hacked.includes(row.id)
          && (row.id !== objective.last || state.field?.hacked.length === objective.count - 1)) : undefined
      const tile = objective.kind === 'reach' ? objective.tile : terminal?.kind === 'terminal' ? terminal.tile : undefined
      const distance = (point: readonly [number, number]) => tile ? Math.abs(point[0] - tile[0]) + Math.abs(point[1] - tile[1]) : Infinity
      const approach = tile && legal.filter(row => row.act.kind === 'none').sort((a, b) => distance(a.to) - distance(b.to))[0]
      const protectedUnits = input.protect ?? (objective.kind === 'hack' ? objective.protect : undefined)
      const unsafe = action.kind === 'turn' && action.act.kind === 'attack' && protectedUnits?.includes(action.act.target)
      const safe = unsafe && legal.find(row => row.act.kind === 'attack' && !protectedUnits!.includes(row.act.target))
      const chosen = hack || approach || safe || unsafe && legal.find(row => row.act.kind === 'wait')
      if (chosen) action = { kind: 'turn', unit: active.id, to: chosen.to, dash: chosen.dash, act: chosen.act, face: active.facing } satisfies TurnAction
    }
    const next = act(session, action)
    if ('error' in next) throw new Error(next.error)
    session = next.session
  }
  return session
}

function saveVictory(save: Save, session: ReturnType<typeof play>, finale?: ExpeditionRun) {
  expect(session.state.result?.winner).toBe('squad')
  const started = revive(deploy(save, session.input, finale))
  const losing = revive(finishBattle(started, false))
  expect(retry(losing).mission?.battle).toEqual(started.mission?.battle)
  let saved = started
  for (const action of session.actions) {
    saved = recordAction(saved, action)
    if (saved.mission?.battle?.actions.length === 1) saved = revive(saved)
  }
  expect(resume(saved.mission?.battle?.input as BattleInput, session.actions)).toEqual(session)
  return revive(finishBattle(saved, true))
}

describe('CY129 campaign combat', () => {
  it('converts the flat XP curve once, preserving each level and matching armor thresholds', () => {
    for (let xp = 0; xp < 5500; xp++) expect(campaignLevel(migrateCampaignXp(xp), 1)).toBe(campaignLevel(xp))
    expect(CAMPAIGN_XP_THRESHOLDS.at(-1)).toBe(10300)
    const legacy = parseSave({ ...fresh(), version: 22, crew: [{ ...newMember(lead), xp: 925 }], combatTraining: { [lead]: { rank: 3, subclass: null } } })
    const next = initializeCampaignCurve(legacy, book)
    expect(revive(next).crew[0]?.xp).toBe(1031)
    expect(initializeCampaignCurve(next, book)).toBe(next)
    const before = groundInput('training', lead, 'Lead', 'hand-rifle', 'back-deck')
    const after = campaignBattleProgression(before, next)
    expect(maxHpOf(after.units[0]!)).toEqual({ ...maxHpOf(before.units[0]!), core: maxHpOf(before.units[0]!).core + 2,
      leftArm: maxHpOf(before.units[0]!).leftArm + 1, rightArm: maxHpOf(before.units[0]!).rightArm + 1 })
  })

  it.each([null, 'heal', 'shield', 'melee', 'long', 'support'] as const)('clears and replays a solo capture with %s', subclass => {
    const save = chooseSubclass(initializeCampaignCurve(fresh(), book), lead, subclass)
    const issued = groundInput('quarantine-board-cargo', lead, 'Lead', 'hand-rifle', 'back-bulwark', undefined, [], undefined, capture)
    const input = campaignSquadInput(issued, save, { alternate: { [lead]: subclass === 'melee' || subclass === 'shield' } })
    expect(input.units.filter(unit => unit.side === 'squad')).toHaveLength(1)
    expect(input.units.find(unit => unit.side === 'squad')?.specialty).toEqual({ kind: 'laser', rank: 1, ...(subclass ? { subclass } : {}) })
    const result = saveVictory(deployAt(save, capture.id), play(input))
    const cleared = settleGround(result, capture, story, true, book, 1)
    expect(cleared.crew[0]?.xp).toBe(75)
    expect(cleared.combatTraining?.[lead]?.rank).toBe(2)
    expect(cleared.story.flags).toContain('captured')
    expect(settleGround(cleared, capture, story, true, book, 1)).toBe(cleared)
  })

  it('commits the shift and clears a frozen ten-person battle with two of every role', () => {
    const save = chooseSubclass(initializeCampaignCurve({ ...fresh(), crew: [newMember(lead), newMember(second),
      ...formation.flatMap((member, index) => member.role !== 'boss-ally' ? [] : [{ ...newMember(9001000 + index), heroine: member.heroine, expeditionOnly: true as const }])] }, book), lead, 'melee')
    const short = { ...save, campaignSupply: { ...save.campaignSupply!, fuel: 0 } }
    expect(commitExpedition(short, book, 'lift-off', duo)).toBe(short)
    const launched = revive(commitExpedition(save, book, 'lift-off', duo))
    expect(launched.combatTraining?.[lead]).toEqual({ rank: 6, focused: true, subclass: 'melee' })
    const mission = expeditionMission()
    const input = campaignBattleProgression(expeditionGroundInput(mission, launched.expedition!, story, launched), launched)
    const units = input.units.filter(unit => unit.side === 'squad')
    expect(units).toHaveLength(10)
    expect(units.map(unit => unit.specialty?.kind).sort()).toEqual(['laser', 'laser', 'medic', 'medic', 'shield', 'shield', 'sniper', 'sniper', 'wing', 'wing'])
    expect(units.filter(unit => unit.specialty?.kind === 'laser').every(unit => unit.specialty?.kind === 'laser' && !unit.specialty.subclass)).toBe(true)
    expect(units.find(unit => unit.specialty?.kind === 'medic')?.frozenRig).toMatchObject({ rightHand: 'hand-pistol', back: 'back-med' })
    expect(units.find(unit => unit.specialty?.kind === 'sniper')?.loadout.back).toMatchObject({ ammo: 4, weapon: { range: [4, 7] } })
    expect(launched.crew.filter(member => member.heroine).every(member => member.xp === 500)).toBe(true)
    expect(Object.values(launched.expeditionXp ?? {})).toEqual(Array(6).fill(500))
    const win = play(input)
    expect(objectiveProgress(win.state).value).toBeGreaterThan(0)
    const result = saveVictory(deployAt(launched, mission.id, expeditionSquad(launched.expedition!)), win)
    const cleared = settleGround(result, { id: mission.id, title: 'Landing', win: {} }, story, true, book, 3)
    expect(cleared.crew.find(member => member.outfit === lead)?.xp).toBe(125)
    expect(cleared.combatTraining?.[lead]?.rank).toBe(7)
    expect(cleared.crew.filter(member => member.heroine).every(member => member.xp === 625)).toBe(true)
    expect(Object.values(cleared.expeditionXp ?? {})).toEqual(Array(6).fill(625))
  })

  it('settles two repeat salvage runs, crafts and deploys the selected part without story XP', () => {
    const save = initializeCampaignCurve(fresh(), book)
    let current: Save = { ...save, worlds: { ...save.worlds, missions: [capture.id] } }
    const watch = stationOf(current, book).absoluteWatch
    for (let run = 0; run < 2; run++) {
      const started = revive(startSalvage(current, book, 'fixture-release', 'dock-recovery', lead))
      const row = salvageDeployment(started)!
      const base = groundInput(row.mission.scenario!, lead, 'Lead', 'hand-rifle', 'back-bulwark', undefined, [], undefined, row.ground)
      const ready = toDeploy(started)
      expect(closeSalvage(ready, row.mission.id, true)).toBe(ready)
      current = closeSalvage(saveVictory(ready, play(campaignSquadInput(base, started))), row.mission.id, true)
      expect(closeSalvage(current, row.mission.id, true)).toBe(current)
    }
    expect(stationOf(current, book).absoluteWatch).toBe(watch + 2)
    expect(current.campaignGear.alloy).toBe(4)
    expect(current.worlds.missions).toEqual([capture.id])
    expect(current.crew[0]?.xp).toBe(0)
    const fitted = fitCampaignPart(craftCampaignPart(current, book, 'legs-runner'), book, lead, 'legs-runner', true)
    const base = groundInput('training', lead, 'Lead', 'hand-rifle', 'back-bulwark')
    expect(campaignSquadInput(base, fitted, { useFitted: true }).units[0]?.frozenRig?.legs).toBe('legs-runner')
  })
})

const manifest = process.env.CY129_CATALOG_MANIFEST
describe.skipIf(!manifest)('CY129 exact four-act campaign catalog', () => {
  it('validates and plays all solo capture routes and all fixed ground expedition sorties', async () => {
    const roots = (process.env.CY129_CATALOG_ROOTS ?? '').split(delimiter).filter(Boolean)
    const { book: authored } = await loadCampaign({ pack: async (path, reference) => {
      const local = path === 'campaign/four-act.json' ? manifest! : roots.map(root => resolve(root, path)).find(existsSync)
      if (!local) throw new Error(`Missing local campaign artifact for ${path}`)
      const bytes = readFileSync(local)
      if (reference) expect(createHash('sha256').update(bytes).digest('hex')).toBe(reference.sha256)
      return bytes
    } }, undefined, 'four-act')
    const navigation = indexCampaignNavigation(authored)
    const quests = new Map(authored.quests.filter(quest => quest.encounter).map(quest => [quest.encounter!, quest]))
    for (const id of [...authored.ground.keys(), ...authored.commands.keys()]) expect(combatReadiness(authored, navigation, quests.get(id))).toBeDefined()
    const counts = { solo: 0, expedition: 0, finale: 0 }
    const failed: string[] = []
    let soloProbe: BattleInput | undefined, expeditionProbe: BattleInput | undefined
    let finaleProbe: { save: Save; formation: ExpeditionRun } | undefined
    for (const arc of authored.fourAct!.arcs.values()) {
      const quest = arc.capture && navigation.quests.get(arc.capture.operation)
      const id = quest && quest.encounter
      const mission = id ? navigation.missions.get(id)?.mission : undefined
      const ground = id ? authored.ground.get(id) : undefined
      if (!mission?.scenario || !ground) continue
      const save = initializeCampaignCurve({ ...fresh(), crew: [newMember(arc.outfit)] }, authored)
      for (const scenario of [mission.scenario, ...(ground.alternate ? [ground.alternate.scenario] : [])]) {
        const flags = ground.alternate?.scenario === scenario ? [ground.alternate.flag] : []
        const base = groundInput(scenario, arc.outfit, 'Lead', 'hand-rifle', ground.expansion ?? 'back-bulwark', ground.boss, [], undefined, ground, flags)
        const input = campaignBattleProgression(lifeAboardInput(campaignSquadInput(base, save, { expansion: ground.expansion }), save, () => null), save)
        soloProbe ??= input
        const win = play(input)
        if (win.state.result?.winner !== 'squad') { failed.push(`solo:${scenario}`); continue }
        const record = saveVictory(deployAt(save, ground.id, [arc.outfit]), win)
        expect(settleGround(record, ground, authored.story, true, authored, 1).worlds.missions).toContain(ground.id)
      }
      counts.solo++
    }
    const shared = authored.fourAct!.transit?.quests ?? []
    const sharedTested = new Set<string>()
    for (const duo of authored.fourAct!.duos.values()) {
      const plan = duo.expedition
      const run = plan && { duo: duo.id, ship: plan.ship, members: plan.members, fuel: 8, provisions: 8 }
      if (!plan?.route || !run) continue
      const crew = run.members.flatMap((member, index) => member.role === 'uma'
        ? [{ ...newMember(member.outfit), xp: 750 }] : member.role === 'boss-ally' ? [{ ...newMember(9010000 + index), heroine: member.heroine, expeditionOnly: true as const }] : [])
      const save = initializeCampaignCurve({ ...fresh(), expedition: run, crew }, authored)
      finaleProbe ??= { save, formation: run }
      for (const stop of new Set([...plan.route.stops, ...shared.filter(quest => !sharedTested.has(quest))])) {
        const encounter = navigation.quests.get(stop)?.encounter
        const ground = encounter ? authored.ground.get(encounter) : undefined
        const mission = encounter ? navigation.missions.get(encounter)?.mission : undefined
        if (!ground || !mission?.scenario) continue
        if (shared.includes(stop)) sharedTested.add(stop)
        const input = campaignBattleProgression(expeditionGroundInput(mission, run, authored.story, save, undefined, true, ground), save)
        if (input.objective.kind === 'reach') expeditionProbe ??= input
        const win = play(input)
        expect(input.units.filter(unit => unit.side === 'squad')).toHaveLength(10)
        if (win.state.result?.winner !== 'squad') { failed.push(`expedition:${mission.scenario}`); continue }
        const record = saveVictory(deployAt(save, ground.id, expeditionSquad(run)), win)
        expect(settleGround(record, ground, authored.story, true, authored, 3).worlds.missions).toContain(ground.id)
        counts.expedition++
      }
    }
    const finaleBook = authored.fourActFinale
    if (finaleProbe && finaleBook) {
      const { save, formation } = finaleProbe
      const witnesses = finaleBook.courts.flatMap(row => row.witnesses[0]?.flag ?? [])
      const finalSave: Save = { ...save, expedition: null, finaleProgress: { releases: witnesses, duo: formation.duo, witnesses } }
      for (const id of finaleBook.ground) {
        const mission = navigation.missions.get(id)!.mission
        const ground = authored.ground.get(id)!
        const input = campaignBattleProgression(expeditionGroundInput(mission, formation, authored.story, finalSave, undefined, true, ground), finalSave)
        const win = play(input)
        if (win.state.result?.winner !== 'squad') { failed.push(`finale:${mission.scenario}`); continue }
        const record = saveVictory(deployAt(finalSave, ground.id, expeditionSquad(formation)), win, formation)
        expect(settleGround(record, ground, authored.story, true, authored, 4).worlds.missions).toContain(ground.id)
        counts.finale++
      }
    }
    expect(failed).toEqual([])
    expect(counts).toEqual({ solo: 50, expedition: 100, finale: 5 })
    const sample = Number(process.env.CY129_PROBE_SEEDS ?? 0)
    if (sample > 0) for (const [profile, input] of [['solo', soloProbe!], ['expedition', expeditionProbe!]] as const) {
      let wins = 0, actions = 0, unresolved = 0
      for (let seed = 1; seed <= sample; seed++) {
        const session = play({ ...input, seed: `cy129-${profile}-${seed}` })
        wins += Number(session.state.result?.winner === 'squad')
        unresolved += Number(!session.state.result)
        actions += session.actions.length
      }
      console.log(`CY129 ${profile} · ${wins}/${sample} wins · ${unresolved} unresolved · ${(actions / sample).toFixed(1)} actions`)
      expect(wins / sample).toBeGreaterThanOrEqual(0.95)
      expect(unresolved).toBe(0)
    }
    const archives = (process.env.CY129_ARCHIVED_SAVES ?? '').split(delimiter).filter(Boolean)
    for (const path of archives) {
      const raw = JSON.parse(readFileSync(path, 'utf8'))
      const original = parseSave(raw.save ?? raw)
      const migrated = revive(initializeCampaignCurve(original, authored))
      expect(migrated.worlds).toEqual(original.worlds)
      expect(migrated.story).toEqual(original.story)
      expect(migrated.mission).toEqual(original.mission)
      if (original.mission?.battle) {
        const { input, actions } = original.mission.battle
        if (input && typeof input === 'object' && 'rulesVersion' in input) expect(resume(input as BattleInput, actions as Parameters<typeof resume>[1])).not.toHaveProperty('error')
        else expect(resumeCommand(input, actions)).toBeTruthy()
      }
      if (raw.input && Array.isArray(raw.actions)) {
        const frozen = resume(raw.input as BattleInput, raw.actions as Parameters<typeof resume>[1])
        expect(frozen).not.toHaveProperty('error')
        expect(frozen).toMatchObject({ state: { result: { winner: 'squad' } } })
      }
    }
  }, 180_000)
})
