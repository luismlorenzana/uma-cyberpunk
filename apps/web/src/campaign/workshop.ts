import { capacityOf, loadOf, type Bands } from '@cyber/battle'
import {
  CAMPAIGN_WORKSHOP_ALLOY_MAX, campaignHomeSupport, issuedCampaignRig, loadoutOf, loadShipment, PARTS_BY_ID, rigProblem, startSupply,
  type CampaignBook, type Rig, type Save,
} from '@cyber/domain'
import { SCENARIOS } from '../mission/battleInput'
import { questComplete } from './quests'

export function workshopAt(save: Save, book: CampaignBook) {
  const { workshop, supply } = book
  if (!workshop || !supply || save.mission || save.campaignDay.pending || save.pairScene) return null
  const invitation = book.quests.find(({ id }) => id === workshop.after)
  const cargo = save.campaignSupply ?? startSupply(supply)
  const port = supply.ports.find(({ id }) => id === workshop.port)
  return invitation && questComplete(save, invitation) && cargo.port === workshop.port && port ? { workshop, cargo, port } : null
}

export function sendWorkshopAlloy(save: Save, book: CampaignBook): Save {
  const at = workshopAt(save, book)
  const shipment = at && loadShipment(at.cargo, at.port, 'alloy')
  if (!shipment || save.campaignGear.alloy + shipment.alloy > CAMPAIGN_WORKSHOP_ALLOY_MAX) return save
  return { ...save, campaignSupply: shipment.supply, campaignGear: { ...save.campaignGear, alloy: save.campaignGear.alloy + shipment.alloy } }
}

export function craftCampaignPart(save: Save, book: CampaignBook, part: string): Save {
  const recipe = workshopAt(save, book)?.workshop.recipes.find((entry) => entry.part === part)
  const gear = save.campaignGear
  if (!recipe || gear.parts.includes(part) || gear.alloy < recipe.alloy) return save
  return { ...save, campaignGear: { alloy: gear.alloy - recipe.alloy, parts: [...gear.parts, part] } }
}

export function rigFits(rig: Rig, bands: Bands): boolean {
  if (rigProblem(rig)) return false
  const loadout = loadoutOf(rig)
  return loadOf(loadout) <= capacityOf({ loadout, bands })
}

export function fittedGroundRig(rig: Rig | null | undefined, scenario: string, expansion?: string): Rig | null {
  const lead = SCENARIOS[scenario]?.input.units.find(({ side }) => side === 'squad')
  if (!rig || !lead) return null
  const fitted = expansion ? { ...rig, back: expansion } : rig
  return rigFits(fitted, lead.bands) ? fitted : null
}

export function fittedSummary(rig: Rig): string {
  return [rig.rightHand, rig.leftArm, rig.rightArm === rig.leftArm ? null : rig.rightArm, rig.back]
    .flatMap((part) => part ? [PARTS_BY_ID.get(part)!.name] : []).join(' · ')
}

function supportsWorkshopMissions(book: CampaignBook, rig: Rig): boolean {
  return !!book.workshop?.missions.every((id) => {
    const mission = Object.values(book.story.chapters).flatMap(({ missions }) => missions).find((entry) => entry.id === id)
    const ground = book.ground.get(id)
    const scenarios = [mission?.scenario, ground?.alternate?.scenario].filter((entry): entry is string => !!entry)
    return scenarios.length > 0 && scenarios.every((id) => fittedGroundRig(rig, id, ground?.expansion) !== null)
  })
}

export function fitCampaignPart(save: Save, book: CampaignBook, outfit: number, part: string, equip: boolean): Save {
  const recipe = workshopAt(save, book)?.workshop.recipes.find((entry) => entry.part === part)
  const member = save.crew.find((entry) => entry.outfit === outfit)
  if (!recipe || !member || !save.campaignGear.parts.includes(part) || campaignHomeSupport(book.pairs, save.story).ashore.has(outfit)) return save
  const issued = issuedCampaignRig()
  const rig = member.rig ?? issued
  if ((rig[recipe.slot] === part) === equip) return save
  if (equip && save.crew.some((entry) => entry.outfit !== outfit && entry.rig && Object.values(entry.rig).includes(part))) return save
  const next = { ...rig, [recipe.slot]: equip ? part : issued[recipe.slot] }
  if (!supportsWorkshopMissions(book, next)) return save
  return { ...save, crew: save.crew.map((entry) => entry === member ? { ...entry, rig: next } : entry) }
}
