import { commandEffectKeys, commandFacts, newMember, newSave, parseSave, resolvedCommand, resumeCommand,
  type CommandAction, type CommandEncounter, type CommandInput, type Save } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { assignOfficer, issueCommand, launchCommand, settleCommand } from './command'
import { advanceCommandCinema, commandLog, replayCommandCinema, retryCommand, savedCommandEvent } from './cinematics'

const first = 9000701, second = 9000702
const encounter: CommandEncounter = { id: 'escort', cost: { fuel: 1, provisions: 2 }, transport: 6, enemy: 15,
  threats: [{ section: 'fore', power: 5, fighters: 2 }, { section: 'aft', power: 8, fighters: 3 }, { section: 'fore', power: 8, fighters: 4 }, { section: 'aft', power: 9, fighters: 1 }],
  calls: { evade: 'Turn', brace: 'Charge', fire: 'Fire', intercept: 'Screen', strike: 'Strike', reroute: 'Power' } }
const fire: CommandAction = { order: 'fire', shields: 0, guns: 3, fighters: 0 }
function launched(): Save {
  const save = { ...newSave('captain', '2026-11-19T00:00:00Z'), crew: [newMember(first), newMember(second)],
    mission: { id: 'escort', chapter: 'local', step: 'deploy' as const, squad: [first], battle: null, won: null },
    campaignSupply: { port: 'local', stores: {}, fuel: 6, provisions: 4, shortfall: 0, reliefDay: null } }
  return launchCommand(assignOfficer(save, 'gunnery', first), save.campaignSupply, encounter, { ashore: new Set(), relay: 0,
    cast: { crew: {}, present: [{ speaker: first, name: 'First officer' }, { speaker: second, name: 'Second officer' }], objective: 'Relief transport', commander: { speaker: 'patrol', name: 'Patrol commander' } } })
}
const reload = (save: Save) => parseSave(JSON.parse(JSON.stringify(save)))
const mechanical = (save: Save) => ({ mission: save.mission, stock: save.campaignSupply, wallet: save.wallet, day: save.campaignDay, story: save.story })

describe('committed ship order cinematics', () => {
  it('commits once, freezes the actual officer and restores the result after reassignment or reload', () => {
    const start = launched(), committed = issueCommand(start, encounter.id, 0, fire)
    expect(committed.mission!.battle!.actions).toHaveLength(1)
    expect(committed.commandCinema.pending).toEqual({ encounter: 'escort', turn: 1, beat: 0 })
    expect(issueCommand(committed, encounter.id, 0, fire)).toBe(committed)
    const changed = reload({ ...committed, commandCrew: { gunnery: { outfit: second, drills: 2, trainedDay: null } } })
    expect(savedCommandEvent(changed)!.actor).toEqual({ speaker: first, name: 'First officer' })
    expect(savedCommandEvent(changed)!.commander).toEqual({ speaker: 'patrol', name: 'Patrol commander' })
    expect(savedCommandEvent(changed)!.after.last).toMatchObject({ hit: 5, transportDamage: 2 })
    expect(changed.campaignSupply).toMatchObject({ fuel: 5, provisions: 2 })
    expect(commandLog(changed)[0]!.text).toContain('First officer')
    expect(commandLog(changed)[0]!.text).not.toContain('Second officer')
  })

  it('advances, skips and replays only presentation, keeping the same resolved facts and log', () => {
    let save = reload(issueCommand(launched(), 'escort', 0, fire))
    const truth = mechanical(save), facts = commandFacts(savedCommandEvent(save)!)
    save = reload(advanceCommandCinema(save, 'escort', 1, 0))
    expect(advanceCommandCinema(save, 'escort', 1, 0)).toBe(save)
    save = reload(advanceCommandCinema(save, 'escort', 1, 1, true))
    expect(save.commandCinema.pending!.beat).toBe(3)
    expect(commandFacts(savedCommandEvent(save)!)).toBe(facts)
    save = reload(advanceCommandCinema(save, 'escort', 1, 3))
    expect(save.commandCinema.pending).toBeNull()
    expect(mechanical(save)).toEqual(truth)
    save = replayCommandCinema(save)
    expect(save.commandCinema.pending!.turn).toBe(1)
    expect(mechanical(save)).toEqual(truth)
    expect(commandLog(save)).toHaveLength(1)
  })

  it('fast playback produces exactly the same battle state as normal playback', () => {
    const start = launched(), normal = issueCommand(start, 'escort', 0, fire)
    const fast = issueCommand({ ...start, commandCinema: { ...start.commandCinema, fast: true } }, 'escort', 0, fire)
    expect(fast.commandCinema.pending!.beat).toBe(3)
    expect(mechanical(fast)).toEqual(mechanical(normal))
    expect(savedCommandEvent(fast)).toEqual(savedCommandEvent(normal))
  })

  it('retains the original input and launch payment through a loss and free retry', () => {
    let save = launched()
    const input = save.mission!.battle!.input, paid = save.campaignSupply
    for (let turn = 0; turn < 3; turn++) save = issueCommand(save, 'escort', turn, { order: 'evade', shields: 1, guns: 1, fighters: 1 })
    expect(save.mission!.won).toBe(false)
    save = reload(retryCommand(save))
    expect(save.mission!.battle!.input).toEqual(input)
    expect(save.mission!.battle!.actions).toEqual([])
    expect(save.commandCinema).toMatchObject({ retries: 1, pending: null })
    expect(save.campaignSupply).toEqual(paid)
    for (let turn = 0; turn < 3; turn++) save = issueCommand(save, 'escort', turn, fire)
    expect(save.mission!.won).toBe(true)
    expect(savedCommandEvent(save)!.actor?.speaker).toBe(first)
    const finished = settleCommand(save, 'escort')
    expect(finished.commandCinema.pending).toBeNull()
    expect(finished.worlds.missions).toEqual(['escort'])
    expect(finished.campaignSupply).toEqual(paid)
  })

  it('never invents an actor for old inputs and keeps their original win condition', () => {
    const save = launched(), input = { ...(save.mission!.battle!.input as CommandInput) }
    delete input.presentation
    const legacy = { ...save, mission: { ...save.mission!, battle: { input, actions: [] } } }
    const committed = issueCommand(legacy, 'escort', 0, fire)
    expect(savedCommandEvent(committed)!.actor).toBeUndefined()
    expect(commandLog(committed)[0]!.text).toContain('Watch officer')
    expect(resumeCommand(input, [])?.input.version).toBe(1)
    const { commandCinema: _, ...old } = committed
    const migrated = parseSave({ ...old, version: 18 })
    expect(migrated.mission).toEqual(committed.mission)
    expect(migrated.commandCinema.pending).toBeNull()
  })

  it('distinguishes emitter damage, confirmed disablement and ordinary victory from actual results', () => {
    const input: CommandInput = { version: 3, reactor: 3, enemy: 8, transport: 7, threats: Array.from({ length: 4 }, () => ({ section: 'fore', power: 1, fighters: 0 })),
      officers: { pilot: 0, shields: 0, gunnery: 0, engineering: 0 }, assault: { emitter: 4, disabledFlag: 'emitter-down' }, contributions: [] }
    const strike: CommandAction = { order: 'strike', shields: 0, guns: 0, fighters: 1, target: 'emitter' }
    const partial = resolvedCommand(input, [strike], 1)!
    expect(partial.after.emitter).toBe(2)
    expect(partial.disabled).toBe(false)
    expect(commandEffectKeys(partial)).toContain('emitter-hit')
    expect(commandEffectKeys(partial)).not.toContain('emitter-disabled')
    expect(commandEffectKeys(partial)).toContain('fighter-strike')
    expect(commandEffectKeys(partial)).not.toContain('guns')
    const disabled = resolvedCommand(input, [strike, strike], 2)!
    expect(disabled.disabled).toBe(true)
    expect(commandEffectKeys(disabled)).toContain('emitter-disabled')
    expect(commandEffectKeys(disabled)).not.toContain('emitter-hit')
    expect(disabled.after.result).toBeNull()
    expect(disabled.after.enemy).toBe(8)
    const ordinary = resolvedCommand(input, [fire, fire], 2)!
    expect(ordinary.after.result).toBe('won')
    expect(ordinary.after.emitter).toBe(4)
    expect(ordinary.disabled).toBe(false)
    const passive = resolvedCommand({ ...input, threats: [{ section: 'fore', power: 0, fighters: 3 }] },
      [{ order: 'reroute', shields: 1, guns: 0, fighters: 2 }], 1)!
    expect(passive.after.last!.intercepted).toBe(1)
    expect(commandEffectKeys(passive)).not.toContain('intercept')
    expect(commandEffectKeys(passive)).not.toContain('shields')
    expect(commandEffectKeys(passive)).toContain('power')
    expect(resolvedCommand(input, [{ ...strike, fighters: 4 }], 1)).toBeNull()
  })

  it('rejects stale or malformed playback cursors without changing the battle', () => {
    const save = issueCommand(launched(), 'escort', 0, fire)
    for (const pending of [{ encounter: 'other', turn: 1, beat: 0 }, { encounter: 'escort', turn: 2, beat: 0 },
      { encounter: 'escort', turn: 1, beat: 4 }, { encounter: 'escort', turn: 0, beat: 0 }]) {
      expect(() => parseSave({ ...save, commandCinema: { ...save.commandCinema, pending } })).toThrow('commandCinema')
    }
    expect(advanceCommandCinema(save, 'other', 1, 0)).toBe(save)
    const input = structuredClone(save.mission!.battle!.input) as CommandInput
    input.presentation!.crew.shields = input.presentation!.crew.gunnery!
    expect(resumeCommand(input, save.mission!.battle!.actions)).toBeNull()
  })

  it('does not freeze an ashore officer into a ship station even if a stale assignment or label remains', () => {
    const start = launched(), assigned = { ...start, mission: { ...start.mission!, step: 'deploy' as const, battle: null, won: null } }
    const save = launchCommand(assigned, assigned.campaignSupply!, encounter, { ashore: new Set([first]), relay: 0,
      cast: { crew: {}, present: [{ speaker: first, name: 'Ashore officer' }], objective: 'Relief transport' } })
    const run = resumeCommand(save.mission!.battle!.input, [])!
    expect(run.input.presentation!.crew.gunnery).toBeUndefined()
    expect(run.input.presentation!.present.some(actor => actor.speaker === first)).toBe(false)
    expect(run.input.officers.gunnery).toBe(0)
  })
})
