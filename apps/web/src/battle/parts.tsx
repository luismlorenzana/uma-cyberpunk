// The battle screen's pieces (CY8, TC29): the timeline, the unit card, the forecast card, the paper doll, the terrain card
// and the cut-in. DOM over the board; each reads the battle's state and the forecast, and decides nothing.
import { talkContact, type BattleState, type Forecast, type StrikeForecast, type TerrainCard, type UnitState } from '@cyber/battle'
import { FaceTile, UmaBust } from '@luismlorenzana/uma-kit/album'
import type { ReactNode } from 'react'
import type { CutInSpeed } from './playback'

export const SIDE_HUE = { squad: '#2ee6ff', enemy: '#ff3d6e' } as const
const PART_NAME = { core: 'Core', leftArm: 'L arm', rightArm: 'R arm', legs: 'Legs' } as const

export const labelOf = (state: BattleState, id: string): string => state.input.units.find((u) => u.id === id)?.label ?? id
const initials = (label: string) => label.split(' ').map((w) => w[0]).join('').slice(0, 3)
/** An Uma's outfit id (her face and bust come from master data, D19), or null for a stand-in, an enemy or a guest. */
export const umaOf = (state: BattleState, id: string): string | null => { const r = state.input.units.find((u) => u.id === id)?.ref; return r?.kind === 'uma' ? r.id : null }

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-white/10 bg-[#0e1222]/90 p-2 text-[12px] text-[#e8ebf5] shadow-lg backdrop-blur ${className}`}>{children}</div>
}

/** The next eight turns (TC3); a forecast's timeline ghosted under them. */
export function Timeline({ state, ids, ghost, onInspect }: { state: BattleState; ids: string[]; ghost: string[] | null; onInspect: (id: string) => void }) {
  const chip = (id: string, i: number, faint: boolean) => {
    const u = state.units.find((x) => x.id === id)
    const hue = u ? SIDE_HUE[u.side] : '#888'
    return (
      <button key={`${id}-${i}`} type="button" onClick={() => onInspect(id)} aria-label={`Turn ${i + 1}: ${labelOf(state, id)}`}
        className={`flex min-h-11 min-w-11 flex-col items-center justify-center rounded-md border px-1 font-display text-[11px] font-bold ${faint ? 'opacity-50' : ''}`}
        style={{ borderColor: hue, color: hue, background: i === 0 && !faint ? `${hue}22` : 'rgba(14,18,34,0.85)' }}>
        {umaOf(state, id) ? <FaceTile outfitId={umaOf(state, id)!} size={36} label={labelOf(state, id)} round /> : initials(labelOf(state, id))}
      </button>
    )
  }
  return (
    <div data-timeline className="pointer-events-auto flex flex-col items-center gap-1">
      <div className="flex gap-1">{ids.map((id, i) => chip(id, i, false))}</div>
      {ghost && <div data-timeline-ghost className="flex gap-1">{ghost.map((id, i) => chip(id, i + 1, true))}</div>}
    </div>
  )
}

function Bar({ hp, max, hue }: { hp: number; max: number; hue: string }) {
  return (
    <span className="inline-block h-1.5 w-16 overflow-hidden rounded bg-white/15 align-middle">
      <span className="block h-full" style={{ width: `${Math.max(0, (hp / max) * 100)}%`, background: hp <= 0 ? '#6b7280' : hue }} />
    </span>
  )
}

/** A unit's card: her parts, Charge, link and state. */
export function UnitCard({ state, unit, onClose }: { state: BattleState; unit: UnitState; onClose: () => void }) {
  const hue = SIDE_HUE[unit.side]
  const contact = unit.status === 'active' ? talkContact(state, unit.id) : undefined
  return (
    <Panel className="pointer-events-auto w-56">
      <div className="mb-1 flex items-center justify-between gap-2">
        {umaOf(state, unit.id) && <FaceTile outfitId={umaOf(state, unit.id)!} size={40} label={labelOf(state, unit.id)} round />}
        <b className="min-w-0 flex-1 truncate" style={{ color: hue }}>{labelOf(state, unit.id)}</b>
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-[#a3abc2]" aria-label="Close">✕</button>
      </div>
      {(['core', 'leftArm', 'rightArm', 'legs'] as const).map((p) => (
        <div key={p} className="flex items-center justify-between gap-2"><span>{PART_NAME[p]}</span><span>{unit.hp[p]}/{unit.maxHp[p]} <Bar hp={unit.hp[p]} max={unit.maxHp[p]} hue={hue} /></span></div>
      ))}
      <div className="mt-1 text-[#a3abc2]">Charge {unit.charge} · Link {unit.link ? 'on' : 'off'} · {unit.status === 'active' ? `facing ${unit.facing}` : unit.status}{unit.stunned ? ' · stunned' : ''}{unit.reloading ? ' · reloading' : ''}</div>
      {contact && <p className="mt-1 text-[#a3abc2]">{unit.talkHit ? `Talk · ${labelOf(state, contact.actor)}` : contact.hint}</p>}
      {unit.windup && <p className="text-[#ffb84d]">Preparing a shot at {labelOf(state, unit.windup.target)}</p>}
      {unit.suppressed && <p className="text-[#ffb84d]">Suppressed · reactions blocked</p>}
    </Panel>
  )
}

function StrikeLine({ state, s, title }: { state: BattleState; s: StrikeForecast; title: string }) {
  const breaks = s.parts.filter((p) => p.breaks !== 'no')
  return (
    <div className="border-t border-white/10 pt-1">
      <div className="flex justify-between"><b>{title}: {labelOf(state, s.unit)}</b><span>{s.facing !== 'front' ? s.facing : ''}</span></div>
      <div>{s.hit}% × {s.hits} · {s.damage[0]} dmg ({s.damage[1]} crit {s.crit}%){s.guard ? ` · guard −${s.guard}%` : ''}</div>
      <div className="text-[#a3abc2]">{s.parts.slice(0, 3).map((p) => `${PART_NAME[p.part]} ${Math.round(p.chance)}%`).join(' · ')}</div>
      {breaks.length > 0 && <div className="text-[#ffb84d]">{breaks.map((p) => `${PART_NAME[p.part]} ${p.breaks === 'will' ? 'will' : 'may'} break`).join(' · ')}</div>}
      {s.hold && <div className="text-[#7ef0b0]">Hold {Math.round(s.hold.chance)}% · {s.hold.breaks === 'will' ? 'frees her' : s.hold.breaks === 'may' ? 'may free her' : 'chips it'}</div>}
    </div>
  )
}

/** The forecast card (TC29): the attack, each Crossfire and the counter, Tech %, Charge, the timeline's shift. */
export function ForecastCard({ state, f, onConfirm, onCancel, children }: { state: BattleState; f: Forecast; onConfirm: () => void; onCancel: () => void; children?: ReactNode }) {
  const charge = Object.entries(f.charge).filter(([, v]) => v !== 0)
  return (
    <Panel className="pointer-events-auto max-h-[72dvh] w-64 overflow-y-auto">
      <div data-forecast className="space-y-1">
        {f.attack && <StrikeLine state={state} s={f.attack} title={f.cover ? `Covered by ${labelOf(state, f.cover)}` : f.signature ?? 'Attack'} />}
        {f.splash && <div className="text-[#ffb84d]">On hit · {f.splash.damage} splash to {f.splash.targets.map((id) => labelOf(state, id)).join(', ')}</div>}
        {f.suppression && <div className="text-[#ffb84d]">
          On hit · Suppress {f.suppression.targets.map((id) => labelOf(state, id)).join(', ')}
          {!!f.suppression.interrupts.length && <div>Interrupt {f.suppression.interrupts.map((id) => labelOf(state, id)).join(', ')}</div>}
        </div>}
        {f.crossfire.map((c) => <StrikeLine key={c.unit} state={state} s={c} title={`Crossfire (${c.how})`} />)}
        {f.counter && <StrikeLine state={state} s={f.counter} title="Counter" />}
        {f.tech && <div>{f.tech.tech}: {f.tech.chance}%</div>}
        {Object.keys(f.skills).length > 0 && <div className="text-[#a3abc2]">{Object.entries(f.skills).map(([k, v]) => `${k} ${v}%`).join(' · ')}</div>}
        {charge.length > 0 && <div className="text-[#a3abc2]">Charge: {charge.map(([id, v]) => `${labelOf(state, id)} ${v > 0 ? `−${v}` : `+${-v}`}`).join(' · ')}</div>}
        {f.volley && <div className="text-[#ff3d6e]">Volley marked on {f.volley.tiles.length} tiles</div>}
      </div>
      {children}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-md bg-white/10 font-semibold">Back</button>
        <button type="button" onClick={onConfirm} className="min-h-11 flex-1 rounded-md bg-[#2ee6ff] font-display font-bold text-[#0b0d17]">Confirm</button>
      </div>
    </Panel>
  )
}

export interface Doll { key: number; unit: string; at: { x: number; y: number }; text: string; parts: Record<'core' | 'leftArm' | 'rightArm' | 'legs', [number, number]>; side: 'squad' | 'enemy' }

/** The paper doll that pops above a hit unit (TC28): the damage, and her four parts. */
export function PaperDoll({ d }: { d: Doll }) {
  const hue = SIDE_HUE[d.side]
  const cell = (p: keyof Doll['parts']) => {
    const [hp, max] = d.parts[p]
    return <span className="block h-2 w-3 rounded-sm" style={{ background: hp <= 0 ? '#6b7280' : hp / max < 0.34 ? '#ff7a1a' : hue }} />
  }
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-center" style={{ left: d.at.x, top: d.at.y }}>
      <div className="font-display text-[15px] font-bold text-white [text-shadow:0_1px_2px_#000]">{d.text}</div>
      <div className="mx-auto grid w-10 grid-cols-3 justify-items-center gap-0.5 rounded bg-black/60 p-0.5">
        <span />{cell('core')}<span />{cell('leftArm')}<span />{cell('rightArm')}<span />{cell('legs')}<span />
      </div>
    </div>
  )
}

/** The terrain card on a long press (TC24). */
export function TerrainPanel({ card, onClose }: { card: TerrainCard; onClose: () => void }) {
  return (
    <Panel className="pointer-events-auto w-60">
      <div className="mb-1 flex items-center justify-between">
        <b>Tile {card.tile[0]},{card.tile[1]} · height {card.height}</b>
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-[#a3abc2]" aria-label="Close">✕</button>
      </div>
      <div>{card.ground}{card.state ? ` · ${card.state}${card.rounds ? ` (${card.rounds} rounds)` : ''}` : ''}{card.live ? ' · live' : ''}</div>
      {card.effects.map((e) => <div key={e} className="text-[#a3abc2]">{e}</div>)}
      {card.changes.length > 0 && <div className="mt-1 text-[11px] text-[#6d7590]">Can change: {card.changes.join('; ')}</div>}
    </Panel>
  )
}

export interface CutInView { attacker: string; target: string; band: string; role: string; signature?: string; speed: CutInSpeed; numbers: string[]; key: number }

/** The cut-in (TC28): a side view of the two, the Uma facing left on the right, the enemy facing right on the left, with
 * the numbers as they land. An Uma shows her bust from master data (D19); stand-ins and enemies stay cards until the
 * full-body renders and the heroines arrive. */
export function CutIn({ state, c }: { state: BattleState; c: CutInView }) {
  const a = state.units.find((u) => u.id === c.attacker), t = state.units.find((u) => u.id === c.target)
  if (!a || !t) return null
  const squad = a.side === 'squad' ? a : t, enemy = a.side === 'squad' ? t : a
  const card = (u: UnitState, right: boolean) => (
    <div className={`flex h-full flex-1 items-center ${right ? 'justify-end pr-[8%]' : 'justify-start pl-[8%]'}`}>
      <div className="flex h-[70%] w-[22%] min-w-24 flex-col items-center justify-end rounded-xl border-2 pb-2 font-display text-[13px] font-bold"
        style={{ borderColor: SIDE_HUE[u.side], color: SIDE_HUE[u.side], background: `linear-gradient(${right ? 270 : 90}deg, ${SIDE_HUE[u.side]}33, transparent)`, transform: right ? 'scaleX(1)' : 'scaleX(1)' }}>
        {umaOf(state, u.id)
          ? <div className="mb-1 min-h-0 w-full flex-1 overflow-hidden"><UmaBust outfitId={umaOf(state, u.id)!} label={labelOf(state, u.id)} size={160} className="mx-auto h-full w-auto" /></div>
          : <span className="mb-auto mt-2 text-[28px]">{right ? '◀' : '▶'}</span>}
        {labelOf(state, u.id)}
      </div>
    </div>
  )
  const full = c.speed === 'full'
  return (
    <div data-cut-in className={`pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col ${full ? 'h-[62%]' : 'h-[34%]'} bg-gradient-to-r from-black/80 via-[#141827]/85 to-black/80`}>
      <div className="flex h-full">{card(enemy, false)}{card(squad, true)}</div>
      <div className="absolute inset-x-0 top-2 text-center font-display text-[13px] font-bold uppercase tracking-widest text-white/80">{c.signature ?? (c.role === 'main' ? c.band : `${c.role} · ${c.band}`)}</div>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-3 font-display text-[20px] font-bold text-white [text-shadow:0_1px_3px_#000]">{c.numbers.map((n, i) => <span key={i}>{n}</span>)}</div>
    </div>
  )
}
