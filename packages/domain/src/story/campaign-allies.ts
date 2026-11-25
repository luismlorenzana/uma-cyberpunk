import { issuedCampaignRig } from '../campaign-gear'
import { ROLES, STAND_IN_BANDS, type CrewMember } from '../crew/crew'
import { PARTS_BY_ID, loadoutOf } from '../crew/parts'
import { capacityOf, loadOf, type Role } from '@cyber/battle'
import { walkSteps } from './check'
import type { CampaignQuest } from './campaign'
import type { P } from './parse'
import type { Scene, Speaker, StoryPack } from './types'

export interface CampaignAlly {
  heroine: string
  member: number
  partner: number
  release: { quest: string; flag: string }
  pairFlag?: string
  home?: { quest: string; flag: string }
  role: Role
  rig: NonNullable<CrewMember['rig']>
}

export const campaignSpeaker = (allies: readonly CampaignAlly[] | undefined, member: number): Speaker =>
  allies?.find(ally => ally.member === member)?.heroine ?? member

export function parseCampaignAllies(p: P, value: unknown, story: StoryPack, scenes: ReadonlyMap<string, Scene>,
  quests: ReadonlyMap<string, CampaignQuest>, fourAct = false): CampaignAlly[] {
  const outfits = new Set([...story.casting.crewOrder, ...story.casting.leads.map(lead => lead.outfit)])
  const members = new Set(outfits), heroines = new Set<string>()
  const checkFlag = (quest: CampaignQuest, flag: string) => scenes.get(quest.scene)?.steps.some(step => step.kind === 'flag' && step.flag === flag && step.set)
  return p.list(value, 'allies', (raw, field) => {
    const required = ['heroine', 'member', 'partner', 'release', 'role', 'main', 'back']
    const row = p.object(raw, field, [...required, 'pairFlag', 'home'], fourAct ? required : [...required, 'pairFlag', 'home'])
    const heroine = p.slug(row.heroine, `${field}.heroine`), member = p.outfit(row.member, `${field}.member`)
    if (!story.casting.heroines.some(entry => entry.board === heroine) || heroines.has(heroine)) p.fail(field, 'expected a unique heroine in casting')
    if (members.has(member)) p.fail(field, 'expected a distinct permanent crew record key')
    members.add(member)
    heroines.add(heroine)
    const partner = p.outfit(row.partner, `${field}.partner`)
    if (!outfits.has(partner)) p.fail(field, 'expected a crew partner in casting')
    const milestone = (name: 'release' | 'home') => {
      const entry = p.object(row[name], `${field}.${name}`, ['quest', 'flag'])
      const quest = p.slug(entry.quest, `${field}.${name}.quest`), flag = p.slug(entry.flag, `${field}.${name}.flag`)
      const binding = quests.get(quest)
      if (!binding || binding.encounter || !checkFlag(binding, flag)) p.fail(`${field}.${name}`, 'expected a dialogue quest with an explicit committed flag')
      return { quest, flag }
    }
    const release = milestone('release'), home = row.home === undefined ? undefined : milestone('home')
    const pairFlag = row.pairFlag === undefined ? undefined : p.slug(row.pairFlag, `${field}.pairFlag`)
    if (pairFlag && ![...quests.values()].some(q => [...walkSteps(scenes.get(q.scene)!.steps, '')].some(({ step }) =>
      step.kind === 'flag' && step.set && step.flag === pairFlag))) p.fail(field, 'expected an authored pair flag')
    const role = row.role as Role
    if (!ROLES.includes(role)) p.fail(`${field}.role`, 'expected a crew role')
    const main = p.slug(row.main, `${field}.main`), back = p.slug(row.back, `${field}.back`)
    if (PARTS_BY_ID.get(main)?.slot !== 'hand' || PARTS_BY_ID.get(back)?.slot !== 'back') p.fail(field, 'expected hand and Back equipment')
    const rig = issuedCampaignRig(main, back), loadout = loadoutOf(rig)
    if (loadOf(loadout) > capacityOf({ loadout, bands: STAND_IN_BANDS })) p.fail(field, 'the issued rig exceeds capacity')
    return { heroine, member, partner, release, role, rig, ...(home ? { home } : {}), ...(pairFlag ? { pairFlag } : {}) }
  }, 60)
}
