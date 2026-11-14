// Looks (D23, D24, LK1, LK2): each Uma's five outfits, picked by where she is. The approved full-body images in Uma
// Character Art's Cyberpunk universe are their portraits (LK10); only the combat armor gets sprites (D24). Pure.
export type Look = 'street' | 'quarters' | 'pilot' | 'armor' | 'armor-helmet'
export const LOOKS: readonly Look[] = ['street', 'quarters', 'pilot', 'armor', 'armor-helmet']
export const LOOK_NAME: Record<Look, string> = { street: 'Street', quarters: 'Quarters', pilot: 'Pilot suit', armor: 'Combat armor', 'armor-helmet': 'Helmet on' }

/** Where she is, as the screens name it. */
export type LookContext = 'world' | 'cabin' | 'spot' | 'post' | 'bridge' | 'mission' | 'sealed'
/** LK2: a world location is Street; her cabin and the ship's spots are Quarters; a post and the Bridge are the Pilot suit; a
 * mission is the Combat armor, and a sealed map closes the helmet. */
export const LOOK_FOR: Record<LookContext, Look> = {
  world: 'street', cabin: 'quarters', spot: 'quarters', post: 'pilot', bridge: 'pilot', mission: 'armor', sealed: 'armor-helmet',
}
/** The look a screen or scene shows: the scene's own `look` when the story names one, else the context's. */
export const lookFor = (context: LookContext, named?: Look): Look => named ?? LOOK_FOR[context]

/** The bust crop of a full-body look (LK10): the top of the 1024 × 1536 image, head to chest, fixed per look (as fractions
 * of the image: from the top, and the height kept). */
export const BUST_CROP: Record<Look, { top: number; height: number }> = {
  street: { top: 0.02, height: 0.36 }, quarters: { top: 0.02, height: 0.36 }, pilot: { top: 0.02, height: 0.36 },
  armor: { top: 0.02, height: 0.38 }, 'armor-helmet': { top: 0.02, height: 0.38 },
}
