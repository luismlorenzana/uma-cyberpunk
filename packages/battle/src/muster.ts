// The Steel Muster (WD11, CY5), on when the input lists `steel-muster`: cover's bonus is the general rule; here are the
// reload, the shared volley meter with its signal a round ahead, and pinning fire.
import { harm, tileOf, unitById, v2 } from './harm'
import { roll } from './rng'
import { lineOfFire } from './sight'
import { boardOf } from './terrain'
import { inputOf } from './timeline'
import { TUNING } from './tuning'
import type { BattleState, Cue, PartId, Tile, Weapon } from './types'
import { PARTS } from './types'

export const musterOn = (state: Pick<BattleState, 'input'>): boolean => v2(state) && (state.input.factions ?? []).includes('steel-muster')
export const isMuster = (state: Pick<BattleState, 'input'>, id: string): boolean => musterOn(state) && inputOf(state, id).faction === 'steel-muster'

/** After a Muster unit fires: Short and Long reload (no counter until her next turn), and the meter fills. When it's full,
 * the volley is signalled: the squad's tiles are marked, to be hit a round later. */
export function afterMusterAttack(state: BattleState, unitId: string, band: Weapon['band'], cues: Cue[]): void {
  if (!isMuster(state, unitId)) return
  const u = unitById(state, unitId)
  if ((band === 'short' || band === 'long') && !u.reloading) {
    u.reloading = true
    cues.push({ kind: 'reload', unit: unitId })
  }
  const volley = state.field!.volley
  if (volley.at > 0) return
  volley.meter += 1
  if (volley.meter < TUNING.muster.volleyFull) return
  const marked: Tile[] = state.units.filter((x) => x.side !== u.side && x.status === 'active').map(tileOf)
  volley.marked = marked
  volley.at = state.time + TUNING.roundTicks
  cues.push({ kind: 'volleySignal', tiles: marked, at: volley.at })
}

/** Pinning fire: a Muster hit on an arm costs the target hit % until her next turn. */
export function pin(state: BattleState, attackerId: string, targetId: string, part: PartId, cues: Cue[]): void {
  if (!isMuster(state, attackerId) || (part !== 'leftArm' && part !== 'rightArm')) return
  const t = unitById(state, targetId)
  if (t.status !== 'active' || t.pinned) return
  t.pinned = true
  cues.push({ kind: 'pinned', unit: targetId })
}

/** The volley, when its round comes: every standing Muster unit with a Short or Long weapon and a line of fire hits each
 * marked tile once; whoever left the marks dodges it. The hits land (it was signalled), on parts by the band's weights. */
export function fireVolley(state: BattleState, cues: Cue[]): void {
  const volley = state.field?.volley
  if (!volley || volley.at === 0 || state.time < volley.at) return
  const tiles = volley.marked
  cues.push({ kind: 'volley', tiles })
  const board = boardOf(state)
  const shooters = state.units.filter((u) => u.status === 'active' && isMuster(state, u.id))
  tiles.forEach((tile, n) => {
    for (const s of shooters) {
      const sIn = inputOf(state, s.id)
      const weapon = [sIn.loadout.rightHand, sIn.loadout.leftHand].find((w): w is Weapon => w?.kind === 'weapon' && (w.band === 'short' || w.band === 'long'))
      if (!weapon || !lineOfFire(board, tileOf(s), tile)) continue
      const target = state.units.find((u) => u.status === 'active' && u.side !== s.side && u.x === tile[0] && u.y === tile[1])
      if (!target) continue
      const weights = TUNING.partWeights[weapon.band as 'short' | 'long']
      let r = roll(state.input.seed, state.turn, s.id, `volley:${n}`) * 100
      let part: PartId = 'core'
      for (const p of PARTS) {
        if (r < weights[p]) { part = p; break }
        r -= weights[p]
      }
      if (part !== 'core' && target.hp[part] <= 0) part = 'core'
      const amount = Math.max(TUNING.minDamage, weapon.power)
      harm(state, target, part, amount, cues, (broke) => ({ kind: 'burn', unit: target.id, part, amount, by: 'volley', broke }))
    }
  })
  volley.meter = 0
  volley.marked = []
  volley.at = 0
}

/** A unit's own turn starts: her reload and pin wear off. */
export function startOwnTurn(state: BattleState, unitId: string): void {
  const u = unitById(state, unitId)
  delete u.reloading
  delete u.pinned
}

export { unitById }
