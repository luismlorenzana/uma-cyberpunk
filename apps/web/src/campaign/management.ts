import {
  awayMembers, campaignSupport, developedPort, formerDisposition, managementReportKey, moduleAt, MODULES_BY_ID, pairProgress,
  sectorAppointed, shipmentAt, startSupply, storesAt, walkSteps,
  type CampaignBook, type LocationProp, type LocationState, type ManagementLocation, type ManagementReceipt, type Save,
} from '@cyber/domain'
import { questComplete } from './quests'
import { workshopAt } from './workshop'

export function managementAt(save: Save, book: CampaignBook) {
  const gate = book.management && book.quests.find(({ id }) => id === book.management!.after)
  if (!gate || !questComplete(save, gate, book) || !book.supply || save.mission || save.pairScene || save.campaignDay.pending) return null
  const supply = save.campaignSupply ?? startSupply(book.supply)
  const port = book.supply.ports.find(({ id }) => id === supply.port)
  return port ? { supply, port: developedPort(book, save, port) } : null
}

export function locationAvailable(save: Save, book: CampaignBook, location: ManagementLocation): boolean {
  const at = managementAt(save, book)
  if (!at) return false
  const entry = location.entry
  const sectors = book.sectors?.filter(({ port }) => port === at.port.id) ?? []
  if (entry.kind === 'module') return !!moduleAt(save.ship, entry.module)
  if (entry.kind === 'quest') {
    const quest = book.quests.find(({ id }) => id === entry.quest)
    return !!quest && questComplete(save, quest, book)
  }
  if (entry.kind === 'workshop') return !!workshopAt(save, book)
  if (entry.kind === 'command') return sectors.some(sector => sectorAppointed(book, save.story, sector))
  if (entry.kind === 'project') {
    const project = book.projects?.find(({ id }) => id === entry.project)
    return !!project && sectors.some(sector => sector.id === project.sector && sectorAppointed(book, save.story, sector))
  }
  if (entry.kind === 'custody') return sectors.some(sector => ['In local custody', 'Awaiting review'].includes(formerDisposition(book, save.story, sector) ?? ''))
    || book.pairs.some(pair => pair.home?.port === at.port.id && save.story.flags.includes(pair.capture) && !pairProgress(pair, save.story).released)
  if (entry.kind === 'shared') return (book.sectors ?? []).some(sector => !!sector.shared && !!sector.former && save.story.seen.includes(sector.shared.visit)
    && save.story.flags.includes(sector.former.aboard) && save.crew.some(member => member.outfit === sector.officer)
    && !campaignSupport(book, save).ashore.has(sector.officer) && !awayMembers(save.operations, save.squads).includes(sector.officer)) || book.pairs.some(pair => pairProgress(pair, save.story).residency === 'shared'
    && pair.members.every(({ outfit }) => save.crew.some(member => member.outfit === outfit) && !campaignSupport(book, save).ashore.has(outfit) && !awayMembers(save.operations, save.squads).includes(outfit)))
  return true
}

export function locationState(save: Save, book: CampaignBook, location: ManagementLocation): LocationState {
  const entry = location.entry, at = managementAt(save, book)
  if (entry.kind === 'project') {
    const left = save.campaignProjects[entry.project]
    return left === undefined ? 'unfunded' : left === 0 ? 'complete' : 'building'
  }
  if (entry.kind === 'module') {
    const module = moduleAt(save.ship, entry.module)
    if (module?.building || (entry.module === 'engineering' && save.ship.modules.some(module => module.building))) return 'building'
    if (save.ship.powered.some(id => id === entry.module)) return 'powered'
    return module?.level ? 'complete' : 'ready'
  }
  if (entry.kind === 'workshop') {
    if (fittedMembers(save, book).length) return 'fitted'
    return save.campaignGear.alloy > 0 ? 'stocked' : 'ready'
  }
  if (location.family === 'planet' && at?.port.liberation) return save.story.flags.includes(at.port.liberation.flag) ? 'restored' : 'occupied'
  if (visibleLocationProps(save, book, location).length && location.family === 'operations') return 'stocked'
  return 'ready'
}

export function fittedMembers(save: Save, book: CampaignBook) {
  const ashore = campaignSupport(book, save).ashore, away = awayMembers(save.operations, save.squads)
  return save.crew.filter(member => !ashore.has(member.outfit) && !away.includes(member.outfit)
    && member.rig && Object.values(member.rig).some(part => part && save.campaignGear.parts.includes(part)))
}

export function visibleLocationProps(save: Save, book: CampaignBook, location: ManagementLocation): LocationProp[] {
  const at = managementAt(save, book)
  if (!at || !locationAvailable(save, book, location)) return []
  return (location.props ?? (location.prop ? [location.prop] : [])).filter(prop => {
    const kind = prop.resource ?? 'alloy'
    return prop.when === 'hangar-alloy' ? save.campaignGear.alloy > 0
      : prop.when === 'ship-alloy' || (prop.when === 'ship-stock' && kind === 'alloy') ? save.wallet.alloy > 0
      : prop.when === 'ship-stock' ? at.supply[kind as 'fuel' | 'provisions'] > 0
      : shipmentAt(at.supply, at.port, kind) > 0
  })
}
export function locationPropVisible(save: Save, book: CampaignBook, location: ManagementLocation): boolean {
  return visibleLocationProps(save, book, location).length > 0
}

function scenePresent(save: Save, book: CampaignBook, scene: string, event?: ManagementReceipt): boolean {
  const definition = book.scenes.get(scene)
  if (!definition) return false
  const ashore = campaignSupport(book, save).ashore, away = awayMembers(save.operations, save.squads)
  return [...walkSteps(definition.steps, '')].every(({ step }) => {
    const speaker = 'speaker' in step ? step.speaker : 'actor' in step ? step.actor : undefined
    return typeof speaker !== 'number' || (save.crew.some(({ outfit }) => outfit === speaker) && !ashore.has(speaker) && !away.includes(speaker)
      && (!event?.officer || event.officer === speaker))
  })
}

function receiptStillTrue(save: Save, event: ManagementReceipt): boolean {
  if (event.kind === 'project-start') return (save.campaignProjects[event.subject] ?? 0) > 0
  if (event.kind === 'project-complete') return save.campaignProjects[event.subject] === 0
  if (event.kind === 'refit-start' || event.kind === 'refit-complete') {
    const module = save.ship.modules.find(({ id }) => id === event.subject)
    return event.kind === 'refit-start' ? !!module?.building : !!module && !module.building && module.level >= event.amount
  }
  if (event.kind === 'fitted') return !!save.crew.find(({ outfit }) => outfit === event.officer)?.rig
    && Object.values(save.crew.find(({ outfit }) => outfit === event.officer)!.rig!).includes(event.subject)
  return true // A dated receipt records a completed transfer, not a claim that its material remains unspent.
}

export function managementReports(save: Save, book: CampaignBook, location: ManagementLocation) {
  if (!locationAvailable(save, book, location)) return []
  const seen = new Set<string>()
  return save.management.receipts.flatMap(event => {
    const key = managementReportKey(event)
    const binding = book.management?.reports.find(report => report.location === location.id && report.kind === event.kind
      && (!report.subject || report.subject === event.subject) && (!report.destination || report.destination === event.destination))
    if (!binding || seen.has(key) || save.management.acknowledged.includes(key) || !receiptStillTrue(save, event)
      || (event.destination === 'port' && event.port !== save.campaignSupply?.port)) return []
    seen.add(key)
    const scene = scenePresent(save, book, binding.scene, event) ? binding.scene : binding.fallback
    return scenePresent(save, book, scene, event) ? [{ event, key, scene }] : []
  })
}

export function acknowledgeManagement(save: Save, key: string): Save {
  if (save.management.acknowledged.includes(key) || save.management.acknowledged.length >= 2048) return save
  return { ...save, management: { ...save.management, acknowledged: [...save.management.acknowledged, key] } }
}

export function locationLedger(save: Save, book: CampaignBook, location: ManagementLocation): string[] {
  const at = managementAt(save, book)
  if (!at) return []
  const entry = location.entry
  if (entry.kind === 'project') {
    const project = book.projects!.find(({ id }) => id === entry.project)!, left = save.campaignProjects[entry.project]
    return [left === undefined ? `Funding needed: ${project.alloy} Alloy · ${project.days} nights` : left ? `Work in progress · ${left} nights left` : 'Operating · civilian service',
      ...(['fuel', 'provisions', 'alloy'] as const).filter(kind => project.production[kind] || project.upkeep[kind])
        .map(kind => `${kind}: +${project.production[kind]} production · ${project.upkeep[kind]} upkeep each night`)]
  }
  if (entry.kind === 'module') {
    const module = moduleAt(save.ship, entry.module)!
    return [`Installed level ${module.level}${module.building ? ` · level ${module.building.level} in ${module.building.left} nights` : ''}`,
      ...(entry.module === 'engineering' ? save.ship.modules.filter(row => row.id !== 'engineering' && (row.id === 'engines' || row.building)).map(row => `${MODULES_BY_ID.get(row.id)!.name} · level ${row.level}${row.building ? ` · level ${row.building.level} in ${row.building.left} nights` : ''}`) : []),
      `Ship Alloy ${save.wallet.alloy} · ${save.wallet.credits} cr · ${save.wallet.data} Data`]
  }
  if (entry.kind === 'workshop') return [`Hangar Alloy ${save.campaignGear.alloy} · ${save.campaignGear.parts.length} owned ${save.campaignGear.parts.length === 1 ? 'part' : 'parts'}`,
    `${fittedMembers(save, book).length} crew with fitted campaign gear aboard`]
  const stock = storesAt(at.supply, at.port)
  return [`${at.port.name} · ${at.port.liberation && !save.story.flags.includes(at.port.liberation.flag) ? 'Occupied' : 'Local services'}`,
    ...(['fuel', 'provisions', 'alloy'] as const).map(kind => `${kind}: stock ${stock[kind]} · reserve ${at.port.reserve[kind]} · upkeep ${at.port.upkeep[kind]} · export ${shipmentAt(at.supply, at.port, kind)}`)]
}

export function locationContext(save: Save, book: CampaignBook, location: ManagementLocation): string {
  const context = location.contexts?.find(context => context.state === locationState(save, book, location))
  return context ? scenePresent(save, book, context.scene) ? context.scene : context.fallback : location.scene
}
