// The loaded story for the ship's screens, and a speaker's name.
import type { StoryPack } from '@cyber/domain'
import { useEffect, useState } from 'react'
import { story } from '../story/load'
import { nameOf } from '../story/runner'

export function useStory(): StoryPack | null {
  const [pack, setPack] = useState<StoryPack | null>(null)
  useEffect(() => { let live = true; void story().then((s) => { if (live) setPack(s.pack) }); return () => { live = false } }, [])
  return pack
}

export const outfitName = (pack: StoryPack | null, outfit: number): string => (pack ? nameOf(pack, outfit) : `Uma ${outfit}`)
