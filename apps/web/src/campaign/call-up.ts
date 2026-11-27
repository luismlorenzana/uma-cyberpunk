import { awayMembers, campaignSupport, canTakeOrdinaryAssignment, crewSpeaker, resting, type CampaignBook, type CampaignQuest, type Save } from '@cyber/domain'
import { voyageCrew } from './watch'

export function bridgeCrew(save: Save, ashore?: ReadonlySet<number>, clearedAllies?: ReadonlySet<number>, requiredLead?: number) {
  const away = new Set(awayMembers(save.operations, save.squads)), deployed = voyageCrew(save)
  return save.crew.filter(member => !ashore?.has(member.outfit) && !away.has(member.outfit)
    && (requiredLead === undefined || !member.heroine)
    && (canTakeOrdinaryAssignment(member) || (member.heroine && clearedAllies?.has(member.outfit) && !deployed.has(member.heroine))))
}

/** Only that operation borrows both members of an available, released home pair. */
export function campaignCallUp(book: CampaignBook, save: Save, quest: CampaignQuest): number[] {
  const away = new Set(awayMembers(save.operations, save.squads))
  const crews = new Map(save.crew.map(member => [member.outfit, member]))
  const flags = new Set(save.story.flags)
  return (book.allies ?? []).flatMap(ally => {
    if (book.fourAct || !ally.home || !quest.callUp?.includes(ally.partner) || !flags.has(ally.release.flag) || !flags.has(ally.home.flag)) return []
    const members = [ally.partner, ally.member]
    return members.every(outfit => {
      const member = crews.get(outfit)
      return member && !away.has(outfit) && !resting(member)
    }) && crews.get(ally.member)?.heroine === ally.heroine ? members : []
  })
}

export function missionAshore(book: CampaignBook, save: Save): ReadonlySet<number> {
  const ashore = campaignSupport(book, save).ashore
  if (save.mission?.callUp) {
    const quest = book.quests.find(row => row.encounter === save.mission!.id)
    const admitted = new Set(quest ? campaignCallUp(book, save, quest) : [])
    for (const outfit of save.mission.callUp.members) if (admitted.has(outfit)) ashore.delete(outfit)
  }
  const duo = save.finaleProgress?.duo
  if (duo && save.mission && save.mission.id === book.fourActFinale?.hushApproach) {
    const riders = book.fourAct?.duos.get(duo)?.expedition?.members ?? []
    const reserved = new Set(riders.map(member => member.role === 'uma' ? member.outfit : member.heroine))
    for (const member of save.crew) if (reserved.has(crewSpeaker(member))) ashore.add(member.outfit)
  }
  return ashore
}
