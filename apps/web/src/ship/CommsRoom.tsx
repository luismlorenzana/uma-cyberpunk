// Comms (CY18, TC70): the operations on offer on the worlds visited (two to four), each with its world, faction,
// danger, watches and reward; a squad to send and the outcome it would bring back (deterministic, so shown first); the
// squads away with the watch they're back and a recall; and this watch's reports.
import { sendProblem, STANDING_NAME, standingNow, type Outcome, type Save, type StoryPack } from '@cyber/domain'
import { useState } from 'react'
import { BANNER_COLOR, cohesionWords } from '../crew/SquadsPanel'
import { updateSave } from '../save/game'
import { expectedOutcome, offersNow, recallOperation, sendOperation } from './operations'

const OUTCOME: Record<Outcome, { word: string; color: string }> = {
  full: { word: 'Full success', color: '#7ef0b0' }, partial: { word: 'Partial: 60%, +1 Strain each', color: '#ffb84d' }, thin: { word: 'Thin: 30%, +1 Strain each', color: '#ff8fae' },
}

export function CommsRoom({ pack, save, nameOf }: { pack: StoryPack; save: Save; nameOf: (outfit: number) => string }) {
  const offers = offersNow(pack, save)
  const free = save.squads.filter((s) => !sendProblem(save, s))
  const [pick, setPick] = useState<Record<string, string>>({})
  const standing = standingNow(pack, save)
  const reports = save.log?.watch === save.watch ? save.log.reports ?? [] : []
  return (
    <div className="absolute inset-0 overflow-y-auto p-4" style={{ paddingTop: 'calc(var(--inset-top) + 64px)', paddingLeft: 'calc(var(--inset-left) + 16px)', paddingRight: 'calc(var(--inset-right) + 16px)' }}>
      <div className="grid grid-cols-[1fr_17rem] gap-3">
        <div>
          <h2 className="mb-1 font-display text-[18px] font-bold">Operations</h2>
          <p className="mb-2 text-[12px] text-white/55">A squad not deployed runs an operation and is back after its watches (a mission’s end or a jump passes one). Its members can’t deploy while away and hold their posts at half. Nobody is ever lost.</p>
          {offers.length === 0 && <p className="text-white/60">No operations on offer: visit a world first.</p>}
          {offers.map((op) => {
            const chosen = pick[op.id] ?? free[0]?.id
            const expect = chosen ? expectedOutcome(save, chosen, op) : null
            return (
              <div key={op.id} data-operation={op.id} className="mb-2 rounded-lg bg-[#141827] p-3 ring-1 ring-white/10">
                <div className="flex items-baseline gap-2"><b className="font-display text-[15px]">{op.title}</b>
                  <span className="text-[12px] text-white/50">{op.world} · danger {'◆'.repeat(op.danger)} · {op.watches} watch{op.watches > 1 ? 'es' : ''}</span></div>
                <div className="text-[12px] text-white/70">
                  Full: {[op.reward.credits && `${op.reward.credits} cr`, op.reward.alloy && `${op.reward.alloy} alloy`, op.reward.data && `${op.reward.data} data`].filter(Boolean).join(' · ')}
                  {op.faction && op.reward.standing ? <span className={op.reward.standing > 0 ? 'text-[#7ef0b0]' : 'text-[#ff8fae]'}> · {op.faction} {op.reward.standing > 0 ? '+' : ''}{op.reward.standing} standing</span> : null}
                </div>
                {free.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select aria-label="Squad to send" value={chosen} onChange={(e) => setPick((p) => ({ ...p, [op.id]: e.target.value }))} className="min-h-10 rounded bg-[#0b0d17] px-2 text-[13px] ring-1 ring-white/15">
                      {free.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.members.length})</option>)}
                    </select>
                    {expect && <span data-expect={expect} className="text-[12px] font-semibold" style={{ color: OUTCOME[expect].color }}>{OUTCOME[expect].word}</span>}
                    <button type="button" data-send={op.id} className="ml-auto min-h-10 rounded-md bg-[#2ee6ff] px-4 font-display font-bold text-[#0b0d17]"
                      onClick={() => chosen && void updateSave((s) => sendOperation(pack, s, chosen, op.id))}>Send</button>
                  </div>
                ) : <div className="mt-2 text-[12px] text-white/45">No squad free to send (away, resting or in a mission). Make squads on the Quarters deck.</div>}
              </div>
            )
          })}
        </div>
        <div className="space-y-3">
          <div className="rounded-lg bg-[#141827] p-3 ring-1 ring-white/10">
            <div className="mb-1 font-display font-bold">Away</div>
            {save.operations.length === 0 ? <div className="text-[12px] text-white/50">No squad is away.</div> : save.operations.map((r) => {
              const s = save.squads.find((x) => x.id === r.squad)
              return (
                <div key={r.squad} data-running={r.id} className="mb-1.5 rounded-md bg-white/5 p-2 text-[12px]" style={{ borderLeft: `4px solid ${BANNER_COLOR[s?.banner ?? 'cyan']}` }}>
                  <b>{s?.name ?? r.squad}</b> · {r.id}<div className="text-white/60">Back at watch {r.back} (in {Math.max(0, r.back - save.watch)}) · {s ? s.members.map(nameOf).join(', ') : ''}</div>
                  <button type="button" data-recall={r.squad} className="mt-1 min-h-9 rounded bg-white/10 px-2 font-semibold" onClick={() => void updateSave((x) => recallOperation(pack, x, r.squad))}>Recall now (thin)</button>
                </div>
              )
            })}
          </div>
          <div className="rounded-lg bg-[#141827] p-3 ring-1 ring-white/10">
            <div className="mb-1 font-display font-bold">Squads</div>
            {save.squads.map((s) => <div key={s.id} className="text-[12px]"><b style={{ color: BANNER_COLOR[s.banner] }}>{s.name}</b> <span className="text-white/55">{cohesionWords(s)}</span></div>)}
          </div>
          <div data-standing className="rounded-lg bg-[#141827] p-3 ring-1 ring-white/10">
            <div className="mb-1 font-display font-bold">Standing</div>
            {Object.entries(standing).map(([f, v]) => <div key={f} className="text-[12px]">{f}: <b>{STANDING_NAME[String(v)]}</b></div>)}
          </div>
          {reports.length > 0 && (
            <div className="rounded-lg bg-[#141827] p-3 ring-1 ring-white/10">
              <div className="mb-1 font-display font-bold">This watch</div>
              {reports.map((r) => <div key={r.op} data-comms-report={r.op} className="text-[12px]" style={{ color: OUTCOME[r.outcome].color }}>{r.text}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
