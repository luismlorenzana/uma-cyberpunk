export const CABIN_STAGES = ['acquaintance', 'friend', 'partner'] as const
export type CabinStage = typeof CABIN_STAGES[number]
export interface CabinEvening {
  id: string
  source: { companion: number } | { sector: string } | { pair: string } | { trio: string }
  chatRapport: number
  chats: Record<CabinStage, string[]>
  invitation: { scene: string; stay: number; leave: number; wait?: number; decline?: number }
  bed: string[]
  morning: { stay: string; leave: string }
  changeMind: string
}

/** Freeze scene identities and choice meaning before play; a release update never reselects a pending visit. */
export interface CabinNight {
  kind: 'cabin'
  id: string
  phase: 'chat' | 'invitation' | 'bed' | 'leave' | 'morning'
  scene: string
  round: number
  outcome: 'stay' | 'leave' | null
  choice: number | null
  plan: {
    invitation: CabinEvening['invitation'] | null
    bed: string
    morning: CabinEvening['morning']
    changeMind: string
    location: 'aboard' | 'ashore'
    rapport: { companion: number; amount: number } | null
  }
}
