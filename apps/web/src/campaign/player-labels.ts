import type { CampaignBook } from '@cyber/domain'

const systems: Record<string, string> = {
  arclight: 'Arclight', cindervale: 'Cindervale', 'far-meridian': 'Far Meridian', nacre: 'Nacre', virelai: 'Virelai',
}
export const systemName = (id: string) => systems[id] ?? 'Other systems'

export const formationRoleName = {
  uma: 'Rifle officer', 'boss-ally': 'Melee officer', 'melee-shield': 'Shield specialist',
  'ranged-medic': 'Combat medic', 'long-range': 'Long-range specialist',
} as const

export function battleTitle(book: CampaignBook, mission: string) {
  const quest = book.quests.find(row => row.encounter === mission)
  return book.ground.get(mission)?.title ?? quest?.title ?? (book.commands.has(mission) ? 'Ship operation' : 'Ground operation')
}
