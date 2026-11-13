// The Hangar (CY11, TC17, TC18): her rig's eight slots and a Coat, the Capacity bar against the total Load with the +1
// Move mark at 70%, every part's numbers shown before a swap (part HP, Move, Capacity left, hit and damage), three saved
// loadouts and "best for her role". The rules are @cyber/battle's, read through @cyber/domain's `rigStats`.
import {
  bestRig, loadOfPart, MAX_PRESETS, PARTS_BY_ID, partsFor, RIG_SLOTS, rigStats, ROLE_NAME, savePreset, SLOT_KIND, SLOT_NAME, wearPreset, type Part, type Rig,
  type RigSlot, type RigStats,
} from '@cyber/domain'
import { TUNING } from '@cyber/battle'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { updateSave } from '../save/game'
import { useCrew } from './useCrew'
import { updateMember, type CrewView } from './view'

const OPTIONAL: ReadonlySet<RigSlot> = new Set(['back', 'leftHand', 'rightHand', 'coat'])
const hpTotal = (s: RigStats) => s.hp.core + s.hp.leftArm + s.hp.rightArm + s.hp.legs
const twoHanded = (p: Part | undefined) => p?.slot === 'hand' && p.item.kind === 'weapon' && !!p.item.twoHanded

/** A rig with one slot changed; a two-handed weapon in the right hand empties the left. */
export function swapped(rig: Rig, slot: RigSlot, id: string | null): Rig {
  const next = { ...rig, [slot]: id } as Rig
  if (slot === 'rightHand' && twoHanded(id ? PARTS_BY_ID.get(id) : undefined)) next.leftHand = null
  if (slot === 'leftHand' && id && twoHanded(rig.rightHand ? PARTS_BY_ID.get(rig.rightHand) : undefined)) next.rightHand = null
  return next
}

export function Hangar() {
  const { crew } = useCrew()
  const [params, setParams] = useSearchParams()
  const [slot, setSlot] = useState<RigSlot | null>(null)
  if (crew.length === 0) return <div className="flex h-full items-center justify-center p-10 text-center text-white/60">No one is aboard yet: the crew comes aboard through the story.</div>
  const view = crew.find((c) => String(c.outfit) === params.get('uma')) ?? crew[0]!
  const wear = (rig: Rig) => void updateSave((s) => updateMember(s, view.outfit, (m) => ({ ...m, rig })))
  return (
    <div data-hangar={view.outfit} className="flex h-full flex-col gap-2" style={{ padding: 'calc(var(--inset-top) + 64px) calc(var(--inset-right) + 14px) calc(var(--inset-bottom) + 10px) calc(var(--inset-left) + 14px)' }}>
      <div className="flex gap-1.5 overflow-x-auto">
        {crew.map((c) => (
          <button key={c.outfit} type="button" data-pick={c.outfit} aria-pressed={c.outfit === view.outfit} onClick={() => { setParams({ uma: String(c.outfit) }, { replace: true }); setSlot(null) }}
            className={`min-h-11 shrink-0 rounded-md px-3 text-[13px] font-semibold ${c.outfit === view.outfit ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10'}`}>
            {c.name} <span className="font-normal opacity-70">{ROLE_NAME[c.role]}</span>{c.stats.problem ? ' ⚠' : ''}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex w-[44%] shrink-0 flex-col gap-2 overflow-y-auto">
          <CapacityBar stats={view.stats} />
          <div className="rounded-xl bg-[#141827] p-1 ring-1 ring-white/10">
            {RIG_SLOTS.map((s) => {
              const p = view.rig[s] ? PARTS_BY_ID.get(view.rig[s]!) : undefined
              return (
                <button key={s} type="button" data-slot={s} aria-pressed={slot === s} onClick={() => setSlot(slot === s ? null : s)}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] ${slot === s ? 'bg-[#2ee6ff]/20 ring-1 ring-[#2ee6ff]' : ''}`}>
                  <span className="w-20 shrink-0 text-white/50">{SLOT_NAME[s]}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{p?.name ?? 'Empty'}</span>
                  <span className="text-white/50">{p ? loadOfPart(p) : 0}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" data-best className="min-h-11 rounded-md bg-[#2ee6ff] px-3 font-display text-[14px] font-bold text-[#0b0d17]" onClick={() => wear(bestRig(view.role, view.bands))}>Best for her role</button>
            {view.auto && <span className="flex items-center text-[12px] text-white/50">Wearing the best for her role</span>}
          </div>
          <Presets view={view} onWear={(i) => void updateSave((s) => updateMember(s, view.outfit, (m) => wearPreset(m, i)))} />
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto rounded-xl bg-[#141827] p-3 ring-1 ring-white/10">
          {slot ? <Picker view={view} slot={slot} onPick={(id) => wear(swapped(view.rig, slot, id))} /> : <Summary view={view} />}
        </div>
      </div>
    </div>
  )
}

function CapacityBar({ stats }: { stats: RigStats }) {
  const scale = Math.max(stats.capacity, stats.load)
  const color = stats.over ? '#ff3d6e' : stats.light ? '#2ee6ff' : '#ffb84d'
  return (
    <div data-capacity className="rounded-xl bg-[#141827] p-2 ring-1 ring-white/10">
      <div className="flex justify-between text-[13px]"><b>Load {stats.load} / Capacity {stats.capacity}</b><span style={{ color }}>{stats.over ? `Over by ${-stats.left}: she can't deploy` : stats.light ? '+1 Move: a light rig' : `${stats.left} left`}</span></div>
      <div className="relative mt-1 h-3 rounded-full bg-white/10">
        <div className="h-3 rounded-full" style={{ width: `${(stats.load / scale) * 100}%`, background: color }} />
        <div className="absolute top-[-3px] h-[18px] w-0.5 bg-white/70" style={{ left: `${(stats.capacity * TUNING.lightRigPct / 100 / scale) * 100}%` }} title="70%: +1 Move at or under" />
        {stats.over && <div className="absolute top-[-3px] h-[18px] w-0.5 bg-white" style={{ left: `${(stats.capacity / scale) * 100}%` }} />}
      </div>
    </div>
  )
}

const delta = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')
const tone = (n: number, goodUp = true) => (n === 0 ? 'text-white/40' : (n > 0) === goodUp ? 'text-[#7ef0b0]' : 'text-[#ff8fae]')

function Picker({ view, slot, onPick }: { view: CrewView; slot: RigSlot; onPick: (id: string | null) => void }) {
  const options: (Part | null)[] = [...(OPTIONAL.has(slot) ? [null] : []), ...partsFor(SLOT_KIND[slot]).filter((p) => !(slot === 'leftHand' && twoHanded(p)))]
  return (
    <div data-picker={slot} className="space-y-1">
      <div className="text-[12px] uppercase tracking-widest text-white/50">{SLOT_NAME[slot]}: each part's numbers if she wears it</div>
      {options.map((p) => {
        const id = p?.id ?? null
        const after = rigStats(swapped(view.rig, slot, id), view.bands)
        const worn = view.rig[slot] === id
        const weapons = after.weapons.filter((w) => (slot === 'back' ? w.mount === 'Back unit' : slot === 'leftHand' ? w.mount === 'Left hand' : slot === 'rightHand' ? w.mount === 'Right hand' : false))
        return (
          <button key={id ?? 'none'} type="button" data-part={id ?? 'none'} onClick={() => onPick(id)} aria-pressed={worn}
            className={`w-full rounded-lg p-2 text-left text-[13px] ${worn ? 'bg-[#2ee6ff]/15 ring-1 ring-[#2ee6ff]' : 'bg-white/5'}`}>
            <div className="flex justify-between gap-2"><b>{p?.name ?? 'Empty'}{worn ? ' · worn' : ''}</b><span className="text-white/50">Load {p ? loadOfPart(p) : 0}</span></div>
            {p && <div className="text-white/60">{p.note}</div>}
            <div className="mt-0.5 flex flex-wrap gap-x-3">
              <span className={tone(hpTotal(after) - hpTotal(view.stats))}>HP {delta(hpTotal(after) - hpTotal(view.stats))}</span>
              <span className={tone(after.move - view.stats.move)}>Move {after.move} ({delta(after.move - view.stats.move)})</span>
              <span className={after.over ? 'text-[#ff8fae]' : 'text-white/70'}>Capacity left {after.left}</span>
              {after.guard !== view.stats.guard && <span className={tone(after.guard - view.stats.guard)}>Guard {after.guard}%</span>}
              {weapons.map((w) => <span key={w.mount} className="text-white/80">{w.hit}% × {w.damage}{w.hits > 1 ? ` × ${w.hits}` : ''}</span>)}
              {after.problem && !after.over && <span className="text-[#ff8fae]">{after.problem}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Summary({ view }: { view: CrewView }) {
  const s = view.stats
  return (
    <div data-summary className="space-y-2 text-[13px]">
      <div className="text-[12px] uppercase tracking-widest text-white/50">{view.name}'s rig · tap a slot to swap</div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {([['Core', s.hp.core], ['Left arm', s.hp.leftArm], ['Right arm', s.hp.rightArm], ['Legs', s.hp.legs]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/5 p-2"><div className="text-white/50">{k} HP</div><div className="font-display text-lg font-bold">{v}</div></div>
        ))}
      </div>
      <div>Move <b>{s.move}</b>{s.light ? ' (light: +1)' : ''} · Guard <b>{s.guard}%</b> · Capacity left <b>{s.left}</b></div>
      <table className="w-full text-left">
        <thead className="text-white/50"><tr><th className="py-1">Weapon</th><th>Band</th><th>Hit</th><th>Damage</th></tr></thead>
        <tbody>{s.weapons.map((w) => <tr key={w.mount} className="border-t border-white/10"><td className="py-1">{w.name} <span className="text-white/50">({w.mount})</span></td><td className="capitalize">{w.band}</td><td>{w.hit}%</td><td>{w.damage}{w.hits > 1 ? ` × ${w.hits}` : ''}</td></tr>)}</tbody>
      </table>
      <p className="text-white/50">Hit is before her target's evasion and Cover; damage a hit is before facing, height and Coats.</p>
      {s.problem && <p data-problem className="rounded-md bg-[#ff3d6e]/15 p-2 text-[#ffb3c6]">{s.problem}: she can't deploy like this.</p>}
    </div>
  )
}

function Presets({ view, onWear }: { view: CrewView; onWear: (i: number) => void }) {
  const [name, setName] = useState('')
  return (
    <div data-presets className="rounded-xl bg-[#141827] p-2 ring-1 ring-white/10">
      <div className="mb-1 flex items-center gap-2 text-[13px]"><b>Saved loadouts</b>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Name" className="min-h-9 w-32 rounded-md bg-white/10 px-2 text-[13px]" />
      </div>
      {Array.from({ length: MAX_PRESETS }, (_, i) => {
        const p = view.member.presets[i]
        const canSave = i <= view.member.presets.length
        return (
          <div key={i} className="flex items-center gap-1.5 py-0.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate">{p ? p.name : <span className="text-white/40">Empty</span>}</span>
            <button type="button" data-save-preset={i} disabled={!canSave} className="min-h-10 rounded-md bg-white/10 px-2 font-semibold disabled:opacity-30"
              onClick={() => { void updateSave((s) => updateMember(s, view.outfit, (m) => savePreset(m, i, name, view.rig))); setName('') }}>Save here</button>
            <button type="button" data-wear-preset={i} disabled={!p} className="min-h-10 rounded-md bg-white/10 px-2 font-semibold disabled:opacity-30" onClick={() => onWear(i)}>Wear</button>
          </div>
        )
      })}
    </div>
  )
}
