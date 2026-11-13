// The board's test bench at /board (CY7): the battle board on the turned landscape stage, with thirteen stand-ins. Tap a
// unit for her reach (TC29's colours), tap a blue or magenta tile to walk her there, drag to pan. `?debug` puts
// `window.__board` on the page (step, pick, figures, drawCalls, fps, saver, record) and a readout of the same numbers:
// the preview pane can't screenshot WebGL, so checks read this. `?map=flat-14` swaps the map.
import { reachable, type BattleMap, type BattleState, type Dir } from '@cyber/battle'
import { initialSaver, toStage, TurnedStage, type StageLayout } from '@luismlorenzana/uma-stage'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { benchBattle, ENEMY_HUE, GUEST_HUE, reachOverlay, SQUAD_HUE } from './bench'
import { BoardScene, type Tile } from './scene'

const MAPS = import.meta.glob<{ default: BattleMap }>('../../../../scenarios/maps/*.json', { eager: true })
const mapById = (id: string): BattleMap | null => Object.entries(MAPS).find(([path]) => path.endsWith(`/${id}.json`))?.[1].default ?? null

export interface BoardHandle {
  step: (ms?: number) => void
  pick: (x: number, y: number) => Tile | null
  readonly figures: number
  readonly drawCalls: number
  readonly fps: number
  readonly saver: boolean
  readonly debug: BoardScene['debug']
  setSaver: (on: boolean) => void
  /** The frame-rate check: renders every frame for `ms` while panning back and forth, then the FpsRecorder's stats. */
  record: (ms?: number) => Promise<ReturnType<ReturnType<BoardScene['beginRecord']>['stats']>>
  tap: (x: number, z: number) => void
}

declare global { interface Window { __board?: BoardHandle } }

export default function BoardScreen() {
  return <TurnedStage>{(layout) => <Board layout={layout} />}</TurnedStage>
}

function Board({ layout }: { layout: StageLayout }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<BoardScene | null>(null)
  const battle = useRef<BattleState | null>(null)
  const selected = useRef<string | null>(null)
  const [saver, setSaver] = useState(initialSaver)
  const [readout, setReadout] = useState<BoardScene['debug'] | null>(null)
  const debug = params.has('debug')
  const mapId = params.get('map') ?? 'heights-14'

  /** A tap on a tile: select the unit there, walk the selected one to a reachable tile, or clear. */
  const tap = (tile: Tile | null) => {
    const s = scene.current, b = battle.current
    if (!s || !b) return
    s.setCursor(tile)
    if (!tile) { selected.current = null; s.setOverlay([]); s.setFocus([]); return }
    const unit = b.units.find((u) => u.x === tile[0] && u.y === tile[1] && u.status === 'active')
    if (unit) {
      selected.current = unit.id
      s.setOverlay(reachOverlay(b, unit.id))
      s.setFocus([unit.id])
      return
    }
    const id = selected.current
    const reach = id ? reachOverlay(b, id).find((o) => o.kind !== 'attack' && o.tile[0] === tile[0] && o.tile[1] === tile[1]) : null
    if (id && reach) {
      const me = b.units.find((u) => u.id === id)!
      const path = reachable(b, id).find((r) => r.to[0] === tile[0] && r.to[1] === tile[1])?.path ?? [tile]
      battle.current = { ...b, units: b.units.map((u) => (u.id === id ? { ...u, x: tile[0], y: tile[1] } : u)) }
      s.setOverlay([])
      void s.walk(id, path).then(() => s.face(id, me.side === 'squad' ? 'N' : 'S'))
      selected.current = null
      return
    }
    selected.current = null
    s.setOverlay([])
    s.setFocus([])
  }

  useEffect(() => {
    const el = canvas.current
    const map = mapById(mapId)
    if (!el || !map) return
    const s = new BoardScene(el, { saver: initialSaver() })
    scene.current = s
    s.resize(layout.width, layout.height, window.devicePixelRatio || 1)
    s.setMap(map)
    const b = benchBattle(map)
    battle.current = b
    let sprite = 0
    for (const u of b.units) {
      const isUma = u.id.startsWith('uma-')
      s.addFigure({
        id: u.id, tile: [u.x, u.y], facing: u.facing as Dir,
        look: isUma ? { kind: 'sprite', set: sprite++ } : { kind: 'standee', face: null },
        hue: u.side === 'enemy' ? ENEMY_HUE : isUma ? SQUAD_HUE : GUEST_HUE,
      })
    }
    s.step()
    const onVisible = () => { if (document.visibilityState === 'visible') s.wake() }
    document.addEventListener('visibilitychange', onVisible)
    if (debug) {
      window.__board = {
        step: (ms) => s.step(ms), pick: (x, y) => s.pick(x, y), get figures() { return s.debug.figures }, get drawCalls() { return s.debug.drawCalls },
        get fps() { return s.debug.fps }, get saver() { return s.debug.saver }, get debug() { return s.debug }, setSaver: (on) => { s.setSaver(on); setSaver(on) },
        tap: (x, z) => tap([x, z]),
        record: async (ms = 10_000) => {
          const rec = s.beginRecord()
          s.setAnimating(true)
          const t0 = performance.now(), cx = layout.width / 2, cy = layout.height / 2
          s.pointerDown(cx, cy)
          await new Promise<void>((resolve) => {
            const pan = () => {
              const t = (performance.now() - t0) / 1000
              s.pointerMove(cx + Math.sin(t * 1.3) * 160, cy + Math.cos(t * 0.9) * 90)
              if (performance.now() - t0 < ms) requestAnimationFrame(pan)
              else resolve()
            }
            requestAnimationFrame(pan)
          })
          s.pointerUp(cx, cy)
          s.setAnimating(false)
          return rec.stats()
        },
      }
    }
    const timer = debug ? window.setInterval(() => setReadout(s.debug), 500) : 0
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      if (window.__board) delete window.__board
      s.dispose()
      scene.current = null
    }
    // Made once a map; the layout's size comes through the next effect.
  }, [mapId])

  useEffect(() => { scene.current?.resize(layout.width, layout.height, window.devicePixelRatio || 1) }, [layout.width, layout.height])
  useEffect(() => { scene.current?.setSaver(saver) }, [saver])

  const point = (e: React.PointerEvent) => toStage(layout, e.clientX, e.clientY)
  return (
    <div className="absolute inset-0 select-none">
      <canvas ref={canvas} className="block h-full w-full" style={{ touchAction: 'none' }}
        onPointerDown={(e) => { const p = point(e); (e.target as Element).setPointerCapture(e.pointerId); scene.current?.pointerDown(p.x, p.y) }}
        onPointerMove={(e) => { const p = point(e); scene.current?.pointerMove(p.x, p.y) }}
        onPointerUp={(e) => { const p = point(e); const tile = scene.current?.pointerUp(p.x, p.y); if (tile) tap(tile) }}
        onPointerCancel={() => scene.current?.pointerCancel()} />
      <div className="pointer-events-none absolute flex gap-2" style={{ top: 'calc(var(--inset-top) + 8px)', left: 'calc(var(--inset-left) + 8px)' }}>
        <button type="button" onClick={() => void navigate('/')} className="pointer-events-auto min-h-11 rounded-md bg-sunken/80 px-4 font-display font-bold text-ink">Back</button>
        <button type="button" onClick={() => setSaver((v) => !v)} className="pointer-events-auto min-h-11 rounded-md bg-sunken/80 px-4 text-[14px] font-semibold text-ink">
          Saver {saver ? 'on' : 'off'}
        </button>
      </div>
      {debug && readout && (
        <pre data-board-readout className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 p-2 text-[11px] leading-4 text-white">
          {`figures ${readout.figures} (sprites ${readout.sprites}, live sets ${readout.liveSets})\ndraw calls ${readout.drawCalls}\nfps ${readout.fps}  saver ${readout.saver ? 'on' : 'off'}\ndevice ${readout.device.width}×${readout.device.height} @${readout.device.ratio}\nfaded ${readout.faded.length}`}
        </pre>
      )}
    </div>
  )
}
