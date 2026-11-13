// The scene player (CY9, TC36): a text box with the speaker's name and bust over the place's backdrop. A tap moves on; an
// interjection slot plays the first squad lead's line; choices are one-tap buttons, a Lead marked as one; a Call shows the
// voters' arguments. **Auto** moves on by the line's length, **Skip** passes to the next choice or the end, **Log** shows
// the scene so far. Busts: master data's by outfit id once the album is wired (CY11); stand-in cards now.
import type { Call, ChoiceOption, Scene, Speaker, Step, StoryPack } from '@cyber/domain'
import { useEffect, useRef, useState } from 'react'
import { nameOf, playScene, type SceneUi } from './runner'

type Prompt =
  | { kind: 'line'; speaker: Speaker | null; text: string; style: 'line' | 'thought' | 'narrate' }
  | { kind: 'choice'; options: readonly ChoiceOption[] }
  | { kind: 'call'; call: Call }
  | { kind: 'battle'; mission: string }

const HUE = ['#2ee6ff', '#ff3dc8', '#7ef0b0', '#ffb84d', '#a78bfa']
const hueOf = (s: Speaker) => HUE[Math.abs([...String(s)].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % HUE.length]!

/** A stand-in bust: a card in the speaker's colour with her initials. */
function Bust({ pack, speaker }: { pack: StoryPack; speaker: Speaker }) {
  const name = nameOf(pack, speaker)
  return (
    <div data-bust className="flex h-40 w-32 flex-col items-center justify-end rounded-xl border-2 pb-2 font-display text-[13px] font-bold"
      style={{ borderColor: hueOf(speaker), color: hueOf(speaker), background: `linear-gradient(180deg, ${hueOf(speaker)}22, transparent)` }}>
      <span className="mb-auto mt-4 text-[34px]">{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
      {name}
    </div>
  )
}

export function ScenePlayer({ pack, scene, squad, onEffect, onBattle, onDone }: {
  pack: StoryPack
  scene: Scene | { id: string; place: string; steps: Step[] }
  squad: readonly number[]
  onEffect: Parameters<typeof playScene>[1]['effect']
  onBattle: (mission: string) => Promise<void>
  onDone: () => void
}) {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [log, setLog] = useState<{ speaker: string; text: string }[]>([])
  const [auto, setAuto] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const skipping = useRef(false)
  const resolve = useRef<((v: number) => void) | null>(null)
  const autoRef = useRef(auto)
  autoRef.current = auto

  const advance = (v = 0) => { const r = resolve.current; resolve.current = null; r?.(v) }

  useEffect(() => {
    let live = true
    const ask = (p: Prompt) => new Promise<number>((r) => { if (!live) return; resolve.current = r; setPrompt(p) })
    const ui: SceneUi = {
      line: async (speaker, text, style) => {
        // React's development double-mount starts a second run; only the live one writes the Log.
        if (!live) return new Promise<void>(() => {})
        setLog((l) => [...l, { speaker: speaker === null ? '' : nameOf(pack, speaker), text }])
        const done = ask({ kind: 'line', speaker, text, style })
        if (autoRef.current) window.setTimeout(() => { if (resolve.current) advance() }, 900 + text.length * 45)
        await done
      },
      emote: async () => { await new Promise((r) => setTimeout(r, skipping.current ? 0 : 300)) },
      wait: async (ms) => { await new Promise((r) => setTimeout(r, Math.min(ms, 2000))) },
      choose: (options) => ask({ kind: 'choice', options }),
      call: (call) => ask({ kind: 'call', call }),
      battle: async (mission) => { await ask({ kind: 'battle', mission }); await onBattle(mission) },
      effect: onEffect,
    }
    void playScene(scene, ui, { pack, squad, skipping: () => skipping.current, stopSkipping: () => { skipping.current = false } }).then(() => { if (live) onDone() })
    return () => { live = false }
    // One run a scene.
  }, [scene.id])

  const skip = () => { skipping.current = true; if (prompt?.kind === 'line') advance() }
  return (
    <div data-scene={scene.id} className="absolute inset-0 select-none bg-gradient-to-b from-[#141827] via-[#0e1222] to-[#05060c] text-[#e8ebf5]">
      <div className="absolute left-4 top-3 text-[12px] uppercase tracking-widest text-white/50" style={{ marginTop: 'var(--inset-top)', marginLeft: 'var(--inset-left)' }}>{scene.place}</div>
      <div className="absolute right-3 top-3 flex gap-2" style={{ marginTop: 'var(--inset-top)', marginRight: 'var(--inset-right)' }}>
        <button type="button" onClick={() => setAuto((a) => !a)} className={`min-h-11 rounded-md px-3 text-[13px] font-bold ${auto ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10'}`}>Auto</button>
        <button type="button" onClick={skip} className="min-h-11 rounded-md bg-white/10 px-3 text-[13px] font-bold">Skip</button>
        <button type="button" onClick={() => setShowLog(true)} className="min-h-11 rounded-md bg-white/10 px-3 text-[13px] font-bold">Log</button>
      </div>
      {prompt?.kind === 'line' && prompt.speaker !== null && <div className="absolute bottom-[34%] left-8"><Bust pack={pack} speaker={prompt.speaker} /></div>}
      {prompt?.kind === 'line' && (
        <button type="button" data-line onClick={() => advance()} className="absolute inset-x-4 bottom-3 min-h-28 rounded-xl border border-white/15 bg-[#0b0d17]/90 p-3 text-left"
          style={{ marginBottom: 'var(--inset-bottom)', marginLeft: 'var(--inset-left)', marginRight: 'var(--inset-right)' }}>
          {prompt.speaker !== null && <div className="mb-1 font-display text-[14px] font-bold" style={{ color: hueOf(prompt.speaker) }}>{nameOf(pack, prompt.speaker)}</div>}
          <div className={`text-[16px] leading-6 ${prompt.style === 'thought' ? 'italic text-white/80' : prompt.style === 'narrate' ? 'text-white/85' : ''}`}>{prompt.style === 'thought' ? `(${prompt.text})` : prompt.text}</div>
        </button>
      )}
      {prompt?.kind === 'choice' && (
        <div data-choice className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          {prompt.options.map((o, i) => (
            <button key={i} type="button" onClick={() => advance(i)} className="min-h-12 min-w-64 rounded-lg border border-[#2ee6ff]/50 bg-[#0b0d17]/90 px-4 font-semibold">
              {o.text}{o.lead && <span className="ml-2 rounded bg-[#2ee6ff]/20 px-1.5 text-[11px] font-bold text-[#2ee6ff]">Lead</span>}
            </button>
          ))}
        </div>
      )}
      {prompt?.kind === 'call' && (
        <div data-call className="absolute inset-x-6 bottom-6 space-y-2 rounded-xl border border-white/15 bg-[#0b0d17]/95 p-3">
          <div className="font-display text-[16px] font-bold">{prompt.call.question}</div>
          {prompt.call.voters.map((v) => <div key={v.outfit} className="text-[13px] text-white/80"><b>{nameOf(pack, v.outfit)}:</b> {v.argument}</div>)}
          <div className="flex gap-2 pt-1">{prompt.call.branches.map((b, i) => <button key={b.id} type="button" onClick={() => advance(i)} className="min-h-11 flex-1 rounded-md bg-[#2ee6ff] font-bold text-[#0b0d17]">{b.text}</button>)}</div>
        </div>
      )}
      {prompt?.kind === 'battle' && (
        <div data-battle-step className="absolute inset-x-6 bottom-6 rounded-xl border border-[#ff3d6e]/50 bg-[#0b0d17]/95 p-3">
          <div className="font-display text-[16px] font-bold">Mission: {prompt.mission}</div>
          <button type="button" onClick={() => advance()} className="mt-2 min-h-11 w-full rounded-md bg-[#ff3d6e] font-bold text-white">Deploy</button>
        </div>
      )}
      {showLog && (
        <div data-log className="absolute inset-4 overflow-y-auto rounded-xl border border-white/15 bg-[#0b0d17]/97 p-3" style={{ margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }}>
          <div className="mb-2 flex items-center justify-between"><b>Log</b><button type="button" onClick={() => setShowLog(false)} className="min-h-11 min-w-11">✕</button></div>
          {log.map((l, i) => <div key={i} className="py-0.5 text-[13px]">{l.speaker && <b>{l.speaker}: </b>}{l.text}</div>)}
        </div>
      )}
    </div>
  )
}
