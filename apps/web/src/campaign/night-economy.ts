import { campaignSpeaker, NIGHT_VISIT_LIMIT, stationDate, WATCHES_PER_DAY,
  type CabinEvening, type CampaignBook, type CampaignNight, type CampaignVisit, type Save, type Speaker } from '@cyber/domain'
import { advanceStationWatches, settleCampaignDay, stationOf, voyageCrew } from './watch'

export function nightVisitsLeft(save: Save) {
  const ledger = save.station?.night
  return ledger?.day === save.campaignDay.day ? NIGHT_VISIT_LIMIT - ledger.used : NIGHT_VISIT_LIMIT
}

export function nightActive(save: Save) {
  return save.station?.night?.day === save.campaignDay.day && (save.station.night.used > 0 || save.station.night.mornings.length > 0)
}

export function contactDay(save: Save, actor: Speaker) {
  const history = save.station?.lastContact
  return history && Object.hasOwn(history, actor) ? history[actor] ?? 0 : 0
}

export function canBookNightContact(save: Save, book: CampaignBook, actors: readonly Speaker[]) {
  return !book.stationStory || nightVisitsLeft(save) > 0
    && actors.every(actor => contactDay(save, actor) !== save.campaignDay.day)
}

export function watchesUntilNight(save: Save, book: CampaignBook) {
  return WATCHES_PER_DAY - 1 - stationOf(save, book).absoluteWatch % WATCHES_PER_DAY
}

export function enterNight(save: Save, book: CampaignBook): Save {
  return book.stationStory ? advanceStationWatches(save, book, watchesUntilNight(save, book)) : save
}

export function spendNightContact(save: Save, book: CampaignBook, actors: readonly Speaker[]): Save {
  if (!book.stationStory) return save
  if (!actors.length || !canBookNightContact(save, book, actors)) return save
  const entered = enterNight(save, book)
  const station = stationOf(entered, book)
  const previous = station.night?.day === entered.campaignDay.day ? station.night : undefined
  return { ...entered, station: { ...station, night: {
    day: entered.campaignDay.day, used: (previous?.used ?? 0) + 1, mornings: previous?.mornings ?? [],
  } } }
}

export function reserveOvernight(save: Save): Save {
  const station = save.station
  if (!station?.night || station.night.day !== save.campaignDay.day) return save
  return { ...save, station: { ...station, night: { ...station.night, used: NIGHT_VISIT_LIMIT } } }
}

export function closeNight(save: Save, book: CampaignBook): Save {
  const station = stationOf(save, book)
  const [morning = null, ...mornings] = station.night?.mornings ?? []
  const { night, ...rest } = station
  const next = book.stationStory ? { ...save, station: mornings.length && night ? { ...rest, night: { ...night, mornings } } : rest } : save
  return settleCampaignDay(next, { day: save.campaignDay.day + 1, pending: morning }, book)
}

export function nextQueuedMorning(save: Save): Save {
  if (!save.station?.night) return { ...save, campaignDay: { ...save.campaignDay, pending: null } }
  const { night, ...station } = save.station
  const [pending = null, ...mornings] = night.mornings
  return { ...save, campaignDay: { ...save.campaignDay, pending },
    station: mornings.length ? { ...station, night: { ...night, mornings } } : station }
}

export function finishNightContact(save: Save, book: CampaignBook, actors: readonly Speaker[], morning: CampaignNight | null): Save {
  const station = save.station
  const night = station?.night
  if (!book.stationStory || !station || !night || night.day !== save.campaignDay.day) {
    return settleCampaignDay(save, { day: save.campaignDay.day + 1, pending: morning }, book)
  }
  const lastContact = { ...station.lastContact }
  for (const actor of actors) lastContact[String(actor)] = night.day
  const next: Save = { ...save, campaignDay: { ...save.campaignDay, pending: null },
    station: { ...station, lastContact, night: { ...night, mornings: morning ? [...night.mornings, morning] : night.mornings } } }
  return nightVisitsLeft(next) ? next : closeNight(next, book)
}

export function cabinVisitors(book: CampaignBook, cabin: CabinEvening): Speaker[] {
  const source = cabin.source
  if ('companion' in source) return [campaignSpeaker(book.allies, source.companion)]
  if ('trio' in source) {
    const ally = book.allies?.find(row => row.heroine === source.trio)
    return ally ? [ally.partner, ally.heroine] : []
  }
  if ('pair' in source) return book.pairs.find(row => row.id === source.pair)?.members.map(row => row.outfit) ?? []
  const sector = book.sectors?.find(row => row.id === source.sector)
  return sector ? [sector.officer, ...(sector.former ? [sector.former.speaker] : [])] : []
}

export function visitActors(book: CampaignBook, visit: CampaignVisit, sectorActors?: readonly Speaker[]): readonly Speaker[] {
  if ('companion' in visit) return [campaignSpeaker(book.allies, visit.companion)]
  return sectorActors ?? book.pairs.find(row => row.id === visit.pair)?.members.map(row => row.outfit) ?? []
}

export function checkInWithLieutenant(save: Save, book: CampaignBook, actor: string): Save {
  if (!book.stationStory || save.mission || save.expedition || save.pairScene || save.campaignDay.pending
    || !save.station?.lieutenantResidents?.includes(actor) || voyageCrew(save).has(actor)
    || save.campaignSupply?.port !== stationOf(save, book).anchor
    || !canBookNightContact(save, book, [actor])) return save
  const entered = spendNightContact(save, book, [actor])
  if (stationDate(stationOf(entered, book).absoluteWatch).phase !== 'Night'
    || entered.campaignSupply?.port !== stationOf(entered, book).anchor) return save
  return finishNightContact(entered, book, [actor], null)
}
