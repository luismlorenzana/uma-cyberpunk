import type { Save } from '../save/save'
import type { CampaignQuest, GroundEncounter } from './campaign'
import type { CampaignRecruit } from './campaign-recruits'
import type { P } from './parse'

export const SIGNAL_CAPTURES = 5
export const CORE_CAPTURES = 10

export interface CampaignTier {
  number: number
  captures: { outfit: number; encounter: string; flag: string }[]
  signal: string
  core?: { after: string; settles: string }
}

export function campaignCaptures(tier: CampaignTier, save: Pick<Save, 'story' | 'worlds'>): number {
  const flags = new Set(save.story.flags)
  const missions = new Set(save.worlds.missions)
  return tier.captures.filter(({ flag, encounter }) => flags.has(flag) && missions.has(encounter)).length
}

export function parseCampaignTiers(p: P, value: unknown, quests: ReadonlyMap<string, CampaignQuest>,
  recruits: readonly CampaignRecruit[], ground: ReadonlyMap<string, GroundEncounter>, draft: boolean): CampaignTier[] {
  const used = { outfits: new Set<number>(), encounters: new Set<string>(), flags: new Set<string>(), bosses: new Set<string>(),
    gates: new Set<string>() }
  const byEncounter = new Map([...quests.values()].filter(q => q.encounter).map(q => [q.encounter!, q]))
  function ancestors(id: string): Set<string> {
    const found = new Set<string>()
    const pending = [id]
    while (pending.length) {
      const q = quests.get(pending.pop()!)!
      if (found.has(q.id)) continue
      found.add(q.id)
      if (q.after) pending.push(q.after)
      pending.push(...(q.requires ?? []))
    }
    return found
  }
  function gate(value: unknown, field: string) {
    const id = p.slug(value, field)
    if (!quests.has(id) || used.gates.has(id)) p.fail(field, 'expected a unique campaign milestone')
    used.gates.add(id)
    return id
  }
  const tiers = p.list(value, 'tiers', (raw, field) => {
    const row = p.object(raw, field, ['number', 'captures', 'signal', 'core'], ['number', 'captures', 'signal'])
    const number = p.int(row.number, field + '.number', 1, 5)
    const signal = gate(row.signal, field + '.signal')
    if (quests.get(signal)!.encounter) p.fail(field + '.signal', 'expected a dialogue milestone')
    const core = row.core === undefined ? undefined : (() => {
      const spec = p.object(row.core, field + '.core', ['after', 'settles'])
      const after = gate(spec.after, field + '.core.after')
      const settles = gate(spec.settles, field + '.core.settles')
      if (!ancestors(after).has(signal) || !ancestors(settles).has(after)) p.fail(field + '.core', 'expected a chain from the signal to the Core settlement')
      return { after, settles }
    })()
    const counts = p.list(row.captures, field + '.captures', (raw, path) => {
      const entry = p.object(raw, path, ['outfit', 'encounter'])
      const outfit = p.outfit(entry.outfit, path + '.outfit'), encounter = p.slug(entry.encounter, path + '.encounter')
      const fight = ground.get(encounter), quest = byEncounter.get(encounter), recruit = recruits.find(entry => entry.outfit === outfit)
      if (!fight?.rescue || !fight.win.flag || !quest || !recruit?.story.includes(quest.id)) {
        return p.fail(path, 'expected this recruit’s ground rescue and its committed capture flag')
      }
      const flag = fight.win.flag, boss = fight.rescue.heroine
      if (used.outfits.has(outfit) || used.encounters.has(encounter) || used.flags.has(flag) || used.bosses.has(boss)) {
        p.fail(path, 'capture, recruit, boss and flag must be unique across tiers')
      }
      const reachable = ancestors(quest.id)
      if (reachable.has(signal) || (core && reachable.has(core.after))) p.fail(path, 'the capture depends on its own milestone')
      used.outfits.add(outfit)
      used.encounters.add(encounter)
      used.flags.add(flag)
      used.bosses.add(boss)
      return { outfit, encounter, flag }
    }, CORE_CAPTURES)
    if (!counts.length || (!draft || core) && counts.length !== CORE_CAPTURES) {
      p.fail(field + '.captures', 'a tier with a Core needs ten qualifying captures')
    }
    if (!draft && !core) p.fail(field + '.core', 'a complete tier needs a Core')
    return { number, captures: counts, signal, ...(core ? { core } : {}) }
  }, 5)
  if (!tiers.length) p.fail('tiers', 'expected at least one tier')
  for (const [index, tier] of tiers.entries()) {
    if (tier.number !== index + 1 || (index > 0 && !tiers[index - 1]?.core)) p.fail('tiers', 'expected successive tiers with a preceding Core')
  }
  if (used.outfits.size !== recruits.length) p.fail('tiers', 'each recruit must belong to one tier')
  return tiers
}
