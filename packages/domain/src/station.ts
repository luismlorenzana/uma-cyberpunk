import type { Wallet } from './ship/hull'

export const STATION_MODULES = {
  bridge: { label: 'Bridge', deck: 'Command', cost: 0, watches: 0, draw: 0, berths: 0 },
  'jump-ring': { label: 'Jump Ring', deck: 'Command', cost: 80, watches: 6, draw: 2, berths: 0 },
  'secure-ward': { label: 'Secure Ward', deck: 'Command', cost: 24, watches: 3, draw: 0, berths: 0 },
  rehabilitation: { label: 'Rehabilitation Suite', deck: 'Command', cost: 30, watches: 3, draw: 0, berths: 0 },
  quarters: { label: 'Core Quarters', deck: 'Habitation', cost: 0, watches: 0, draw: 0, berths: 20 },
  'habitat-a': { label: 'Habitat A', deck: 'Habitation', cost: 18, watches: 2, draw: 0, berths: 100 },
  'habitat-b': { label: 'Habitat B', deck: 'Habitation', cost: 55, watches: 5, draw: 0, berths: 160 },
  infirmary: { label: 'Infirmary', deck: 'Habitation', cost: 24, watches: 3, draw: 1, berths: 0 },
  reactor: { label: 'Reactor', deck: 'Engineering', cost: 0, watches: 0, draw: 0, berths: 0 },
  'reactor-bank': { label: 'Reactor Bank', deck: 'Engineering', cost: 20, watches: 3, draw: 0, berths: 0 },
  fabrication: { label: 'Fabrication', deck: 'Engineering', cost: 18, watches: 2, draw: 2, berths: 0 },
  'life-support': { label: 'Life Support', deck: 'Engineering', cost: 25, watches: 3, draw: 0, berths: 0 },
  cargo: { label: 'Cargo', deck: 'Flight', cost: 0, watches: 0, draw: 0, berths: 0 },
  cutter: { label: 'Cutter Berth', deck: 'Flight', cost: 0, watches: 0, draw: 0, berths: 0 },
  shipyard: { label: 'Shipyard', deck: 'Flight', cost: 36, watches: 4, draw: 3, berths: 0 },
} as const

export type StationModule = keyof typeof STATION_MODULES
export const STATION_ROOMS = Object.keys(STATION_MODULES) as StationModule[]
export const STATION_DECKS = ['Command', 'Habitation', 'Engineering', 'Flight'] as const
export const STATION_MONTHS = ['Keel', 'Signal', 'Longlight', 'Farwake'] as const
export const STATION_WATCHES = ['Duty', 'Free', 'Night'] as const
export const WATCHES_PER_DAY = STATION_WATCHES.length
export const TEMPORARY_BERTHS = 30
export const STATION_RESERVE_MAX = 99
export const STARTING_STATION_RESERVES = { fuel: 3, provisions: 6 } as const
export const STARTER_CUTTER = { id: 'selden-relief', name: 'Selden Relief' } as const
export const STATION_WORK = ['reactor', 'fabrication', 'life-support', 'infirmary', 'shipyard'] as const
export type StationWork = typeof STATION_WORK[number]
export const SECURE_WARD_BERTHS = 12
export const STATION_DELIVERY_SLOTS = 5
export type StationCustody = { actor: string; berth: number } | { actor: string; port: string }
export interface StationDelivery {
  from: string
  kind: 'fuel' | 'provisions'
  amount: number
  at: number
}

export type StationAppointmentTarget = { actor: number } | { quest: string }
export type StationAppointment = StationAppointmentTarget & { at: number; port?: string }
export interface StationState {
  absoluteWatch: number
  anchor: string
  rooms: Partial<Record<StationModule, number>>
  off: StationModule[]
  shifts: Partial<Record<StationWork, number>>
  report: { at: number; workers: number[]; alloy: number; data: number } | null
  autoStaff?: true
  move?: { to: string; at: number }
  reserves?: { fuel: number; provisions: number }
  integrity?: number
  travellers?: number[]
  lieutenantResidents?: string[]
  preferredCabins?: Record<string, number>
  custody?: StationCustody[]
  deliveries?: StationDelivery[]
  appointments?: StationAppointment[]
  recruit?: string
  sceneRelease?: string
}

export function firstStation(day = 1, anchor = 'selden'): StationState {
  return { absoluteWatch: (day - 1) * WATCHES_PER_DAY, anchor, rooms: {}, off: [], shifts: {}, report: null }
}

export function appointmentFor(state: StationState, target: StationAppointmentTarget) {
  return state.appointments?.find(row => 'actor' in row ? 'actor' in target && row.actor === target.actor
    : 'quest' in target && row.quest === target.quest)
}

export function cancelStationAppointment(state: StationState, target: StationAppointmentTarget): StationState {
  const cancel = appointmentFor(state, target)
  if (!cancel) return state
  return { ...state, appointments: state.appointments!.filter(row => row !== cancel) }
}

export function bookStationAppointment(state: StationState, target: StationAppointmentTarget, port?: string, earliest = state.absoluteWatch): StationState {
  const current = cancelStationAppointment(state, target)
  const appointments = current.appointments ?? []
  if (appointments.length >= 50) return state
  const available = Math.max(state.absoluteWatch, earliest)
  const phase = available % WATCHES_PER_DAY
  let next = available + (WATCHES_PER_DAY + 1 - phase) % WATCHES_PER_DAY
  const reserved = new Set(appointments.map(row => row.at))
  while (reserved.has(next)) next += WATCHES_PER_DAY
  const activity = 'actor' in target ? { actor: target.actor } : { quest: target.quest }
  const appointment = { ...activity, at: next, ...(port === undefined ? {} : { port }) }
  return { ...current, appointments: [...appointments, appointment].sort((a, b) => a.at - b.at) }
}

export function stationDate(absoluteWatch: number) {
  const index = Math.floor(absoluteWatch / WATCHES_PER_DAY)
  return { year: Math.floor(index / 120) + 1, month: STATION_MONTHS[Math.floor(index % 120 / 30)]!,
    day: index % 30 + 1, phase: STATION_WATCHES[absoluteWatch % WATCHES_PER_DAY]! }
}

export function stationRoom(state: StationState, room: StationModule): 'active' | 'off' | 'building' | 'empty' {
  if (STATION_MODULES[room].watches === 0 || state.rooms[room] === 0) return state.off.includes(room) ? 'off' : 'active'
  return state.rooms[room] === undefined ? 'empty' : 'building'
}

export function stationCapacity(state: StationState): number {
  return STATION_ROOMS.reduce((capacity, room) => capacity + (stationRoom(state, room) === 'active' ? STATION_MODULES[room].berths : 0), 0)
}

export function stationPower(state: StationState) {
  const supply = stationRoom(state, 'reactor-bank') === 'active' ? 10 : 4
  const used = STATION_ROOMS.reduce((total, room) => total + (stationRoom(state, room) === 'active' ? STATION_MODULES[room].draw : 0), 0)
  return { supply, used }
}

export function buildStationRoom(state: StationState, wallet: Wallet, room: StationModule) {
  const module = STATION_MODULES[room]
  if (stationRoom(state, room) !== 'empty' || wallet.alloy < module.cost) return null
  if (room === 'habitat-b' && stationRoom(state, 'habitat-a') !== 'active') return null
  if (Object.values(state.rooms).filter(left => left > 0).length >= 2) return null
  return { station: { ...state, rooms: { ...state.rooms, [room]: module.watches } },
    wallet: { ...wallet, alloy: wallet.alloy - module.cost } }
}

export function cancelStationRoom(state: StationState, wallet: Wallet, room: StationModule) {
  if (stationRoom(state, room) !== 'building') return null
  const rooms = { ...state.rooms }
  delete rooms[room]
  return { station: { ...state, rooms }, wallet: { ...wallet, alloy: wallet.alloy + Math.floor(STATION_MODULES[room].cost / 2) } }
}

export function stationPowerShortfall(state: StationState, room: StationModule) {
  const { supply, used } = stationPower(state)
  return Math.max(0, used + STATION_MODULES[room].draw - supply)
}

export function stationPowerDonors(state: StationState, room: StationModule) {
  if (stationRoom(state, room) !== 'off') return []
  const short = stationPowerShortfall(state, room)
  const shedding: StationModule[] = ['fabrication', 'shipyard', 'jump-ring', 'infirmary', 'life-support']
  return short > 0 ? shedding.filter(donor => stationRoom(state, donor) === 'active' && STATION_MODULES[donor].draw >= short
    && (donor !== 'jump-ring' || !state.move)) : []
}

export function rerouteStationPower(state: StationState, room: StationModule, from: StationModule) {
  return stationPowerDonors(state, room).includes(from) ? setStationPower(setStationPower(state, from), room) : state
}

export function setStationPower(state: StationState, room: StationModule) {
  if (!STATION_MODULES[room].draw || room === 'jump-ring' && state.move) return state
  const mode = stationRoom(state, room)
  if (mode === 'active') return { ...state, off: [...state.off, room] }
  if (mode !== 'off' || stationPowerShortfall(state, room)) return state
  return { ...state, off: state.off.filter(key => key !== room) }
}

export function assignStationShift(state: StationState, room: StationWork, actor: number | null) {
  if (stationRoom(state, room) !== 'active') return state
  const shifts = { ...state.shifts }
  for (const key of STATION_WORK) if (shifts[key] === actor || key === room) delete shifts[key]
  if (actor !== null) shifts[room] = actor
  return { ...state, shifts }
}

export function tickStation(state: StationState, present: ReadonlySet<number>) {
  const next = { ...state, absoluteWatch: state.absoluteWatch + 1, rooms: { ...state.rooms }, off: [...state.off] }
  if (next.move?.at === next.absoluteWatch) {
    next.anchor = next.move.to
    delete next.move
  }
  for (const room of STATION_ROOMS) {
    const left = next.rooms[room]
    if (!left) continue
    if (left === 1) {
      const power = stationPower(next)
      if (power.used + STATION_MODULES[room].draw > power.supply) next.off.push(room)
    }
    next.rooms[room] = left - 1
  }
  if (next.deliveries?.length) {
    const reserves = { ...next.reserves ?? STARTING_STATION_RESERVES }
    next.deliveries = next.deliveries.flatMap(order => {
      const due = Math.max(order.at, next.move?.at ?? 0)
      if (due > next.absoluteWatch) return [due === order.at ? order : { ...order, at: due }]
      const unloaded = Math.min(order.amount, STATION_RESERVE_MAX - reserves[order.kind])
      reserves[order.kind] += unloaded
      return unloaded === order.amount ? [] : [{ ...order, amount: order.amount - unloaded }]
    })
    next.reserves = reserves
  }
  if (state.absoluteWatch % WATCHES_PER_DAY !== 0) return { station: next, alloy: 0, data: 0 }
  const reserved = new Set(STATION_WORK.flatMap(room => {
    const assigned = state.shifts[room]
    return assigned !== undefined && stationRoom(state, room) === 'active' && present.has(assigned) ? [assigned] : []
  }))
  const available = [...present].filter(actor => !reserved.has(actor))
  const jobs = STATION_WORK.flatMap(room => {
    if (stationRoom(state, room) !== 'active') return []
    const preferred = state.shifts[room]
    const actor = preferred !== undefined && present.has(preferred) ? preferred : state.autoStaff ? available.shift() : undefined
    return actor === undefined ? [] : [{ room, actor }]
  })
  const alloy = jobs.filter(job => job.room === 'reactor' || job.room === 'fabrication' || job.room === 'shipyard').length
  const data = jobs.filter(job => job.room === 'reactor' || job.room === 'infirmary').length
  next.report = { at: state.absoluteWatch, workers: jobs.map(job => job.actor), alloy, data }
  if (jobs.some(job => job.room === 'life-support')) {
    const reserves = next.reserves ?? STARTING_STATION_RESERVES
    next.reserves = { ...reserves, provisions: Math.min(STATION_RESERVE_MAX, reserves.provisions + 2) }
  }
  return { station: next, alloy, data, infirmary: jobs.some(job => job.room === 'infirmary') }
}
