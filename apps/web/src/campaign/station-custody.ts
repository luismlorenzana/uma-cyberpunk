import { firstStation, SECURE_WARD_BERTHS, stationRoom, type CampaignBook, type Save, type StationCustody, type StationState } from '@cyber/domain'

/** Stable rooms for the captured Generals. Story remains the authority for capture and release. */
export function stationCustody(save: Save, book: CampaignBook): StationCustody[] {
  const station = save.station ?? firstStation(save.campaignDay.day, book.supply?.start)
  const chapter = new Map(book.quests.map(quest => [quest.id, quest]))
  const seen = new Map(save.story.seen.map((scene, index) => [scene, index]))
  const completed = (q: string | undefined) => {
    const step = q ? chapter.get(q) : undefined
    return step && (seen.get(step.scene) ?? (step.sceneWhen ? seen.get(step.sceneWhen.scene) : undefined))
  }
  const held = [...book.fourAct?.arcs.values() ?? []].flatMap(arc => {
    const capture = arc.capture && completed(arc.capture.custody)
    return capture === undefined || completed(arc.rehabilitation?.release) !== undefined ? []
      : [{ actor: arc.general, watch: capture, port: chapter.get(arc.capture!.custody)?.port ?? station.anchor }]
  }).sort((a, b) => a.watch - b.watch)
  const existing = new Map(station.custody?.map(row => [row.actor, row]))
  const occupied = new Set(held.flatMap(row => {
    const prior = existing.get(row.actor)
    return prior && 'berth' in prior ? [prior.berth] : []
  }))
  const secure = stationRoom(station, 'secure-ward') === 'active' ? SECURE_WARD_BERTHS : 0
  let free = 0
  return held.map(({ actor, port }) => {
    const prior = existing.get(actor)
    if (prior && 'berth' in prior) return prior
    while (occupied.has(free)) free++
    return free <= secure ? { actor, berth: free++ } : prior ?? { actor, port }
  })
}

export function syncStationCustody(save: Save, book: CampaignBook, station: StationState): Save {
  return { ...save, station: { ...station, custody: stationCustody({ ...save, station }, book) } }
}

export function custodyCommit(save: Save, book: CampaignBook, quest: string): Save {
  const owner = book.fourAct?.personalQuestOwners.get(quest)
  const arc = owner === undefined ? undefined : book.fourAct?.arcs.get(owner)
  if (!arc || quest !== arc.capture?.custody && quest !== arc.rehabilitation?.release) return save
  return syncStationCustody(save, book, save.station ?? firstStation(save.campaignDay.day, book.supply?.start))
}
