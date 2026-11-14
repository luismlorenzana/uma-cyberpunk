// The cabins' items (CY14, TC61): furniture in six styles, the keepsakes and the gifts. Invented names and numbers, so
// they're in git; the real pixel art comes from uma-platform (the furniture request, D25). A style's **line** is its five
// pieces, one for each regular slot; a full line in a cabin is a **set**.
export type Slot = 'bed' | 'desk' | 'wall' | 'floor' | 'light' | 'keepsake'
export const SLOTS: readonly Slot[] = ['bed', 'desk', 'wall', 'floor', 'light', 'keepsake']
/** The slots a style's line fills; the keepsake slot takes keepsakes only. */
export const LINE_SLOTS: readonly Exclude<Slot, 'keepsake'>[] = ['bed', 'desk', 'wall', 'floor', 'light']
export const CABIN_SLOT_NAME: Record<Slot, string> = { bed: 'Bed', desk: 'Desk', wall: 'Wall', floor: 'Floor', light: 'Light', keepsake: 'Keepsake' }

export type Style = 'neon' | 'classic' | 'cozy' | 'sporty' | 'tech' | 'wild'
export const DECOR_STYLES: readonly Style[] = ['neon', 'classic', 'cozy', 'sporty', 'tech', 'wild']
export const DECOR_NAME: Record<Style, string> = { neon: 'Neon', classic: 'Classic', cozy: 'Cozy', sporty: 'Sporty', tech: 'Tech', wild: 'Wild' }
/** Each style's colours for the stand-in icons and the cabin's tint: base, accent. */
export const DECOR_COLORS: Record<Style, readonly [string, string]> = {
  neon: ['#2a1640', '#ff3dc8'], classic: ['#4a3626', '#e0b070'], cozy: ['#5a3a46', '#ffb3c1'],
  sporty: ['#173a5a', '#4fd1ff'], tech: ['#1b2a33', '#7cf2c8'], wild: ['#26402a', '#a6e36a'],
}
/** The style she dislikes most is her favourite's opposite. */
export const OPPOSITE: Record<Style, Style> = { neon: 'classic', classic: 'neon', cozy: 'sporty', sporty: 'cozy', tech: 'wild', wild: 'tech' }

export type GiftKind = 'snacks' | 'music' | 'gear' | 'plants' | 'books' | 'keepsakes'
export const GIFT_KINDS: readonly GiftKind[] = ['snacks', 'music', 'gear', 'plants', 'books', 'keepsakes']
export const GIFT_NAME: Record<GiftKind, string> = { snacks: 'Snacks', music: 'Music', gear: 'Gear', plants: 'Plants', books: 'Books', keepsakes: 'Keepsakes' }

export interface Furniture { id: string; kind: 'furniture'; name: string; slot: Exclude<Slot, 'keepsake'>; style: Style; comfort: 1 | 2 | 3 }
export interface Keepsake { id: string; kind: 'keepsake'; name: string; slot: 'keepsake'; comfort: 1 | 2 | 3 }
export interface Gift { id: string; kind: 'gift'; name: string; gift: GiftKind }
export type Item = Furniture | Keepsake | Gift

const line = (style: Style, names: readonly [string, string, string, string, string], comfort: readonly [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3]): Furniture[] =>
  LINE_SLOTS.map((slot, i) => ({ id: `${style}-${slot}`, kind: 'furniture', name: names[i]!, slot, style, comfort: comfort[i]! }))

export const FURNITURE: readonly Furniture[] = [
  ...line('neon', ['Glow Pod Bed', 'Holo Desk', 'Neon Sign', 'Light-Grid Mat', 'Strip Lights'], [2, 2, 2, 1, 2]),
  ...line('classic', ['Oak Bunk', 'Writing Desk', 'Framed Print', 'Woven Rug', 'Brass Lamp'], [3, 2, 1, 2, 1]),
  ...line('cozy', ['Quilted Bed', 'Tea Table', 'Plush Shelf', 'Fluffy Rug', 'Paper Lantern'], [3, 1, 2, 3, 1]),
  ...line('sporty', ['Training Cot', 'Gear Bench', 'Race Poster', 'Stretch Mat', 'Track Light'], [2, 2, 1, 2, 2]),
  ...line('tech', ['Capsule Bunk', 'Console Desk', 'Wall Screen', 'Grid Floor Panel', 'Smart Lamp'], [2, 3, 2, 1, 1]),
  ...line('wild', ['Rope Hammock', 'Driftwood Desk', 'Vine Wall', 'Moss Rug', 'Firefly Jar'], [2, 1, 2, 2, 3]),
]
export const KEEPSAKES: readonly Keepsake[] = [
  { id: 'keepsake-trophy', kind: 'keepsake', name: 'First Trophy', slot: 'keepsake', comfort: 3 },
  { id: 'keepsake-photo', kind: 'keepsake', name: 'Crew Photo', slot: 'keepsake', comfort: 3 },
  { id: 'keepsake-charm', kind: 'keepsake', name: 'Captain’s Charm', slot: 'keepsake', comfort: 2 },
  { id: 'keepsake-starmap', kind: 'keepsake', name: 'Hand-Drawn Star Map', slot: 'keepsake', comfort: 2 },
  { id: 'keepsake-ribbon', kind: 'keepsake', name: 'Old Race Ribbon', slot: 'keepsake', comfort: 2 },
  { id: 'keepsake-radio', kind: 'keepsake', name: 'Pocket Radio', slot: 'keepsake', comfort: 1 },
]
export const GIFTS: readonly Gift[] = [
  { id: 'gift-buns', kind: 'gift', name: 'Steamed Buns', gift: 'snacks' }, { id: 'gift-candy', kind: 'gift', name: 'Fizz Candy', gift: 'snacks' },
  { id: 'gift-tape', kind: 'gift', name: 'Mix Tape', gift: 'music' }, { id: 'gift-earbuds', kind: 'gift', name: 'Spare Earbuds', gift: 'music' },
  { id: 'gift-gloves', kind: 'gift', name: 'Grip Gloves', gift: 'gear' }, { id: 'gift-kit', kind: 'gift', name: 'Tune-Up Kit', gift: 'gear' },
  { id: 'gift-succulent', kind: 'gift', name: 'Tiny Succulent', gift: 'plants' }, { id: 'gift-seeds', kind: 'gift', name: 'Seed Packet', gift: 'plants' },
  { id: 'gift-novel', kind: 'gift', name: 'Paperback Novel', gift: 'books' }, { id: 'gift-atlas', kind: 'gift', name: 'Pocket Atlas', gift: 'books' },
  { id: 'gift-pin', kind: 'gift', name: 'Enamel Pin', gift: 'keepsakes' }, { id: 'gift-postcard', kind: 'gift', name: 'Postcard', gift: 'keepsakes' },
]
export const ITEMS: readonly Item[] = [...FURNITURE, ...KEEPSAKES, ...GIFTS]
export const ITEMS_BY_ID: ReadonlyMap<string, Item> = new Map(ITEMS.map((i) => [i.id, i]))
export const placeable = (item: Item | undefined): item is Furniture | Keepsake => !!item && item.kind !== 'gift'

/** A new game's stock (TC61): two of each regular slot in Classic and Cozy, and one gift of each kind. */
export const STARTER_STOCK: Readonly<Record<string, number>> = Object.fromEntries([
  ...FURNITURE.filter((f) => f.style === 'classic' || f.style === 'cozy').map((f) => [f.id, 2] as const),
  ...GIFT_KINDS.map((k) => [GIFTS.find((g) => g.gift === k)!.id, 1] as const),
])

/** The item a won mission brings (TC61), by a fixed table over the mission's id: furniture most often, a gift or a keepsake. */
export function missionItem(missionId: string): string {
  const h = [...missionId].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17)
  const pool = h % 5 === 0 ? KEEPSAKES : h % 3 === 0 ? GIFTS : FURNITURE
  return pool[(h >>> 3) % pool.length]!.id
}

// --- Topics and the cabin record (here, with no imports, so the crew record can hold a cabin) ---------------------------

export type Topic = 'racing' | 'music' | 'food' | 'fashion' | 'tech' | 'stars' | 'home' | 'training' | 'games' | 'nature' | 'history' | 'crew'
export const TOPICS: readonly Topic[] = ['racing', 'music', 'food', 'fashion', 'tech', 'stars', 'home', 'training', 'games', 'nature', 'history', 'crew']
export const TOPIC_NAME: Record<Topic, string> = {
  racing: 'Racing', music: 'Music', food: 'Food', fashion: 'Fashion', tech: 'Tech', stars: 'The stars', home: 'Home', training: 'Training',
  games: 'Games', nature: 'Nature', history: 'History', crew: 'The crew',
}

/** What she has revealed of her tastes: `gift`, `styles`, and `topic:<topic>` for each loved topic talked about. */
export type Reveal = 'gift' | 'styles' | `topic:${Topic}`
export interface Cabin {
  slots: Record<Slot, string | null>
  revealed: Reveal[]
  /** A slot she asked for at the end of a visit; granting it fills the slot and pays. */
  request: Slot | null
}
export const emptyCabin = (): Cabin => ({ slots: { bed: null, desk: null, wall: null, floor: null, light: null, keepsake: null }, revealed: [], request: null })

