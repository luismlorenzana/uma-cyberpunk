// The ship's rooms (CY10, TC9, TC49): the game's list and order. Four are open from the start; three open when the lead
// whose casting names them comes aboard. Which lead opens which is story data (`casting.json`'s `opens`).
import type { Casting } from '../story/types'
import { MODULE_IDS, type ModuleId } from './modules'

export type RoomId = 'bridge' | 'hangar' | 'quarters' | 'log' | 'store' | 'comms' | 'simpod'
export interface Room { id: RoomId; name: string; fromStart: boolean }

export const ROOMS: readonly Room[] = [
  { id: 'bridge', name: 'Bridge', fromStart: true },
  { id: 'hangar', name: 'Hangar', fromStart: true },
  { id: 'quarters', name: 'Quarters', fromStart: true },
  { id: 'log', name: 'Log', fromStart: true },
  { id: 'store', name: 'Store', fromStart: false },
  { id: 'comms', name: 'Comms', fromStart: false },
  { id: 'simpod', name: 'Sim Pod', fromStart: false },
]
export const ROOM_IDS: readonly RoomId[] = ROOMS.map((r) => r.id)
export const OPEN_FROM_START: readonly RoomId[] = ROOMS.filter((r) => r.fromStart).map((r) => r.id)

/** The lead whose coming aboard opens a room, or null when no lead in the casting names it. */
export const keyOfRoom = (casting: Pick<Casting, 'leads'>, room: RoomId): number | null => casting.leads.find((l) => l.opens === room)?.outfit ?? null

/** A room as the ship shows it: open, or locked with its key in words. */
export function roomView(casting: Pick<Casting, 'leads'>, open: readonly RoomId[], room: Room, nameOf: (outfit: number) => string): { room: Room; open: boolean; key: string | null } {
  if (open.includes(room.id)) return { room, open: true, key: null }
  const lead = keyOfRoom(casting, room.id)
  return { room, open: false, key: lead === null ? 'Opens later in the story' : `Opens when ${nameOf(lead)} comes aboard` }
}

/** The rooms a lead's coming aboard opens. */
export const roomsOpenedBy = (casting: Pick<Casting, 'leads'>, outfit: number): RoomId[] =>
  casting.leads.filter((l) => l.outfit === outfit && l.opens && ROOM_IDS.includes(l.opens as RoomId)).map((l) => l.opens as RoomId)

/** The modules a lead's coming aboard opens (CY15: `opens` may name any module). */
export const modulesOpenedBy = (casting: Pick<Casting, 'leads'>, outfit: number): ModuleId[] =>
  casting.leads.filter((l) => l.outfit === outfit && l.opens && MODULE_IDS.includes(l.opens as ModuleId)).map((l) => l.opens as ModuleId)
