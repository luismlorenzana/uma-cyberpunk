import { awayMembers, campaignSupport, homeOutcome, pairProgress, sectorAssignment, seeScene,
  setFlag, type CabinEvening, type CabinNight, type CabinStage, type CampaignAlly, type CampaignBook, type EffectStep, type Save } from '@cyber/domain'
import { dateAvailable, dateProgress } from './dates'
import { pairAvailable } from './pair'
import { applyStep } from '../mission/director'
import { settleCampaignDay } from './watch'
import { questAvailable, questComplete } from './quests'
import { giveRapport } from '../bonds/bonds'

function trioParticipantsReady(save: Save, book: CampaignBook, ally: CampaignAlly): boolean {
  if (save.captain.romance === 'friends' || save.expedition) return false
  const ashore = campaignSupport(book, save).ashore
  return [ally.partner, ally.member].every(id => {
    const date = book.dates?.find(d => d.companion === id)
    const bond = save.crew.find(member => member.outfit === id)?.bond
    return !!date && dateAvailable(save, book, date) && dateProgress(save, book, date).visit === date.regular
      && !ashore.has(id) && bond?.path === 'heart' && bond.rank >= (date.overnightRank ?? 10)
  })
}

export function sharedConsentOffer(save: Save, book: CampaignBook, ally: CampaignAlly) {
  const quest = book.quests.find(row => row.id === ally.pairConsent)
  const evening = book.quests.find(row => row.id === book.evening?.after)
  if (!quest || !evening || !ally.pairFlag || save.story.flags.includes(ally.pairFlag) || save.mission
    || save.pairScene || save.campaignDay.pending || !questComplete(save, evening, book)
    || !save.story.flags.includes(ally.release.flag)
    || !questAvailable(save, book, quest, save.campaignSupply?.port ?? book.supply?.start, 'quarters')
    || !trioParticipantsReady(save, book, ally)) return undefined
  return quest
}

export function finishSharedConsent(save: Save, book: CampaignBook, ally: CampaignAlly, expectedDay: number, effects: readonly EffectStep[]): Save {
  if (save.campaignDay.day !== expectedDay) return save
  const quest = sharedConsentOffer(save, book, ally)
  if (!quest || !ally.pairFlag || effects.length !== 1) return save
  const accepted = effects[0]!
  if (accepted.kind !== 'flag' || !accepted.set || accepted.flag !== ally.pairFlag) return save
  return { ...save, story: seeScene(setFlag(save.story, ally.pairFlag), quest.scene) }
}

function trioReady(save: Save, book: CampaignBook, heroine: string): boolean {
  const ally = book.allies?.find(row => row.heroine === heroine)
  return !!ally?.pairFlag && save.story.flags.includes(ally.pairFlag) && trioParticipantsReady(save, book, ally)
}

export function cabinAvailable(save: Save, book: CampaignBook, cabin: CabinEvening): boolean {
  const away = awayMembers(save.operations, save.squads), source = cabin.source
  if ('trio' in source) return trioReady(save, book, source.trio)
  if ('companion' in source) {
    const date = book.dates?.find(d => d.companion === source.companion)
    return !!date && dateAvailable(save, book, date) && !away.includes(source.companion)
      && dateProgress(save, book, date).visit === date.regular
  }
  if ('sector' in source) {
    const sector = book.sectors?.find(s => s.id === source.sector), former = sector?.former
    if (!sector?.shared || !former || !save.story.seen.includes(sector.shared.morning)
      || !save.story.flags.includes(former.released) || save.story.flags.includes(former.custody)
      || !save.crew.some(c => c.outfit === sector.officer) || away.includes(sector.officer)) return false
    const assignment = sectorAssignment(book, save.story, sector)
    return ((assignment === 'aboard' || assignment === 'assigned') && save.story.flags.includes(former.aboard))
      || ((assignment === 'command' || assignment === 'retired') && save.campaignSupply?.port === sector.port && save.story.flags.includes(former.ashore))
  }
  const pair = book.pairs.find(p => p.id === source.pair)
  if (!pair || !pairAvailable(save, book, pair)) return false
  const progress = pairProgress(pair, save.story)
  if (!progress.moved || !progress.residency || !save.story.seen.includes(pair.rooms[progress.residency].morning)
    || !pair.members.every(m => save.crew.some(c => c.outfit === m.outfit) && !away.includes(m.outfit))) return false
  return pair.home && homeOutcome(pair.home, save.story) === 'resettle' ? save.campaignSupply?.port === pair.home.port
    : pair.members.every(m => !campaignSupport(book, save).ashore.has(m.outfit))
}

export function cabinStage(save: Save, book: CampaignBook, cabin: CabinEvening): CabinStage {
  if ('companion' in cabin.source) {
    const id = cabin.source.companion, bond = save.crew.find(c => c.outfit === id)?.bond
    return bond?.path === 'heart' ? 'partner' : bond?.path === 'trust' || (bond?.rank ?? 1) >= 4 ? 'friend' : 'acquaintance'
  }
  if ('pair' in cabin.source) {
    const id = cabin.source.pair, pair = book.pairs.find(p => p.id === id)
    return pair && pairProgress(pair, save.story).bond === 'romance' ? 'partner' : 'friend'
  }
  return 'trio' in cabin.source ? 'partner' : 'friend'
}

export function canStay(save: Save, book: CampaignBook, cabin: CabinEvening): boolean {
  if (!cabinAvailable(save, book, cabin)) return false
  if (!('companion' in cabin.source)) return true // Shared scripts invite each person to separate berths.
  const id = cabin.source.companion, bond = save.crew.find(c => c.outfit === id)?.bond
  const rank = book.dates?.find(date => date.companion === id)?.overnightRank ?? 10
  return !!bond && bond.rank >= rank && bond.path === 'heart' && save.captain.romance !== 'friends'
}

export function startCabinEvening(save: Save, book: CampaignBook, cabin: CabinEvening, expectedDay: number): Save {
  if (save.campaignDay.day !== expectedDay || save.campaignDay.pending || save.pairScene || save.mission || !cabinAvailable(save, book, cabin)) return save
  const after = book.quests.find(q => q.id === book.evening?.after)
  if (!after || !questComplete(save, after, book)) return save
  const stage = cabinStage(save, book, cabin), key = `${cabin.id}-${stage}`, count = save.cabinVisits[key] ?? 0
  const scene = cabin.chats[stage][count % cabin.chats[stage].length]!
  const source = cabin.source
  const companion = 'companion' in source ? source.companion : 'sector' in source ? book.sectors?.find(s => s.id === source.sector)?.officer
    : 'trio' in source ? book.allies?.find(ally => ally.heroine === source.trio)?.partner
    : book.pairs.find(p => p.id === source.pair)?.members[0].outfit
  const pending: CabinNight = { kind: 'cabin', id: cabin.id, phase: 'chat', scene, round: 0, outcome: null, choice: null,
    plan: { location: companion && campaignSupport(book, save).ashore.has(companion) ? 'ashore' : 'aboard',
      rapport: 'companion' in source ? { companion: source.companion, amount: cabin.chatRapport } : null,
      invitation: canStay(save, book, cabin) ? { ...cabin.invitation } : null,
      bed: cabin.bed[(save.cabinVisits[`${cabin.id}-bed`] ?? 0) % cabin.bed.length]!, morning: { ...cabin.morning }, changeMind: cabin.changeMind } }
  return { ...save, cabinVisits: { ...save.cabinVisits, [key]: Math.min(1000000, count + 1) }, campaignDay: { ...save.campaignDay, pending } }
}

function current(save: Save, day: number, expected: CabinNight): CabinNight | null {
  const pending = save.campaignDay.pending
  return save.campaignDay.day === day && pending?.kind === 'cabin' && pending.id === expected.id && pending.scene === expected.scene
    && pending.phase === expected.phase && pending.round === expected.round ? pending : null
}

export function chooseCabinOutcome(save: Save, book: CampaignBook, day: number, expected: CabinNight, index: number): Save {
  const pending = current(save, day, expected)
  if (!pending || pending.phase !== 'invitation' || !pending.plan.invitation || pending.outcome) return save
  const invite = pending.plan.invitation, cabin = book.cabinEvenings?.find(c => c.id === pending.id)
  if (index === invite.wait) return save
  const outcome = index === invite.stay ? 'stay' : index === invite.leave || index === invite.decline ? 'leave' : null
  if (!outcome || outcome === 'stay' && (!cabin || !canStay(save, book, cabin))) return save
  return { ...save, ...(outcome === 'stay' ? { cabinVisits: { ...save.cabinVisits,
    [`${pending.id}-bed`]: Math.min(1000000, (save.cabinVisits[`${pending.id}-bed`] ?? 0) + 1) } } : {}),
    campaignDay: { ...save.campaignDay, pending: { ...pending, outcome, choice: index } } }
}

export function leaveCabinEarly(save: Save, day: number, expected: CabinNight): Save {
  const pending = current(save, day, expected)
  if (!pending || pending.phase !== 'bed' || pending.outcome !== 'stay') return save
  return { ...save, campaignDay: { ...save.campaignDay, pending: { ...pending, phase: 'leave', outcome: 'leave', scene: pending.plan.changeMind } } }
}

export function finishCabinScene(save: Save, book: CampaignBook, day: number, expected: CabinNight, effects: readonly EffectStep[]): Save {
  const pending = current(save, day, expected)
  if (!pending) return save
  let next = save.story.seen.includes(pending.scene) ? save : effects.reduce((s, step) => applyStep(s, book.story, step), save)
  next = { ...next, story: seeScene(next.story, pending.scene) }
  if (pending.phase === 'chat' && pending.plan.rapport?.amount) {
    next = giveRapport(next, book.story, pending.plan.rapport.companion, pending.plan.rapport.amount)
  }
  const move = (phase: CabinNight['phase'], scene: string): Save => ({ ...next,
    campaignDay: { ...next.campaignDay, pending: { ...pending, phase, scene } } })
  if (pending.phase === 'morning') return { ...next, campaignDay: { ...next.campaignDay, pending: null } }
  if (pending.phase === 'chat' && pending.plan.invitation) return move('invitation', pending.plan.invitation.scene)
  if (pending.phase === 'invitation') {
    if (!pending.outcome) return { ...next, campaignDay: { ...next.campaignDay,
      pending: { ...pending, round: Math.min(1000000, pending.round + 1) } } }
    if (pending.outcome === 'stay') return move('bed', pending.plan.bed)
  }
  const outcome = pending.outcome ?? 'leave'
  return settleCampaignDay(next, { day: day + 1,
    pending: { ...pending, phase: 'morning', outcome, scene: pending.plan.morning[outcome] } }, book)
}
