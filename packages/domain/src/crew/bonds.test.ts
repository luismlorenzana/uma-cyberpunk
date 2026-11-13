import { describe, expect, it } from 'vitest'
import { addRapport, BOND_TUNING, bondProgress, catchUpFactor, choosePath, median, newBond, readyScene, seeBondScene, settleBond } from './bonds'

const open = () => true

describe('bonds (TC56)', () => {
  it('lands ranks as rapport fills them, carrying the rest', () => {
    const b = addRapport(newBond(), 260, open)
    expect([b.rank, b.rapport]).toEqual([3, 10]) // 100 to rank 2, 150 to rank 3
    expect(bondProgress(b)).toBeCloseTo(10 / 200)
  })
  it('waits at a closed gate and lands the rank the moment it opens, with the rapport kept', () => {
    const gate = (r: number) => r !== 4
    const b = addRapport(newBond(), 700, gate)
    expect([b.rank, b.rapport]).toEqual([3, 450]) // waits at 3; 450 already toward 4
    const opened = settleBond(b, open)
    expect([opened.rank, opened.rapport]).toEqual([5, 0]) // 200 to rank 4, then 250 to rank 5
  })
  it('stops at rank 10', () => {
    const b = addRapport(newBond(), 99_999, open)
    expect([b.rank, b.rapport, bondProgress(b)]).toEqual([10, 0, 1])
  })
  it('never takes rapport away', () => expect(addRapport(addRapport(newBond(), 50, open), -40, open).rapport).toBe(50))
  it('counts double below the crew median', () => {
    expect(median([1, 3, 5, 7])).toBe(4)
    expect(catchUpFactor(2, [1, 3, 5, 7])).toBe(BOND_TUNING.catchUp)
    expect(catchUpFactor(5, [1, 3, 5, 7])).toBe(1)
    expect(catchUpFactor(1, [])).toBe(1)
  })
  it('offers the lowest written scene she has reached and not seen, and keeps it until played', () => {
    const b = addRapport(newBond(), 500, open) // rank 4
    expect(readyScene(b, [2, 4, 8])).toBe(2)
    const seen = seeBondScene(b, 2)
    expect(readyScene(seen, [2, 4, 8])).toBe(4)
    expect(readyScene(seeBondScene(seen, 4), [2, 4, 8])).toBeNull() // 8 not reached
    expect(seeBondScene(seen, 2)).toBe(seen)
  })
  it('keeps the path chosen', () => expect(choosePath(newBond(), 'heart').path).toBe('heart'))
})
