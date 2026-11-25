import type { CampaignBook, CommandEncounter, Save } from '@cyber/domain'

export type CommandFront = 'home' | 'liberation' | 'expedition' | 'finale'

export function campaignCommandFront(book: CampaignBook, save: Save, encounter: string): CommandFront {
  if (book.fourActFinale?.hushApproach === encounter) return 'finale'
  if (save.expedition) return 'expedition'
  const quest = book.quests.find(quest => quest.encounter === encounter)
  if (quest && [...book.fourAct?.systems.values() ?? []].some(system => system.capital?.operation === quest.id)) return 'liberation'
  return 'home'
}

export function tuneCampaignCommand(encounter: CommandEncounter, front: CommandFront): CommandEncounter {
  if (encounter.threats.length < 2) return encounter
  const threats = encounter.threats.map((wave, i, waves) => {
    const initial = i === 0, final = i === waves.length - 1
    if (front === 'home' && !encounter.assault && initial) return { ...wave, fighters: Math.max(0, wave.fighters - 1) }
    if (front === 'liberation' && encounter.assault && final) return { ...wave, power: Math.min(12, wave.power + 1) }
    if (front === 'expedition' && initial) return { ...wave, power: Math.max(1, wave.power - 1) }
    if ((front === 'expedition' || front === 'finale') && final) return { ...wave, fighters: Math.min(6, wave.fighters + 1) }
    return wave
  })
  return { ...encounter, threats }
}
