// The ship's two cards (CY16): the ship-log card after a watch (every post's output, already applied: one tap closes
// it) and a jump's event card (two or three choices, each resolved by who holds a named post; skippable).
import { postKind, POSTS, type Save, type StoryPack } from '@cyber/domain'
import { useState } from 'react'
import type { CrewView } from '../crew/view'
import { updateSave, useGame } from '../save/game'
import { answerEvent, currentEvent, skipEvent } from './duties'

const primary = 'min-h-11 rounded-md bg-[#2ee6ff] px-4 font-display font-bold text-[#0b0d17]'
const btn = 'min-h-11 rounded-md bg-white/10 px-3 text-[14px] font-semibold'
const frame = 'absolute left-1/2 top-1/2 z-30 max-h-[80%] w-[min(30rem,86%)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-[#141827] p-4 ring-1 ring-[#2ee6ff]/40'

export function LogCard({ save, nameOf }: { save: Save; nameOf: (outfit: number) => string }) {
  const log = save.log
  if (!log || log.read) return null
  const g = log.gains
  return (
    <div data-ship-log={log.watch} className={frame}>
      <h2 className="font-display text-[20px] font-bold">Ship log · watch {log.watch}</h2>
      <p className="mb-2 text-[12px] text-white/50">Every post’s output, already applied.</p>
      <ul className="space-y-1 text-[14px]">
        {log.lines.map((l, i) => (
          <li key={i} data-log-line={l.post} className="flex gap-2"><b className="w-28 shrink-0 truncate">{nameOf(l.outfit)}</b><span className="text-white/60">{POSTS[l.post].name}</span>
            <span className="ml-auto text-right">{l.text}{l.half ? <span className="text-[#ffb84d]"> (half: deployed)</span> : null}</span></li>
        ))}
      </ul>
      {(g.credits || g.alloy || g.data) ? <div className="mt-2 text-[13px] text-[#7cf2c8]">The wallet: {[g.credits && `+${g.credits} cr`, g.alloy && `+${g.alloy} alloy`, g.data && `+${g.data} data`].filter(Boolean).join(' · ')}</div> : null}
      <button type="button" data-log-done className={`${primary} mt-3`} onClick={() => void updateSave((s) => (s.log ? { ...s, log: { ...s.log, read: true } } : s), { quiet: true })}>Done</button>
    </div>
  )
}

export function EventCard({ save, pack, crew, nameOf }: { save: Save; pack: StoryPack | null; crew: readonly CrewView[]; nameOf: (outfit: number) => string }) {
  const [result, setResult] = useState<string | null>(null)
  const ev = currentEvent(save, pack)
  if (result) return (
    <div data-event-result className={frame}>
      <p className="text-[15px] italic">{result}</p>
      <button type="button" className={`${primary} mt-3`} onClick={() => setResult(null)}>Done</button>
    </div>
  )
  if (!ev) return null
  return (
    <div data-event={ev.id} className={frame}>
      <h2 className="font-display text-[20px] font-bold">{ev.title}</h2>
      <p className="mb-3 text-[14px] text-white/80">{ev.text}</p>
      <div className="space-y-1.5">
        {ev.choices.map((c, i) => {
          const holder = c.check ? save.crew.find((m) => m.post && postKind(m.post) === c.check!.post) : undefined
          return (
            <button key={i} type="button" data-choice={i} className={`${btn} w-full text-left`} onClick={() => {
              const now = useGame.getState().save
              const r = now ? answerEvent(now, pack, crew, i) : null
              if (!r) return
              setResult(r.text)
              void updateSave(() => r.save)
            }}>
              {c.text}
              {c.check && <span className="block text-[12px] font-normal text-white/55">{POSTS[c.check.post].name}’s {c.check.band} {c.check.at}+: {holder ? nameOf(holder.outfit) : 'no one posted'}</span>}
            </button>
          )
        })}
      </div>
      <button type="button" data-event-skip className="mt-2 text-[13px] text-white/50" onClick={() => void updateSave(skipEvent)}>Skip</button>
    </div>
  )
}
