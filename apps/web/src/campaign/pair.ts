import { COMMAND_STATIONS, awayMembers, fillFile, homeOutcome, pairProgress, seeScene,
  type CampaignBook, type CampaignPair, type EffectStep, type Save } from '@cyber/domain'
import { applyStep } from '../mission/director'

export function readyForHome(save: Save, pair: CampaignPair): boolean {
  const progress = pairProgress(pair, save.story)
  if (!progress.moved || !progress.residency || !save.story.seen.includes(pair.rooms[progress.residency].morning)) return false
  const away = awayMembers(save.operations, save.squads)
  return pair.members.every(({ outfit }) => !away.includes(outfit) && save.crew.some((member) => member.outfit === outfit))
}

export function homeQuestReady(save: Save, book: CampaignBook, quest: string): boolean {
  const pair = book.pairs.find(({ home }) => home?.base === quest || home?.defense === quest)
  if (!pair?.home) return true
  return quest === pair.home.base ? readyForHome(save, pair) : homeOutcome(pair.home, save.story) !== null
}

export function nextHomeScene(save: Save, book: CampaignBook, pair: CampaignPair): string | null {
  const home = pair.home
  if (!home || save.campaignSupply?.port !== home.port) return null
  const port = book.supply?.ports.find(({ id }) => id === home.port)
  if (!port?.liberation || !save.story.flags.includes(port.liberation.flag)) return null
  const outcome = homeOutcome(home, save.story)
  if (outcome) {
    const defense = book.quests.find(({ id }) => id === home.defense)
    if (!defense?.encounter || !save.worlds.missions.includes(defense.encounter)) return null
    const debrief = home[outcome].debrief
    return !save.story.seen.includes(debrief) ? debrief : outcome === 'resettle' ? home.visit : null
  }
  const base = book.quests.find(({ id }) => id === home.base)
  return base && save.story.seen.includes(base.scene) && readyForHome(save, pair) ? home.scene : null
}

export function pairAvailable(save: Save, book: CampaignBook, pair: CampaignPair): boolean {
  const after = book.quests.find((quest) => quest.id === pair.after)
  return !!after && save.story.flags.includes(pair.capture) && save.story.seen.includes(after.scene)
    && (!after.encounter || save.worlds.missions.includes(after.encounter))
    && save.crew.some(({ outfit }) => outfit === pair.members[0].outfit)
}

export function openPairScene(save: Save, book: CampaignBook, pair: CampaignPair, scene: string): Save {
  if (save.pairScene || save.campaignDay.pending || save.mission || !pairAvailable(save, book, pair) || !pairSceneReady(save, book, pair, scene)) return save
  return { ...save, pairScene: { pair: pair.id, scene } }
}

export function pairSceneReady(save: Save, book: CampaignBook, pair: CampaignPair, scene: string): boolean {
  return pairProgress(pair, save.story).next === scene || nextHomeScene(save, book, pair) === scene
}

/** Finishing a pair scene commits any choices and its milestone together. Returning to a room still uses the night clock. */
export function recordPairScene(save: Save, book: CampaignBook, pair: CampaignPair, scene: string, effects: readonly EffectStep[]): Save {
  if (save.story.seen.includes(scene)) return save
  const next = effects.reduce((state, step) => applyStep(state, book.story, step), save)
  let story = seeScene(next.story, scene)
  if (scene === pair.recovery[1]) {
    book.story.files[pair.testimony]?.lines.forEach((_, index) => { story = fillFile(story, pair.testimony, index) })
  }
  return { ...next, story }
}

export function closePairScene(save: Save, book: CampaignBook, pair: CampaignPair, scene: string, effects: readonly EffectStep[]): Save {
  if (save.pairScene?.pair !== pair.id || save.pairScene.scene !== scene || !pairAvailable(save, book, pair) || !pairSceneReady(save, book, pair, scene)) return save
  const next = { ...recordPairScene(save, book, pair, scene, effects), pairScene: null }
  const home = pair.home
  if (!home || scene !== home.scene || homeOutcome(home, next.story) !== 'resettle') return next
  const residents = new Set(pair.members.map(({ outfit }) => outfit))
  const commandCrew = { ...next.commandCrew }
  for (const station of COMMAND_STATIONS) {
    const officer = commandCrew[station]
    if (officer && residents.has(officer.outfit)) delete commandCrew[station]
  }
  return { ...next, commandCrew,
    crew: next.crew.map((member) => residents.has(member.outfit) ? { ...member, post: null } : member),
    dutyPresets: next.dutyPresets.map((preset) => ({ ...preset,
      posts: Object.fromEntries(Object.entries(preset.posts).filter(([outfit]) => !residents.has(Number(outfit)))) })) }
}
