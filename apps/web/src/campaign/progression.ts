
import { crewSpeaker, type Save, type Speaker } from '@cyber/domain'

export const CAMPAIGN_CLEAR_XP = 50

/** Settlements call this once, after recording a first clear. The battle supplies the participating identities. */
export function creditCampaignClear(save: Save, actors: readonly Speaker[]): Save {
  const present = new Set(actors.map(String))
  if (!save.crew.some(member => present.has(String(crewSpeaker(member))))) return save
  return { ...save, crew: save.crew.map(member => present.has(String(crewSpeaker(member)))
    ? { ...member, xp: member.xp + CAMPAIGN_CLEAR_XP } : member) }
}
