// The Bridge's readiness meter (CY18, TC64, TC71): the ship's readiness total for the next finale, that finale's needs
// met or not (each unmet one's harsh condition named), and each faction's standing. Folds to one chip.
import { STANDING_NAME, SQUAD_TUNING, readinessNow, standingNow, systemsBuilt, MODULES_BY_ID, type FinaleCondition, type ReadinessNeed, type Save, type StoryPack } from '@cyber/domain'
import { useState } from 'react'
import { finaleNeeds, nextFinale } from '../mission/director'

export const CONDITION_NAME: Record<FinaleCondition, string> = { fog: 'fog: the map hidden for three rounds', hazards: 'a hull breach: fire across the middle', 'no-reinforcements': 'no reinforcements from the bench' }

/** A readiness need in words. */
export function needWords(n: ReadinessNeed): string {
  if ('system' in n) return `${MODULES_BY_ID.get(n.system as never)?.name ?? n.system} built`
  if ('standing' in n) return `${n.standing} at ${STANDING_NAME[String(n.at)]}`
  return `Readiness ${n.total}`
}

export function ReadinessCard({ pack, save }: { pack: StoryPack; save: Save }) {
  const [open, setOpen] = useState(false)
  const total = readinessNow(pack, save)
  const finale = nextFinale(pack, save)
  const needs = finale ? finaleNeeds(pack, save, finale.mission) : []
  const unmet = needs.filter((n) => !n.met).length
  const standing = standingNow(pack, save)
  return (
    <div data-readiness={total} className="absolute z-10 w-64 rounded-xl bg-[#141827]/95 p-2 text-[12px] ring-1 ring-white/15" style={{ top: 'calc(var(--inset-top) + 8px)', right: 'calc(var(--inset-right) + 8px)' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-9 w-full items-center gap-2 text-left">
        <b className="font-display text-[14px]">Readiness {total}</b>
        {finale && <span className={unmet ? 'text-[#ffb84d]' : 'text-[#7ef0b0]'}>{unmet ? `${unmet} unmet` : 'ready'}</span>}
        <span className="ml-auto text-white/40">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="mt-1 space-y-2">
          <div className="text-white/55">Standing above Hostile ×{SQUAD_TUNING.readiness.standing}, operations won ×{SQUAD_TUNING.readiness.operation} ({save.operationsWon.length}), battle systems ×{SQUAD_TUNING.readiness.system} ({systemsBuilt(save).length}).</div>
          {finale && (
            <div data-finale={finale.mission.id}>
              <div className="font-semibold">Next finale: {finale.mission.id}</div>
              {needs.map((n, i) => (
                <div key={i} data-need={n.met ? 'met' : 'unmet'} className={n.met ? 'text-[#7ef0b0]' : 'text-[#ffb84d]'}>{n.met ? '✓' : '✗'} {needWords(n.need)}{n.met ? '' : ` · else ${CONDITION_NAME[n.need.else]}`}</div>
              ))}
            </div>
          )}
          <div data-standings>
            {Object.entries(standing).map(([f, v]) => (
              <div key={f} className="flex items-center gap-2"><span className="w-24 truncate">{f}</span>
                <span className="flex gap-0.5">{[-2, -1, 0, 1, 2].map((k) => <i key={k} className="block h-2 w-4 rounded-sm" style={{ background: k <= v ? (v < 0 ? '#ff8fae' : '#7ef0b0') : '#ffffff1a' }} />)}</span>
                <span className="text-white/60">{STANDING_NAME[String(v)]}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
