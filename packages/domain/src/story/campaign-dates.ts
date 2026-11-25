import { BOND_TUNING } from '../crew/bonds'
import { walkSteps } from './check'
import { P } from './parse'
import { campaignSpeaker, type CampaignAlly } from './campaign-allies'
import type { Scene, StoryPack } from './types'

export interface DateVisit {
  scene: string
  morning: string | null
  title: string
}

export interface DateMilestone extends DateVisit {
  rank: number
  rapport: number
  after?: string
  legacyFlag?: string
  /** A shore milestone is offered at this port; ordinary ship evenings stay available. */
  port?: string
}

export interface CampaignDate {
  companion: number
  overnightRank?: number
  after: string
  milestones: DateMilestone[]
  regular: DateVisit
  awards: { quest: string; rapport: number }[]
}

export function parseCampaignDates(value: unknown, story: StoryPack, scenes: ReadonlyMap<string, Scene>,
  quests: ReadonlySet<string>, reserved: ReadonlySet<string>, companions: ReadonlySet<number>, ports: ReadonlySet<string> = new Set(),
  allies: readonly CampaignAlly[] = []): CampaignDate[] {
  const p = new P('campaign.json')
  const cast = new Set([...story.casting.crewOrder, ...story.casting.leads.map(({ outfit }) => outfit)])
  const usedScenes = new Set(reserved), usedCompanions = new Set(companions)
  function quest(value: unknown, path: string): string {
    const id = p.slug(value, path)
    return quests.has(id) ? id : p.fail(path, `unknown quest ${id}`)
  }
  function scene(value: unknown, path: string, companion: number, pathAllowed = false): Scene {
    const id = p.slug(value, path)
    const declared = scenes.get(id)
    if (!declared || usedScenes.has(id)) return p.fail(path, `unknown or already assigned scene ${id}`)
    const speaker = campaignSpeaker(allies, companion)
    if (!declared.cast.some(({ outfit, heroine }) => typeof speaker === 'number' ? outfit === speaker : heroine === speaker)) p.fail(path, 'the companion must appear in the scene')
    for (const { step } of walkSteps(declared.steps, path)) {
      if (['battle', 'join', 'aboard', 'refit'].includes(step.kind)) p.fail(path, 'a quarters scene cannot change the roster or ship')
      if (!pathAllowed && (step.kind === 'path' || step.kind === 'captain' && step.options.some(option => option.rapport))) p.fail(path, 'bond choices belong in milestones')
    }
    usedScenes.add(id)
    return declared
  }
  return p.list(value, 'dates', (value, path) => {
    const d = p.object(value, path, ['companion', 'after', 'milestones', 'regular', 'awards', 'overnightRank'], ['companion', 'after', 'milestones', 'regular', 'awards'])
    const related = typeof d.companion === 'string' ? allies.find(ally => ally.heroine === d.companion) : undefined
    const companion = related?.member ?? p.outfit(d.companion, `${path}.companion`)
    if ((!cast.has(companion) && !related) || usedCompanions.has(companion)) p.fail(`${path}.companion`, 'expected a unique crew companion')
    usedCompanions.add(companion)
    function visit(o: Record<string, unknown>, field: string, milestone = false): DateVisit {
      return { title: p.text(o.title, `${field}.title`, 60), scene: scene(o.scene, `${field}.scene`, companion, milestone).id,
        morning: o.morning === undefined ? null : scene(o.morning, `${field}.morning`, companion).id }
    }
    let priorRank = 0, paths = 0
    const milestones = p.list(d.milestones, `${path}.milestones`, (value, field): DateMilestone => {
      const fields = ['scene', 'title', 'rank', 'rapport']
      const m = p.object(value, field, [...fields, 'morning', 'after', 'legacyFlag', 'port'], fields)
      const rank = p.int(m.rank, `${field}.rank`, 1, 10)
      if (rank <= priorRank) p.fail(`${field}.rank`, 'milestone ranks must increase')
      priorRank = rank
      const entry = visit(m, field, true)
      const steps = scenes.get(entry.scene)!.steps
      const pathSteps = [...walkSteps(steps, field)].filter(({ step }) => step.kind === 'path')
      if (pathSteps.length) {
        const choice = steps.find((step) => step.kind === 'path')
        if (paths || rank !== BOND_TUNING.pathRank || pathSteps.length !== 1 || !choice || !choice.trust.length || !choice.heart.length) {
          p.fail(field, 'expected one top-level Trust or Heart choice with both branches at rank 8')
        }
        paths++
      }
      if (m.legacyFlag !== undefined && (rank !== 1 || pathSteps.length)) p.fail(field, 'only the first milestone can credit a legacy flag')
      const port = m.port === undefined ? undefined : p.slug(m.port, `${field}.port`)
      if (port !== undefined && !ports.has(port)) p.fail(`${field}.port`, 'unknown shore port')
      return { ...entry, rank, rapport: p.int(m.rapport, `${field}.rapport`, 0, 1000),
        ...(port === undefined ? {} : { port }),
        ...(m.after === undefined ? {} : { after: quest(m.after, `${field}.after`) }),
        ...(m.legacyFlag === undefined ? {} : { legacyFlag: p.slug(m.legacyFlag, `${field}.legacyFlag`) }) }
    }, 10)
    if (paths !== 1 || milestones[0]?.rank !== 1) p.fail(`${path}.milestones`, 'expected rank 1 opening and rank 8 relationship decision')
    const regular = visit(p.object(d.regular, `${path}.regular`, ['scene', 'morning', 'title'], ['scene', 'title']), `${path}.regular`)
    const paid = new Set<string>()
    const awards = p.list(d.awards, `${path}.awards`, (value, field) => {
      const a = p.object(value, field, ['quest', 'rapport'])
      const id = quest(a.quest, `${field}.quest`)
      if (paid.has(id)) p.fail(field, 'duplicate quest award')
      paid.add(id)
      return { quest: id, rapport: p.int(a.rapport, `${field}.rapport`, 1, 1000) }
    }, 24)
    const after = quest(d.after, `${path}.after`)
    if (related && related.release.quest !== after) p.fail(`${path}.after`, 'Ally dates start at the release quest')
    const overnightRank = d.overnightRank === undefined ? undefined : p.int(d.overnightRank, `${path}.overnightRank`, BOND_TUNING.pathRank, 10)
    return { companion, after, milestones, regular, awards, ...(overnightRank === undefined ? {} : { overnightRank }) }
  }, 60 + allies.length)
}
