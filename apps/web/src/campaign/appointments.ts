import { appointmentFor, awayMembers, bookStationAppointment, WATCHES_PER_DAY, stationDate, type CampaignBook, type Save,
  type StationAppointment, type StationAppointmentTarget } from '@cyber/domain'
import { nameOf } from '../story/runner'
import { dateAvailable, dateEligible, dateMeetingPort } from './dates'
import { questAvailable, questComplete } from './quests'
import { stationCustody } from './station-custody'
import { stationOf } from './watch'

function careLead(book: CampaignBook, quest: string) {
  const owner = book.fourAct?.personalQuestOwners.get(quest)
  return owner !== undefined && book.fourAct?.arcs.get(owner)?.rehabilitation?.sessions.includes(quest) ? owner : undefined
}

export function isCareSession(book: CampaignBook, quest: string) {
  return careLead(book, quest) !== undefined
}

export function careLeadAway(save: Save, book: CampaignBook, quest: string) {
  const owner = careLead(book, quest)
  return owner !== undefined && (awayMembers(save.operations, save.squads).includes(owner) || !!save.expedition)
}

export function carePort(book: CampaignBook, save: Save, quest: string) {
  const authored = book.quests.find(row => row.id === quest)?.port
  const owner = careLead(book, quest)
  if (authored || owner === undefined) return authored
  const general = book.fourAct?.arcs.get(owner)?.general
  const place = stationCustody(save, book).find(row => row.actor === general)
  return place && 'port' in place ? place.port : undefined
}

function actorReturns(save: Save, now: number, actor: number | undefined) {
  if (actor === undefined) return now
  const squads = new Set(save.squads.filter(row => row.members.includes(actor)).map(row => row.id))
  const delay = save.operations.reduce((later, run) => squads.has(run.squad) ? Math.max(later, run.back - save.watch) : later, 0)
  return delay ? (Math.floor(now / WATCHES_PER_DAY) + delay) * WATCHES_PER_DAY : now
}

export function appointmentVenue(book: CampaignBook, save: Save, row: StationAppointment, watch = row.at) {
  const station = stationOf(save, book)
  const anchor = station.move && station.move.at <= watch ? station.move.to : station.anchor
  if (row.port) return row.port
  return ('quest' in row ? carePort(book, save, row.quest) : undefined) ?? anchor
}

export function appointmentTitle(book: CampaignBook, save: Save, row: StationAppointment) {
  if ('quest' in row) return book.quests.find(quest => quest.id === row.quest)?.title ?? 'Rehabilitation'
  const companion = save.crew.find(member => member.outfit === row.actor)
  return nameOf(book.story, companion?.heroine ?? row.actor)
}

export function reserveAppointment(save: Save, book: CampaignBook, target: StationAppointmentTarget): Save {
  if (save.campaignDay.pending || save.pairScene || save.mission || save.expedition) return save
  let venue: string | undefined
  let participant: number | undefined
  if ('actor' in target) {
    const date = book.dates?.find(row => row.companion === target.actor)
    if (!date || !dateEligible(save, book, date)) return save
    participant = date.companion
    venue = dateMeetingPort(save, book, date)
  } else {
    const quest = book.quests.find(row => row.id === target.quest)
    if (!quest || !isCareSession(book, target.quest) || questComplete(save, quest, book)
      || !questAvailable(save, book, quest, quest.port ?? stationOf(save, book).anchor)) return save
    participant = careLead(book, target.quest)
    venue = quest.port
  }
  const station = stationOf(save, book)
  const previous = appointmentFor(station, target)
  const earliest = Math.max(actorReturns(save, station.absoluteWatch, participant), previous ? previous.at + 1 : 0)
  const next = bookStationAppointment(station, target, venue, earliest)
  return next === station ? save : { ...save, station: next }
}

export function appointmentStatus(book: CampaignBook, save: Save, row: StationAppointment) {
  const station = stationOf(save, book)
  const venue = appointmentVenue(book, save, row, station.absoluteWatch)
  const port = save.campaignSupply?.port ?? book.supply?.start
  const quest = 'quest' in row ? book.quests.find(quest => quest.id === row.quest) : undefined
  const date = 'actor' in row ? book.dates?.find(date => date.companion === row.actor) : undefined
  if (quest && questComplete(save, quest, book)) return { venue, state: 'completed' as const }
  if (row.at > station.absoluteWatch) return { venue, state: 'future' as const }
  if (row.at < station.absoluteWatch) return { venue, state: 'missed' as const }
  if (port !== venue) return { venue, state: 'travel' as const }
  const ready = date ? dateAvailable(save, book, date)
    : quest && !careLeadAway(save, book, quest.id) && questAvailable(save, book, quest, port)
  return { venue, state: ready ? 'ready' as const : 'unavailable' as const }
}

export function travelAppointmentConflicts(book: CampaignBook, save: Save, destination: string, arrival: number) {
  const station = stationOf(save, book)
  if (arrival <= station.absoluteWatch) return []
  return (station.appointments ?? []).filter(row => row.at >= station.absoluteWatch && row.at <= arrival
    && (row.at < arrival || appointmentVenue(book, save, row) !== destination))
}

export function watchLabel(watch: number) {
  const date = stationDate(watch)
  return `${date.month} ${date.day} · ${date.phase}`
}
