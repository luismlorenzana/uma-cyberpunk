// The ship's decks (CY15, TC62, TC63): a side cutaway of decks of slots, each module a panel in its slot with its level
// as one to three bars and a lit edge (cyan a room, magenta a battle system), a build under way striped with its watches
// left, an empty slot a dashed "+". A tap on a module opens its quick look (Enter, Upgrade, the Lab's Research); a tap on
// an empty slot opens the build sheet. All drawn in code, ours.
import { deckSlots, MODULES_BY_ID, moduleAt, reactorPips, ROOM_IDS, type Cost, type ModuleId, type RoomId, type Save } from '@cyber/domain'
import { lazy, Suspense, useState } from 'react'

/** The quick look, the build sheet and the Lab load on the first tap, so the home screen's bundle stays small. */
const ShipSheet = lazy(() => import('./ShipSheet'))

const X0 = 150, X1 = 930, Y0 = 70, Y1 = 410

export const costText = (c: Cost): string => [c.credits && `${c.credits} cr`, c.alloy && `${c.alloy} alloy`, c.data && `${c.data} data`].filter(Boolean).join(' · ') || 'free'

export function WalletChips({ save }: { save: Save }) {
  const w = save.wallet
  return (
    <span data-wallet className="flex items-center gap-1.5 text-[13px]">
      <span className="rounded bg-[#141827] px-2 py-1 ring-1 ring-white/15"><b data-credits>{w.credits}</b> cr</span>
      <span className="rounded bg-[#141827] px-2 py-1 ring-1 ring-white/15"><b data-alloy>{w.alloy}</b> alloy</span>
      <span className="rounded bg-[#141827] px-2 py-1 ring-1 ring-white/15"><b data-data>{w.data}</b> data</span>
      <span className="rounded bg-[#141827] px-2 py-1 ring-1 ring-white/15" title="Reactor pips">⚡ <b data-pips>{reactorPips(save.ship)}</b></span>
    </span>
  )
}

export type Pick = { kind: 'module'; id: ModuleId } | { kind: 'slot'; deck: number; slot: number } | { kind: 'lab' }

/** The cutaway's decks. `onRoom` opens a room's quick look for the seven rooms with a page. */
export function Decks({ save, onRoom }: { save: Save; onRoom: (room: RoomId) => void }) {
  const [pick, setPick] = useState<Pick | null>(null)
  const ship = save.ship
  const deckH = Math.min(120, (Y1 - Y0) / ship.decks), slotW = (X1 - X0) / ship.width
  const top = Y0 + ((Y1 - Y0) - deckH * ship.decks) / 2
  const tapModule = (id: ModuleId) => { setPick({ kind: 'module', id }); if (ROOM_IDS.includes(id as RoomId) && (moduleAt(ship, id)?.level ?? 0) >= 1) onRoom(id as RoomId) }
  return (
    <>
      <svg viewBox="0 0 1000 460" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label="The ship's decks">
        <defs>
          <linearGradient id="hull" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1b2033" /><stop offset="1" stopColor="#0e1222" /></linearGradient>
          <pattern id="building" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#ffb84d22" /></pattern>
        </defs>
        <path d={`M${X0 - 30} ${top - 20} L${X1} ${top - 20} Q990 ${top - 20} 985 ${top + 60} L960 ${top + deckH * ship.decks + 20} L${X0 - 30} ${top + deckH * ship.decks + 20} Q${X0 - 60} ${top + deckH * ship.decks + 20} ${X0 - 60} ${top + deckH * ship.decks - 20} L${X0 - 60} ${top + 20} Q${X0 - 60} ${top - 20} ${X0 - 30} ${top - 20} Z`} fill="url(#hull)" stroke="#2ee6ff44" strokeWidth="3" />
        {Array.from({ length: ship.decks }, (_, deck) => {
          const y = top + deck * deckH
          const slots = deckSlots(ship, deck)
          const drawn = new Set<string>()
          return (
            <g key={deck} data-deck={deck}>
              <text x={X0 - 40} y={y + deckH / 2 + 6} textAnchor="middle" fontSize="16" fill="#6d7590">D{deck + 1}</text>
              {slots.map((id, slot) => {
                const x = X0 + slot * slotW
                if (id === null) return (
                  <g key={`e${slot}`} data-empty={`${deck}:${slot}`} role="button" tabIndex={0} aria-label={`Deck ${deck + 1}, slot ${slot + 1}: empty`} onClick={() => setPick({ kind: 'slot', deck, slot })} style={{ cursor: 'pointer' }}>
                    <rect x={x + 6} y={y + 6} width={slotW - 12} height={deckH - 12} rx="10" fill="#0b0d17" stroke={pick?.kind === 'slot' && pick.deck === deck && pick.slot === slot ? '#2ee6ff' : '#ffffff26'} strokeDasharray="8 6" strokeWidth="2" />
                    <text x={x + slotW / 2} y={y + deckH / 2 + 8} textAnchor="middle" fontSize="26" fill="#ffffff44">+</text>
                  </g>
                )
                if (drawn.has(id)) return null
                drawn.add(id)
                const m = moduleAt(ship, id)!, def = MODULES_BY_ID.get(id)!, w = def.width * slotW
                const edge = def.kind === 'system' ? '#ff3dc8' : '#2ee6ff'
                const picked = pick?.kind === 'module' && pick.id === id
                return (
                  <g key={id} data-module={id} data-level={m.level} role="button" tabIndex={0} aria-label={`${def.name}, level ${m.level}${m.building ? ', building' : ''}`} onClick={() => tapModule(id)} style={{ cursor: 'pointer' }}>
                    <rect x={x + 6} y={y + 6} width={w - 12} height={deckH - 12} rx="10" fill="#141827" stroke={picked ? '#ffffff' : m.level ? edge : '#ffb84d'} strokeOpacity={m.level ? 0.4 + 0.2 * m.level : 0.8} strokeWidth={picked ? 4 : 2 + m.level} />
                    {m.building && <rect x={x + 6} y={y + 6} width={w - 12} height={deckH - 12} rx="10" fill="url(#building)" />}
                    <text x={x + w / 2} y={y + deckH / 2 + (deckH > 80 ? 0 : 4)} textAnchor="middle" fontSize={Math.min(22, deckH / 4)} fontWeight="700" fill={m.level ? '#e8ebf5' : '#ffb84d'}>{def.name}</text>
                    {deckH > 70 && <text x={x + w / 2} y={y + deckH / 2 + 22} textAnchor="middle" fontSize="14" fill="#ffb84d">{m.building ? `Building · ${m.building.left} watch${m.building.left === 1 ? '' : 'es'}` : ''}</text>}
                    {[0, 1, 2].map((b) => <rect key={b} x={x + 16 + b * 14} y={y + deckH - 22} width="10" height="6" rx="2" fill={b < m.level ? edge : '#ffffff22'} />)}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      {pick && <Suspense fallback={null}><ShipSheet save={save} pick={pick} setPick={setPick} /></Suspense>}
    </>
  )
}
