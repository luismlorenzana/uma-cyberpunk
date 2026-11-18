// The scene player (CY9, TC36): a text box with the speaker's name and bust over the place's backdrop. A tap moves on; an
// interjection slot plays the first squad lead's line; choices are one-tap buttons, a Lead marked as one; a Call shows the
// voters' arguments. **Auto** moves on by the line's length, **Skip** passes to the next choice or the end, **Log** shows
// the scene so far. Busts: master data's by outfit id once the album is wired (CY11); stand-in cards now. CY13: the
// captain's choices (a tone each) and Trust or Heart in bond scenes, and the captain's name and pronouns in every line.
import { DEFAULT_CAPTAIN, fillCaptain, type BondPath, type Call, type CaptainOption, type ChoiceOption, type Scene, type Speaker, type Step, type StoryPack } from '@cyber/domain'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '../save/game'
import { nameOf, playScene, type BondEffect, type SceneUi } from './runner'
import { ScenePortrait, selectScenePortrait, type ScenePortraitImage } from './ScenePortrait'

type Prompt =
  | { kind: 'line'; speaker: Speaker | null; text: string; style: 'line' | 'thought' | 'narrate' }
  | { kind: 'choice'; options: readonly ChoiceOption[] }
  | { kind: 'call'; call: Call }
  | { kind: 'battle'; mission: string }
  | { kind: 'captain'; options: readonly CaptainOption[] }
  | { kind: 'path' }

const TONE: Record<CaptainOption['tone'], { mark: string; name: string }> = { warm: { mark: '♥', name: 'Warm' }, steady: { mark: '◆', name: 'Steady' }, wry: { mark: '~', name: 'Wry' } }

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

export interface ScenePresentation {
  backdrop?: string
  portraits: ScenePortraitImage[]
  illustrations?: Record<string, string>
}

export function ScenePlayer({ pack, scene, squad, onEffect, onBattle, onDone, onBond, presentation, pathFooter }: {
  pack: StoryPack
  scene: Scene | { id: string; place: string; steps: Step[] }
  squad: readonly number[]
  onEffect: Parameters<typeof playScene>[1]['effect']
  onBattle: (mission: string) => Promise<void>
  onDone: () => void
  /** A bond scene's effects: a captain's choice's rapport, the path chosen (CY13). */
  onBond?: (effect: BondEffect) => void
  presentation?: ScenePresentation
  pathFooter?: string
}) {
  const captain = useGame((g) => g.save?.captain) ?? DEFAULT_CAPTAIN
  const fill = (text: string) => fillCaptain(text, captain)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [expressions, setExpressions] = useState<Partial<Record<Speaker, string>>>({})
  const [illustration, setIllustration] = useState<string | null>(null)
  const [log, setLog] = useState<{ actor: Speaker | null; speaker: string; text: string }[]>([])
  /** Her last line stays above a choice, so the player answers what was said. */
  const said = log[log.length - 1]
  const saidLine = said && <div data-said className="mx-auto mb-1 max-w-[80%] rounded-lg bg-[#0b0d17]/80 px-3 py-2 text-[14px]">{said.speaker && <b>{said.speaker}: </b>}{said.text}</div>
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
        setLog((l) => [...l, { actor: speaker, speaker: speaker === null ? '' : nameOf(pack, speaker), text: fillCaptain(text, captain) }])
        const done = ask({ kind: 'line', speaker, text, style })
        const current = resolve.current
        if (autoRef.current) window.setTimeout(() => { if (live && current === resolve.current) advance() }, 900 + text.length * 45)
        await done
      },
      emote: async (actor, emote) => {
        if (live && presentation) setExpressions((old) => ({ ...old, [actor]: emote }))
        await new Promise((r) => setTimeout(r, skipping.current ? 0 : 300))
      },
      illustration: (asset) => { if (live) setIllustration(asset) },
      wait: async (ms) => { await new Promise((r) => setTimeout(r, Math.min(ms, 2000))) },
      choose: (options) => ask({ kind: 'choice', options }),
      call: (call) => ask({ kind: 'call', call }),
      battle: async (mission) => { await ask({ kind: 'battle', mission }); await onBattle(mission) },
      effect: (step) => { if (live) onEffect(step) },
      captain: (options) => ask({ kind: 'captain', options }),
      path: async () => ((await ask({ kind: 'path' })) === 1 ? 'heart' : 'trust') as BondPath,
      bond: (e) => { if (live) onBond?.(e) },
    }
    void playScene(scene, ui, { pack, squad, skipping: () => skipping.current, stopSkipping: () => { skipping.current = false }, romance: captain.romance }).then(() => { if (live) onDone() })
    return () => { live = false }
    // One run a scene.
  }, [scene.id])

  const skip = () => { skipping.current = true; if (prompt?.kind === 'line') advance() }
  const speaker = prompt?.kind === 'line' ? prompt.speaker
    : presentation && (prompt?.kind === 'choice' || prompt?.kind === 'captain') ? said?.actor ?? null : null
  const image = illustration && presentation?.illustrations?.[illustration]
  const portrait = speaker === null || !presentation ? null : selectScenePortrait(presentation.portraits, speaker, expressions[speaker])
  return (
    <div data-scene={scene.id} className="absolute inset-0 select-none bg-gradient-to-b from-[#141827] via-[#0e1222] to-[#05060c] text-[#e8ebf5]">
      {image ? <img alt="" src={image} className="absolute inset-0 size-full object-cover" data-scene-illustration />
        : presentation?.backdrop && <img alt="" src={presentation.backdrop} className="absolute inset-0 size-full object-cover opacity-70" data-scene-backdrop />}
      <div className="absolute left-4 top-3 text-[12px] uppercase tracking-widest text-white/50" style={{ marginTop: 'var(--inset-top)', marginLeft: 'var(--inset-left)' }}>{scene.place}</div>
      <div className="absolute right-3 top-3 flex gap-2" style={{ marginTop: 'var(--inset-top)', marginRight: 'var(--inset-right)' }}>
        <button type="button" onClick={() => setAuto((a) => !a)} className={`min-h-11 rounded-md px-3 text-[13px] font-bold ${auto ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-white/10'}`}>Auto</button>
        <button type="button" onClick={skip} className="min-h-11 rounded-md bg-white/10 px-3 text-[13px] font-bold">Skip</button>
        <button type="button" onClick={() => setShowLog(true)} className="min-h-11 rounded-md bg-white/10 px-3 text-[13px] font-bold">Log</button>
      </div>
      {!image && speaker !== null && <div className="absolute bottom-[34%] max-h-[48%]" style={{ left: 'calc(var(--inset-left) + 16px)' }}>
        {portrait ? <ScenePortrait key={portrait.image.url} image={portrait.image} face={portrait.face} />
          : <Bust pack={pack} speaker={speaker} />}
      </div>}
      {prompt?.kind === 'line' && (
        <button type="button" data-line onClick={() => advance()} className="absolute inset-x-4 bottom-3 min-h-28 rounded-xl border border-white/15 bg-[#0b0d17]/90 p-3 text-left"
          style={{ marginBottom: 'var(--inset-bottom)', marginLeft: 'var(--inset-left)', marginRight: 'var(--inset-right)' }}>
          {prompt.speaker !== null && <div className="mb-1 font-display text-[14px] font-bold" style={{ color: hueOf(prompt.speaker) }}>{nameOf(pack, prompt.speaker)}</div>}
          <div className={`text-[16px] leading-6 ${prompt.style === 'thought' ? 'italic text-white/80' : prompt.style === 'narrate' ? 'text-white/85' : ''}`}>{prompt.style === 'thought' ? `(${fill(prompt.text)})` : fill(prompt.text)}</div>
        </button>
      )}
      {prompt?.kind === 'choice' && (
        <div data-choice className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          {prompt.options.map((o, i) => (
            <button key={i} type="button" onClick={() => advance(i)} className="min-h-12 min-w-64 rounded-lg border border-[#2ee6ff]/50 bg-[#0b0d17]/90 px-4 font-semibold">
              {fill(o.text)}{o.lead && <span className="ml-2 rounded bg-[#2ee6ff]/20 px-1.5 text-[11px] font-bold text-[#2ee6ff]">Lead</span>}
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
      {prompt?.kind === 'captain' && (
        <div data-captain className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          {saidLine}
          <div className="text-[12px] uppercase tracking-widest text-white/50">{captain.name}</div>
          {prompt.options.map((o, i) => (
            <button key={i} type="button" data-tone={o.tone} onClick={() => advance(i)} className="flex min-h-12 min-w-72 max-w-[80%] items-center gap-3 rounded-lg border border-[#2ee6ff]/50 bg-[#0b0d17]/90 px-4 text-left font-semibold">
              <span className="w-12 shrink-0 text-center text-[12px] text-[#2ee6ff]" title={TONE[o.tone].name}>{TONE[o.tone].mark} {TONE[o.tone].name}</span>{fill(o.text)}
            </button>
          ))}
        </div>
      )}
      {prompt?.kind === 'path' && (
        <div data-path className="absolute inset-x-6 bottom-6 space-y-2 rounded-xl border border-white/15 bg-[#0b0d17]/95 p-3">
          {saidLine}
          <div className="font-display text-[16px] font-bold">What do you answer?</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" data-choose="trust" onClick={() => advance(0)} className="min-h-14 rounded-md bg-[#2ee6ff] px-3 text-left font-bold text-[#0b0d17]">Trust<span className="block text-[12px] font-normal">Partners in arms: friendship, all the way</span></button>
            <button type="button" data-choose="heart" onClick={() => advance(1)} className="min-h-14 rounded-md bg-[#ff3dc8] px-3 text-left font-bold text-[#0b0d17]">Heart<span className="block text-[12px] font-normal">Something more: a light romance</span></button>
          </div>
          <div className="text-[12px] text-white/50">{pathFooter ?? 'Both are equal in battle, and a later scene can change it.'}</div>
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
