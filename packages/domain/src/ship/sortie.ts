// A sortie's ship (CY17, TC59, TC64): the captain's Orders the battle offers and the powered systems with their levels
// and their post holders' bands, for rules version 3's input. Pure: the deploy screen builds the battle from these.
import type { Band, OrderKind, SystemInput, SystemKind } from '@cyber/battle'
import type { PostKind } from './duties'
import { moduleLevel, type Ship } from './hull'

/** Each system's post, whose holder's band sets its strength. */
export const SYSTEM_POST: Record<SystemKind, PostKind> = { battery: 'gunner', sensors: 'navigator', shield: 'engineer', drones: 'mechanic', engines: 'pilot' }
const ORDER_OF: Partial<Record<SystemKind, OrderKind>> = { battery: 'strike', sensors: 'sweep', shield: 'barrier', drones: 'drone' }

/** The Orders this sortie (TC59): 2 slots at Bridge level 1, 3 at 2, 4 at 3 (+1 with Ship Uplink, to 4); Sure shot and
 * Call her name always; Hold the line from Bridge 2; Reboot from Med Bay 2 or with Field Repairs; each powered system's
 * support; a reinforcement from Hangar 3 when someone rests. */
export function sortieOrders(ship: Ship, bench: boolean): { slots: number; kinds: OrderKind[] } {
  const bridge = moduleLevel(ship, 'bridge'), done = ship.research.done
  const slots = Math.min(4, (bridge >= 3 ? 4 : bridge >= 2 ? 3 : 2) + (done.includes('tactics-3') ? 1 : 0))
  const kinds: OrderKind[] = ['sure', 'resonance']
  if (bridge >= 2) kinds.push('hold')
  if (moduleLevel(ship, 'medbay') >= 2 || done.includes('tactics-2')) kinds.push('reboot')
  for (const s of ship.powered) { const o = ORDER_OF[s]; if (o && moduleLevel(ship, s) >= 1) kinds.push(o) }
  if (moduleLevel(ship, 'hangar') >= 3 && bench) kinds.push('reinforce')
  return { slots, kinds }
}

/** The powered systems as the battle reads them: level and the band of whoever holds the system's post (3 if no one). */
export function sortieSystems(ship: Ship, bandAt: (post: PostKind) => Band | null): SystemInput[] {
  return ship.powered.filter((s) => moduleLevel(ship, s) >= 1).map((id) => ({ id, level: moduleLevel(ship, id), band: bandAt(SYSTEM_POST[id]) ?? 3 }))
}
