// The squads on the Quarters deck (CY18, TC69): a row a squad (its banner, its name to rename, its cohesion and the
// battles to the next level, its leader, away on an operation), its members to move, and the crew in no squad.
import { cohesionLevel, SQUAD_TUNING, type Save, type Squad } from '@cyber/domain'
import { useState } from 'react'
import { updateSave } from '../save/game'
import { editSquad, moveProblem, moveToSquad } from './squads'

export const BANNER_COLOR: Record<string, string> = { cyan: '#2ee6ff', magenta: '#ff3dc8', amber: '#ffb84d', lime: '#7ef0b0' }

/** Cohesion in words: the level and the battles fought together to the next one. */
export function cohesionWords(s: Squad): string {
  const level = cohesionLevel(s.cohesion), next = SQUAD_TUNING.cohesion[level]
  return next === undefined ? `Cohesion ${level} (max)` : `Cohesion ${level} · ${next - s.cohesion} battle${next - s.cohesion === 1 ? '' : 's'} to ${level + 1}`
}

export function SquadsPanel({ save, nameOf }: { save: Save; nameOf: (outfit: number) => string }) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')
  const loose = save.crew.map((m) => m.outfit).filter((o) => !save.squads.some((s) => s.members.includes(o)))
  const move = (outfit: number, to: string) => void updateSave((s) => moveToSquad(s, outfit, to === 'none' ? null : to))
  const picker = (outfit: number, current: string | null) => (
    <select aria-label={`Move ${nameOf(outfit)}`} value={current ?? 'none'} onChange={(e) => move(outfit, e.target.value)} className="min-h-9 rounded bg-[#0b0d17] px-1 text-[12px] ring-1 ring-white/15">
      {save.squads.map((s) => <option key={s.id} value={s.id} disabled={!!moveProblem(save, outfit, s.id)}>{s.name}</option>)}
      <option value="new" disabled={!!moveProblem(save, outfit, 'new')}>A new squad</option>
      <option value="none">No squad</option>
    </select>
  )
  return (
    <div data-squads className="mt-3 rounded-lg bg-[#141827] p-3 text-[13px] ring-1 ring-white/10">
      <div className="mb-1 flex items-baseline gap-2"><span className="font-display font-bold">Squads</span>
        <span className="text-white/50">Up to {SQUAD_TUNING.maxSquads} of {SQUAD_TUNING.maxMembers}; a squad grows cohesion fighting with three or more of its members.</span></div>
      {save.squads.map((s) => {
        const away = save.operations.find((r) => r.squad === s.id)
        return (
          <div key={s.id} data-squad={s.id} className="mb-1.5 flex flex-wrap items-center gap-2 rounded-md bg-white/5 p-2" style={{ borderLeft: `4px solid ${BANNER_COLOR[s.banner] ?? '#2ee6ff'}` }}>
            {renaming === s.id ? (
              <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); void updateSave((x) => editSquad(x, s.id, { name })); setRenaming(null) }}>
                <input aria-label="Squad name" autoFocus maxLength={24} value={name} onChange={(e) => setName(e.target.value)} className="min-h-9 w-36 rounded bg-[#0b0d17] px-2 ring-1 ring-white/20" />
                <button type="submit" className="min-h-9 rounded bg-[#2ee6ff] px-2 font-bold text-[#0b0d17]">Save</button>
              </form>
            ) : (
              <button type="button" data-rename={s.id} onClick={() => { setRenaming(s.id); setName(s.name) }} className="min-h-9 font-display text-[15px] font-bold" title="Rename">{s.name} ✎</button>
            )}
            <span data-cohesion={cohesionLevel(s.cohesion)} className="text-white/60">{cohesionWords(s)}</span>
            {away && <span data-away className="rounded bg-[#ffb84d]/20 px-1.5 text-[#ffb84d]">Away · back at watch {away.back}</span>}
            <div className="flex w-full flex-wrap gap-1.5">
              {s.members.map((o) => (
                <span key={o} data-squad-member={o} className="flex items-center gap-1 rounded bg-[#0b0d17]/60 px-1.5 py-0.5">
                  <button type="button" title={o === s.leader ? 'Leader' : 'Make leader'} disabled={!!away} onClick={() => void updateSave((x) => editSquad(x, s.id, { leader: o }))}
                    className={o === s.leader ? 'text-[#ffb84d]' : 'text-white/30'}>★</button>
                  {nameOf(o)} {!away && picker(o, s.id)}
                </span>
              ))}
            </div>
          </div>
        )
      })}
      {loose.length > 0 && (
        <div data-no-squad className="flex flex-wrap items-center gap-1.5 rounded-md bg-white/5 p-2">
          <span className="text-white/50">No squad:</span>
          {loose.map((o) => <span key={o} className="flex items-center gap-1 rounded bg-[#0b0d17]/60 px-1.5 py-0.5">{nameOf(o)} {picker(o, null)}</span>)}
        </div>
      )}
      {save.squads.length === 0 && loose.length === 0 && <div className="text-white/50">No squads yet.</div>}
    </div>
  )
}
