// The timeline (TC3, CY4): each unit's clock fills at its Speed band's rate, and a turn comes when it's full. There are no
// player and enemy phases. Ties go to the higher Speed band, then to the seeded roll. Down units keep their clocks: their
// next turn is when they extract.
import { roll } from './rng'
import { TUNING } from './tuning'
import type { BattleState, UnitInput, UnitState } from './types'

export const inputOf = (state: Pick<BattleState, 'input'>, id: string): UnitInput => state.input.units.find((u) => u.id === id)!
export const rateOf = (input: UnitInput): number => TUNING.clockRate[input.bands.speed]
export const ticksToTurn = (clock: number, rate: number): number => Math.max(0, Math.ceil((TUNING.clockFull - clock) / rate))
/** The round a time falls in: ticks 1–100 are round 1 (a turn at Speed band 3 comes at tick 100). */
export const roundAt = (time: number): number => Math.max(1, Math.ceil(time / TUNING.roundTicks))

interface Clock { id: string; clock: number; rate: number; speed: number }

function pick(state: Pick<BattleState, 'input'>, clocks: readonly Clock[], turn: number): { clock: Clock; ticks: number } | null {
  let best: { clock: Clock; ticks: number; tie: number } | null = null
  for (const c of clocks) {
    const ticks = ticksToTurn(c.clock, c.rate)
    const tie = roll(state.input.seed, turn, c.id, 'order')
    if (!best || ticks < best.ticks || (ticks === best.ticks && (c.speed > best.clock.speed || (c.speed === best.clock.speed && tie < best.tie))))
      best = { clock: c, ticks, tie }
  }
  return best && { clock: best.clock, ticks: best.ticks }
}

const ticking = (u: UnitState) => u.status === 'active' || u.status === 'down'

const clocksOf = (state: Pick<BattleState, 'input' | 'units'>): Clock[] =>
  state.units.filter(ticking).map((u) => {
    const input = inputOf(state, u.id)
    return { id: u.id, clock: u.clock, rate: rateOf(input), speed: input.bands.speed }
  })

/** Who acts next and how many ticks until then, for `turn` (the seeded tie-break's key). */
export function nextTurn(state: Pick<BattleState, 'input' | 'units'>, turn: number): { id: string; ticks: number } | null {
  const next = pick(state, clocksOf(state), turn)
  return next && { id: next.clock.id, ticks: next.ticks }
}

/** Fills every clock by `ticks`. */
export function advanceClocks(units: UnitState[], state: Pick<BattleState, 'input'>, ticks: number): void {
  for (const u of units) if (ticking(u)) u.clock += rateOf(inputOf(state, u.id)) * ticks
}

/**
 * The turns after the active unit's, `count` of them, if she restarts her clock at `restart` (0 after an action, the
 * Wait clock after a Wait). The forecast shows this list, and the timeline ghosts the shift a Wait would cause.
 */
export function upcomingAfter(state: Pick<BattleState, 'input' | 'units' | 'active' | 'turn'>, restart: number, count: number = TUNING.timelineLength): string[] {
  const clocks = clocksOf(state).map((c) => (c.id === state.active ? { ...c, clock: restart } : { ...c }))
  const out: string[] = []
  for (let k = 0; k < count && clocks.length > 0; k++) {
    const next = pick(state, clocks, state.turn + 1 + k)
    if (!next) break
    for (const c of clocks) c.clock += c.rate * next.ticks
    out.push(next.clock.id)
    next.clock.clock = 0
  }
  return out
}

/** The timeline as drawn: the active unit, then the turns after hers. */
export function timeline(state: Pick<BattleState, 'input' | 'units' | 'active' | 'turn'>, count: number = TUNING.timelineLength): string[] {
  if (!state.active) return []
  return [state.active, ...upcomingAfter(state, 0, count - 1)]
}
