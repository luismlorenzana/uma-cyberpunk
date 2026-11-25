import { CompositionLayer } from '../story/ScenePlayer'
import type { CampaignComposition } from '@cyber/domain'
import { commandEffectKeys, commandFacts, type CommandActorArt, type ResolvedCommand } from '@cyber/domain'
import { useEffect, useMemo, useState } from 'react'
import { updateSave, useGame } from '../save/game'
import { ScenePortrait, selectScenePortrait, type ScenePortraitImage } from '../story/ScenePortrait'
import { advanceCommandCinema, commandStationArt } from './cinematics'
import { campaignImage, type LoadedCampaign } from './load'

const button = 'min-h-11 rounded-lg bg-[#16263e] px-3 text-sm font-bold text-white ring-1 ring-white/20 disabled:opacity-50'
const orderNames = { evade: 'Evade', brace: 'Brace shields', fire: 'Fire guns', intercept: 'Intercept', strike: 'Fighter strike', reroute: 'Reroute power' }

function Shot({ loaded, actor, station, emote, portraitOnly, showPortrait }: { loaded: LoadedCampaign; actor?: CommandActorArt; station: ResolvedCommand['station']; emote: string; portraitOnly?: boolean; showPortrait: boolean }) {
  const [shot, setShot] = useState<{ plate?: string; pose?: string; portraits: ScenePortraitImage[]; layers?: (CampaignComposition['layers'][number] & { url: string })[] }>({ portraits: [] })
  const plate = loaded.book.commandCinematics?.stations.find(row => row.station === station)?.backdrop
  const member = actor && loaded.book.wardrobe?.members.find(row => row.speaker === actor.speaker)
  const expressionBase = actor && member && Object.values(member.looks).find(row => row.asset === actor.base || row.dialogue === actor.base)?.portrait
  useEffect(() => {
    let live = true
    const urls: string[] = [], reads = new Map<string, Promise<string>>()
    setShot({ portraits: [] })
    const read = (id: string) => {
      const old = reads.get(id)
      if (old) return old
      const ref = loaded.assets.get(id)
      const pending = ref ? campaignImage(ref).then(url => { if (live) urls.push(url); else URL.revokeObjectURL(url); return url }) : Promise.reject(new Error('Missing cinematic image'))
      reads.set(id, pending)
      return pending
    }
    const available = actor ? loaded.book.portraitFaces?.filter(row => row.speaker === actor.speaker && row.base === (expressionBase ?? actor.base)) ?? [] : []
    const matching = available.filter(row => row.emote === emote)
    const placements = matching.length ? matching : available.filter(row => row.emote === 'neutral')
    const portrait = actor && (expressionBase ?? (placements.length ? actor.base : actor.profile ?? actor.base))
    void Promise.all([plate ? read(plate).catch(() => undefined) : undefined,
      actor && !actor.composition && !portraitOnly ? read(actor.pose ?? actor.poseFallback ?? actor.base).catch(() => undefined) : undefined,
      portrait ? read(portrait).catch(() => undefined) : undefined,
      Promise.all((actor?.composition?.layers ?? []).map(async layer => { try { return { ...layer, url: await read(layer.asset) } } catch { return null } })),
      Promise.all(placements.map(async face => { try { return { emote: face.emote, at: face.at, url: await read(face.asset) } } catch { return null } })),
    ]).then(([plate, pose, profile, layers, faces]) => { if (live) setShot({ plate, pose, layers: layers.filter(layer => layer !== null), portraits: actor && profile ? [{ speaker: actor.speaker, url: profile, faces: faces.filter(face => face !== null) }] : [] }) })
    return () => { live = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [loaded, actor, plate, emote, expressionBase, portraitOnly])
  const portrait = actor && selectScenePortrait(shot.portraits, actor.speaker, emote)
  return <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
    {shot.plate && <img src={shot.plate} alt="" className="absolute inset-0 size-full object-cover opacity-50" />}
    {actor?.composition && <svg className="absolute inset-0 size-full" viewBox={`0 0 ${actor.composition.width} ${actor.composition.height}`} preserveAspectRatio="xMidYMid meet" data-scene-composition>{shot.layers?.map(layer => <CompositionLayer key={layer.asset} layer={layer} />)}</svg>}
    {!actor?.composition && shot.pose && <img src={shot.pose} alt="" className="absolute bottom-0 right-0 h-[88%] w-[64%] object-contain object-bottom opacity-80" data-command-pose />}
    {showPortrait && portrait && actor?.composition?.portraits !== 'hide' && <div className={`absolute left-2 top-14 h-[92px] w-[90px] overflow-hidden rounded-lg bg-[#080d19]/85 [&_img[data-scene-portrait]]:max-h-none ${expressionBase && portrait.image.faces?.length ? '' : actor.profile && !portrait.face ? '[&_img[data-scene-portrait]]:w-[90px] [&_img[data-scene-portrait]]:max-w-[90px]' : '[&>div]:w-[180px] [&>div]:-translate-x-[45px] [&_img[data-scene-portrait]]:w-[180px] [&_img[data-scene-portrait]]:max-w-[180px]'}`}>
      <ScenePortrait key={portrait.image.url} image={portrait.image} face={portrait.face} profile={!!expressionBase && !!portrait.image.faces?.length} />
    </div>}
  </div>
}

function AuthoredEffects({ loaded, event }: { loaded: LoadedCampaign; event: ResolvedCommand }) {
  const keys = commandEffectKeys(event).join(':')
  const [compositions, setCompositions] = useState<{ key: string; width: number; height: number; layers: (CampaignComposition['layers'][number] & { url: string })[] }[]>([])
  useEffect(() => {
    let live = true
    const urls: string[] = [], active = new Set(keys.split(':'))
    setCompositions([])
    void Promise.all((loaded.book.commandCinematics?.effects ?? []).filter(effect => active.has(effect.kind) && effect.composition).map(async effect => {
      const composition = effect.composition!
      const layers = await Promise.all(composition.layers.map(async layer => {
        const ref = loaded.assets.get(layer.asset)
        if (!ref) return null
        try { const url = await campaignImage(ref); if (live) urls.push(url); else URL.revokeObjectURL(url); return { ...layer, url } } catch { return null }
      }))
      return { key: effect.kind, width: composition.width, height: composition.height, layers: layers.filter(layer => layer !== null) }
    })).then(value => { if (live) setCompositions(value) })
    return () => { live = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [loaded, keys])
  return <>{compositions.map(composition => <svg key={composition.key} aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${composition.width} ${composition.height}`} preserveAspectRatio="xMidYMid meet" data-command-art-effect={composition.key}>
    {composition.layers.map(layer => <CompositionLayer key={layer.asset} layer={layer} />)}
  </svg>)}</>
}

function CommandEffects({ event, animate }: { event: ResolvedCommand; animate: boolean }) {
  const last = event.after.last!
  return <svg viewBox="0 0 320 110" className={`relative h-12 w-full ${animate ? 'motion-safe:animate-pulse' : ''}`} aria-label="Resolved ship effects">
    <path d="M24 55L58 36L90 55L58 70Z" fill="#606eb8" stroke="#c3ceff" strokeWidth="3" />
    <path d="M234 55L270 34L303 55L270 72Z" fill="#80516e" stroke="#ffafbc" strokeWidth="3" />
    {(event.action.shields > 0 || last.blocked > 0) && <path d="M97 24Q130 55 97 87" fill="none" stroke="#7ee8ff" strokeWidth="5" data-command-effect="shields" />}
    {last.intercepted > 0 && <path d="M147 20L154 36L139 36ZM173 76L180 93L165 93Z" fill="#8de3c5" data-command-effect="intercept" />}
    {(last.hit > 0 || last.emitterHit > 0) && <path d="M107 55L224 55" stroke="#ffd47e" strokeWidth="4" strokeDasharray={event.action.order === 'strike' ? '11 7' : undefined} data-command-effect="hit" />}
    {last.emitterHit > 0 && <circle cx="268" cy="55" r="25" fill="none" stroke={event.disabled ? '#a2e5c4' : '#eab7ff'} strokeWidth="4" data-command-effect={event.disabled ? 'emitter-disabled' : 'emitter-hit'} />}
    {(last.hullDamage > 0 || last.transportDamage > 0) && <path d="M55 34L70 54L51 67L72 80" fill="none" stroke="#ff8a9e" strokeWidth="4" data-command-effect="friendly-damage" />}
    {event.after.power > event.before.power && <path d="M147 14L133 56L151 52L140 94L171 43L154 45L169 14Z" fill="#a5e7ff" data-command-effect="power" />}
  </svg>
}

export function CommandCinematic({ event, loaded, encounter, beat, fast }: { event: ResolvedCommand; loaded: LoadedCampaign; encounter: string; beat: number; fast: boolean }) {
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const activeExpedition = useGame(state => state.save?.expedition)
  const binding = loaded.book.commandCinematics?.encounters.find(row => row.encounter === encounter)
  const actorSpeaker = event.actor?.speaker
  const friendly = useMemo(() => actorSpeaker === undefined ? undefined : commandStationArt(loaded.book, actorSpeaker), [loaded.book, actorSpeaker])
  const crew = friendly?.actor
  const enemyText = event.commander && binding?.commander === event.commander.speaker ? (event.after.enemy === 0 ? binding?.enemy?.withdrawal : event.disabled ? binding?.enemy?.disabled : binding?.enemy?.contact) : undefined
  const finale = loaded.book.fourActFinale
  const call = encounter === finale?.hushApproach && event.actor
    ? [...finale.hushCrews.values()].map(crew => crew.roster.get(event.actor!.speaker)?.ship).find(Boolean) : undefined
  const bank = event.actor && finale?.voices?.get(event.actor.speaker)
  const aboard = bank && (!bank.expeditionOnly || activeExpedition?.members.some(member => member.role !== 'uma' && member.heroine === event.actor?.speaker))
  const outcomeCue = event.after.result === 'lost' ? 'loss' : event.after.result === 'won' ? 'victory' : event.disabled ? 'disabled' : event.action.order
  const report = aboard && bank.ship[outcomeCue]
  const authoredScene = call ?? (report || undefined)
  const callLine = authoredScene && loaded.book.scenes.get(authoredScene)?.steps.find(step => step.kind === 'line' && step.speaker === event.actor?.speaker)
  const enemySpeaking = beat === 2 && !!enemyText && !!event.commander
  const enemy = enemySpeaking ? loaded.book.commandCinematics?.actors.find(actor => actor.speaker === event.commander!.speaker && actor.role === 'enemy') : undefined
  const actor = enemySpeaking ? enemy : crew, voice = crew?.orders?.[event.action.order]
  const emote = enemySpeaking ? 'stern' : event.after.result === 'lost' && beat === 3 ? 'worried' : event.after.result === 'won' && beat === 3 ? 'relieved' : 'determined'
  const speaker = beat === 0 ? 'Captain' : enemySpeaking ? event.commander!.name : event.actor?.name ?? 'Watch officer'
  const outcome = event.after.result === 'lost' ? 'Withdrawal required' : event.after.result === 'won' ? 'Immediate objective secured' : 'Awaiting next order'
  const line = beat === 0 ? voice?.captain ?? `${orderNames[event.action.order]} · ${event.action.target === 'emitter' ? 'Shield emitter' : 'Opposing ship'}`
    : beat === 1 ? voice?.acknowledgement ?? `Order acknowledged at ${event.station}.`
    : beat === 2 ? enemyText ?? (callLine && callLine.kind === 'line' ? callLine.text : undefined) ?? voice?.result ?? 'The confirmed response is on the tactical display.'
    : event.after.result === 'lost' ? crew?.states?.loss ?? outcome : event.after.result === 'won' ? crew?.states?.victory ?? outcome
      : event.disabled ? crew?.states?.disabled ?? 'Emitter confirmed disabled.' : voice?.result ?? outcome
  function advance(skip = false) {
    setBusy(true)
    void updateSave(save => advanceCommandCinema(save, encounter, event.turn, beat, skip)).catch(error => setError(String(error))).finally(() => setBusy(false))
  }
  useEffect(() => {
    if (beat === 3 || error) return
    const timer = setTimeout(() => advance(), Math.min(4000, Math.max(1200, line.length * 23)))
    return () => clearTimeout(timer)
  }, [encounter, event.turn, beat, error])
  return <section className="fixed inset-0 z-20 flex flex-col justify-between overflow-hidden bg-[#15223a] p-3" style={{ margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }} role="dialog" aria-modal="true" aria-label="Ship order cinematic" data-command-cinema={`${event.turn}:${beat}`}>
    <Shot key={actor?.speaker} loaded={loaded} actor={actor || undefined} station={event.station} emote={emote}
      showPortrait={beat !== 0} portraitOnly={!enemySpeaking && friendly?.portraitOnly} />
    {(beat === 2 || beat === 3) && <AuthoredEffects loaded={loaded} event={event} />}
    <header className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-[#080d19]/95 p-2 text-xs"><span>Hull {event.after.hull} · Fore {event.after.shields.fore} · Aft {event.after.shields.aft} · Reactor {event.after.power}</span><span>{event.objective} {event.after.transport} · Opponent {event.after.enemy}{event.after.emitter === null ? '' : ` · Emitter ${event.after.emitter}`}</span></header>
    <div className="relative space-y-1 pl-24">
      <p className="text-xs font-bold text-cyan-200">Order {event.turn} · {['Captain’s order', 'Station response', 'Confirmed action', 'Result'][beat]}</p>
      <p className="text-sm font-bold">{speaker}{enemySpeaking ? ' · Enemy channel' : beat ? ` · ${event.station}` : ''}</p>
      <p className="rounded-lg bg-[#080d19]/90 p-2 text-sm" aria-live="polite">{line}</p>
    </div>
    <div className="relative mt-2 rounded-lg bg-[#080d19]/90 p-2 text-xs">
      <CommandEffects event={event} animate={beat === 2} />
      <p className="font-bold">{event.action.target === 'emitter' ? `Emitter ${event.before.emitter} → ${event.after.emitter}` : `Opposing ship ${event.after.enemy}`} · {event.objective} {event.after.transport}</p>
      <p>{commandFacts(event)}</p>
      {event.disabled && <p className="text-cyan-200">Emitter disabled · boarding remains a separate operation</p>}
      {beat === 3 && <p className="font-bold text-cyan-200">{outcome}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => advance(beat < 3)}>{beat < 3 ? 'Skip to result' : 'Continue'}</button>
        <button type="button" className={button} aria-pressed={fast} onClick={() => void updateSave(save => ({ ...save, commandCinema: { ...save.commandCinema, fast: !save.commandCinema.fast, pending: !save.commandCinema.fast && save.commandCinema.pending ? { ...save.commandCinema.pending, beat: 3 } : save.commandCinema.pending } }))}>Fast orders</button>
        {beat < 3 && <button type="button" className={button} disabled={busy} onClick={() => advance()}>Next</button>}
      </div>
    </div>
  </section>
}
