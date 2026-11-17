export type CampaignNight =
  | { kind: 'visit'; companion: number; scene: string; morning: string | null }
  | { kind: 'morning'; companion: number; scene: string }

export interface CampaignDay {
  day: number
  pending: CampaignNight | null
}

export const firstCampaignDay = (): CampaignDay => ({ day: 1, pending: null })

/** A choice is saved before starting the visit. Ending it settles the night once. */
export function startCampaignNight(day: CampaignDay, visit: Extract<CampaignNight, { kind: 'visit' }> | null): CampaignDay {
  if (day.pending) return day
  return visit ? { ...day, pending: visit } : { day: day.day + 1, pending: null }
}

export function finishCampaignNightScene(day: CampaignDay, finishedDay: number, finished: CampaignNight): CampaignDay {
  const pending = day.pending
  if (day.day !== finishedDay || !pending || pending.kind !== finished.kind || pending.scene !== finished.scene || pending.companion !== finished.companion) return day
  if (pending.kind === 'morning') return { ...day, pending: null }
  return {
    day: day.day + 1,
    pending: pending.morning ? { kind: 'morning', companion: pending.companion, scene: pending.morning } : null,
  }
}
