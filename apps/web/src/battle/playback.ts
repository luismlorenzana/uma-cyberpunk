// How an action's cues play (CY8, copied in spirit from uma-quest's fight/playback.ts): which attacks get the cut-in and
// at what speed, and how long each step takes, enemy turns at double speed. Pure.
import type { BattleState, Cue } from '@cyber/battle'

export type CutInSetting = 'auto' | 'quick' | 'off'
export type CutInSpeed = 'full' | 'quick' | 'off'

/** TC28: Full the first time each weapon (a unit's mount) is seen and always for a leader, Quick otherwise; the setting
 * can hold it to Quick or turn it off. */
export function cutInSpeed(setting: CutInSetting, seen: ReadonlySet<string>, cue: Extract<Cue, { kind: 'attack' }>, state: BattleState): CutInSpeed {
  if (setting === 'off') return 'off'
  if (setting === 'quick') return 'quick'
  const boss = state.input.units.some((u) => u.leader && (u.id === cue.unit || u.id === cue.target))
  return cue.signature || boss || !seen.has(`${cue.unit}:${cue.with}`) ? 'full' : 'quick'
}

export const CUT_IN_MS: Record<CutInSpeed, number> = { full: 1600, quick: 750, off: 0 }

/** A step's base time, before the side's speed: walks go by tiles, hits pause for their numbers. */
export function stepMs(cue: Cue): number {
  switch (cue.kind) {
    case 'moved': return 0 // the walk itself takes its time
    case 'hit': case 'miss': case 'burn': return 220
    case 'rigBreak': case 'freed': case 'extracted': case 'talked': return 500
    case 'terrain': case 'door': case 'heights': case 'volley': case 'volleySignal': return 400
    default: return 0
  }
}

/** Enemy turns play at double speed (TC30). */
export const speedOf = (side: 'squad' | 'enemy'): number => (side === 'enemy' ? 2 : 1)
