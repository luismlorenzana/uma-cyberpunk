// The crew for the screens: the save's records, the story's tags and master data, joined (CY11).
import { useMemo } from 'react'
import { useMaster } from '../master/master'
import { useGame } from '../save/game'
import { outfitName, useStory } from '../ship/useStory'
import { crewViews, infoFrom, type CrewView } from './view'

export function useCrew(): { crew: CrewView[]; ready: boolean } {
  const save = useGame((g) => g.save)
  const pack = useStory()
  const master = useMaster()
  const info = master.status === 'ready' ? master.view.info : null
  return useMemo(() => ({ crew: save ? crewViews(save, pack, infoFrom(info), (o) => outfitName(pack, o)) : [], ready: !!save && !!pack }), [save, pack, info])
}
