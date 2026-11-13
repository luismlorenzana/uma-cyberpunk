// A battle in play (CY8, BP4): the frozen input and the actions taken, the state they replay to, and the measures the
// results show. Resume replays the stored actions on the stored rules version; if that fails (the rules changed under
// it), the caller offers Restart. Pure.
import { applyBattleAction, replayBattle, startBattle, type BattleAction, type BattleInput, type BattleState, type Cue } from '@cyber/battle'

export interface Tally { playerTurns: number; partsBroken: number; counters: number; crossfires: number; covers: number }
export const EMPTY_TALLY: Tally = { playerTurns: 0, partsBroken: 0, counters: 0, crossfires: 0, covers: 0 }

/** Adds an action's cues to the tally. */
export function tally(t: Tally, cues: readonly Cue[], state: BattleState): Tally {
  const next = { ...t }
  for (const c of cues) {
    if (c.kind === 'turnStarted' && state.units.find((u) => u.id === c.unit)?.side === 'squad') next.playerTurns++
    else if (c.kind === 'partBroke') next.partsBroken++
    else if (c.kind === 'counter') next.counters++
    else if (c.kind === 'crossfire') next.crossfires++
    else if (c.kind === 'cover') next.covers++
  }
  return next
}

export interface Session { input: BattleInput; actions: BattleAction[]; state: BattleState; tally: Tally }

export function startSession(input: BattleInput): { session: Session; cues: Cue[] } {
  const { state, cues } = startBattle(input)
  return { session: { input, actions: [], state, tally: tally(EMPTY_TALLY, cues, state) }, cues }
}

/** Applies an action: the next session and its cues, or the error. */
export function act(s: Session, action: BattleAction): { session: Session; cues: Cue[] } | { error: string } {
  const r = applyBattleAction(s.state, action)
  if (r.error) return { error: r.error }
  return { session: { input: s.input, actions: [...s.actions, action], state: r.state, tally: tally(s.tally, r.cues, r.state) }, cues: r.cues }
}

/** Rebuilds a stored battle; an error means the stored actions no longer replay. */
export function resume(input: BattleInput, actions: readonly BattleAction[]): Session | { error: string } {
  try {
    const r = replayBattle(input, actions)
    if (r.error) return { error: r.error }
    let t = EMPTY_TALLY
    // The tally needs each step's state; replaying again is cheap.
    let state = startBattle(input).state
    t = tally(t, r.cues[0] ?? [], state)
    actions.forEach((a, i) => { state = applyBattleAction(state, a).state; t = tally(t, r.cues[i + 1] ?? [], state) })
    return { input, actions: [...actions], state: r.state, tally: t }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
