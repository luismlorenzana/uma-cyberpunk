import { replayBattle, type BattleAction, type BattleInput } from '@cyber/battle'
import { advanceCombatTraining, earn, fillFile, setFlag, type CampaignBook, type GroundEncounter, type Save, type StoryPack } from '@cyber/domain'
import { finishMission } from '../mission/director'
import { advanceStationWatches } from './watch'
import { creditCampaignClear } from './progression'

/** The settled clear is the commit marker for the reward, evidence and campaign outcome. */
export function settleGround(save: Save, ground: GroundEncounter, storyPack: StoryPack, fourAct = false, book?: CampaignBook): Save {
  const mission = save.mission
  if (mission?.id !== ground.id || mission.step !== 'results' || !mission.won) return save
  if (save.worlds.missions.includes(mission.id)) return finishMission(save)
  const win = ground.win
  let story = win.flag ? setFlag(save.story, win.flag) : save.story
  if (fourAct || ground.rescue || ground.talk?.length || ground.formation || mission.callUp) {
    if (!mission.battle) return save
    const input = mission.battle.input as BattleInput
    try {
      const { state, error } = replayBattle(input, mission.battle.actions as BattleAction[])
      const result = state.result
      if (error || result?.winner !== 'squad') return save
      const rescue = ground.rescue
      if (rescue) {
        const leader = input.units.find((u) => u.id === rescue.unit)
        const freed = result.enemies?.find((u) => u.id === rescue.unit && u.fate === 'freed')
        if (input.objective.kind !== 'freeLeader' || input.objective.collar !== 'rigBreak'
          || leader?.ref?.kind !== 'heroine' || leader.ref.id !== rescue.heroine || !freed?.freedBy) return save
        if (rescue.jackOutFlag && freed.freedBy === 'jackout') story = setFlag(story, rescue.jackOutFlag)
      }
      for (const { id, talk, home } of result.enemies ?? []) {
        const contact = ground.talk?.find((entry) => entry.target === id)
        if (talk && talk === contact?.outcome) story = setFlag(story, talk)
        if (home && home === contact?.brokenOutcome) story = setFlag(story, home)
      }
    } catch { return save }
  }
  const file = win.file ? storyPack.files[win.file] : undefined
  file?.lines.forEach((_, line) => { story = fillFile(story, file.id, line) })
  const complete = mission.battle?.input as BattleInput | undefined
  const trained = complete?.rulesVersion === 5 ? advanceCombatTraining(save, complete.units) : save
  const cleared = fourAct && complete ? creditCampaignClear(trained, complete.units.flatMap(unit =>
    unit.side === 'squad' && unit.ref && (unit.ref.kind === 'uma' || unit.ref.kind === 'heroine') ? [unit.ref.id] : [])) : trained
  const debriefed = finishMission({ ...cleared, story, wallet: win.reward ? earn(save.wallet, win.reward) : save.wallet,
    worlds: { ...save.worlds, missions: [...save.worlds.missions, mission.id] } })
  return book?.stationStory ? advanceStationWatches(debriefed, book, 1) : debriefed
}
