import type { Bands } from '@cyber/battle'
import { awayMembers, campaignSupport, crewSpeaker, issuedCampaignRig, laserFitting, observeManagement, PARTS_BY_ID,
  rigStats, savePreset, SLOT_KIND, type CampaignBook, type ExpeditionRun, type Rig, type RigSlot, type Save, type Speaker } from '@cyber/domain'
import { campaignActorXp, campaignArmorForXp, reinforceCampaignArmor } from './progression'
import { CAMPAIGN_ARMOR_SLOTS, applyCampaignArmor, campaignLaserTraining, expeditionRoleKit, fitCampaignChassis } from './training'
import { voyageCrew } from './watch'
import { workshopAt } from './workshop'

export interface CharacterBuildContext {
  actor: Speaker
  bands: Bands
  assignment?: ExpeditionRun['members'][number]
  variant: number
}

export const isArmorSlot = (slot: RigSlot): slot is typeof CAMPAIGN_ARMOR_SLOTS[number] =>
  CAMPAIGN_ARMOR_SLOTS.some(candidate => slot === candidate)

const wearer = (save: Save, actor: Speaker) => save.crew.find(member => crewSpeaker(member) === actor)

export function characterBuild(save: Save, context: CharacterBuildContext) {
  const { actor, bands, assignment, variant } = context
  const member = wearer(save, actor)
  const template = typeof actor === 'number' ? laserFitting(campaignLaserTraining(save, actor))
    : assignment ? expeditionRoleKit(assignment, variant, save) : undefined
  if (!template) return
  const issued = fitCampaignChassis(template, bands)
  const equipped = { ...issued.rig }
  for (const slot of CAMPAIGN_ARMOR_SLOTS) {
    const part = member?.rig?.[slot]
    if (part && save.campaignGear.parts.includes(part)) Object.assign(equipped, { [slot]: part })
  }
  const worn = fitCampaignChassis(template, bands, member?.rig, save.campaignGear.parts)
  const bonus = campaignArmorForXp(campaignActorXp(save, actor) ?? 0, save.campaignCurve)
  const compare = (rig: Rig) => rigStats(rig, bands, reinforceCampaignArmor(applyCampaignArmor(template, rig).loadout, bonus))
  return { member, issued: issued.rig, rig: worn.rig, equipped, loadout: worn.loadout, stats: compare(worn.rig), compare }
}

/** A preset stores a snapshot. Role mounts follow the currently issued kit when the armor is applied. */
export function armorFrom(current: Rig, preset: Rig): Rig {
  const { core, leftArm, rightArm, legs, visor, coat } = preset
  return { ...current, core, leftArm, rightArm, legs, visor, coat }
}

export function equippedBy(save: Save, actor: Speaker, part: string): Speaker | undefined {
  const holder = save.crew.find(member => crewSpeaker(member) !== actor && member.rig && Object.values(member.rig).includes(part))
  return holder && crewSpeaker(holder)
}

export function characterFitBlock(save: Save, book: CampaignBook, actor: Speaker): string | undefined {
  const member = wearer(save, actor)
  if (typeof actor !== 'number' || member?.expeditionOnly) return 'Role equipment is assigned in sortie prep.'
  if (!member) return 'Recruit this Uma to save and fit equipment.'
  if (voyageCrew(save).has(actor) || awayMembers(save.operations, save.squads).includes(member.outfit)
    || campaignSupport(book, save).ashore.has(member.outfit)) return 'This Uma is away from the Hangar.'
  if (!workshopAt(save, book)) return 'Dock at an available Workshop to change equipment.'
}

/** Check the complete desired fit before changing any slot. Reservations only belong to equipped rigs. */
export function characterRigProblem(save: Save, book: CampaignBook, context: CharacterBuildContext, desired: Rig): string | undefined {
  const build = characterBuild(save, context)
  if (!build) return 'Equipment is unavailable.'
  const blocked = characterFitBlock(save, book, context.actor)
  if (blocked) return blocked
  const reserved = new Set<string>()
  for (const slot of CAMPAIGN_ARMOR_SLOTS) {
    const id = desired[slot]
    if (id === build.issued[slot]) continue
    const part = id && PARTS_BY_ID.get(id)
    if (!part || part.slot !== SLOT_KIND[slot] || !save.campaignGear.parts.includes(part.id)) {
      return (part ? part.name : 'This part') + ' is unavailable.'
    }
    if (equippedBy(save, context.actor, part.id) !== undefined) return `${part.name} is fitted to another character.`
    if (reserved.has(part.id)) return `Only one ${part.name} is in stock.`
    reserved.add(part.id)
  }
  return build.compare(armorFrom(build.rig, desired)).problem ?? undefined
}

export function fitCharacterRig(save: Save, book: CampaignBook, context: CharacterBuildContext, desired: Rig): Save {
  const build = characterBuild(save, context)
  const member = build?.member
  if (!build || !member || characterRigProblem(save, book, context, desired)) return save
  if (CAMPAIGN_ARMOR_SLOTS.every(slot => build.equipped[slot] === desired[slot])) return save
  const rig = armorFrom(member.rig ?? issuedCampaignRig(), desired)
  return observeManagement(save, { ...save, crew: save.crew.map(row => row === member ? { ...member, rig } : row) })
}

export function saveCharacterLoadout(save: Save, context: CharacterBuildContext, index: number, name: string): Save {
  if (save.mission || typeof context.actor !== 'number' || !Number.isInteger(index)) return save
  const build = characterBuild(save, context)
  const member = build?.member
  if (!build || !member || member.expeditionOnly || index > member.presets.length
    || CAMPAIGN_ARMOR_SLOTS.some(slot => build.equipped[slot] !== build.rig[slot])) return save
  const updated = savePreset(member, index, name, build.rig)
  return updated === member ? save : { ...save, crew: save.crew.map(row => row === member ? updated : row) }
}

export function wearCharacterLoadout(save: Save, book: CampaignBook, context: CharacterBuildContext, index: number): Save {
  const preset = wearer(save, context.actor)?.presets[index]
  return preset ? fitCharacterRig(save, book, context, preset.rig) : save
}
