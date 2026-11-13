// The stand-in crew's numbers (CY11): invented 5★ stats (each summing to 550, like every outfit's) and running-style
// grades for CY9's invented outfit ids 9000001–9000004, which master data doesn't hold. Invented, so they're in git.
import type { OutfitInfo } from './crew'

const info = (speed: number, stamina: number, power: number, guts: number, wit: number, front: string, pace: string, late: string, end: string): OutfitInfo =>
  ({ stats: { speed, stamina, power, guts, wit }, strategy: { front, pace, late, end } as OutfitInfo['strategy'] })

export const STAND_IN_OUTFITS: Readonly<Record<number, OutfitInfo>> = {
  9000001: info(132, 96, 124, 90, 108, 'A', 'B', 'C', 'G'),
  9000002: info(98, 104, 92, 112, 144, 'G', 'C', 'A', 'B'),
  9000003: info(104, 128, 140, 96, 82, 'C', 'A', 'B', 'E'),
  9000004: info(116, 112, 84, 102, 136, 'F', 'C', 'B', 'A'),
}
