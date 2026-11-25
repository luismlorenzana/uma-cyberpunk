import { SHIP_CARGO_MAX } from '../campaign-supply'
import { walkSteps } from './check'
import type { P } from './parse'
import type { CampaignBook, CampaignQuest } from './campaign'

export interface PersonalArc {
  outfit: number
  system: string
  home: { world: string; place: string }
  general: string
  lieutenants: readonly string[]
  capture?: { operation: string; custody: string }
  rehabilitation?: { sessions: readonly string[]; release: string; quarters: string; clearance?: string }
}

interface Capital { operation: string; settlement: string }
interface HomeSystem { id: string; capital?: Capital }
interface LieutenantReturn { heroine: string; quest: string; operation?: string }
const LIEUTENANT_ROLES = ['melee-shield', 'ranged-medic', 'long-range'] as const
export type LieutenantRole = typeof LIEUTENANT_ROLES[number]
export type ExpeditionMember = { role: 'uma'; outfit: number } | { role: 'boss-ally' | LieutenantRole; heroine: string }
export interface ExpeditionRoute {
  name: string
  launch: string
  stops: readonly string[]
  transitAfter?: string
  watch?: { after: string; rest: string; shortfall: string }
  return: string
  cargo: { fuel: number; provisions: number }
}
export interface ExpeditionFormation { ship: string; members: readonly ExpeditionMember[]; route?: ExpeditionRoute }
export interface FixedDuo {
  id: string
  system: string
  umas: readonly [number, number]
  returns: readonly LieutenantReturn[]
  local?: { base: string; evidence: string }
  expedition?: ExpeditionFormation
}

export interface FourActCampaign {
  schemaVersion: 1
  systems: ReadonlyMap<string, HomeSystem>
  arcs: ReadonlyMap<number, PersonalArc>
  duos: ReadonlyMap<string, FixedDuo>
  /** Includes sign-on, personal missions and rehabilitation. Shared beats are left unowned. */
  personalQuestOwners: ReadonlyMap<string, number>
  transit?: { flag: string; quests: readonly string[] }
}

type Book = Pick<CampaignBook, 'opening' | 'draft' | 'quests' | 'scenes' | 'story' | 'recruits' | 'ground' | 'commands' | 'supply' | 'allies'>

export function parseFourActCampaign(p: P, value: unknown, book: Book): FourActCampaign {
  const source = p.object(value, 'fourAct', ['schemaVersion', 'systems', 'arcs', 'duos', 'transit'], ['schemaVersion', 'systems', 'arcs', 'duos'])
  if (source.schemaVersion !== 1) p.fail('fourAct.schemaVersion', 'expected version 1')
  const quests = new Map(book.quests.map(quest => [quest.id, quest]))
  const onboardingScenes = new Set([quests.get(book.opening)!.scene, ...(book.supply?.ports.map(port => port.scene) ?? [])])
  for (const id of onboardingScenes) {
    if ([...walkSteps(book.scenes.get(id)!.steps, '')].some(({ step }) => step.kind === 'join' || step.kind === 'aboard')) {
      p.fail(`scenes.${id}`, 'recruits must join through their own sign-on')
    }
  }
  const recruits = new Map(book.recruits?.map(recruit => [recruit.outfit, recruit]))
  const encounters = new Set<string>()
  for (const step of book.quests) if (step.encounter) {
    if (encounters.has(step.encounter)) p.fail(`quests.${step.id}`, 'expected a unique quest for this encounter')
    encounters.add(step.encounter)
  }
  const heroines = new Set(book.story.casting.heroines.map(actor => actor.board))
  const chapterByScene = new Map(Object.values(book.story.chapters).flatMap(chapter => chapter.scenes.map(scene => [scene.id, chapter] as const)))
  const systems = new Map<string, HomeSystem>()
  const arcs = new Map<number, PersonalArc>()
  const duos = new Map<string, FixedDuo>()
  const personalQuestOwners = new Map<string, number>()
  const usedActors = new Set<string>(), usedHomes = new Set<string>(), usedMembers = new Set<number>()
  const clearances = new Map<number, CampaignQuest>()
  const settlementQuests = new Set<string>(), capitalMissions = new Set<string>(), expeditionShips = new Set<string>()
  const expeditionQuests = new Set<string>()

  function quest(raw: unknown, field: string): CampaignQuest {
    const id = p.slug(raw, field)
    return quests.get(id) ?? p.fail(field, `unknown quest ${id}`)
  }
  function heroine(raw: unknown, field: string): string {
    const id = p.slug(raw, field)
    if (!heroines.has(id) || usedActors.has(id)) p.fail(field, 'expected a distinct heroine from casting')
    usedActors.add(id)
    return id
  }
  function settlement(raw: unknown, field: string): CampaignQuest {
    const step = quest(raw, field)
    if (step.encounter || settlementQuests.has(step.id)) p.fail(field, 'expected an unused dialogue quest for the settlement')
    settlementQuests.add(step.id)
    return step
  }
  function ancestors(step: CampaignQuest): Set<string> {
    const prerequisites = new Set([...(step.after ? [step.after] : []), ...(step.requires ?? [])])
    for (const id of prerequisites) {
      const prior = quests.get(id)!
      if (prior.after) prerequisites.add(prior.after)
      prior.requires?.forEach(need => prerequisites.add(need))
    }
    return prerequisites
  }

  let transit: FourActCampaign['transit']
  if (source.transit !== undefined) {
    const path = 'fourAct.transit'
    const spec = p.object(source.transit, path, ['flag', 'quests'])
    const flag = p.slug(spec.flag, path + '.flag')
    const stages = p.list(spec.quests, path + '.quests', quest, 8)
    const final = stages.at(-1)
    if (!final || final.encounter || !book.scenes.get(final.scene)?.steps.some(
      step => step.kind === 'flag' && step.set && step.flag === flag)
      || new Set(stages.map(stage => stage.id)).size !== stages.length
      || stages.slice(1).some((stage, index) => stage.after !== stages[index]!.id)) {
      p.fail(path, 'expected continuous shared transit ending in its own committed flag')
    }
    stages.forEach(stage => expeditionQuests.add(stage.id))
    transit = { flag, quests: stages.map(stage => stage.id) }
  }

  p.list(source.systems, 'fourAct.systems', (raw, field) => {
    const row = p.object(raw, field, ['id', 'capital'], ['id'])
    const id = p.slug(row.id, field + '.id')
    if (systems.has(id)) p.fail(field + '.id', 'duplicate home system')
    let capital: Capital | undefined
    if (row.capital !== undefined) {
      const spec = p.object(row.capital, field + '.capital', ['operation', 'settlement'])
      const operation = quest(spec.operation, field + '.capital.operation')
      const finish = settlement(spec.settlement, field + '.capital.settlement')
      if (!operation.encounter || (!book.ground.has(operation.encounter) && !book.commands.has(operation.encounter))
        || !ancestors(finish).has(operation.id)
        || capitalMissions.has(operation.encounter)) p.fail(field + '.capital', 'expected a unique ship or ground operation followed by a civic settlement')
      capitalMissions.add(operation.encounter!)
      capital = { operation: operation.id, settlement: finish.id }
    }
    systems.set(id, { id, ...(capital ? { capital } : {}) })
  }, 5)

  p.list(source.arcs, 'fourAct.arcs', (raw, field) => {
    const row = p.object(raw, field, ['outfit', 'system', 'home', 'general', 'lieutenants', 'capture', 'rehabilitation'],
      ['outfit', 'system', 'home', 'general', 'lieutenants'])
    const outfit = p.outfit(row.outfit, field + '.outfit')
    const recruit = recruits.get(outfit)
    if (!recruit || arcs.has(outfit)) return p.fail(field + '.outfit', 'expected a unique recruit')
    const system = p.slug(row.system, field + '.system')
    if (!systems.has(system)) p.fail(field + '.system', 'expected a registered home system')
    const homeRow = p.object(row.home, field + '.home', ['world', 'place'])
    const world = p.slug(homeRow.world, field + '.home.world'), place = p.slug(homeRow.place, field + '.home.place')
    const homeKey = `${world}/${place}`
    if (!book.story.worlds[world]?.locations.some(location => location.id === place) || usedHomes.has(homeKey)) {
      p.fail(field + '.home', 'expected a distinct authored location')
    }
    usedHomes.add(homeKey)
    const general = heroine(row.general, field + '.general')
    const lieutenants = p.list(row.lieutenants, field + '.lieutenants', heroine, 3)
    if (lieutenants.length !== 3) p.fail(field + '.lieutenants', 'expected three named lieutenants')

    const signOn = quests.get(recruit.signOn)!
    if (signOn.after !== book.opening) p.fail(field + '.outfit', 'sign-on must open directly after the shared premise')
    const upstream = new Set([book.opening, signOn.id])
    const guaranteedFlags = new Set<string>()
    personalQuestOwners.set(signOn.id, outfit)
    for (const id of recruit.story) {
      const step = quests.get(id)!
      if (step.requires?.some(need => !upstream.has(need)) || step.requiresAny?.some(need => !upstream.has(need)) || step.flags?.some(flag => !guaranteedFlags.has(flag))) {
        p.fail(`quests.${id}`, 'personal routes need prerequisites reachable by their own recruit')
      }
      const scene = book.scenes.get(step.scene)!
      const variant = step.sceneWhen && book.scenes.get(step.sceneWhen.scene)
      const cleared = new Set<string>()
      for (const { step: effect } of [scene, ...(variant ? [variant] : [])].flatMap(scene => [...walkSteps(scene.steps, '')])) {
        if ((effect.kind === 'join' || effect.kind === 'aboard') && effect.outfit !== outfit) {
          p.fail(`quests.${id}`, 'a personal quest cannot add another recruit')
        }
        if (effect.kind === 'flag' && !effect.set) cleared.add(effect.flag)
      }
      for (const flag of cleared) guaranteedFlags.delete(flag)
      for (const effect of scene.steps) if (effect.kind === 'flag' && effect.set && !cleared.has(effect.flag) && (!variant || variant.steps.some(other =>
        other.kind === 'flag' && other.set && other.flag === effect.flag))) guaranteedFlags.add(effect.flag)
      if (step.encounter) {
        const chapter = chapterByScene.get(step.scene)
        const mission = chapter?.missions.find(mission => mission.id === step.encounter)
        if (!chapter || !mission || chapter.leads.length !== 1 || chapter.leads[0] !== outfit ||
          (mission.fixedSquad && (mission.fixedSquad.length !== 1 || mission.fixedSquad[0] !== outfit))) {
          p.fail(`quests.${id}`, 'a personal encounter must be playable with its named lead alone')
        }
        const flag = book.ground.get(step.encounter)?.win.flag
        if (flag) guaranteedFlags.add(flag)
      }
      upstream.add(id)
      personalQuestOwners.set(id, outfit)
    }

    let capture: PersonalArc['capture']
    if (row.capture !== undefined) {
      const spec = p.object(row.capture, field + '.capture', ['operation', 'custody'])
      const operation = quest(spec.operation, field + '.capture.operation')
      const custody = settlement(spec.custody, field + '.capture.custody')
      const encounter = operation.encounter && book.ground.get(operation.encounter)
      if (!encounter || encounter.rescue?.heroine !== general || !encounter.win.flag || !recruit.story.includes(operation.id)
        || !ancestors(custody).has(operation.id) || recruit.story.at(-1) !== custody.id) {
        p.fail(field + '.capture', 'expected the named General’s rescue battle and a final custody scene on this route')
      }
      if (![...upstream].some(id => {
        const mission = quests.get(id)?.encounter
        return mission && book.commands.has(mission)
      })) p.fail(field + '.capture', 'a complete arc needs a ship operation')
      capture = { operation: operation.id, custody: custody.id }
    }
    let rehabilitation: PersonalArc['rehabilitation']
    if (row.rehabilitation !== undefined) {
      const path = field + '.rehabilitation'
      const spec = p.object(row.rehabilitation, path, ['sessions', 'quarters', 'clearance'], ['sessions', 'quarters'])
      const ally = book.allies?.find(ally => ally.partner === outfit && ally.heroine === general)
      if (!capture || !ally) return p.fail(path, 'rehabilitation needs this General’s custody and ally record')
      let prev = capture.custody
      const bind = (id: unknown, key: string) => {
        const step = settlement(id, key)
        if (step.after !== prev || step.requires?.some(required => !upstream.has(required))
          || step.requiresAny?.some(required => !upstream.has(required)) || step.flags?.length) {
          p.fail(key, 'rehabilitation must follow the same Uma’s custody without another recruit or a relationship gate')
        }
        upstream.add(step.id)
        prev = step.id
        personalQuestOwners.set(step.id, outfit)
        return step.id
      }
      const sessions = p.list(spec.sessions, path + '.sessions', bind, 16)
      if (!sessions.length) p.fail(path + '.sessions', 'expected authored rehabilitation sessions')
      const release = bind(ally.release.quest, path + '.release')
      const quarters = bind(spec.quarters, path + '.quarters')
      const clearance = spec.clearance === undefined ? undefined : settlement(spec.clearance, path + '.clearance')
      if (clearance) {
        clearances.set(outfit, clearance)
        personalQuestOwners.set(clearance.id, outfit)
      }
      rehabilitation = { sessions, release, quarters, ...(clearance ? { clearance: clearance.id } : {}) }
    }
    arcs.set(outfit, { outfit, system, home: { world, place }, general, lieutenants,
      ...(capture ? { capture } : {}), ...(rehabilitation ? { rehabilitation } : {}) })
  }, 50)
  if (!arcs.size || arcs.size !== recruits.size) p.fail('fourAct.arcs', 'expected one personal arc for every release recruit')

  p.list(source.duos, 'fourAct.duos', (raw, field) => {
    const row = p.object(raw, field, ['id', 'umas', 'returns', 'local', 'expedition'], ['id', 'umas', 'returns'])
    const id = p.slug(row.id, field + '.id')
    const umas = p.list(row.umas, field + '.umas', (value, path) => p.outfit(value, path), 2)
    const [first, second] = umas
    const a = first === undefined ? undefined : arcs.get(first)
    const b = second === undefined ? undefined : arcs.get(second)
    if (duos.has(id) || !a || !b || first === second || a.system !== b.system || usedMembers.has(a.outfit) || usedMembers.has(b.outfit)) {
      return p.fail(field + '.umas', 'expected one fixed pair of distinct available leads from the same system')
    }
    usedMembers.add(a.outfit)
    usedMembers.add(b.outfit)
    const allowed = new Set([...a.lieutenants, ...b.lieutenants])
    const jointlyReady = (prior: ReadonlySet<string>) => !!a.rehabilitation && !!b.rehabilitation
      && prior.has(a.rehabilitation.quarters) && prior.has(b.rehabilitation.quarters)
    const returns = p.list(row.returns, field + '.returns', (raw, path) => {
      const entry = p.object(raw, path, ['heroine', 'quest', 'operation'], ['heroine', 'quest'])
      const actor = p.slug(entry.heroine, path + '.heroine')
      if (!allowed.delete(actor)) p.fail(path + '.heroine', 'expected a distinct lieutenant of this duo')
      const finish = settlement(entry.quest, path + '.quest')
      // Both captured Generals and both leads have entered the local arc before any return is counted.
      const prior = ancestors(finish)
      if (!jointlyReady(prior)) p.fail(path + '.quest', 'lieutenant returns need both Generals to reach allied residence')
      const operation = entry.operation === undefined ? undefined : quest(entry.operation, path + '.operation')
      if (operation) {
        const encounter = operation.encounter && book.ground.get(operation.encounter)
        if (!encounter || !prior.has(operation.id) || !encounter.formation?.opponents.some(opponent => opponent.heroine === actor)) {
          p.fail(path + '.operation', 'expected a settled ground operation with this named lieutenant')
        }
      }
      if (!book.draft && !operation) p.fail(path + '.operation', 'production returns need a recorded encounter')
      return { heroine: actor, quest: finish.id, ...(operation ? { operation: operation.id } : {}) }
    }, 6)
    let local: FixedDuo['local']
    if (!book.draft && row.local === undefined) p.fail(field + '.local', 'production duos need a joint base and evidence')
    if (row.local !== undefined) {
      const spec = p.object(row.local, field + '.local', ['base', 'evidence'])
      const base = settlement(spec.base, field + '.local.base')
      const evidence = settlement(spec.evidence, field + '.local.evidence')
      const known = ancestors(evidence)
      if (!jointlyReady(ancestors(base)) || !known.has(base.id) || returns.some(row => !known.has(row.quest)
        || !ancestors(quests.get(row.quest)!).has(base.id))) {
        p.fail(field + '.local', 'the joint base needs both residents, and its evidence needs the returns')
      }
      local = { base: base.id, evidence: evidence.id }
    }
    let expedition: ExpeditionFormation | undefined
    if (row.expedition !== undefined) {
      const path = field + '.expedition'
      if (!local || !a.rehabilitation?.clearance || !b.rehabilitation?.clearance) {
        p.fail(path, 'expected the duo’s local route and both General clearance quests')
      }
      expedition = parseExpeditionFormation(p, row.expedition, path, [a, b], returns)
      const route = p.object(row.expedition, path, ['ship', 'lieutenants', 'route'], ['ship', 'lieutenants']).route
      if (route !== undefined) {
        const panel = path + '.route'
        const keys = ['name', 'launch', 'stops', 'return', 'cargo']
        const spec = p.object(route, panel, [...keys, 'transitAfter', 'watch'], keys)
        const launch = settlement(spec.launch, panel + '.launch')
        const stops = p.list(spec.stops, panel + '.stops', (id, field) => quest(id, field), 32)
        const home = settlement(spec.return, panel + '.return')
        const stages = [launch, ...stops, home]
        if (!stops.some(q => q.encounter && book.commands.has(q.encounter))
          || !stops.some(q => q.encounter && book.ground.has(q.encounter))
          || new Set(stages.map(q => q.id)).size !== stages.length
          || stages.slice(1).some((stage, index) => stage.after !== stages[index]!.id)) {
          p.fail(panel, 'expected a continuous expedition with ship and ground operations')
        }
        for (const stage of stages) {
          if (expeditionQuests.has(stage.id)) p.fail(panel, 'expected distinct quests for each expedition')
          expeditionQuests.add(stage.id)
        }
        if (!book.supply || !launch.port) p.fail(panel + '.launch', 'expected a departure berth in the supply network')
        const cargo = p.object(spec.cargo, panel + '.cargo', ['fuel', 'provisions'])
        const reserved = { fuel: p.int(cargo.fuel, panel + '.cargo.fuel', 1, SHIP_CARGO_MAX),
          provisions: p.int(cargo.provisions, panel + '.cargo.provisions', 1, SHIP_CARGO_MAX) }
        const transitAfter = spec.transitAfter === undefined ? undefined : quest(spec.transitAfter, panel + '.transitAfter').id
        if (transitAfter && (!transit || ![launch, ...stops].some(stage => stage.id === transitAfter))) {
          p.fail(panel + '.transitAfter', 'expected an outbound checkpoint on this route')
        }
        const transitStages = transit?.quests.map(id => quests.get(id)!) ?? []
        const shipCosts = [...stops, ...transitStages].reduce((total, stage) => {
          const cost = stage.encounter && book.commands.get(stage.encounter)?.cost
          return cost ? { fuel: total.fuel + cost.fuel, provisions: total.provisions + cost.provisions } : total
        }, { fuel: 0, provisions: 0 })
        if (reserved.fuel < shipCosts.fuel || reserved.provisions < shipCosts.provisions) {
          p.fail(panel + '.cargo', 'expected enough supplies for all ship operations')
        }
        const watch = spec.watch === undefined ? undefined : (() => {
          const field = panel + '.watch'
          const entry = p.object(spec.watch, field, ['after', 'rest', 'shortfall'])
          const after = quest(entry.after, field + '.after')
          if (!after.encounter || !stops.includes(after) || !book.commands.has(after.encounter)) {
            p.fail(field + '.after', 'expected a settled expedition command encounter')
          }
          const report = (raw: unknown, key: string) => {
            const id = p.slug(raw, field + '.' + key)
            const scene = book.scenes.get(id)
            if (!scene || [...walkSteps(scene.steps, '')].some(({ step }) =>
              !['line', 'thought', 'narrate', 'emote', 'wait', 'choice', 'captain', 'slot', 'illustration'].includes(step.kind)
                || step.kind === 'captain' && step.options.some(option => option.rapport))) {
              p.fail(field + '.' + key, 'expected an authored watch scene without gameplay effects')
            }
            return id
          }
          return { after: after.id, rest: report(entry.rest, 'rest'), shortfall: report(entry.shortfall, 'shortfall') }
        })()
        expedition.route = { name: p.text(spec.name, panel + '.name', 40), launch: launch.id, return: home.id,
          stops: stops.map(q => q.id), ...(transitAfter ? { transitAfter } : {}), ...(watch ? { watch } : {}), cargo: reserved }
      }
      if (expeditionShips.has(expedition.ship)) p.fail(path + '.ship', 'expected a unique ship for each duo')
      expeditionShips.add(expedition.ship)
    }
    duos.set(id, { id, system: a.system, umas: [a.outfit, b.outfit], returns, ...(local ? { local } : {}), ...(expedition ? { expedition } : {}) })
  }, 25)

  for (const [outfit, clearance] of clearances) {
    const arc = arcs.get(outfit)!
    const duo = [...duos.values()].find(duo => duo.umas.includes(outfit))
    const prior = ancestors(clearance)
    if (!duo?.local || !prior.has(duo.local.base) || !prior.has(arc.rehabilitation!.quarters)) {
      p.fail(`quests.${clearance.id}`, 'expedition clearance requires the General’s residence and the duo base')
    }
  }

  for (const { operation, settlement } of [...systems.values()].flatMap(system => system.capital ? [system.capital] : [])) {
    if (personalQuestOwners.has(operation) || personalQuestOwners.has(settlement)) p.fail('fourAct.systems', 'capital liberation has its own route')
  }
  if (!book.draft && (systems.size !== 5 || [...systems.values()].some(system => !system.capital)
    || arcs.size !== 50 || [...arcs.values()].some(arc => !arc.rehabilitation)
    || !transit || duos.size !== 25 || [...duos.values()].some(duo => !duo.local || duo.returns.length !== 6 || !duo.expedition?.route))) {
    p.fail('fourAct', 'a production book needs 50 captures and rehabilitations, five capital outcomes and 25 full expedition routes with shared transit')
  }
  return { schemaVersion: 1, systems, arcs, duos, personalQuestOwners, ...(transit ? { transit } : {}) }
}

export function parseExpeditionFormation(p: P, raw: unknown, path: string, arcs: readonly [PersonalArc, PersonalArc],
  returns: readonly LieutenantReturn[]): ExpeditionFormation {
  const spec = p.object(raw, path, ['ship', 'lieutenants', 'route'], ['ship', 'lieutenants'])
  const ship = p.slug(spec.ship, path + '.ship')
  const eligible = new Set(returns.map(entry => entry.heroine))
  const lieutenants = p.list(spec.lieutenants, path + '.lieutenants', (raw, key) => {
    const entry = p.object(raw, key, ['heroine', 'role'])
    const heroine = p.slug(entry.heroine, key + '.heroine')
    if (!eligible.delete(heroine)) p.fail(key + '.heroine', 'expected a unique lieutenant from this duo’s returns')
    const role = LIEUTENANT_ROLES.find(role => role === entry.role)
      ?? p.fail(key + '.role', 'expected melee-shield, ranged-medic or long-range')
    return { heroine, role }
  }, 6)
  if (lieutenants.length !== 6 || LIEUTENANT_ROLES.some(role => lieutenants.filter(entry => entry.role === role).length !== 2)) {
    p.fail(path + '.lieutenants', 'expected two lieutenants per expedition role')
  }
  const [a, b] = arcs
  return { ship, members: [
    { role: 'uma', outfit: a.outfit }, { role: 'uma', outfit: b.outfit },
    { role: 'boss-ally', heroine: a.general }, { role: 'boss-ally', heroine: b.general }, ...lieutenants,
  ] }
}

export function rehabilitationQuestIds(arc: PersonalArc | undefined): readonly string[] {
  const route = arc?.rehabilitation
  return route ? [...route.sessions, route.release, route.quarters, ...(route.clearance ? [route.clearance] : [])] : []
}

export function expeditionReadiness(campaign: FourActCampaign, duo: string, complete: ReadonlySet<string>) {
  const pairing = campaign.duos.get(duo)
  if (!pairing) return null
  const capitals = [...campaign.systems.values()].filter(({ capital }) =>
    capital && complete.has(capital.operation) && complete.has(capital.settlement)).length
  const returned = pairing.returns.filter(({ quest, operation }) => complete.has(quest) && (!operation || complete.has(operation))).length
  const cleared = pairing.umas.filter(outfit => {
    const clearance = campaign.arcs.get(outfit)?.rehabilitation?.clearance
    return clearance !== undefined && complete.has(clearance)
  }).length
  return { capitals, returned, cleared, ready: capitals === 5 && returned === 6 && cleared === 2 }
}
