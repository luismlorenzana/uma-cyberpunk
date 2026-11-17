export type SoloNight =
  | { kind: 'visit'; companion: number; scene: string; morning: string | null }
  | { kind: 'morning'; companion: number; scene: string }
export type PairNight =
  | { kind: 'pair-visit'; pair: string; scene: string; morning: string | null }
  | { kind: 'pair-morning'; pair: string; scene: string }
export type CampaignNight = SoloNight | PairNight
export type CampaignVisit = Extract<CampaignNight, { kind: 'visit' | 'pair-visit' }>

export interface CampaignDay<N extends CampaignNight = CampaignNight> {
  day: number
  pending: N | null
}

export const firstCampaignDay = (): CampaignDay<SoloNight> => ({ day: 1, pending: null })

/** A choice is saved before starting the visit. Ending it settles the night once. */
export function startCampaignNight(day: CampaignDay, visit: CampaignVisit | null): CampaignDay {
  if (day.pending) return day
  return visit ? { ...day, pending: visit } : { day: day.day + 1, pending: null }
}

export function finishCampaignNightScene(day: CampaignDay, finishedDay: number, finished: CampaignNight): CampaignDay {
  const pending = day.pending
  if (day.day !== finishedDay || !pending || pending.kind !== finished.kind || pending.scene !== finished.scene) return day
  if (('pair' in pending && (!('pair' in finished) || pending.pair !== finished.pair))
    || ('companion' in pending && (!('companion' in finished) || pending.companion !== finished.companion))) return day
  if (pending.kind === 'morning' || pending.kind === 'pair-morning') return { ...day, pending: null }
  return {
    day: day.day + 1,
    pending: !pending.morning ? null : pending.kind === 'pair-visit' ? { kind: 'pair-morning', pair: pending.pair, scene: pending.morning }
      : { kind: 'morning', companion: pending.companion, scene: pending.morning },
  }
}
