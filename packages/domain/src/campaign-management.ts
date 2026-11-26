import type { ModuleId } from './ship/modules'
import type { CampaignBook } from './story/campaign'
import type { Save } from './save/save'

export const MANAGEMENT_EVENTS = ['shipment', 'relief', 'project-start', 'project-complete', 'refit-start', 'refit-complete', 'crafted', 'fitted'] as const
export type ManagementEvent = typeof MANAGEMENT_EVENTS[number]
export interface ManagementReceipt {
  sequence: number
  day: number
  kind: ManagementEvent
  subject: string
  port: string | null
  destination: 'ship' | 'hangar' | 'port' | 'station'
  amount: number
  officer?: number
}
export interface CampaignManagementState {
  sequence: number
  receipts: ManagementReceipt[]
  acknowledged: string[]
}
export type ManagementEntry = { kind: 'module'; module: ModuleId } | { kind: 'quest'; quest: string }
  | { kind: 'project'; project: string } | { kind: 'workshop' | 'port' | 'command' | 'custody' | 'shared' }
export const LOCATION_STATES = ['ready', 'unfunded', 'building', 'complete', 'stocked', 'fitted', 'occupied', 'restored', 'powered'] as const
export type LocationState = typeof LOCATION_STATES[number]
/** An absent state export deliberately uses its named fallback, rather than masquerading as final art. */
export interface LocationVisual { slot: string; asset?: string; fallback: string }
export interface LocationProp {
  asset: string; when: 'hangar-alloy' | 'ship-alloy' | 'port-surplus' | 'ship-stock'
  resource?: 'fuel' | 'provisions' | 'alloy'
  x: number; y: number; width: number; height: number
}
export interface ManagementLocation {
  id: string
  title: string
  family: 'command' | 'living' | 'social' | 'care' | 'operations' | 'planet'
  entry: ManagementEntry
  scene: string
  visual: LocationVisual
  states: Partial<Record<LocationState, LocationVisual>>
  contexts?: { state: LocationState; scene: string; fallback: string }[]
  prop?: LocationProp
  props?: LocationProp[]
}
export interface CampaignManagement {
  after: string
  locations: ManagementLocation[]
  reports: { kind: ManagementEvent; subject?: string; destination?: ManagementReceipt['destination']; location: string; scene: string; fallback: string }[]
}

export const managementReportKey = (event: ManagementReceipt): string =>
  `${event.kind}:${event.destination}:${event.subject}${event.officer ? `:${event.officer}` : ''}`

export function managementReceipt(save: Save, event: Omit<ManagementReceipt, 'sequence' | 'day' | 'port'> & { port?: string | null }): Save {
  const state = save.management
  if (state.sequence >= Number.MAX_SAFE_INTEGER) return save
  const receipt = { ...event, sequence: state.sequence + 1, day: save.campaignDay.day, port: event.port === undefined ? save.campaignSupply?.port ?? null : event.port }
  return { ...save, management: { ...state, sequence: receipt.sequence, receipts: [...state.receipts.slice(-31), receipt] } }
}

/** Observe real commits only. In particular, build reservations and completed builds are distinct events. */
export function observeManagement(before: Save, after: Save, book?: Pick<CampaignBook, 'projects' | 'sectors'>): Save {
  if (before === after || before.management !== after.management) return after
  let next = after
  const add = (kind: ManagementEvent, subject: string, destination: ManagementReceipt['destination'], amount = 1, officer?: number, port?: string) => {
    next = managementReceipt(next, { kind, subject, destination, amount, ...(officer ? { officer } : {}), ...(port ? { port } : {}) })
  }
  for (const [id, left] of Object.entries(after.campaignProjects)) {
    const old = before.campaignProjects[id]
    if (old === undefined && left > 0) add('project-start', id, 'port')
    else if (old !== undefined && old > 0 && left === 0) add('project-complete', id, 'port', 1, undefined, book?.sectors?.find(sector => sector.id === book.projects?.find(project => project.id === id)?.sector)?.port)
  }
  for (const module of after.ship.modules) {
    const old = before.ship.modules.find(({ id }) => id === module.id)
    if (module.building && !old?.building) add('refit-start', module.id, 'ship', module.building.level)
    else if (old?.building && !module.building && module.level > old.level) add('refit-complete', module.id, 'ship', module.level)
  }
  const received = after.campaignGear.alloy - before.campaignGear.alloy
  if (received > 0) add('shipment', 'alloy', 'hangar', received)
  for (const part of after.campaignGear.parts) if (!before.campaignGear.parts.includes(part)) add('crafted', part, 'hangar')
  for (const member of after.crew) {
    const old = before.crew.find(({ outfit }) => outfit === member.outfit)
    if (!old || !member.rig) continue
    for (const part of new Set(Object.values(member.rig))) {
      if (part && after.campaignGear.parts.includes(part) && !Object.values(old.rig ?? {}).includes(part)) add('fitted', part, 'hangar', 1, member.outfit)
    }
  }
  return next
}
