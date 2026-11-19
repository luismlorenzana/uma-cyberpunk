// Looks (D23, D24, LK1, LK2): each Uma's six outfits, picked by where she is. The approved full-body images in Uma
// Character Art's Cyberpunk universe are their portraits (LK10); only the combat armor gets sprites (D24). Pure.
export type Look = 'street' | 'ship-casual' | 'quarters' | 'pilot' | 'armor' | 'armor-helmet'
export const LOOKS: readonly Look[] = ['street', 'ship-casual', 'quarters', 'pilot', 'armor', 'armor-helmet']
export const LOOK_NAME: Record<Look, string> = { street: 'Street', 'ship-casual': 'Ship Casual', quarters: 'Quarters', pilot: 'Pilot suit', armor: 'Combat armor', 'armor-helmet': 'Helmet on' }

/** Where she is, as the screens name it. */
export const LOOK_CONTEXTS = ['world', 'ship', 'briefing', 'cabin', 'spot', 'post', 'bridge', 'mission', 'sealed'] as const
export type LookContext = typeof LOOK_CONTEXTS[number]
/** A world location is Street; her cabin is Quarters and public ship spaces are Ship Casual; duty uses the Pilot suit; a
 * mission is the Combat armor, and a sealed map closes the helmet. */
export const LOOK_FOR: Record<LookContext, Look> = {
  world: 'street', ship: 'ship-casual', briefing: 'ship-casual', cabin: 'quarters', spot: 'ship-casual', post: 'pilot', bridge: 'pilot', mission: 'armor', sealed: 'armor-helmet',
}
/** The look a screen or scene shows: the scene's own `look` when the story names one, else the context's. */
export const lookFor = (context: LookContext, named?: Look): Look => named ?? LOOK_FOR[context]

/** The bust crop of a full-body look (LK10): the top of the 1024 × 1536 image, head to chest, fixed per look (as fractions
 * of the image: from the top, and the height kept). */
export const BUST_CROP: Record<Look, { top: number; height: number }> = {
  street: { top: 0.02, height: 0.36 }, 'ship-casual': { top: 0.02, height: 0.36 }, quarters: { top: 0.02, height: 0.36 }, pilot: { top: 0.02, height: 0.36 },
  armor: { top: 0.02, height: 0.38 }, 'armor-helmet': { top: 0.02, height: 0.38 },
}

/** Explicit callers/scene looks take priority; known ship places also work in older books. */
export function placeLookContext(place: string): LookContext {
  if (['cabin', 'quarters', 'private-cabin', 'shared-cabin'].includes(place)) return 'cabin'
  if (['bridge', 'post', 'command', 'station'].includes(place)) return 'bridge'
  if (['aboard', 'ship', 'spot', 'galley', 'lounge', 'observation', 'corridor', 'briefing', 'welcome-briefing'].includes(place)) return 'ship'
  return 'world'
}
