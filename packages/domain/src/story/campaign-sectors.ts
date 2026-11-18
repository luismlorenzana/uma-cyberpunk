import type { CampaignSector } from '../campaign-sectors'
import type { SupplyNetwork } from '../campaign-supply'
import { COMMAND_STATIONS, type CommandStation } from '../ship/command'
import type { CampaignQuest } from './campaign'
import type { CampaignRecruit } from './campaign-recruits'
import { P } from './parse'
import { walkSteps } from './check'
import type { Scene, StoryPack } from './types'

export function parseCampaignSectors(value: unknown, quests: ReadonlyMap<string, CampaignQuest>, recruits: readonly CampaignRecruit[],
  supply: SupplyNetwork | undefined, story: StoryPack, scenes: ReadonlyMap<string, Scene>, reserved: ReadonlySet<string>): CampaignSector[] {
  const p = new P('campaign.json')
  const ids = new Set<string>(), officers = new Set<number>()
  const usedScenes = new Set(reserved)
  const speakers = new Set([...story.casting.heroines.flatMap(({ board }) => board ?? []), ...story.casting.minor])
  return p.list(value, 'sectors', (value, path) => {
    const fields = ['id', 'title', 'port', 'officer', 'qualification', 'liberation', 'appointment', 'alloy', 'contribution']
    const s = p.object(value, path, [...fields, 'retirement', 'former', 'shared'], fields)
    const id = p.slug(s.id, `${path}.id`), port = p.slug(s.port, `${path}.port`), officer = p.outfit(s.officer, `${path}.officer`)
    if (id.length > 56 || ids.has(id) || officers.has(officer)) p.fail(path, 'expected a unique short sector id and officer')
    ids.add(id)
    officers.add(officer)
    const recruit = recruits.find(({ outfit }) => outfit === officer)
    if (!recruit || !supply?.ports.some((entry) => entry.id === port)) return p.fail(path, 'expected a recruit and a civilian port')
    const qualification = s.qualification as CommandStation
    if (!COMMAND_STATIONS.includes(qualification)) p.fail(`${path}.qualification`, 'expected a bridge station')
    const localQuest = (key: string) => {
      const quest = p.slug(s[key], `${path}.${key}`)
      if (quests.get(quest)?.port !== port) p.fail(`${path}.${key}`, 'expected a quest at this port')
      return quest
    }
    const liberation = localQuest('liberation'), appointment = localQuest('appointment')
    if (recruit.story.indexOf(liberation) < 0 || recruit.story.indexOf(appointment) <= recruit.story.indexOf(liberation)
      || quests.get(appointment)?.encounter) p.fail(path, 'expected liberation before a dialogue appointment in this recruit’s story')
    const former = s.former === undefined ? undefined : (() => {
      const field = `${path}.former`, row = p.object(s.former, field, ['speaker', 'custody', 'released', 'aboard', 'ashore'])
      const speaker = p.slug(row.speaker, `${field}.speaker`)
      if (!speakers.has(speaker)) p.fail(`${field}.speaker`, 'expected a cast member')
      const flags = (['custody', 'released', 'aboard', 'ashore'] as const).map((key) => p.slug(row[key], `${field}.${key}`))
      if (new Set(flags).size !== flags.length) p.fail(field, 'expected distinct disposition flags')
      return { speaker, custody: flags[0]!, released: flags[1]!, aboard: flags[2]!, ashore: flags[3]! }
    })()
    const shared = s.shared === undefined ? undefined : (() => {
      const field = `${path}.shared`, row = p.object(s.shared, field, ['after', 'visit', 'morning'])
      const after = p.slug(row.after, `${field}.after`)
      if (!former || quests.get(after)?.port !== port) p.fail(field, 'expected a local disposition quest')
      const readScene = (key: 'visit' | 'morning') => {
        const id = p.slug(row[key], `${field}.${key}`), scene = scenes.get(id)
        if (!scene || usedScenes.has(id) || !scene.cast.some((actor) => actor.outfit === officer) || !scene.cast.some((actor) => actor.heroine === former?.speaker)
          || [...walkSteps(scene.steps, field)].some(({ step }) => ['battle', 'join', 'aboard', 'refit'].includes(step.kind))) {
          p.fail(`${field}.${key}`, 'expected a unique scene with both participants and no encounter or roster changes')
        }
        usedScenes.add(id)
        return id
      }
      return { after, visit: readScene('visit'), morning: readScene('morning') }
    })()
    return { id, port, officer, qualification, liberation, appointment, title: p.text(s.title, `${path}.title`, 56),
      alloy: p.int(s.alloy, `${path}.alloy`, 0, 8), contribution: p.text(s.contribution, `${path}.contribution`, 120),
      ...(former ? { former } : {}), ...(shared ? { shared } : {}), ...(s.retirement === undefined ? {} : { retirement: localQuest('retirement') }) }
  }, 24)
}
