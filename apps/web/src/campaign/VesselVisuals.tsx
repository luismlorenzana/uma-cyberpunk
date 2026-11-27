import { useEffect, useRef } from 'react'
import { COMMAND_HULL, STATION_MODULES, STATION_ROOMS, stationRoom, type StationModule, type StationState } from '@cyber/domain'

type Rect = readonly [x: number, y: number, width: number, height: number]
type Point = readonly [x: number, y: number]
type RoomState = ReturnType<typeof stationRoom>
type Context = CanvasRenderingContext2D

const sockets: Record<StationModule, Rect> = {
  bridge: [212, 61, 57, 29],
  'jump-ring': [202, 20, 77, 28],
  'secure-ward': [148, 61, 52, 30],
  rehabilitation: [281, 61, 53, 30],
  quarters: [141, 104, 62, 35],
  'habitat-a': [73, 102, 60, 39],
  'habitat-b': [8, 102, 57, 39],
  infirmary: [89, 156, 66, 29],
  reactor: [277, 104, 62, 35],
  'reactor-bank': [347, 102, 60, 39],
  fabrication: [415, 102, 57, 39],
  'life-support': [327, 156, 66, 29],
  cargo: [188, 155, 46, 35],
  cutter: [247, 155, 46, 35],
  shipyard: [196, 204, 89, 28],
}

const lamp: Record<RoomState, string> = {
  active: '#72ead6', off: '#91a0b2', building: '#ffca7d', empty: '#527089',
}
const surface = '#263c54'
const trim = '#688ca6'

function polygon(ctx: Context, points: readonly Point[], fill: string, stroke?: string) {
  ctx.beginPath()
  ctx.moveTo(...points[0]!)
  for (const point of points.slice(1)) ctx.lineTo(...point)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.stroke()
  }
}

function plate(ctx: Context, [x, y, w, h]: Rect, fill: string, stroke: string, bevel = 5) {
  polygon(ctx, [[x + bevel, y], [x + w - bevel, y], [x + w, y + bevel], [x + w, y + h - bevel],
    [x + w - bevel, y + h], [x + bevel, y + h], [x, y + h - bevel], [x, y + bevel]], fill, stroke)
}

function bar(ctx: Context, [x, y, w, h]: Rect, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

function wire(ctx: Context, points: readonly Point[], color: string, width = 1) {
  ctx.beginPath()
  ctx.moveTo(...points[0]!)
  for (const point of points.slice(1)) ctx.lineTo(...point)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
  ctx.lineWidth = 1
}

function ellipses(ctx: Context, rings: readonly Rect[], color: string) {
  ctx.strokeStyle = color
  for (const [x, y, rx, ry] of rings) {
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawStation(ctx: Context, state: StationState) {
  const transit = !!state.move
  const charge = transit ? lamp.building : lamp.active
  ellipses(ctx, [[240, 125, 235, 77], [240, 125, 197, 104], [240, 125, 118, 118]], '#233b53')
  wire(ctx, [[5, 122], [475, 122]], '#344b62')
  wire(ctx, [[240, 8], [240, 239]], '#344b62')

  for (const id of STATION_ROOMS) {
    const [x, y, w, h] = sockets[id]
    const status = stationRoom(state, id)
    const cx = x + w / 2, cy = y + h / 2
    if (status === 'empty') continue
    const path: Point[] = cy < 100 || cy > 145 ? [[240, 122], [cx, 122], [cx, cy]] : [[240, 122], [cx, cy]]
    wire(ctx, path, '#496783', 8)
    wire(ctx, path, '#14253a', 4)
  }
  plate(ctx, [200, 86, 80, 76], '#243b53', '#83a0b8', 16)
  plate(ctx, [212, 97, 56, 54], '#15283e', trim, 12)
  plate(ctx, [223, 107, 34, 34], '#1d4d60', charge, 7)
  ellipses(ctx, [[240, 124, 11, 11], [240, 124, 6, 6]], charge)
  bar(ctx, [238, 122, 4, 4], '#d2fff5')
  if (stationRoom(state, 'jump-ring') !== 'empty') {
    ellipses(ctx, [[240, 77, 47, 47]], transit ? '#bc8d55' : '#3b657e')
  }
  for (const id of STATION_ROOMS) {
    const rect = sockets[id]
    const [x, y, w, h] = rect
    const status = stationRoom(state, id)
    if (status === 'empty') continue
    if (status === 'building') ctx.setLineDash([4, 3])
    plate(ctx, rect, status === 'building' ? '#352f30' : surface, lamp[status])
    ctx.setLineDash([])
    bar(ctx, [x + 7, y + 5, w - 14, h - 10], '#15273b')
    bar(ctx, [x + 7, y + h - 7, w - 14, 2], '#415873')
    for (let light = x + 10; light < x + w - 7; light += 7) {
      bar(ctx, [light, y + 9, 3, 4], lamp[status])
    }
    if (status === 'building') {
      wire(ctx, [[x + 9, y + h - 10], [x + w - 9, y + 8]], lamp.building)
    } else {
      plate(ctx, [x + w / 2 - 7, y + h / 2 - 1, 14, 9], '#324e65', trim, 2)
    }
  }
}

function drawRoom(ctx: Context, room: StationModule, status: RoomState, cutterBerthed: boolean) {
  const { berths, deck } = STATION_MODULES[room]
  const color = lamp[status]
  plate(ctx, [9, 9, 302, 94], '#112136', trim, 12)
  plate(ctx, [19, 18, 282, 76], status === 'off' ? '#182231' : '#233a50', color, 8)
  bar(ctx, [34, 52, 251, 8], '#172a3e')
  bar(ctx, [68, 55, 183, 1], color)
  if (status === 'empty' || status === 'building') {
    ctx.setLineDash([6, 5])
    plate(ctx, [65, 29, 190, 54], '#1a2b3e', color, 7)
    ctx.setLineDash([])
    if (status === 'building') {
      wire(ctx, [[77, 74], [128, 35], [183, 74], [241, 35]], color, 2)
    }
    return
  }
  if (berths) {
    const blocks = Math.max(4, berths / 10)
    const perRow = blocks / 2
    const step = 224 / perRow
    for (let index = 0; index < blocks; index++) {
      const x = 48 + (index % perRow) * step, y = index < perRow ? 24 : 63
      plate(ctx, [x, y, Math.min(38, step - 4), 24], '#182c40', trim, 3)
      bar(ctx, [x + 4, y + 5, 8, 2], color)
      bar(ctx, [x + 4, y + 10, 15, 8], '#3d5d74')
    }
    return
  }
  if (room === 'cutter' || room === 'shipyard') {
    plate(ctx, [88, 24, 144, 63], '#142638', color, 6)
    wire(ctx, [[103, 28], [103, 84]], trim, 2)
    wire(ctx, [[217, 28], [217, 84]], trim, 2)
    if (cutterBerthed) drawCutter(ctx, '#75ddd0', COMMAND_HULL, false, 'berthed', [109, 34, 102, 42])
    return
  }
  for (const x of [45, 92, 185, 232]) {
    const y = x === 45 || x === 232 ? 28 : 65
    plate(ctx, [x, y, 42, 18], '#172b40', trim, 3)
    bar(ctx, [x + 5, y + 4, 18, 2], color)
  }
  if (deck === 'Engineering' || room === 'jump-ring') {
    ellipses(ctx, [[160, 56, 23, 23], [160, 56, 16, 16], [160, 56, 7, 7]], color)
  } else {
    plate(ctx, [137, 39, 46, 31], '#172c40', color, 6)
    bar(ctx, [143, 43, 34, 7], '#3b6475')
  }
}

export type CutterPresentation = 'commissioning' | 'berthed' | 'underway'

function drawCutter(ctx: Context, stripe: string, integrity: number, reinforced: boolean, state: CutterPresentation, [x, y, w, h]: Rect) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(w / 288, h / 112)
  const construction = state === 'commissioning'
  if (construction) ctx.setLineDash([5, 4])
  if (state !== 'underway') {
    wire(ctx, [[39, 17], [20, 17], [20, 97], [39, 97]], trim, 2)
    wire(ctx, [[249, 17], [270, 17], [270, 97], [249, 97]], trim, 2)
  } else {
    for (const offset of [43, 61, 76]) bar(ctx, [7, offset, 34, 2], stripe)
  }
  polygon(ctx, [[30, 34], [69, 27], [87, 12], [150, 19], [172, 33], [218, 39], [264, 56],
    [218, 74], [172, 79], [150, 94], [87, 100], [69, 85], [30, 78]], '#243d56', construction ? lamp.building : trim)
  ctx.setLineDash([])
  polygon(ctx, [[52, 41], [101, 30], [172, 39], [218, 47], [248, 56], [218, 66], [172, 73],
    [101, 82], [52, 70]], '#152c44', '#78a3b7')
  polygon(ctx, [[167, 44], [200, 46], [225, 56], [200, 66], [167, 68], [155, 56]], '#314f69', stripe)
  bar(ctx, [96, 53, 57, 7], stripe)
  for (const offset of [33, 69]) {
    plate(ctx, [35, offset, 38, 11], '#183347', construction ? lamp.building : stripe, 3)
    if (reinforced) plate(ctx, [97, offset - 4, 48, 14], '#4f6881', '#b0c8df', 4)
  }
  if (integrity < COMMAND_HULL) {
    const impact = integrity <= COMMAND_HULL / 2 ? '#ffab83' : '#ffd5a1'
    wire(ctx, [[132, 79], [141, 67], [151, 81], [163, 73]], impact, 2)
  }
  ctx.restore()
}

function render(ref: HTMLCanvasElement | null, draw: (ctx: Context) => void) {
  if (!ref) return
  const ctx = ref.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, ref.width, ref.height)
  draw(ctx)
}

export function StationExterior({ state }: { state: StationState }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const installed = STATION_ROOMS.filter(id => {
    const status = stationRoom(state, id)
    return status === 'active' || status === 'off'
  }).length
  useEffect(() => render(ref.current, ctx => drawStation(ctx, state)), [state])
  return <figure className="m-0 min-w-0 self-start overflow-hidden rounded-lg border border-cyan-100/20 bg-[#081424] p-1.5"
    data-station-exterior data-installed={installed} data-relocating={!!state.move}>
    <canvas ref={ref} width={480} height={244} aria-hidden="true" className="block h-auto max-h-32 w-full object-contain" />
    <figcaption className="flex flex-wrap justify-between gap-x-2 px-2 pb-1 text-xs text-slate-300">
      <span>Station exterior</span><span>{installed}/{STATION_ROOMS.length} facilities{state.move && ' · Jump queued'}</span>
    </figcaption>
  </figure>
}

export function StationRoomPlan({ room, status, cutterBerthed }: { room: StationModule; status: RoomState; cutterBerthed: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => render(ref.current, ctx => drawRoom(ctx, room, status, cutterBerthed)), [room, status, cutterBerthed])
  return <canvas ref={ref} width={320} height={112} aria-hidden="true"
    className="block h-auto max-h-28 w-full rounded border border-cyan-100/20 bg-[#0a1322]"
    data-room-plan={room} data-room-plan-state={status} />
}

export function CutterVisual({ id, name, state, integrity = COMMAND_HULL, reinforced = false, compact = false }: {
  id: string; name: string; state: CutterPresentation; integrity?: number; reinforced?: boolean; compact?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hue = [...id].reduce((value, part) => ((value * 31) + part.charCodeAt(0)) >>> 0, 0) % 360
  useEffect(() => render(ref.current, ctx => {
    ctx.save()
    ctx.scale(compact ? .5 : 1, compact ? .5 : 1)
    drawCutter(ctx, `hsl(${hue} 76% 69%)`, integrity, reinforced, state, [0, 0, 288, 112])
    ctx.restore()
  }), [hue, integrity, reinforced, state, compact])
  return <canvas ref={ref} width={compact ? 144 : 288} height={compact ? 56 : 112}
    role="img" aria-label={`${name} exterior · ${state}${reinforced ? ' · Reinforced' : ''}${integrity < COMMAND_HULL ? ' · Damaged' : ''}`}
    data-cutter-exterior={id} data-cutter-state={state} data-cutter-hull={integrity} data-cutter-reinforced={reinforced}
    className={compact ? 'block h-auto w-28 shrink-0 rounded bg-[#081424]' : 'block h-auto max-h-28 w-full rounded-lg border border-cyan-100/20 bg-[#081424] object-contain'} />
}
