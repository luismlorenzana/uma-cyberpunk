// The battle screen (CY8, TC29): the board with the battle's DOM over it. The player's turn is two-tap move (the first tap
// shows her path, the second moves her; undoable until the action commits), then an action from the commands arc, the
// forecast card for an attack, and the facing, all sent as one turn. Enemy turns play at double speed, with Skip. Every
// committed action is handed to `onCommit` (the sandbox's autosave); the board follows the cues, then the state.
import {
  boardOf, canAim, chooseAction, dirTo, EXPEDITION_RULES_VERSION, orderError, partnerOf, type OrderKind, forecast, liveTiles, targetTile, supportFrom, talkContact, terrainCard, timeline, type Act, type BattleAction, type BattleState,
  FIRE_MODE_LABEL, fireModes, modeCost, quickPatchTargets,
  type Cue, type Dir, type Forecast, type Reach, type Role, type TerrainCard, type Tile, type TurnAction,
} from '@cyber/battle'
import { AlbumArtProvider } from '@luismlorenzana/uma-kit/album'
import { initialSaver, toStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { looksFor, type UnitLook } from '../board/looks'
import { campaignCombatLooks, type CombatLook } from '../board/local-combat-sprites'
import type { CampaignRelease, CampaignReleaseFile } from '@cyber/domain'
import { campaignImage } from '../campaign/load'
import { BoardScene, type BoardFigure, type StateKind } from '../board/scene'
import { albumArt } from '../crew/art'
import { useMaster } from '../master/master'
import { CutIn, ForecastCard, labelOf, PaperDoll, SIDE_HUE, TerrainPanel, Timeline, UnitCard, type CutInView, type Doll } from './parts'
import { BattleHelp } from './BattleHelp'
import { actionHelpTopic, objectiveTopics } from './help'
import { CUT_IN_MS, cutInSpeed, speedOf, stepMs, type CutInSetting } from './playback'
import { targetsFrom, threatTiles, tileKey, turnReach } from './reach'
import { act as applyAct, type Session } from './session'
import { CombatVisualPlayback, type CombatTrace } from './combat-visual-playback'

export type Control = { squad: 'player' | 'ai'; enemy: 'player' | 'ai' }

type Ui =
  | { phase: 'watch' }
  | { phase: 'move'; dash: boolean; moves: Reach[]; danger: Set<string>; ghost: Reach | null }
  | { phase: 'act'; reach: Reach; dash: boolean }
  | { phase: 'target'; reach: Reach; dash: boolean; aim: boolean }
  | { phase: 'more'; reach: Reach; dash: boolean }
  | { phase: 'forecast'; reach: Reach; dash: boolean; act: Act; f: Forecast }
  | { phase: 'face'; reach: Reach; dash: boolean; act: Act; face: Dir }
  | { phase: 'bench'; role: Role }
  // Rules version 3 (CY17): the captain's Orders and the duo technique.
  | { phase: 'orders' }
  | { phase: 'order-target'; order: OrderKind }
  | { phase: 'order-tile'; order: OrderKind }
  | { phase: 'duo' }
  | { phase: 'patch' }

export interface SandboxHandle {
  readonly state: BattleState
  act: (action: BattleAction) => string | null
  /** A tap on a tile, as a finger's would land. */
  tap: (x: number, z: number) => void
  step: (ms?: number) => void
  auto: () => Promise<BattleState['result']>
  /** The board's readout (figures, sprites, live sets, draw calls). */
  readonly board: BoardScene['debug'] | null
  readonly combat: BoardScene['combatDebug'] | null
  readonly combatTrace: readonly CombatTrace[]
  play: (action: BattleAction) => Promise<string | null>
  skipPlayback: () => void
}
declare global { interface Window { __sandbox?: SandboxHandle } }

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const DIRS: Dir[] = ['N', 'E', 'S', 'W']
const ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' }
/** Each Order's words and what it takes (TC59). */
const ORDER: Record<OrderKind, { label: string; takes: 'none' | 'unit' | 'tile' }> = {
  sure: { label: 'Sure shot', takes: 'none' }, hold: { label: 'Hold the line', takes: 'unit' }, reboot: { label: 'Reboot', takes: 'unit' },
  resonance: { label: 'Call her name', takes: 'unit' }, strike: { label: 'Orbital strike', takes: 'tile' }, sweep: { label: 'Sweep', takes: 'none' },
  barrier: { label: 'Barrier', takes: 'tile' }, drone: { label: 'Drone', takes: 'unit' }, reinforce: { label: 'Reinforce', takes: 'tile' },
}

/** The act's words on the arc and the card. */
function actWords(state: BattleState, a: Act): string {
  if (a.kind === 'tech') return `${a.tech} ${labelOf(state, a.target)}`
  if (a.kind === 'hack') return `Hack ${a.terminal}`
  if (a.kind === 'barrier') return `Barrier ${a.at[0]},${a.at[1]}`
  if (a.kind === 'mend') return `Mend ${labelOf(state, a.target)} ${a.part}`
  if (a.kind === 'reboot') return `Reboot ${labelOf(state, a.target)}`
  if (a.kind === 'talk') return `Talk to ${labelOf(state, a.target)}`
  if (a.kind === 'item') return `${a.item}${a.target ? ` ${labelOf(state, a.target)}` : ''}${a.part ? ` ${a.part}` : ''}${a.at ? ` ${a.at[0]},${a.at[1]}` : ''}`
  if (a.kind === 'attack') return `Attack ${labelOf(state, a.target)}`
  return a.kind
}

export interface BattleViewProps {
  layout: StageLayout
  session: Session
  control: Control
  debug: boolean
  training?: boolean
  objectiveLabel?: string
  portrait?: { unit: string; url: string }
  campaignPortraits?: ReadonlyMap<string, CampaignReleaseFile>
  signatureSplashes?: readonly (readonly [string, CampaignReleaseFile])[]
  standInKit?: 'biome' | 'town'
  combatSprites?: CampaignRelease['combatSprites']
  onCommit: (s: Session) => void
  onStoryCues?: (cues: readonly Cue[]) => Promise<void>
  onTalkReply?: (target: string, reason: 'refused' | 'notYet') => void
  onEnd: (s: Session) => void
  onQuit: () => void
  quitLabel?: string
}

/** The battle screen: its Umas' looks first (their sprite sets or faces from master data, D19, a few seconds at most),
 * then the board. Faces on the timeline, the unit card and the cut-in come through uma-kit's album art. */
export function BattleView(props: BattleViewProps) {
  const master = useMaster()
  const art = master.status === 'ready' ? master.view.art : null
  const [looks, setLooks] = useState<Map<string, UnitLook | CombatLook> | null>(null)
  const [loaded, setLoaded] = useState<[number, number]>([0, 0])
  const [signatureArt, setSignatureArt] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    let live = true
    const campaignUrls: string[] = []
    // Strict Mode tears down its first effect before this microtask, so the mount that stays owns the asset reads.
    queueMicrotask(() => {
      if (!live) return
      const portrait = props.portrait
      const face = portrait && new Image()
      if (face && portrait) face.src = portrait.url
      const portraits = [...props.campaignPortraits ?? []].map(async ([unit, asset]) => {
        const url = await campaignImage(asset).catch(() => undefined)
        if (!url) return []
        if (!live) { URL.revokeObjectURL(url); return [] }
        campaignUrls.push(url)
        try {
          const face = new Image()
          face.src = url
          await face.decode()
          return [[unit, { kind: 'face' as const, face }] as const]
        } catch {
          return []
        }
      })
      void Promise.all((props.signatureSplashes ?? []).map(async ([key, asset]) => {
        const url = await campaignImage(asset).catch(() => undefined)
        if (!url) return []
        if (!live) { URL.revokeObjectURL(url); return [] }
        campaignUrls.push(url)
        return [[key, url] as const]
      })).then(rows => { if (live) setSignatureArt(new Map(rows.flat())) })
      void Promise.all([
        looksFor(props.session.input, art, undefined, (d, n) => { if (live) setLoaded([d, n]) }, props.combatSprites === undefined),
        face ? face.decode().then(() => face, () => null) : undefined,
        props.combatSprites ? campaignCombatLooks(props.session.input, props.combatSprites) : undefined,
        Promise.all(portraits),
      ]).then(([units, decoded, combat, fallback]) => {
        if (!live) return
        const all = new Map<string, UnitLook | CombatLook>(units)
        for (const [unit, face] of fallback.flat()) all.set(unit, face)
        if (portrait && decoded) all.set(portrait.unit, { kind: 'face', face: decoded })
        for (const [id, look] of combat ?? []) all.set(id, look)
        setLooks(all)
      })
    })
    return () => { live = false; campaignUrls.forEach(url => URL.revokeObjectURL(url)) }
  }, [])
  const albums = useMemo(() => albumArt((id) => props.session.input.units.find((u) => u.ref?.id === id)?.label ?? `Uma ${id}`), [props.session.input])
  if (!looks) return <div data-loading-squad className="flex h-full items-center justify-center bg-[#0b0d17] font-display text-[15px] text-white/60">Bringing the squad aboard…{loaded[1] ? ` ${loaded[0]} of ${loaded[1]}` : ''}</div>
  return <AlbumArtProvider art={albums}><BattleBoard {...props} looks={looks} signatureArt={signatureArt} /></AlbumArtProvider>
}

function BattleBoard({ layout, session: first, control, debug, training, objectiveLabel, standInKit, combatSprites, onCommit, onEnd, onQuit, quitLabel = 'Setup', onStoryCues, onTalkReply, looks, signatureArt, signatureSplashes }: BattleViewProps & { looks: Map<string, UnitLook | CombatLook>; signatureArt: ReadonlyMap<string, string> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<BoardScene | null>(null)
  const session = useRef(first)
  const controlRef = useRef(control)
  const busy = useRef(false)
  const skipping = useRef(false)
  const playingSide = useRef<'squad' | 'enemy' | null>(null)
  const seen = useRef(new Set<string>())
  const lastTarget = useRef<Tile | null>(null)
  const terrainKey = useRef('')
  const press = useRef<{ timer: number; fired: boolean; x: number; y: number } | null>(null)
  const [state, setState] = useState(first.state)
  const [ui, setUi] = useState<Ui>({ phase: 'watch' })
  const [inspect, setInspect] = useState<string | null>(null)
  const [terrain, setTerrain] = useState<TerrainCard | null>(null)
  const [dolls, setDolls] = useState<Doll[]>([])
  const [cutIn, setCutIn] = useState<CutInView | null>(null)
  const [resonance, setResonance] = useState<{ unit: string; path: 'trust' | 'heart' | null; key: number } | null>(null)
  const expanded = first.input.units.filter(({ side }) => side === 'squad').length > 5
  const [cutInSetting, setCutInSetting] = useState<CutInSetting>(expanded && !signatureSplashes?.length ? 'off' : 'auto')
  const [quickTurns, setQuickTurns] = useState(expanded)
  const [reachAll, setReachAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [saver, setSaver] = useState(initialSaver)
  const settingRef = useRef(cutInSetting)
  settingRef.current = cutInSetting
  const tapRef = useRef<(t: Tile) => void>(() => {})
  const combatTrace = useRef<CombatTrace[]>([])

  const sideOf = (id: string | null) => session.current.state.units.find((u) => u.id === id)?.side ?? 'squad'
  const isPlayer = (s: BattleState) => !!s.active && controlRef.current[sideOf(s.active)] === 'player'

  // --- The board follows the state -----------------------------------------------------------------------------------

  const syncTerrain = (s: BattleState) => {
    const sc = scene.current
    if (!sc) return
    const field = s.field
    const key = field ? JSON.stringify([field.lifts, field.doors, field.burst]) : ''
    if (key !== terrainKey.current) {
      terrainKey.current = key
      const board = boardOf(s)
      const heights = s.input.map.heights.map((row, z) => row.split('').map((_, x) => String(board.height(x, z))).join(''))
      const shut = (s.input.map.props ?? []).filter((p) => p.kind === 'door' && field && !field.doors[p.id]).map((p) => p.id)
      sc.setMap({ ...s.input.map, heights }, { shut, burst: field?.burst ?? [] })
    }
    const states: { tile: Tile; kind: StateKind }[] = []
    for (const [k, st] of Object.entries(field?.states ?? {})) { const [x, z] = k.split(',').map(Number) as [number, number]; states.push({ tile: [x, z], kind: st.kind }) }
    for (const k of liveTiles(s)) { const [x, z] = k.split(',').map(Number) as [number, number]; states.push({ tile: [x, z], kind: 'live' }) }
    sc.setStates(states)
  }

  /** Snap to authoritative state on resume, skip and at the end of playback. */
  const sync = (s: BattleState) => {
    const sc = scene.current
    if (!sc) return
    syncTerrain(s)
    for (const u of s.units) {
      if (u.status === 'out' || u.status === 'freed') { sc.removeFigure(u.id); continue }
      sc.place(u.id, [u.x, u.y], u.facing)
      sc.setDown(u.id, u.status === 'down')
      sc.setCombatPose(u.id, u)
      sc.setHue(u.id, SIDE_HUE[u.side])
    }
    sc.syncCombatBarriers(s.field?.barriers ?? [])
  }

  /** The overlays for the phase (TC29). */
  const paint = (u: Ui, s: BattleState) => {
    const sc = scene.current
    if (!sc) return
    const over: { tile: Tile; kind: 'reach' | 'danger' | 'attack' | 'area' }[] = []
    if (reachAll && s.active) for (const k of threatTiles(s, sideOf(s.active))) { const [x, z] = k.split(',').map(Number) as [number, number]; over.push({ tile: [x, z], kind: 'danger' }) }
    if (u.phase === 'move') {
      for (const r of u.moves) over.push({ tile: r.to, kind: u.danger.has(tileKey(r.to)) ? 'danger' : 'reach' })
      if (u.ghost) for (const t of u.ghost.path.slice(1)) over.push({ tile: t, kind: 'area' })
    }
    if (u.phase === 'act' || u.phase === 'target') {
      for (const t of targetsFrom(s, s.active!, u.reach.to)) {
        const tile = targetTile(s, t.target)
        if (tile) over.push({ tile, kind: 'attack' })
      }
    }
    // Rules version 3: the orbital strike's marked tiles until it lands.
    for (const t of s.v3?.strike?.tiles ?? []) over.push({ tile: t, kind: 'danger' })
    for (const unit of s.units) if (unit.status === 'active' && unit.signatureMark) over.push({ tile: unit.signatureMark.tile, kind: 'danger' })
    for (const unit of s.units) {
      if (!unit.windup || unit.status !== 'active') continue
      const tile = targetTile(s, unit.windup.target)
      if (tile) over.push({ tile, kind: 'danger' })
    }
    if (u.phase === 'forecast') for (const id of u.f.suppression?.targets ?? u.f.splash?.targets ?? []) {
      const tile = targetTile(s, id)
      if (tile) over.push({ tile, kind: 'area' })
    }
    sc.setOverlay(over)
    sc.setFocus(s.active ? [s.active, ...(u.phase === 'forecast' && u.act.kind === 'attack' ? [u.act.target] : [])] : [])
  }

  const show = (u: Ui) => { setUi(u); paint(u, session.current.state) }

  // --- Playing cues --------------------------------------------------------------------------------------------------

  const popDoll = (s: BattleState, unit: string, text: string) => {
    const sc = scene.current, u = s.units.find((x) => x.id === unit)
    const at = sc?.headOf(unit)
    if (!u || !at) return
    const d: Doll = { key: Math.random(), unit, at, text, side: u.side, parts: { core: [u.hp.core, u.maxHp.core], leftArm: [u.hp.leftArm, u.maxHp.leftArm], rightArm: [u.hp.rightArm, u.maxHp.rightArm], legs: [u.hp.legs, u.maxHp.legs] } }
    setDolls((all) => [...all, d])
    window.setTimeout(() => setDolls((all) => all.filter((x) => x.key !== d.key)), 1600)
  }

  /** Plays an action's cues on the board, then shows the state as it ended. */
  const play = async (action: BattleAction, cues: readonly Cue[], before: BattleState, after: BattleState, side: 'squad' | 'enemy') => {
    const sc = scene.current
    if (!sc || skipping.current) return
    const speed = speedOf(side)
    const interrupted = () => skipping.current || scene.current !== sc
    const visual = new CombatVisualPlayback(sc, action, cues, before, speed, interrupted,
      entry => { if (debug) combatTrace.current.push(entry) })
    let current: CutInView | null = null
    for (const [i, c] of cues.entries()) {
      if (interrupted()) break
      const timed = await visual?.beforeCue(c, i)
      if (interrupted()) break
      // A walk also ends on a timer, so a page that draws no frames (hidden, throttled) never stalls the battle.
      if (c.kind === 'moved') await Promise.race([sc.walk(c.unit, c.path, speed), wait((c.path.length * 350) / speed + 400)])
      else if (c.kind === 'attack') {
        if (c.mode) popDoll(before, c.unit, FIRE_MODE_LABEL[c.mode])
        const sp = cutInSpeed(settingRef.current, seen.current, c, after)
        seen.current.add(`${c.unit}:${c.with}`)
        if (current) { await wait(CUT_IN_MS[current.speed] / speed / 2); setCutIn(null) }
        const splash = sp === 'full' && c.signature ? signatureArt.get(c.unit + ':' + c.signature.id) : undefined
        current = sp === 'off' ? null : { attacker: c.unit, target: c.target, band: c.band, role: c.role, signature: c.signature?.label,
          splash, speed: sp, numbers: [], key: Math.random() }
        setCutIn(current)
        if (current) await wait(CUT_IN_MS[sp] / speed / 2)
      } else if (c.kind === 'signatureWarning' || c.kind === 'signatureCanceled') {
        popDoll(after, c.unit, c.kind === 'signatureWarning' ? c.label : 'Attack interrupted')
      } else if (c.kind === 'hit' || c.kind === 'miss' || c.kind === 'burn' || c.kind === 'holdHit' || c.kind === 'barrierHit') {
        const text = c.kind === 'miss' ? 'Miss' : `${c.amount}${'crit' in c && c.crit ? '!' : ''}`
        if (current) { const shown: CutInView = { ...(current as CutInView), numbers: [...(current as CutInView).numbers, text] }; current = shown; setCutIn(shown) }
        const target = c.kind === 'burn' ? c.unit : c.kind === 'barrierHit' ? null : c.target
        if (target) popDoll(after, target, text)
      } else if (c.kind === 'rigBreak') sc.setDown(c.unit, true)
      else if (c.kind === 'extracted' || c.kind === 'freed') {
        await visual?.beforeRemoval(c)
        if (!interrupted()) sc.removeFigure(c.unit)
      }
      else if (c.kind === 'talked') {
        popDoll(after, c.target, 'Talked down')
        await visual?.beforeRemoval(c)
        if (!interrupted()) sc.removeFigure(c.target)
      }
      else if (c.kind === 'prepared') popDoll(after, c.unit, `Preparing · ${labelOf(after, c.target)}`)
      else if (c.kind === 'suppressed') popDoll(after, c.target, c.interrupted ? 'Interrupted' : 'Suppressed')
      else if (c.kind === 'mended' && action.kind === 'quickPatch') popDoll(after, c.target, 'Emergency patch')
      else if (c.kind === 'faced') sc.face(c.unit, c.facing)
      else if (c.kind === 'terrain' || c.kind === 'door' || c.kind === 'heights' || c.kind === 'burst') {
        if (visual) syncTerrain(after)
        else sync(after)
      }
      else if (c.kind === 'turned') sc.setHue(c.unit, SIDE_HUE[c.side])
      else if (c.kind === 'resonance') { setResonance({ unit: c.unit, path: c.path, key: Math.random() }); window.setTimeout(() => setResonance(null), 2200) }
      else if (!visual && (c.kind === 'strikeMarked' || c.kind === 'duo' || c.kind === 'order')) sync(after)
      await visual?.afterCue(c, i)
      const ms = timed || (visual && c.kind === 'rigBreak') ? 0 : stepMs(c) / speed
      if (ms) await wait(ms)
    }
    if (current) { await wait(CUT_IN_MS[current.speed] / speed / 2); setCutIn(null) }
    await visual?.finishAttack()
  }

  // --- The loop ------------------------------------------------------------------------------------------------------

  const commit = async (action: BattleAction): Promise<string | null> => {
    if (busy.current) return 'busy'
    const before = session.current.state
    const r = applyAct(session.current, action)
    if ('error' in r) { setToast(r.error); return r.error }
    const side = sideOf(before.active)
    session.current = r.session
    onCommit(r.session)
    busy.current = true
    playingSide.current = side
    combatTrace.current = []
    setUi({ phase: 'watch' })
    scene.current?.setOverlay([])
    await play(action, r.cues, before, r.session.state, side)
    if (!skipping.current) sync(r.session.state)
    setState(r.session.state)
    if (onStoryCues) await onStoryCues(r.cues)
    busy.current = false
    playingSide.current = null
    next()
    return null
  }

  const next = () => {
    const s = session.current.state
    if (s.result) {
      sync(s)
      onEnd(session.current)
      return
    }
    if (isPlayer(s)) {
      if (skipping.current) { skipping.current = false; sync(s); setState(s) }
      const reach = turnReach(s, s.active!)
      show({ phase: 'move', dash: false, moves: reach.moves, danger: reach.danger, ghost: null })
      return
    }
    // The AI's turn: at double speed, or at once while skipping.
    window.setTimeout(() => void commit(chooseAction(session.current.state)), skipping.current ? 0 : 250)
  }

  const skip = () => {
    if (playingSide.current !== 'enemy' && isPlayer(session.current.state)) return
    skipping.current = true
  }

  // --- The board's mount ---------------------------------------------------------------------------------------------

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const sc = new BoardScene(el, { saver: initialSaver(), standInKit })
    scene.current = sc
    sc.resize(layout.width, layout.height, window.devicePixelRatio || 1)
    const s = session.current.state
    terrainKey.current = ''
    let sprite = 0
    for (const u of s.units) {
      const ref = s.input.units.find((i) => i.id === u.id)
      const own = looks.get(u.id)
      // Her own look (an Uma's set or face), else a stand-in set for the first four squad units, else a plain card.
      const standIn = combatSprites === undefined && u.side === 'squad' && ref?.ref?.kind !== 'uma' && sprite < 4 && !/guest/i.test(ref?.label ?? '')
      const look: BoardFigure['look'] = own?.kind === 'combat' ? own : own?.kind === 'set' ? { kind: 'sprite', source: own.source } : own?.kind === 'face' ? { kind: 'standee', face: own.face }
        : standIn || (combatSprites === undefined && ref?.ref?.kind === 'uma' && sprite < 4) ? { kind: 'sprite', set: sprite++ } : { kind: 'standee', face: null }
      sc.addFigure({ id: u.id, tile: [u.x, u.y], facing: u.facing, hue: SIDE_HUE[u.side], look })
    }
    sync(s)
    sc.step()
    const onVisible = () => { if (document.visibilityState === 'visible') sc.wake() }
    document.addEventListener('visibilitychange', onVisible)
    next()
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      sc.dispose()
      scene.current = null
    }
    // Made once a battle.
  }, [])

  useEffect(() => { scene.current?.resize(layout.width, layout.height, window.devicePixelRatio || 1) }, [layout.width, layout.height])
  useEffect(() => { scene.current?.setSaver(saver) }, [saver])
  useEffect(() => { controlRef.current = control }, [control])
  useEffect(() => { paint(ui, session.current.state) }, [reachAll])

  useEffect(() => {
    if (!debug) return
    window.__sandbox = {
      get state() { return session.current.state },
      get board() { return scene.current?.debug ?? null },
      get combat() { return scene.current?.combatDebug ?? null },
      get combatTrace() { return combatTrace.current },
      play: commit,
      skipPlayback: skip,
      act: (a) => { const r = applyAct(session.current, a); if ('error' in r) return r.error; session.current = r.session; onCommit(r.session); sync(r.session.state); setState(r.session.state); return null },
      step: (ms) => scene.current?.step(ms),
      tap: (x, z) => tapRef.current([x, z]),
      auto: async () => {
        controlRef.current = { squad: 'ai', enemy: 'ai' }
        while (!session.current.state.result) {
          const r = applyAct(session.current, chooseAction(session.current.state))
          if ('error' in r) throw new Error(r.error)
          session.current = r.session
          onCommit(r.session)
        }
        sync(session.current.state)
        setState(session.current.state)
        onEnd(session.current)
        return session.current.state.result
      },
    }
    return () => { delete window.__sandbox }
  }, [debug])

  // --- Taps ----------------------------------------------------------------------------------------------------------

  const previewAction = (reach: Reach, dash: boolean, action: Act) => {
    const s = session.current.state
    const result = forecast(s, { kind: 'turn', unit: s.active!, to: reach.to, ...(dash ? { dash: true } : {}), act: action, face: 'N' })
    if ('error' in result) { setToast(result.error); return }
    show({ phase: 'forecast', reach, dash, act: action, f: result })
  }

  const tap = (tile: Tile) => {
    const s = session.current.state
    setTerrain(null)
    scene.current?.setCursor(tile)
    const unit = s.units.find((u) => u.x === tile[0] && u.y === tile[1] && (u.status === 'active' || u.status === 'down'))
    if (ui.phase === 'move') {
      const r = ui.moves.find((m) => m.to[0] === tile[0] && m.to[1] === tile[1])
      if (r) {
        if (ui.ghost && ui.ghost.to[0] === r.to[0] && ui.ghost.to[1] === r.to[1]) {
          // The second tap moves her (still undoable).
          void scene.current?.walk(s.active!, r.path)
          show({ phase: 'act', reach: r, dash: ui.dash })
        } else show({ ...ui, ghost: r })
        return
      }
      if (unit) setInspect(unit.id)
      return
    }
    if (ui.phase === 'act' || ui.phase === 'target') {
      const t = unit ? targetsFrom(s, s.active!, ui.reach.to).find((x) => x.target === unit.id) : null
      const thing = !unit ? targetsFrom(s, s.active!, ui.reach.to).find((x) => { const t2 = targetTile(s, x.target); return !!t2 && t2[0] === tile[0] && t2[1] === tile[1] }) : null
      const pick = t ?? thing
      if (pick) {
        const a: Act = { kind: 'attack', with: pick.mount, target: pick.target, ...(ui.phase === 'target' && ui.aim && unit?.holdHp ? { aim: 'hold' as const } : {}) }
        lastTarget.current = tile
        previewAction(ui.reach, ui.dash, a)
        return
      }
      if (unit) setInspect(unit.id)
      return
    }
    if (ui.phase === 'bench') {
      void commit({ kind: 'bench', unit: s.active!, role: ui.role, at: tile }).then((err) => { if (!err) setToast(null) })
      return
    }
    if (ui.phase === 'order-target' && unit) {
      void commit({ kind: 'order', unit: s.active!, order: ui.order, target: unit.id }).then((err) => { if (!err) { setToast(null); undo() } })
      return
    }
    if (ui.phase === 'order-tile') {
      const role = ui.order === 'reinforce' ? (s.input.bench ?? [])[0] : undefined
      void commit({ kind: 'order', unit: s.active!, order: ui.order, at: tile, ...(role ? { role } : {}) }).then((err) => { if (!err) { setToast(null); undo() } })
      return
    }
    if (ui.phase === 'duo' && unit) {
      void commit({ kind: 'duo', unit: s.active!, target: unit.id }).then((err) => { if (!err) setToast(null) })
      return
    }
    if (unit) setInspect(unit.id)
  }

  tapRef.current = tap

  const undo = () => {
    const s = session.current.state
    const me = s.units.find((u) => u.id === s.active)
    if (!me) return
    scene.current?.place(me.id, [me.x, me.y], me.facing)
    const reach = turnReach(s, me.id)
    show({ phase: 'move', dash: false, moves: reach.moves, danger: reach.danger, ghost: null })
  }

  const toFace = (reach: Reach, dash: boolean, a: Act) => {
    const s = session.current.state
    const foe = s.units.filter((u) => u.side !== sideOf(s.active) && u.status === 'active')
      .sort((x, y) => Math.abs(x.x - reach.to[0]) + Math.abs(x.y - reach.to[1]) - (Math.abs(y.x - reach.to[0]) + Math.abs(y.y - reach.to[1])))[0]
    const toward = lastTarget.current ?? (foe ? [foe.x, foe.y] as Tile : null)
    const face: Dir = toward ? dirTo(reach.to, toward) : s.units.find((u) => u.id === s.active)!.facing
    if (quickTurns) {
      lastTarget.current = null
      void commit({ kind: 'turn', unit: s.active!, to: reach.to, ...(dash ? { dash: true } : {}), act: a, face })
      return
    }
    show({ phase: 'face', reach, dash, act: a, face })
    scene.current?.face(s.active!, face)
  }

  const send = () => {
    if (ui.phase !== 'face') return
    const s = session.current.state
    const me = s.units.find((u) => u.id === s.active)!
    const moved = ui.reach.to[0] !== me.x || ui.reach.to[1] !== me.y
    lastTarget.current = null
    void commit({ kind: 'turn', unit: me.id, ...(moved ? { to: ui.reach.to } : {}), ...(ui.dash ? { dash: true } : {}), act: ui.act, face: ui.face })
  }

  // --- Pointer handling: tap, drag to pan, long press for the terrain card -------------------------------------------

  const point = (e: React.PointerEvent) => toStage(layout, e.clientX, e.clientY)
  const down = (e: React.PointerEvent) => {
    const p = point(e)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    scene.current?.pointerDown(p.x, p.y)
    const timer = window.setTimeout(() => {
      if (!press.current) return
      press.current.fired = true
      const tile = scene.current?.pick(press.current.x, press.current.y)
      if (tile) setTerrain(terrainCard(session.current.state, tile))
    }, 500)
    press.current = { timer, fired: false, x: p.x, y: p.y }
  }
  const move = (e: React.PointerEvent) => {
    const p = point(e)
    if (press.current && Math.hypot(p.x - press.current.x, p.y - press.current.y) > 8) { window.clearTimeout(press.current.timer); press.current = null }
    scene.current?.pointerMove(p.x, p.y)
  }
  const up = (e: React.PointerEvent) => {
    const p = point(e)
    const pr = press.current
    if (pr) window.clearTimeout(pr.timer)
    press.current = null
    const tile = scene.current?.pointerUp(p.x, p.y)
    if (tile && !pr?.fired) tap(tile)
  }

  // --- The commands arc ----------------------------------------------------------------------------------------------

  const me = state.units.find((u) => u.id === state.active)
  const playerTurn = !!me && ui.phase !== 'watch'
  const expedition = state.input.rulesVersion === EXPEDITION_RULES_VERSION
  const scrollActions = expedition && ui.phase === 'more'
  const btn = (label: string, onClick: () => void, primary = false, key = label) => (
    <button key={key} type="button" onClick={onClick}
      className={`pointer-events-auto min-h-11 min-w-24 rounded-full px-4 font-display text-[14px] font-bold shadow ${primary ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-[#141827]/90 text-[#e8ebf5] ring-1 ring-white/15'}`}>
      {label}
    </button>
  )
  const arc: React.ReactNode[] = []
  if (playerTurn && me) {
    if (ui.phase === 'move') {
      arc.push(btn('Act here', () => { const r = ui.moves.find((m) => m.to[0] === me.x && m.to[1] === me.y)!; show({ phase: 'act', reach: r, dash: false }) }))
      if (expanded) arc.push(btn('Auto turn', () => {
        const current = session.current.state
        const next = chooseAction(current)
        void commit(next)
      }))
      arc.push(btn('Wait', () => { const r = ui.moves.find((m) => m.to[0] === me.x && m.to[1] === me.y)!; toFace(r, false, { kind: 'wait' }) }))
      const thruster = state.input.units.find((i) => i.id === me.id)?.loadout.back.kind === 'thruster'
      if (thruster && me.charge >= 1 && state.input.rulesVersion >= 2) arc.push(btn(ui.dash ? 'Dash on' : 'Dash', () => { const r = turnReach(state, me.id, !ui.dash); show({ phase: 'move', dash: !ui.dash, moves: r.moves, danger: r.danger, ghost: null }) }))
      arc.push(btn(me.link ? 'Link on' : 'Link off', () => void commit({ kind: 'link', unit: me.id, on: !me.link })))
      if (quickPatchTargets(state, me.id).length) arc.push(btn('Emergency patch', () => show({ phase: 'patch' })))
      if (me.side === 'squad' && state.field && !state.field.benchUsed && (state.input.bench ?? []).length > 0) {
        for (const role of state.input.bench ?? []) arc.push(btn(`Call ${role}`, () => { show({ phase: 'bench', role }); setToast(`Tap a tile for the ${role}`) }, false, `bench-${role}`))
      }
      const o = state.input.orders
      const left = o && state.v3 ? Math.min(o.slots, 4) - state.v3.orders : 0
      if (me.side === 'squad' && left > 0) arc.push(btn(`Orders ${left}`, () => show({ phase: 'orders' }), false, 'orders'))
      if (me.side === 'squad' && (partnerOf(state, me.id)?.level ?? 0) >= 3) arc.push(btn('Duo', () => { show({ phase: 'duo' }); setToast('Tap the enemy both partners can reach') }, false, 'duo'))
    } else if (training && ui.phase === 'target' && !ui.aim) {
      const targets = targetsFrom(state, me.id, ui.reach.to)
      const mounts = { right: 'Main hand', left: 'Off hand', back: 'Back unit' }
      targets.slice(0, 4).forEach(({ target, mount }) => {
        const name = labelOf(state, target)
        const label = mount === 'back' || targets.some((entry) => entry.target === target && entry.mount !== mount)
          ? `${name} · ${mounts[mount]}` : name
        arc.push(btn(label, () => {
          lastTarget.current = targetTile(state, target)
          previewAction(ui.reach, ui.dash, { kind: 'attack', with: mount, target })
        }, true, `${target}:${mount}`))
      })
      arc.push(btn('Back', () => show({ phase: 'act', reach: ui.reach, dash: ui.dash })))
    } else if (ui.phase === 'act' || ui.phase === 'target') {
      const targets = targetsFrom(state, me.id, ui.reach.to)
      if (targets.length > 0) arc.push(btn('Attack', () => show({ phase: 'target', reach: ui.reach, dash: ui.dash, aim: false }), ui.phase !== 'target'))
      const canAimHold = targets.some((t) => state.units.find((u) => u.id === t.target)?.holdHp)
      if (canAimHold) arc.push(btn('Aim at Hold', () => show({ phase: 'target', reach: ui.reach, dash: ui.dash, aim: true })))
      const placed = ui.dash ? { ...state, units: state.units.map(unit => unit.id === me.id ? { ...unit, charge: unit.charge - 1 } : unit) } : state
      const support = supportFrom(placed, me.id, ui.reach.to)
      const signature = state.input.units.find(unit => unit.id === me.id)?.signature
      for (const act of support) if (act.kind === 'attack' && act.signature && signature) {
        arc.push(btn(`${signature.label} · ${labelOf(state, act.target)}`,
          () => previewAction(ui.reach, ui.dash, act), false, `signature-${act.target}`))
      }
      for (const act of support) if (act.kind === 'talk') {
        arc.push(btn(actWords(state, act), () => {
          lastTarget.current = targetTile(state, act.target)
          previewAction(ui.reach, ui.dash, act)
        }, false, `talk-${act.target}`))
      }
      if (onTalkReply) for (const contact of state.input.talk ?? []) {
        const target = state.units.find(u => u.id === contact.target && u.status === 'active')
        if (!target || Math.abs(target.x - ui.reach.to[0]) + Math.abs(target.y - ui.reach.to[1]) !== 1) continue
        const reason = contact.actor !== me.id ? 'refused' : contact.requires === 'actorHit' && !target.talkHit ? 'notYet' : undefined
        if (reason) arc.push(btn(`Speak to ${labelOf(state, target.id)}`, () => onTalkReply(target.id, reason), false, `reply-${target.id}`))
      }
      if (support.some((act) => act.kind !== 'talk' && act.kind !== 'attack')) arc.push(btn('More', () => show({ phase: 'more', reach: ui.reach, dash: ui.dash })))
      arc.push(btn('Wait', () => toFace(ui.reach, ui.dash, { kind: 'wait' })))
      arc.push(btn('Done', () => toFace(ui.reach, ui.dash, { kind: 'none' })))
      arc.push(btn('Undo', undo))
    } else if (ui.phase === 'more') {
      const placed = { ...state, units: state.units.map((u) => (u.id === me.id ? { ...u, x: ui.reach.to[0], y: ui.reach.to[1] } : u)) }
      const actions = supportFrom(placed, me.id, ui.reach.to).filter((act) => act.kind !== 'talk' && act.kind !== 'attack')
      const shown = expedition ? actions : actions.slice(0, 8)
      shown.forEach((a, i) => arc.push(btn(actWords(state, a),
        () => previewAction(ui.reach, ui.dash, a), false, `more-${i}`)))
      arc.push(btn('Back', () => show({ phase: 'act', reach: ui.reach, dash: ui.dash })))
    } else if (ui.phase === 'face') {
      arc.push(
        <div key="arrows" className="pointer-events-auto grid grid-cols-3 gap-1">
          {(['', 'N', '', 'W', '', 'E', '', 'S', ''] as const).map((d, i) => d
            ? <button key={i} type="button" aria-label={`Face ${d}`} onClick={() => { show({ ...ui, face: d }); scene.current?.face(me.id, d) }}
              className={`min-h-11 min-w-11 rounded-md text-[18px] font-bold ${ui.face === d ? 'bg-[#2ee6ff] text-[#0b0d17]' : 'bg-[#141827]/90 text-white ring-1 ring-white/15'}`}>{ARROW[d]}</button>
            : <span key={i} />)}
        </div>,
      )
      arc.push(btn('Confirm', send, true))
      arc.push(btn('Undo', undo))
    } else if (ui.phase === 'patch') {
      for (const target of quickPatchTargets(state, me.id)) {
        arc.push(btn(`Patch ${labelOf(state, target.id)}`, () => void commit({ kind: 'quickPatch', unit: me.id, target: target.id }), true, target.id))
      }
      arc.push(btn('Back', undo))
    } else if (ui.phase === 'bench') arc.push(btn('Cancel call', undo))
    else if (ui.phase === 'orders') {
      for (const kind of state.input.orders?.kinds ?? []) {
        const words = ORDER[kind]
        // An Order that takes nothing is checked now; one that takes a unit or a tile is checked on the tap.
        const blocked = words.takes === 'none' ? orderError(state, { kind: 'order', unit: me.id, order: kind }) : null
        if (blocked) continue
        arc.push(btn(words.label, () => {
          if (words.takes === 'none') void commit({ kind: 'order', unit: me.id, order: kind }).then((err) => { if (!err) undo() })
          else { show({ phase: words.takes === 'unit' ? 'order-target' : 'order-tile', order: kind }); setToast(words.takes === 'unit' ? `Tap the Uma or enemy for ${words.label}` : `Tap a tile for ${words.label}`) }
        }, false, `order-${kind}`))
      }
      arc.push(btn('Back', undo))
    } else if (ui.phase === 'order-target' || ui.phase === 'order-tile' || ui.phase === 'duo') arc.push(btn('Cancel', () => { setToast(null); undo() }))
  }

  const timelineIds = timeline(state)
  const ghost = ui.phase === 'forecast' ? ui.f.timeline : null
  const inspected = inspect ? state.units.find((u) => u.id === inspect) : null
  const shot = ui.phase === 'forecast' && ui.act.kind === 'attack' && !ui.act.signature ? ui.act : null
  const conversation = ui.phase === 'forecast' && ui.act.kind === 'talk' ? talkContact(state, ui.act.target) : null
  const shooter = state.input.units.find(({ id }) => id === me?.id)
  const modes = shot && shooter ? fireModes(shooter, shot.with, state.input.rulesVersion) : []
  const aimTarget = (training || !!modes.length) && shot && me && canAim(state, me.id) && shot.mode !== 'area' && shot.mode !== 'suppress'
    ? state.units.find((unit) => unit.id === shot.target) : null
  return (
    <div className="absolute inset-0 select-none overflow-hidden">
      <canvas ref={canvas} className="block h-full w-full" style={{ touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onPointerCancel={() => { scene.current?.pointerCancel(); press.current = null }} />
      {resonance && (
        <div key={resonance.key} data-resonance={resonance.unit} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className={`rounded-2xl px-8 py-5 text-center font-display shadow-2xl ring-2 ${resonance.path === 'heart' ? 'bg-[#ff3dc8]/85 ring-[#ffb3ec]' : 'bg-[#2ee6ff]/85 ring-[#b3f5ff]'} text-[#0b0d17]`}>
            <div className="text-[13px] uppercase tracking-[0.3em]">Resonance</div>
            <div className="text-[30px] font-bold">{labelOf(state, resonance.unit)}</div>
            <div className="text-[16px] font-semibold">{resonance.path === 'heart' ? 'Devotion' : 'Resolve'}</div>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: 'calc(var(--inset-top) + 6px)' }}>
        <Timeline state={state} ids={timelineIds} ghost={ghost} onInspect={setInspect} />
      </div>
      <div className="pointer-events-none absolute flex flex-col items-end gap-1 text-xs font-semibold text-white"
        style={{ top: 'calc(var(--inset-top) + 55px)', right: 'calc(var(--inset-right) + 6px)' }}>
        {objectiveLabel && <div className="flex items-center rounded bg-black/75 pl-2">{objectiveLabel}
          <BattleHelp topic={objectiveTopics[state.input.objective.kind]} version={state.input.rulesVersion} disabled={busy.current} />
          {!!state.input.protect?.length && <BattleHelp topic="protect" version={state.input.rulesVersion} disabled={busy.current} />}
        </div>}
        {!state.result && state.units.filter(unit => unit.status === 'active' && unit.signatureMark).map(unit =>
          <p key={unit.id} className="rounded bg-[#58263d] px-2 py-1">
            {state.input.units.find(input => input.id === unit.id)?.signature?.label} · Tile marked
          </p>)}
      </div>
      <div className="pointer-events-none absolute flex flex-col gap-2" style={{ top: 'calc(var(--inset-top) + 6px)', left: 'calc(var(--inset-left) + 6px)' }}>
        <button type="button" onClick={onQuit} className="pointer-events-auto min-h-11 rounded-md bg-[#141827]/90 px-3 text-[13px] font-semibold text-white ring-1 ring-white/15">{quitLabel}</button>
        <button type="button" onClick={() => setReachAll((v) => !v)} className="pointer-events-auto min-h-11 rounded-md bg-[#141827]/90 px-3 text-[13px] font-semibold text-white ring-1 ring-white/15">Reach {reachAll ? 'on' : 'off'}</button>
        <button type="button" onClick={() => setCutInSetting((v) => (v === 'auto' ? 'quick' : v === 'quick' ? 'off' : 'auto'))} className="pointer-events-auto min-h-11 rounded-md bg-[#141827]/90 px-3 text-[13px] font-semibold text-white ring-1 ring-white/15">Cut-in {cutInSetting}</button>
        <button type="button" onClick={() => setSaver((v) => !v)} className="pointer-events-auto min-h-11 rounded-md bg-[#141827]/90 px-3 text-[13px] font-semibold text-white ring-1 ring-white/15">Saver {saver ? 'on' : 'off'}</button>
        {!inspected && !terrain && <BattleHelp version={state.input.rulesVersion} disabled={busy.current || !isPlayer(state) && !state.result} />}
        {expedition && <select aria-label="Inspect squad member" value={inspected?.side === 'squad' ? inspected.id : ''}
          onChange={event => setInspect(event.currentTarget.value || null)}
          className="pointer-events-auto min-h-11 max-w-44 rounded-md bg-[#141827] px-2 text-[13px] font-semibold text-white ring-1 ring-white/15">
          <option value="">Squad · 10</option>
          {state.units.filter(unit => unit.side === 'squad').map(unit => <option key={unit.id} value={unit.id}>{labelOf(state, unit.id)}</option>)}
        </select>}
        {expanded && <button type="button" onClick={() => setQuickTurns(!quickTurns)} aria-pressed={quickTurns}
          className="pointer-events-auto min-h-11 rounded-md bg-[#141827]/90 px-3 text-[13px] font-semibold text-white ring-1 ring-white/15">Auto face {quickTurns ? 'on' : 'off'}</button>}
        {inspected && <UnitCard state={state} unit={inspected} onClose={() => setInspect(null)} />}
        {terrain && <TerrainPanel card={terrain} version={state.input.rulesVersion} onClose={() => setTerrain(null)} />}
      </div>
      {me && !isPlayer(state) && !state.result && (
        <div className="absolute" style={{ bottom: 'calc(var(--inset-bottom) + 10px)', right: 'calc(var(--inset-right) + 10px)' }}>{btn('Skip', skip, true)}</div>
      )}
      <div className={`absolute flex max-w-[46%] flex-wrap items-end justify-end gap-2 ${scrollActions ? 'pointer-events-auto max-h-[66%] overflow-y-auto overscroll-contain p-1' : 'pointer-events-none'}`} style={{ bottom: 'calc(var(--inset-bottom) + 10px)', right: 'calc(var(--inset-right) + 10px)' }}>
        {ui.phase === 'forecast' && <ForecastCard state={state} f={ui.f} onCancel={() => show({ phase: 'act', reach: ui.reach, dash: ui.dash })} onConfirm={() => toFace(ui.reach, ui.dash, ui.act)}>
          {actionHelpTopic(ui.act) !== 'forecast' && <BattleHelp topic={actionHelpTopic(ui.act)} version={state.input.rulesVersion} />}
          {conversation && <p className="mt-2 text-[13px] text-white/80">{conversation.hint}</p>}
          {shot && me && modes.length > 0 && <div className="mt-2 grid grid-cols-2 gap-1" aria-label="Firing mode">
            {([undefined, ...modes] as const).map((mode) => {
              const act = { ...shot, mode, aim: mode === 'area' || mode === 'suppress' ? undefined : shot.aim }
              const result = forecast(state, { kind: 'turn', unit: me.id, to: ui.reach.to, dash: ui.dash, act, face: me.facing })
              return <button type="button" key={mode ?? 'base'} aria-pressed={shot.mode === mode} disabled={'error' in result}
                className="min-h-11 rounded-md bg-white/10 aria-pressed:ring-2 aria-pressed:ring-cyan-300 disabled:opacity-40"
                onClick={() => previewAction(ui.reach, ui.dash, act)}>
                {mode ? `${FIRE_MODE_LABEL[mode]} · ${modeCost(mode)}` : 'Standard'}
              </button>
            })}
          </div>}
          {shot?.mode === 'impact' && <p className="mt-1 text-[#ffb84d]">On hit · Drain 1 Charge</p>}
          {shot?.mode === 'thermal' && <p className="mt-1 text-[#ffb84d]">On hit · Ignite tile</p>}
          {shot && aimTarget && <div className="mt-2 grid grid-cols-2 gap-1" aria-label="Aim">
            {(['core', 'leftArm', 'rightArm', 'legs'] as const).filter((part) => aimTarget.hp[part] > 0).map((part) => (
              <button key={part} type="button" aria-pressed={shot.aim === part}
                className="min-h-11 flex-1 rounded-md bg-white/10 aria-pressed:ring-2 aria-pressed:ring-cyan-300"
                onClick={() => previewAction(ui.reach, ui.dash, { ...shot, aim: shot.aim === part ? undefined : part })}>
                Aim {{ core: 'Core', leftArm: 'left arm', rightArm: 'right arm', legs: 'Legs' }[part]}
              </button>
            ))}
          </div>}
        </ForecastCard>}
        {arc}
      </div>
      {me && playerTurn && (
        <div className="pointer-events-none absolute text-[12px] font-semibold text-white/80 [text-shadow:0_1px_2px_#000]" style={{ bottom: 'calc(var(--inset-bottom) + 10px)', left: 'calc(var(--inset-left) + 10px)' }}>
          {labelOf(state, me.id)} · Charge {me.charge}{ui.phase === 'move' ? (ui.ghost ? ' · tap again to move' : ' · tap a tile') : ui.phase === 'target' ? ' · tap a target' : ''}
        </div>
      )}
      {dolls.map((d) => <PaperDoll key={d.key} d={d} />)}
      {cutIn && <CutIn key={cutIn.key} state={state} c={cutIn} />}
      {toast && (
        <button type="button" onClick={() => setToast(null)} className="pointer-events-auto absolute left-1/2 top-16 -translate-x-1/2 rounded-md bg-black/80 px-3 py-2 text-[13px] text-white">{toast}</button>
      )}
    </div>
  )
}
