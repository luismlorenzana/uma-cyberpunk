
import type { CampaignQuest } from './campaign'
import type { P } from './parse'
import type { Scene, Speaker } from './types'

export interface FinaleWitness {
  flag: string
  release: string
  scene: string
}

export interface FinaleVisit {
  scene: string
  actors: Speaker[]
  port?: string
  flags: string[]
  receipt?: string
  kind: 'civic' | 'commitment' | 'reunion' | 'shared'
}

export interface MissionReports {
  preparation: string
  result: string[]
  failure: string
  withdrawal: string
  retry: string
}

export const BOSS_VISIT_STAGES = ['acquaintance', 'friend', 'partner', 'household'] as const

export interface CrewDialogue {
  duty: Readonly<Record<string, string>>
  ship: Readonly<Record<string, string>>
  ground: Readonly<Record<string, string>>
  signature: Readonly<Record<string, string>>
  expeditionOnly: boolean
}

export interface FourActFinale {
  voices?: ReadonlyMap<Speaker, CrewDialogue>
  start: string
  capitals: string[]
  courts: { name: string; witnesses: FinaleWitness[] }[]
  witnessesAt: string
  ground: string[]
  hushApproach: string
  hushCrews: ReadonlyMap<string, { secured: string; withdrawal: string; roster: ReadonlyMap<Speaker, {
    role: string; ship: string; ground: string }> }>
  speakerAt: string
  bridge: string
  speakers: ReadonlyMap<Speaker, string>
  victory: string
  returnToPlay: string
  credits: string
  trueCredits: { scene: string; flag: string }
  visits: FinaleVisit[]
  harbor: { flag: string; port: string; crossings: string[] }
  dispatches: { scene: string; flags: string[]; unless: string[]; title: string }[]
  visitBanks: ReadonlyMap<string, Record<typeof BOSS_VISIT_STAGES[number], string[]>>
  reports: ReadonlyMap<string, MissionReports>
  recoveries: ReadonlyMap<string, { duo: string; flag: string; preparation: string; mission: string }>
}

export function parseFourActFinale(p: P, value: unknown, scenes: ReadonlyMap<string, Scene>, quests: CampaignQuest[], missions: ReadonlyMap<string, unknown>): FourActFinale {
  const path = 'fourActFinale'
  const root = p.object(value, path, ['schemaVersion', 'start', 'capitals', 'courts', 'witnessesAt', 'ground', 'speakerAt',
    'bridge', 'speakers', 'victory', 'returnToPlay', 'credits', 'trueCredits', 'visits', 'visitBanks', 'reports', 'recoveries', 'hushApproach', 'hushCrews', 'harbor', 'dispatches', 'voices'],
  ['schemaVersion', 'start', 'capitals', 'courts', 'witnessesAt', 'ground', 'speakerAt', 'bridge', 'speakers', 'victory',
    'returnToPlay', 'credits', 'trueCredits', 'visits', 'visitBanks', 'reports', 'recoveries', 'hushApproach', 'hushCrews', 'harbor', 'dispatches'])
  p.version(root)
  const questIds = new Set(quests.map(row => row.id))
  const scene = (raw: unknown, field: string) => {
    const id = p.slug(raw, field)
    return scenes.has(id) ? id : p.fail(field, 'unknown scene')
  }
  const quest = (raw: unknown, field: string) => {
    const id = p.slug(raw, field)
    return questIds.has(id) ? id : p.fail(field, 'unknown quest')
  }
  const mission = (raw: unknown, field: string) => {
    const id = p.slug(raw, field)
    return missions.has(id) ? id : p.fail(field, 'unknown mission')
  }
  const courts = p.list(root.courts, path + '.courts', (raw, field) => {
    const row = p.object(raw, field, ['name', 'witnesses'])
    const witnesses = p.list(row.witnesses, field + '.witnesses', (raw, field) => {
      const row = p.object(raw, field, ['flag', 'release', 'scene'])
      return { flag: p.slug(row.flag, field + '.flag'), release: quest(row.release, field + '.release'), scene: scene(row.scene, field + '.scene') }
    }, 5)
    if (witnesses.length !== 5) p.fail(field, 'expected five potential witnesses')
    return { name: p.text(row.name, field + '.name', 40), witnesses }
  }, 5)
  const capitals = p.list(root.capitals, path + '.capitals', quest, 5)
  if (new Set(courts.map(row => row.name)).size !== 5 || new Set(courts.flatMap(row => row.witnesses.map(w => w.flag))).size !== 25
    || new Set(capitals).size !== 5) p.fail(path, 'expected five distinct capital settlements and five unique witnesses per court')
  const speakers = new Map(p.list(root.speakers, path + '.speakers', (raw, field) => {
    const row = p.object(raw, field, ['actor', 'scene'])
    return [p.speaker(row.actor, field + '.actor'), scene(row.scene, field + '.scene')] as const
  }, 100))
  const trueCredits = p.object(root.trueCredits, path + '.trueCredits', ['scene', 'flag'])
  const visits = p.list(root.visits, path + '.visits', (raw, field): FinaleVisit => {
    const row = p.object(raw, field, ['scene', 'actors', 'port', 'flags', 'receipt', 'kind'], ['scene', 'actors', 'flags', 'kind'])
    const kind = row.kind
    if (kind !== 'civic' && kind !== 'commitment' && kind !== 'reunion' && kind !== 'shared') return p.fail(field, 'unknown visit kind')
    const actors = p.list(row.actors, field + '.actors', (v, k) => p.speaker(v, k), 2)
    if (!actors.length || (row.kind === 'shared' && actors.length !== 2)) p.fail(field, 'expected a complete visit cast')
    return { scene: scene(row.scene, field + '.scene'), actors, kind,
      flags: p.list(row.flags, field + '.flags', (v, k) => p.slug(v, k), 8),
      ...(row.port === undefined ? {} : { port: p.slug(row.port, field + '.port') }),
      ...(row.receipt === undefined ? {} : { receipt: p.slug(row.receipt, field + '.receipt') }) }
  }, 300)
  if (new Set(visits.map(visit => visit.scene)).size !== visits.length) p.fail(path + '.visits', 'duplicate scene')
  const visitBanks = new Map(p.list(root.visitBanks, path + '.visitBanks', (raw, field) => {
    const row = p.object(raw, field, ['actor', ...BOSS_VISIT_STAGES])
    const scenes = (stage: typeof BOSS_VISIT_STAGES[number]) => {
      const choices = p.list(row[stage], field + '.' + stage, scene, 2)
      return choices.length === 2 ? choices : p.fail(field, 'expected two daily scenes')
    }
    return [p.slug(row.actor, field + '.actor'), { acquaintance: scenes('acquaintance'), friend: scenes('friend'),
      partner: scenes('partner'), household: scenes('household') }] as const
  }, 50))
  const reports = new Map(p.list(root.reports, path + '.reports', (raw, field) => {
    const row = p.object(raw, field, ['mission', 'preparation', 'result', 'failure', 'withdrawal', 'retry'])
    return [mission(row.mission, field + '.mission'), { preparation: scene(row.preparation, field + '.preparation'),
      result: p.list(row.result, field + '.result', scene, 8), failure: scene(row.failure, field + '.failure'),
      withdrawal: scene(row.withdrawal, field + '.withdrawal'), retry: scene(row.retry, field + '.retry') }] as const
  }, 700))
  const recoveries = new Map(p.list(root.recoveries, path + '.recoveries', (raw, field) => {
    const row = p.object(raw, field, ['quest', 'duo', 'flag', 'preparation', 'mission'])
    return [quest(row.quest, field + '.quest'), { duo: p.slug(row.duo, field + '.duo'), flag: p.slug(row.flag, field + '.flag'),
      preparation: quest(row.preparation, field + '.preparation'), mission: mission(row.mission, field + '.mission') }] as const
  }, 50))
  const hushCrews = new Map(p.list(root.hushCrews, path + '.hushCrews', (raw, field) => {
    const row = p.object(raw, field, ['duo', 'secured', 'withdrawal', 'roster'])
    const roster = new Map(p.list(row.roster, field + '.roster', (raw, field) => {
      const actor = p.object(raw, field, ['actor', 'role', 'ship', 'ground'])
      return [p.speaker(actor.actor, field + '.actor'), { role: p.slug(actor.role, field + '.role'),
        ship: scene(actor.ship, field + '.ship'), ground: scene(actor.ground, field + '.ground') }] as const
    }, 10))
    if (roster.size !== 10) p.fail(field, 'expected ten named actors')
    return [p.slug(row.duo, field + '.duo'), { roster, secured: scene(row.secured, field + '.secured'),
      withdrawal: scene(row.withdrawal, field + '.withdrawal') }] as const
  }, 25))
  const harbor = p.object(root.harbor, path + '.harbor', ['flag', 'port', 'crossings'])
  const dispatches = p.list(root.dispatches, path + '.dispatches', (raw, field) => {
    const row = p.object(raw, field, ['scene', 'flags', 'unless', 'title'])
    return { scene: scene(row.scene, field + '.scene'), title: p.text(row.title, field + '.title', 80),
      flags: p.list(row.flags, field + '.flags', (v, k) => p.slug(v, k), 8),
      unless: p.list(row.unless, field + '.unless', (v, k) => p.slug(v, k), 8) }
  }, 150)
  const voices = root.voices === undefined ? undefined : new Map(p.list(root.voices, path + '.voices', (raw, field) => {
    const row = p.object(raw, field, ['actor', 'duty', 'ship', 'ground', 'signature', 'expeditionOnly'])
    const bank = (key: string) => {
      const group = field + '.' + key
      return Object.fromEntries(p.list(row[key], group, (raw, field) => {
        const item = p.object(raw, field, ['cue', 'scene'])
        return [p.slug(item.cue, field + '.cue'), scene(item.scene, field + '.scene')] as const
      }, 40))
    }
    if (typeof row.expeditionOnly !== 'boolean') return p.fail(field + '.expeditionOnly', 'expected a crew eligibility rule')
    return [p.speaker(row.actor, field + '.actor'), { duty: bank('duty'), ship: bank('ship'), ground: bank('ground'),
      signature: bank('signature'), expeditionOnly: row.expeditionOnly }] as const
  }, 250))
  return { ...(voices ? { voices } : {}), dispatches, harbor: { flag: p.slug(harbor.flag, path + '.harbor.flag'), port: p.slug(harbor.port, path + '.harbor.port'),
    crossings: p.list(harbor.crossings, path + '.harbor.crossings', quest, 3) },
    hushCrews, hushApproach: mission(root.hushApproach, path + '.hushApproach'),
    start: quest(root.start, path + '.start'), capitals, courts, witnessesAt: quest(root.witnessesAt, path + '.witnessesAt'),
    ground: p.list(root.ground, path + '.ground', mission, 5), speakerAt: quest(root.speakerAt, path + '.speakerAt'),
    bridge: scene(root.bridge, path + '.bridge'), speakers, victory: p.slug(root.victory, path + '.victory'),
    returnToPlay: p.slug(root.returnToPlay, path + '.returnToPlay'), credits: scene(root.credits, path + '.credits'),
    trueCredits: { scene: scene(trueCredits.scene, path + '.trueCredits.scene'), flag: p.slug(trueCredits.flag, path + '.trueCredits.flag') },
    visits, visitBanks, reports, recoveries }
}
