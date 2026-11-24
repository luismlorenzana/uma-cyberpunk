import { advanceCombatTraining, earn, fillFile, setFlag, type GroundEncounter, type Save, type StoryPack } from '@cyber/domain'
import type { BattleInput } from '@cyber/battle'
import { finishMission } from '../mission/director'

/** The settled clear is the commit marker for the reward, evidence and campaign outcome. */
export function settleGround(save: Save, ground: GroundEncounter, storyPack: StoryPack): Save {
  const mission = save.mission
  if (mission?.id !== ground.id || mission.step !== 'results' || !mission.won) return save
  if (save.worlds.missions.includes(mission.id)) return finishMission(save)
  const win = ground.win
  let story = win.flag ? setFlag(save.story, win.flag) : save.story
  const file = win.file ? storyPack.files[win.file] : undefined
  file?.lines.forEach((_, line) => { story = fillFile(story, file.id, line) })
  const complete = mission.battle?.input as BattleInput | undefined
  const trained = complete?.rulesVersion === 5 ? advanceCombatTraining(save, complete.units) : save
  return finishMission({ ...trained, story, wallet: win.reward ? earn(save.wallet, win.reward) : save.wallet,
    worlds: { ...save.worlds, missions: [...save.worlds.missions, mission.id] } })
}
