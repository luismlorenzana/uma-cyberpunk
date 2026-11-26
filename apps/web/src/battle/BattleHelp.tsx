import { useEffect, useId, useRef, useState } from 'react'
import { battleHelp, type BattleTopic } from './help'

export function BattleHelp({ topic, version = Infinity, detail, disabled = false }: {
  topic?: BattleTopic; version?: number; detail?: string; disabled?: boolean
}) {
  const button = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const title = useId()
  const [open, setOpen] = useState(false)
  const [selected, select] = useState<BattleTopic | undefined>(topic)
  useEffect(() => {
    const sheet = dialog.current
    if (!open || !sheet) return
    const trigger = button.current
    sheet.showModal()
    close.current?.focus()
    return () => {
      sheet.close()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [open])
  const entries = (Object.keys(battleHelp) as BattleTopic[]).filter(key => (battleHelp[key][2] ?? 1) <= version)
  if (topic && !entries.includes(topic)) return null
  const name = topic ? `About ${battleHelp[topic][0]}` : 'Battle Help'
  return <>
    <button ref={button} type="button" aria-label={name} title={name} disabled={disabled}
      className="pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-cyan-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-100 disabled:opacity-40"
      onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); select(topic); setOpen(true) }}>
      <span aria-hidden="true" className="text-base">ⓘ</span>{!topic && <span className="pr-2 text-sm">Battle Help</span>}
    </button>
    {open && <dialog ref={dialog} aria-labelledby={title} className="fixed inset-0 m-auto max-h-[80dvh] w-[min(34rem,80vw)] overflow-y-auto overscroll-contain rounded-xl border border-cyan-200/35 bg-[#101b2d] p-4 text-white shadow-xl backdrop:bg-black/70"
      onCancel={event => { event.preventDefault(); setOpen(false) }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={title} className="text-lg font-bold">{selected ? battleHelp[selected][0] : 'Battle Help'}</h2>
        <button ref={close} type="button" className="min-h-11 min-w-11 rounded-lg bg-white/10 px-2" onClick={() => setOpen(false)}>Close</button>
      </div>
      {selected ? <div className="space-y-2 py-2 text-sm">
        <p>{battleHelp[selected][1]}</p>
        {selected === topic && detail && <p className="text-cyan-200">{detail}</p>}
        <button type="button" className="min-h-11 text-cyan-200" onClick={() => select(undefined)}>All topics</button>
      </div> : <ul className="grid grid-cols-2 gap-1 pt-2 text-sm">
        {entries.map(key => <li key={key}><button type="button" className="min-h-11 w-full rounded-lg bg-white/5 px-2 text-left hover:bg-white/10"
          onClick={() => select(key)}>{battleHelp[key][0]}</button></li>)}
      </ul>}
    </dialog>}
  </>
}
