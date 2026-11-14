// The cabins' stand-in art (CY14), drawn in code until uma-platform's pixel furniture set lands (D25's request): one flat
// SVG icon per item, its shape by slot and its colours by style (gifts by kind), and the cabin diorama's room. Ours,
// original, in git.
import { DECOR_COLORS, ITEMS_BY_ID, type GiftKind, type Item, type Slot } from '@cyber/domain'

const GIFT_COLORS: Record<GiftKind, readonly [string, string]> = {
  snacks: ['#5a2d1c', '#ffb347'], music: ['#2b1d4f', '#b48cff'], gear: ['#1f3340', '#7fd4ff'],
  plants: ['#1e3d24', '#7be38a'], books: ['#3f2a1f', '#f2d49b'], keepsakes: ['#3d1f33', '#ff8fc7'],
}
const KEEPSAKE: readonly [string, string] = ['#3a3220', '#ffd166']

/** An item's two colours: its style's, its gift kind's, or the keepsakes' gold. */
export function itemColors(item: Item): readonly [string, string] {
  if (item.kind === 'furniture') return DECOR_COLORS[item.style]
  if (item.kind === 'gift') return GIFT_COLORS[item.gift]
  return KEEPSAKE
}

/** The shape of each slot, in a 48 × 48 box: base fill `a`, accent `b`. */
function shape(slot: Slot | 'gift', a: string, b: string) {
  switch (slot) {
    case 'bed': return <><rect x="4" y="22" width="40" height="14" rx="3" fill={a} /><rect x="6" y="16" width="12" height="8" rx="3" fill={b} /><rect x="4" y="34" width="4" height="8" fill={a} /><rect x="40" y="34" width="4" height="8" fill={a} /><rect x="18" y="20" width="24" height="4" rx="2" fill={b} opacity="0.6" /></>
    case 'desk': return <><rect x="6" y="18" width="36" height="6" rx="1.5" fill={b} /><rect x="9" y="24" width="4" height="18" fill={a} /><rect x="35" y="24" width="4" height="18" fill={a} /><rect x="22" y="8" width="14" height="10" rx="1.5" fill={a} stroke={b} strokeWidth="1.5" /></>
    case 'wall': return <><rect x="8" y="6" width="32" height="34" rx="2" fill={a} stroke={b} strokeWidth="3" /><path d="M12 34 L20 22 L26 30 L30 25 L36 34 Z" fill={b} /></>
    case 'floor': return <><ellipse cx="24" cy="30" rx="21" ry="11" fill={a} /><ellipse cx="24" cy="30" rx="14" ry="6.5" fill="none" stroke={b} strokeWidth="2.5" /></>
    case 'light': return <><path d="M14 22 L34 22 L29 8 L19 8 Z" fill={b} /><rect x="22.5" y="22" width="3" height="16" fill={a} /><rect x="15" y="38" width="18" height="4" rx="2" fill={a} /><circle cx="24" cy="15" r="9" fill={b} opacity="0.25" /></>
    case 'keepsake': return <><path d="M24 6 L28.5 18 L41 18 L31 26 L35 39 L24 31 L13 39 L17 26 L7 18 L19.5 18 Z" fill={b} stroke={a} strokeWidth="2" /></>
    case 'gift': return <><rect x="8" y="18" width="32" height="24" rx="2" fill={a} /><rect x="6" y="13" width="36" height="8" rx="2" fill={b} /><rect x="21.5" y="13" width="5" height="29" fill={b} /><path d="M24 13 C18 4 10 8 16 13 M24 13 C30 4 38 8 32 13" stroke={b} strokeWidth="2.5" fill="none" /></>
  }
}

/** An item's stand-in icon. */
export function ItemIcon({ id, size = 40, className }: { id: string; size?: number; className?: string }) {
  const item = ITEMS_BY_ID.get(id)
  if (!item) return null
  const [a, b] = itemColors(item)
  return (
    <svg data-item={id} viewBox="0 0 48 48" width={size} height={size} className={className} role="img" aria-label={item.name}>
      {shape(item.kind === 'gift' ? 'gift' : item.slot, a, b)}
    </svg>
  )
}

/** Where each slot sits in the cabin's 640 × 360 room, and how big its piece draws. */
export const SLOT_SPOTS: Record<Slot, { x: number; y: number; size: number }> = {
  bed: { x: 14, y: 214, size: 150 }, floor: { x: 160, y: 286, size: 116 }, wall: { x: 92, y: 44, size: 92 },
  light: { x: 548, y: 40, size: 72 }, desk: { x: 476, y: 204, size: 138 }, keepsake: { x: 420, y: 168, size: 52 },
}
/** Where she stands: the room's centre-right, between the rug and the desk, the window behind her. */
export const STAND = { left: '54%', bottom: '5%', height: '74%' } as const

/** A world's window colours, from its id, so each world the ship orbits tints the cabin's window differently. */
export function windowColors(world: string | null): readonly [string, string] {
  if (!world) return ['#060812', '#1b2350']
  const PALETTES = [['#0d0624', '#ff3dc8'], ['#03121a', '#2ee6ff'], ['#140a02', '#ffb347'], ['#06140a', '#7be38a'], ['#0b0820', '#b48cff']] as const
  return PALETTES[[...world].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 3) % PALETTES.length]!
}
