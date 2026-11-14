// The ship's quick look, build sheet and Lab (CY15), loaded on the first tap on the decks (`Hull.tsx`).
import {
  BRANCH_NAME, buildSlots, CAPABILITY_NAME, installedSystems, MODULES, MODULES_BY_ID, moduleAt, PROJECTS, PROJECTS_BY_ID, placeProblem, reactorPips,
  researchProblem, ROOM_IDS, upgradeProblem, type Branch, type RoomId, type Save,
} from '@cyber/domain'
import { useNavigate } from 'react-router'
import { updateSave } from '../save/game'
import { placeOnShip, researchOnShip, upgradeOnShip } from './build'
import { costText, type Pick } from './Hull'

const btn = 'min-h-11 rounded-md bg-white/10 px-3 text-[14px] font-semibold disabled:opacity-40'
const primary = 'min-h-11 rounded-md bg-[#2ee6ff] px-4 font-display font-bold text-[#0b0d17] disabled:opacity-40'

export default function ShipSheet({ save, pick, setPick }: { save: Save; pick: Pick; setPick: (p: Pick | null) => void }) {
  const navigate = useNavigate()
  const ship = save.ship
  const frame = (title: string, body: React.ReactNode) => (
    <div data-sheet={pick.kind} className="absolute z-20 max-h-[78%] w-[min(25rem,46%)] overflow-y-auto rounded-xl bg-[#141827]/97 p-3 ring-1 ring-white/15" style={{ bottom: 'calc(var(--inset-bottom) + 10px)', left: 'calc(var(--inset-left) + 10px)' }}>
      <div className="flex items-center justify-between"><b className="font-display text-[18px]">{title}</b><button type="button" onClick={() => setPick(null)} className="min-h-11 min-w-11 text-white/60" aria-label="Close">✕</button></div>
      {body}
    </div>
  )
  if (pick.kind === 'slot') {
    const options = MODULES.filter((m) => ship.unlocked.includes(m.id) && !moduleAt(ship, m.id))
    return frame(`Build on deck ${pick.deck + 1}`, (
      <div className="space-y-1.5">
        <p className="text-[12px] text-white/55">Builds at once: {ship.modules.filter((m) => m.building).length} of {buildSlots(ship)}. A module builds over its watches; nothing costs upkeep.</p>
        {options.length === 0 && <p className="text-[13px] text-white/60">Nothing unlocked to build: research and the story unlock more.</p>}
        {options.map((m) => {
          const problem = placeProblem(ship, save.wallet, m.id, pick.deck, pick.slot)
          return (
            <div key={m.id} data-build-option={m.id} className="rounded-lg bg-white/5 p-2 text-[13px]">
              <div className="flex items-center gap-2"><b className="flex-1">{m.name}{m.width === 2 ? ' (two slots)' : ''}{m.kind === 'system' ? ` · ${m.pips} pip${m.pips === 1 ? '' : 's'}` : ''}</b>
                <button type="button" data-build={m.id} className={primary} disabled={!!problem} onClick={() => { void updateSave((s) => placeOnShip(s, m.id, pick.deck, pick.slot)); setPick({ kind: 'module', id: m.id }) }}>Build</button></div>
              <div className="text-white/70">{m.levels[0].adds}</div>
              <div className="text-white/50">{costText(m.levels[0].cost)} · {m.levels[0].watches} watch{m.levels[0].watches === 1 ? '' : 'es'}{problem ? ` · ${problem}` : ''}</div>
            </div>
          )
        })}
      </div>
    ))
  }
  if (pick.kind === 'lab') return frame('The Lab', <Lab save={save} />)
  const m = moduleAt(ship, pick.id)!, def = MODULES_BY_ID.get(pick.id)!
  const next = m.level < 3 ? def.levels[m.level]! : null
  const problem = upgradeProblem(ship, save.wallet, pick.id)
  const caps = def.capability?.slice(0, m.level).filter(Boolean) as string[] | undefined
  return frame(`${def.name} · level ${m.level}`, (
    <div className="space-y-2 text-[13px]">
      {m.building && <div className="text-[#ffb84d]">Building level {m.building.level}: {m.building.left} watch{m.building.left === 1 ? '' : 'es'} left.</div>}
      {m.level > 0 && <div className="text-white/80">{def.levels[m.level - 1]!.adds}</div>}
      {def.kind === 'system' && <div className="text-white/60">A battle system: {def.pips} reactor pip{def.pips === 1 ? '' : 's'} when powered for a sortie (the deploy screen).</div>}
      {pick.id === 'engineering' && <div className="text-white/60">The reactor: {reactorPips(ship)} pips. Builds at once: {buildSlots(ship)}. Installed systems: {installedSystems(ship).map((s) => MODULES_BY_ID.get(s)!.name).join(', ') || 'none'}.</div>}
      {caps && caps.length > 0 && <div className="text-[#7cf2c8]">Opens on the map: {[...new Set(caps)].map((c) => CAPABILITY_NAME[c] ?? c).join(', ')}</div>}
      {next && !m.building && (
        <div className="rounded-lg bg-white/5 p-2">
          <div><b>Level {m.level + 1}:</b> {next.adds}</div>
          <div className="text-white/50">{costText(next.cost)} · {next.watches} watch{next.watches === 1 ? '' : 'es'}{problem ? ` · ${problem}` : ''}</div>
          <button type="button" data-upgrade={pick.id} className={`${primary} mt-1`} disabled={!!problem} onClick={() => void updateSave((s) => upgradeOnShip(s, pick.id))}>Upgrade</button>
        </div>
      )}
      <div className="flex gap-2">
        {pick.id === 'lab' && m.level >= 1 && <button type="button" data-research-open className={primary} onClick={() => setPick({ kind: 'lab' })}>Research</button>}
        {ROOM_IDS.includes(pick.id as RoomId) && m.level >= 1 && <button type="button" className={btn} onClick={() => void navigate(`/room/${pick.id}`)}>Enter</button>}
      </div>
    </div>
  ))
}

function Lab({ save }: { save: Save }) {
  const ship = save.ship, cur = ship.research.current
  return (
    <div data-lab className="space-y-2 text-[13px]">
      {cur ? <div data-researching={cur.id} className="rounded-lg bg-[#2ee6ff]/10 p-2">Researching <b>{PROJECTS_BY_ID.get(cur.id)!.name}</b>: {cur.left} watch{cur.left === 1 ? '' : 'es'} left.</div>
        : <div className="text-white/60">The Lab is free. One project at a time; each costs Data and takes watches.</div>}
      {(['ship', 'rigs', 'tactics', 'quarters'] as Branch[]).map((branch) => (
        <div key={branch}>
          <div className="mb-1 text-[11px] uppercase tracking-widest text-white/45">{BRANCH_NAME[branch]}</div>
          {PROJECTS.filter((p) => p.branch === branch).map((p) => {
            const done = ship.research.done.includes(p.id), problem = done ? null : researchProblem(ship, save.wallet, p.id)
            return (
              <div key={p.id} data-project={p.id} className={`mb-1 flex items-center gap-2 rounded-md p-1.5 ${done ? 'bg-[#7cf2c8]/10' : 'bg-white/5'}`}>
                <div className="min-w-0 flex-1"><b>{p.name}</b> <span className="text-white/60">· {p.does}</span>
                  <div className="text-white/45">{done ? 'Done' : `${p.data} data · ${p.watches} watch${p.watches === 1 ? '' : 'es'}${problem ? ` · ${problem}` : ''}`}</div></div>
                {!done && <button type="button" data-start={p.id} className={btn} disabled={!!problem} onClick={() => void updateSave((s) => researchOnShip(s, p.id))}>Start</button>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
