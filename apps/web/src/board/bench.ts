// The board's test bench (CY7): a battle on a test map with thirteen stand-ins (four Umas as sprites, a guest and eight
// enemies as standees), and the reach overlays worked out by the battle rules themselves (TC29's colours).
import { createBattle, inReach, reachable, boardOf, type BattleInput, type BattleMap, type BattleState, type Loadout, type UnitInput, type Weapon } from '@cyber/battle'
import type { OverlayKind, Tile } from './scene'

const rifle: Weapon = { kind: 'weapon', band: 'short', type: 'P', power: 6, accuracy: 75, range: [1, 3], hits: 3, load: 3 }
const blade: Weapon = { kind: 'weapon', band: 'melee', type: 'P', power: 12, accuracy: 85, range: [1, 1], hits: 1, load: 2 }
const rig = (hand: Weapon): Loadout => ({
  core: { load: 3 }, leftArm: { load: 2 }, rightArm: { load: 2 }, legs: { load: 2 }, back: { kind: 'none', load: 0 }, visor: { load: 1 },
  leftHand: null, rightHand: hand, coat: null,
})
const unit = (id: string, side: 'squad' | 'enemy', spawn: number, hand: Weapon, label: string): UnitInput => ({
  id, side, spawn, bands: { speed: 3, stamina: 3, power: 3, guts: 3, wit: 3 }, chargeCap: 3, link: true, facing: side === 'squad' ? 'N' : 'S',
  loadout: rig(hand), ref: { kind: 'standin', id }, label,
})

export const SQUAD_HUE = '#2ee6ff'
export const GUEST_HUE = '#7ef0b0'
export const ENEMY_HUE = '#ff3d6e'

/** Thirteen stand-ins on a map: four Umas (sprites), a guest and eight enemies (standees). */
export function benchInput(map: BattleMap): BattleInput {
  const squad = ['Vanguard A', 'Striker A', 'Gunner A', 'Medic A'].map((label, i) => unit(`uma-${i + 1}`, 'squad', i, i === 1 ? blade : rifle, label))
  const guest = unit('guest-1', 'squad', 4, blade, 'Guest A')
  const enemies = Array.from({ length: 8 }, (_, i) => unit(`enemy-${i + 1}`, 'enemy', i, i % 2 ? blade : rifle, `Trooper ${i + 1}`))
  return { rulesVersion: 2, seed: 'board', map, objective: { kind: 'defeatAll' }, units: [...squad, guest, ...enemies] }
}

export const benchBattle = (map: BattleMap): BattleState => createBattle(benchInput(map))

/** A unit's reach as overlays: blue where she's safe, magenta inside an enemy's reach, red what she could then strike. */
export function reachOverlay(state: BattleState, unitId: string): { tile: Tile; kind: OverlayKind }[] {
  const me = state.units.find((u) => u.id === unitId)
  if (!me) return []
  const board = boardOf(state)
  const foes = state.units.filter((u) => u.side !== me.side && u.status === 'active')
  // Enemy reach: every tile a foe could strike next turn (her moves, then her weapon's reach).
  const danger = new Set<string>()
  for (const f of foes) {
    const weapon = state.input.units.find((i) => i.id === f.id)!.loadout.rightHand as Weapon
    for (const r of reachable(state, f.id)) {
      for (let z = 0; z < state.input.map.depth; z++) for (let x = 0; x < state.input.map.width; x++) {
        if (inReach(board, weapon, r.to, [x, z])) danger.add(`${x},${z}`)
      }
    }
  }
  const out: { tile: Tile; kind: OverlayKind }[] = []
  const moves = reachable(state, unitId)
  for (const r of moves) out.push({ tile: r.to, kind: danger.has(`${r.to[0]},${r.to[1]}`) ? 'danger' : 'reach' })
  const weapon = state.input.units.find((i) => i.id === unitId)!.loadout.rightHand as Weapon
  const strike = new Set<string>()
  for (const r of moves) for (const f of foes) if (inReach(board, weapon, r.to, [f.x, f.y])) strike.add(`${f.x},${f.y}`)
  for (const k of strike) { const [x, z] = k.split(',').map(Number) as [number, number]; out.push({ tile: [x, z], kind: 'attack' }) }
  return out
}
