
import type { BattleInput, Loadout } from '@cyber/battle'
import { CAMPAIGN_ACT_XP, CAMPAIGN_XP_THRESHOLDS, campaignArmor, campaignLevel, crewSpeaker, levelOf, migrateCampaignXp,
  type CampaignBook, type CombatAct, type ExpeditionRun, type Save, type Speaker } from '@cyber/domain'

export const veteranCoreHp = (xp: number) => Math.min(3, Math.floor(levelOf(xp) / 5))

/** A new deployment freezes veteran reinforcement. Retrying or replaying a recorded battle keeps its original input. */
export function campaignActorXp(save: Pick<Save, 'crew' | 'expeditionXp'>, actor: Speaker): number | undefined {
  return save.crew.find(member => crewSpeaker(member) === actor)?.xp ?? (typeof actor === 'string' ? save.expeditionXp?.[actor] : undefined)
}

export function campaignArmorForXp(xp: number, curve?: 1) {
  return curve ? campaignArmor(campaignLevel(xp, curve)) : { core: veteranCoreHp(xp), arms: 0, legs: 0, next: undefined }
}

export function reinforceCampaignArmor(loadout: Loadout, hp: ReturnType<typeof campaignArmorForXp>): Loadout {
  if (!(hp.core || hp.arms || hp.legs)) return loadout
  const { core, leftArm, rightArm, legs } = loadout
  return { ...loadout, core: { ...core, hp: (core.hp ?? 0) + hp.core },
    leftArm: { ...leftArm, hp: (leftArm.hp ?? 0) + hp.arms }, rightArm: { ...rightArm, hp: (rightArm.hp ?? 0) + hp.arms },
    legs: { ...legs, hp: (legs.hp ?? 0) + hp.legs } }
}

export function campaignBattleProgression(input: BattleInput, save: Pick<Save, 'crew' | 'campaignCurve' | 'expeditionXp'>): BattleInput {
  const xp = [...Object.entries(save.expeditionXp ?? {}), ...save.crew.map(member => [String(crewSpeaker(member)), member.xp] as const)]
  const bonuses = new Map(xp.map(([actor, earned]) => [actor, campaignArmorForXp(earned, save.campaignCurve)]))
  return { ...input, units: input.units.map(unit => {
    const hp = unit.side === 'squad' && unit.ref ? bonuses.get(unit.ref.id) : undefined
    if (!hp || !(hp.core || hp.arms || hp.legs)) return unit
    return { ...unit, loadout: reinforceCampaignArmor(unit.loadout, hp) }
  }) }
}

export const CAMPAIGN_CLEAR_XP = 50

/** Settlements call this once, after recording a first clear. The battle supplies the participating identities. */
export function creditCampaignClear(save: Save, actors: readonly Speaker[], act?: CombatAct): Save {
  const present = new Set(actors.map(String))
  const roster = new Set(save.crew.map(member => String(crewSpeaker(member))))
  if (![...present].some(actor => roster.has(actor) || Object.hasOwn(save.expeditionXp ?? {}, actor))) return save
  const xp = save.campaignCurve && act ? CAMPAIGN_ACT_XP[act] : CAMPAIGN_CLEAR_XP
  const cap = save.campaignCurve ? CAMPAIGN_XP_THRESHOLDS.at(-1)! : Infinity
  const expeditionXp = save.expeditionXp && Object.fromEntries(Object.entries(save.expeditionXp).map(([actor, earned]) =>
    [actor, present.has(actor) && !roster.has(actor) ? Math.min(cap, earned + xp) : earned]))
  return { ...save, ...(expeditionXp ? { expeditionXp } : {}), crew: save.crew.map(member => present.has(String(crewSpeaker(member)))
    ? { ...member, xp: Math.min(cap, member.xp + xp) } : member) }
}

/** A launch receipt identifies the participants even when a given guest has no ordinary duty record. */
export function focusExpeditionCrew(save: Save, members: ExpeditionRun['members']): Save {
  const training = { ...save.combatTraining }
  const guests = new Set<string>()
  const expeditionXp = { ...save.expeditionXp }
  const floor = CAMPAIGN_XP_THRESHOLDS[5]!
  for (const member of members) {
    if (member.role !== 'uma') {
      guests.add(member.heroine)
      if (member.role !== 'boss-ally' && !save.crew.some(row => row.heroine === member.heroine)) {
        expeditionXp[member.heroine] = Math.max(floor, expeditionXp[member.heroine] ?? 0)
      }
      continue
    }
    const prior = training[member.outfit] ?? { rank: 1, subclass: null }
    training[member.outfit] = { ...prior, rank: Math.max(6, prior.rank), focused: true }
  }
  return { ...save, combatTraining: training, expeditionXp, crew: save.crew.map(member =>
    member.heroine && guests.has(member.heroine) && member.xp < floor ? { ...member, xp: floor } : member) }
}

/** Profile-aware migration. Parsing a save alone cannot identify the private campaign or its historical formations. */
export function initializeCampaignCurve(save: Save, book: CampaignBook): Save {
  if (!book.fourAct || save.campaignCurve) return save
  let next: Save = { ...save, campaignCurve: 1, crew: save.crew.map(member => ({ ...member, xp: migrateCampaignXp(member.xp) })) }
  const historical = new Set([save.expedition?.duo, save.finaleProgress?.duo])
  for (const duo of book.fourAct.duos.values()) {
    const launch = duo.expedition?.route && book.quests.find(quest => quest.id === duo.expedition?.route?.launch)
    const seen = launch && (save.story.seen.includes(launch.scene) || launch.sceneWhen && save.story.seen.includes(launch.sceneWhen.scene))
    const fleet = save.fleet?.[duo.id]
    if (duo.expedition && (historical.has(duo.id) || seen || fleet?.condition === 'parked' || fleet?.condition === 'returned')) {
      next = focusExpeditionCrew(next, fleet?.run?.members ?? (save.expedition?.duo === duo.id ? save.expedition.members : duo.expedition.members))
    }
  }
  return next
}
