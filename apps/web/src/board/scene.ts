// The battle board (CY7, BP3): a game-owned scene built from uma-stage 0.3.0's parts, in the shape of its `BandStage`
// (copied, never imported: uma-platform P2). The map's terrain from the stand-in biome kit, a night grade, the four live
// lights, tilt-shift and bloom unless the saver is on; Umas as sprites and enemies as standees, each on a base ring with
// a facing wedge; the reach overlays and a cursor; picking by tile tops; a two-axis pan; the fade of high ground in front
// of the units in focus; and a loop that renders only when something changes. three.js, loaded with the board's route.
import type { BattleMap, Dir } from '@cyber/battle'
import {
  boxOf, buildWorldParts, CAMERA_PITCH, cameraOffset, cardQuad, coveringOccluders, deviceSize, drawStandInKit, Effects, figureTarget, FpsRecorder,
  FramePacer, frustum, liveSets, pickAt, pixelTexture, project, roomGeometry, SAVER_FPS, snapToGrid, SpriteActor, spriteStretch, Standee, STANDEE,
  standInKitAtlas, standInSet, stepFade, TEXELS_PER_UNIT, tileQuad, tintAt, type Facing, type FadeTarget, type Occluder, type PickTarget, type StageGrade,
  type View,
} from '@luismlorenzana/uma-stage'
import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide, Group, HemisphereLight, LineBasicMaterial, LineLoop, Mesh,
  MeshBasicMaterial, type MeshLambertMaterial, OrthographicCamera, PointLight, RingGeometry, Scene, ShapeGeometry, Shape, SRGBColorSpace, Vector3,
  WebGLRenderer,
} from 'three'
import { levelOf, toRoomDesign } from './design'

export type Tile = readonly [x: number, z: number]

/** The night over the Ring (TC6): a blue-violet sky, a cool key light, the sprites tinted toward it, the lamps on. */
export const NIGHT_GRADE: StageGrade = {
  sky: '#5a6cc8', ground: '#1a1030', skyLight: 1.1, sun: '#b8c8ff', sunLight: 0.8, tint: '#c9d2ff', background: '#0b0d17', lamps: 1,
}

/** The overlay colours (TC29). */
export const OVERLAY = {
  reach: '#3b82f6',
  danger: '#e040c8',
  attack: '#ef4444',
  area: '#facc15',
} as const
export type OverlayKind = keyof typeof OVERLAY

export interface BoardFigure {
  id: string
  /** A sprite (an Uma) from a stand-in set, or a standee card (an enemy, a guest). */
  look: { kind: 'sprite'; set: number } | { kind: 'standee'; face: CanvasImageSource | null }
  /** The base ring's colour: the side's hue. */
  hue: string
  tile: Tile
  facing: Dir
}

export interface BoardDebug {
  figures: number
  sprites: number
  liveSets: number
  drawCalls: number
  fps: number
  saver: boolean
  device: { width: number; height: number; ratio: number }
  look: { x: number; z: number }
  faded: string[]
}

const FACING: Record<Dir, Facing> = { N: 'back', S: 'front', E: 'right', W: 'left' }
const WEDGE_ANGLE: Record<Dir, number> = { N: Math.PI / 2, E: 0, S: -Math.PI / 2, W: Math.PI }
const WALK_SPEED = 3.2
const LIVE_LIGHTS = 4
const FIGURE_HIT = { w: 112, h: 200 }
const FIGURE_HEAD = 2.15
const STANDEE_HEAD = ((STANDEE.h + 8) / TEXELS_PER_UNIT) * spriteStretch()
const FADE = { opacity: 0.35, ms: 150 }
/** Frames rendered after the last change before the loop sleeps. */
const IDLE_FRAMES = 3

const RIGHT = new Vector3(1, 0, 0)
const UP = new Vector3(0, Math.cos(CAMERA_PITCH), -Math.sin(CAMERA_PITCH))
const FORWARD = new Vector3(0, -Math.sin(CAMERA_PITCH), -Math.cos(CAMERA_PITCH))

interface Live {
  spec: BoardFigure
  x: number
  z: number
  facing: Dir
  path: { x: number; z: number }[]
  done: (() => void) | null
  body: Standee | SpriteActor
  base: Group
  wedge: Mesh
}

/** A flat ring and a facing wedge, lying on a tile (TC23, TC41). */
function baseRing(hue: string): { group: Group; wedge: Mesh } {
  const group = new Group()
  const ring = new Mesh(new RingGeometry(0.34, 0.42, 32), new MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  const shape = new Shape()
  shape.moveTo(0.52, 0)
  shape.lineTo(0.36, 0.11)
  shape.lineTo(0.36, -0.11)
  shape.closePath()
  const wedge = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial({ color: hue, side: DoubleSide, depthWrite: false }))
  wedge.rotation.x = -Math.PI / 2
  group.add(ring, wedge)
  group.renderOrder = 1
  return { group, wedge }
}

export class BoardScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  private readonly sky: HemisphereLight
  private readonly sun: DirectionalLight
  private readonly lamps: PointLight[] = []
  private readonly pacer: FramePacer
  private recorder = new FpsRecorder()
  private effects: Effects | null = null
  private saver: boolean
  private device = { width: 1, height: 1, ratio: 1 }
  private css = { width: 1, height: 1 }
  private map: BattleMap | null = null
  private world: { shared: Group; parts: Map<string, { group: Group; alpha: number; order: number }>; occluders: Occluder[]; lights: { x: number; y: number; z: number; color: string; radius: number }[] } | null = null
  private readonly figures = new Map<string, Live>()
  private overlay: Mesh | null = null
  private cursor: LineLoop | null = null
  private focus = new Set<string>()
  private look = { x: 0, z: 0 }
  private drag: { x: number; y: number; lookX: number; lookZ: number; moved: boolean } | null = null
  private raf = 0
  private last = 0
  private idle = 0
  private animating = false
  private recent: number[] = []
  private firstFrame: (() => void) | null
  private readonly grade = NIGHT_GRADE
  private readonly reducedMotion: MediaQueryList | null

  constructor(canvas: HTMLCanvasElement, options: { saver: boolean; onFirstFrame?: () => void }) {
    this.saver = options.saver
    this.pacer = new FramePacer(options.saver ? SAVER_FPS : null)
    this.firstFrame = options.onFirstFrame ?? null
    this.reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'default' })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.info.autoReset = false
    this.sky = new HemisphereLight(0xffffff, 0xffffff, 1)
    this.sun = new DirectionalLight(0xffffff, 1)
    this.sun.position.set(-4, 8, 6)
    this.scene.add(this.sky, this.sun)
    for (let i = 0; i < LIVE_LIGHTS; i++) { const l = new PointLight(0xffffff, 0, 6, 2); this.lamps.push(l); this.scene.add(l) }
    this.applyGrade()
  }

  // --- The world -----------------------------------------------------------------------------------------------------

  /** Builds the board from a battle map on the stand-in biome kit. High ground (level 2 and up) is kept apart, so it can
   * fade while it stands in front of a unit in focus. */
  setMap(map: BattleMap): void {
    this.dropWorld()
    this.map = map
    const kit = standInKitAtlas('biome')
    const page = pixelTexture(new CanvasTexture(drawStandInKit(kit)))
    page.colorSpace = SRGBColorSpace
    const geo = roomGeometry(toRoomDesign(map), kit)
    const tileOfFace = (corners: readonly { x: number; z: number }[]): string => {
      const x = Math.floor(Math.min(...corners.map((c) => c.x)) + 0.01), z = Math.floor(Math.max(...corners.map((c) => c.z)) - 0.01)
      return `${x},${z}`
    }
    const high = (key: string) => { const [x, z] = key.split(',').map(Number) as [number, number]; return levelOf(map, x, z) >= 2 }
    const split = buildWorldParts(geo, kit, [page], (item) => {
      if (item.kind !== 'face') return null
      const key = tileOfFace(item.face.corners)
      return high(key) ? `tile:${key}` : null
    })
    this.scene.add(split.shared)
    const parts = new Map<string, { group: Group; alpha: number; order: number }>()
    const occluders: Occluder[] = []
    for (const [id, group] of split.parts) {
      this.scene.add(group)
      const [x, z] = id.slice(5).split(',').map(Number) as [number, number]
      const y = levelOf(map, x, z)
      // At the tile's middle, so a unit's own tile never fades for her.
      occluders.push({ id, z: z + 0.5, box: boxOf([{ x, y, z }, { x: x + 1, y, z }, { x, y: 0, z: z + 1 }, { x: x + 1, y: 0, z: z + 1 }]) })
      parts.set(id, { group, alpha: 1, order: Math.round((z + 1) * 100) })
    }
    this.world = { shared: split.shared, parts, occluders, lights: geo.lights.map((l) => ({ x: l.at.x, y: l.at.y, z: l.at.z, color: l.color, radius: l.radius })) }
    this.look = { x: map.width / 2, z: map.depth / 2 }
    for (const f of this.figures.values()) this.stand(f)
    this.wake()
  }

  private dropWorld(): void {
    if (!this.world) return
    for (const g of [this.world.shared, ...[...this.world.parts.values()].map((p) => p.group)]) {
      this.scene.remove(g)
      g.traverse((o) => { const m = o as Mesh; m.geometry?.dispose(); (m.material as MeshBasicMaterial | undefined)?.dispose?.() })
    }
    this.world = null
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (cssWidth < 1 || cssHeight < 1) return
    this.device = deviceSize(cssWidth, cssHeight, dpr)
    this.css = { width: cssWidth, height: cssHeight }
    this.renderer.setPixelRatio(this.device.ratio)
    this.renderer.setSize(cssWidth, cssHeight, false)
    Object.assign(this.camera, frustum(this.device.width, this.device.height))
    this.camera.updateProjectionMatrix()
    this.effects?.setSize(cssWidth, cssHeight, this.device.ratio)
    this.wake()
  }

  // --- The camera, the pan and taps ----------------------------------------------------------------------------------

  get view(): View {
    return { look: { x: this.look.x, y: 0, z: this.look.z }, width: this.css.width, height: this.css.height, ratio: this.device.ratio }
  }

  /** World units a CSS px of drag moves the camera, across and in depth. */
  private perPx(): { x: number; z: number } {
    const unit = this.device.ratio / TEXELS_PER_UNIT
    return { x: unit, z: unit / Math.sin(CAMERA_PITCH) }
  }

  /** A finger down, in stage CSS px (on the turned layout, `toStage` first). */
  pointerDown(x: number, y: number): void {
    this.drag = { x, y, lookX: this.look.x, lookZ: this.look.z, moved: false }
  }
  /** Pans on both axes, clamped to the board. */
  pointerMove(x: number, y: number): void {
    const d = this.drag
    if (!d || !this.map) return
    const dx = x - d.x, dy = y - d.y
    if (!d.moved && Math.hypot(dx, dy) < 8) return
    d.moved = true
    const per = this.perPx()
    this.look = { x: Math.min(this.map.width, Math.max(0, d.lookX - dx * per.x)), z: Math.min(this.map.depth, Math.max(0, d.lookZ - dy * per.z)) }
    this.wake()
  }
  /** The finger lifts: a tap answers with the tile under it (a figure's tile when it's on one), a pan with null. */
  pointerUp(x: number, y: number): Tile | null {
    const d = this.drag
    this.drag = null
    if (!d || d.moved) return null
    return this.pick(x, y)
  }
  pointerCancel(): void { this.drag = null }

  /** The tile under a stage point: a figure first (her tile), else the nearest tile top. */
  pick(x: number, y: number): Tile | null {
    const map = this.map
    if (!map) return null
    const targets: PickTarget[] = [...this.figures.values()].map((f) => ({ ref: { kind: 'figure', id: f.spec.id },
      quad: cardQuad({ x: f.x, y: this.groundAt(f.x, f.z), z: f.z }, FIGURE_HIT.w, FIGURE_HIT.h), bias: 0.05 }))
    for (let z = 0; z < map.depth; z++) for (let tx = 0; tx < map.width; tx++) {
      if (map.tiles[z]![tx] === '#') continue
      targets.push({ ref: { kind: 'marker', marker: { kind: 'slot', x: tx, z } } as never, quad: tileQuad(tx, z, levelOf(map, tx, z)) })
    }
    const hit = pickAt(this.view, x, y, targets)[0]
    if (!hit) return null
    if (hit.ref.kind === 'figure') {
      const f = this.figures.get(hit.ref.id)!
      return [Math.floor(f.x), Math.floor(f.z)]
    }
    const m = (hit.ref as unknown as { marker: { x: number; z: number } }).marker
    return [m.x, m.z]
  }

  /** A world point on the stage, in CSS px (for DOM chips). */
  project(p: { x: number; y: number; z: number }): { x: number; y: number } { const s = project(this.view, p); return { x: s.x, y: s.y } }
  /** Where a figure's head is on the stage, or null. */
  headOf(id: string): { x: number; y: number } | null {
    const f = this.figures.get(id)
    return f ? this.project({ x: f.x, y: this.groundAt(f.x, f.z) + (f.body instanceof SpriteActor ? FIGURE_HEAD : STANDEE_HEAD), z: f.z }) : null
  }

  private groundAt(x: number, z: number): number { return this.map ? levelOf(this.map, Math.floor(x), Math.floor(z)) : 0 }

  // --- Figures -------------------------------------------------------------------------------------------------------

  addFigure(spec: BoardFigure): void {
    this.removeFigure(spec.id)
    const body = spec.look.kind === 'sprite' ? new SpriteActor(standInSet(spec.look.set)) : new Standee(spec.look.face)
    const { group, wedge } = baseRing(spec.hue)
    this.scene.add(body.group, body.shadowMesh, group)
    const f: Live = { spec, x: spec.tile[0] + 0.5, z: spec.tile[1] + 0.5, facing: spec.facing, path: [], done: null, body, base: group, wedge }
    this.figures.set(spec.id, f)
    this.stand(f)
    this.wake()
  }

  removeFigure(id: string): void {
    const f = this.figures.get(id)
    if (!f) return
    f.done?.()
    this.scene.remove(f.body.group, f.body.shadowMesh, f.base)
    f.body.dispose()
    f.base.traverse((o) => { const m = o as Mesh; m.geometry?.dispose(); (m.material as MeshBasicMaterial | undefined)?.dispose?.() })
    this.figures.delete(id)
    this.wake()
  }

  /** Puts a figure on a tile at once, facing a way. */
  place(id: string, tile: Tile, facing?: Dir): void {
    const f = this.figures.get(id)
    if (!f) return
    f.path = []
    f.done?.()
    f.done = null
    f.x = tile[0] + 0.5
    f.z = tile[1] + 0.5
    if (facing) f.facing = facing
    this.stand(f)
    this.wake()
  }

  /** Turns a figure. */
  face(id: string, facing: Dir): void {
    const f = this.figures.get(id)
    if (!f) return
    f.facing = facing
    this.stand(f)
    this.wake()
  }

  /** Walks a figure along a path of tiles (the battle's, start included); resolves on arrival. */
  walk(id: string, path: readonly Tile[]): Promise<void> {
    const f = this.figures.get(id)
    if (!f || path.length < 2) return Promise.resolve()
    f.done?.()
    f.path = path.slice(1).map((t) => ({ x: t[0] + 0.5, z: t[1] + 0.5 }))
    this.wake()
    return new Promise((resolve) => { f.done = resolve })
  }

  /** The units the fade keeps in view (the one acting and her target). */
  setFocus(ids: readonly string[]): void {
    this.focus = new Set(ids)
    this.wake()
  }

  /** Positions a figure's ring and wedge on her tile. */
  private stand(f: Live): void {
    const y = this.groundAt(f.x, f.z) + 0.02
    f.base.position.set(f.x, y, f.z)
    f.wedge.rotation.z = WEDGE_ANGLE[f.facing]
  }

  // --- Overlays ------------------------------------------------------------------------------------------------------

  /** One merged mesh of tile tops in the overlay colours: reach, danger, attack, area. */
  setOverlay(tiles: readonly { tile: Tile; kind: OverlayKind }[]): void {
    if (this.overlay) {
      this.scene.remove(this.overlay)
      this.overlay.geometry.dispose()
      ;(this.overlay.material as MeshBasicMaterial).dispose()
      this.overlay = null
    }
    if (tiles.length > 0 && this.map) {
      const pos = new Float32Array(tiles.length * 18), col = new Float32Array(tiles.length * 18)
      const inset = 0.06
      tiles.forEach(({ tile: [x, z], kind }, i) => {
        const y = levelOf(this.map!, x, z) + 0.015
        const c = new Color(OVERLAY[kind])
        const quad = [[x + inset, z + inset], [x + 1 - inset, z + inset], [x + 1 - inset, z + 1 - inset], [x + inset, z + inset], [x + 1 - inset, z + 1 - inset], [x + inset, z + 1 - inset]]
        quad.forEach(([qx, qz], k) => {
          pos.set([qx!, y, qz!], i * 18 + k * 3)
          col.set([c.r, c.g, c.b], i * 18 + k * 3)
        })
      })
      const g = new BufferGeometry()
      g.setAttribute('position', new BufferAttribute(pos, 3))
      g.setAttribute('color', new BufferAttribute(col, 3))
      this.overlay = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, side: DoubleSide }))
      this.overlay.renderOrder = 2
      this.scene.add(this.overlay)
    }
    this.wake()
  }

  /** The cursor's outline on a tile, or none. */
  setCursor(tile: Tile | null): void {
    if (this.cursor) {
      this.scene.remove(this.cursor)
      this.cursor.geometry.dispose()
      ;(this.cursor.material as LineBasicMaterial).dispose()
      this.cursor = null
    }
    if (tile && this.map) {
      const [x, z] = tile, y = levelOf(this.map, x, z) + 0.03
      const g = new BufferGeometry().setFromPoints([new Vector3(x, y, z), new Vector3(x + 1, y, z), new Vector3(x + 1, y, z + 1), new Vector3(x, y, z + 1)])
      this.cursor = new LineLoop(g, new LineBasicMaterial({ color: '#f5f7ff' }))
      this.cursor.renderOrder = 3
      this.scene.add(this.cursor)
    }
    this.wake()
  }

  // --- The loop ------------------------------------------------------------------------------------------------------

  private applyGrade(): void {
    const g = this.grade
    this.sky.color.set(g.sky)
    this.sky.groundColor.set(g.ground)
    this.sky.intensity = g.skyLight
    this.sun.color.set(g.sun)
    this.sun.intensity = g.sunLight
    this.scene.background = new Color(g.background)
  }

  /** Battery saver: 30 fps and no tilt-shift or bloom. */
  setSaver(saver: boolean): void { this.saver = saver; this.pacer.setFps(saver ? SAVER_FPS : null); this.wake() }
  private effectsOn(): Effects | null {
    if (this.saver) return null
    if (!this.effects) { this.effects = new Effects(this.renderer, this.scene, this.camera); this.effects.setSize(this.css.width, this.css.height, this.device.ratio) }
    return this.effects
  }

  /** Renders every frame while on (the frame-rate check), else only when something changes. */
  setAnimating(on: boolean): void { this.animating = on; this.wake() }
  beginRecord(): FpsRecorder { this.recorder = new FpsRecorder(); return this.recorder }

  /** Something changed: draw until things settle. */
  wake(): void {
    this.idle = 0
    if (this.raf || typeof requestAnimationFrame !== 'function') return
    this.last = performance.now()
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000))
      this.last = now
      const busy = this.update(dt)
      if (this.pacer.shouldDraw(now)) this.draw(now)
      this.idle = busy || this.animating || this.drag ? 0 : this.idle + 1
      if (this.idle > IDLE_FRAMES) { this.raf = 0; this.recorder.pause(); return }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  /** Runs one frame by hand (a hidden preview pane runs no animation frames). */
  step(ms = 33): void { this.update(ms / 1000); this.draw(performance.now()) }

  /** Advances walks and fades; true while anything still moves. */
  private update(dt: number): boolean {
    let busy = false
    for (const f of this.figures.values()) {
      const p = f.path[0]
      let moving = false
      if (p) {
        const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz), step = WALK_SPEED * dt
        if (d <= Math.max(step, 1e-6)) { f.x = p.x; f.z = p.z; f.path.shift() }
        else { f.x += (dx / d) * step; f.z += (dz / d) * step }
        f.facing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : dz > 0 ? 'S' : 'N'
        moving = true
        busy = true
        if (!f.path.length) { const done = f.done; f.done = null; done?.() }
        this.stand(f)
      }
      f.body.update(dt * 1000, FACING[f.facing], moving, false)
    }
    return this.stepFades(dt) || busy
  }

  /** The fade: high ground covering a unit in focus eases to 35%, the rest back to full. */
  private stepFades(dt: number): boolean {
    const world = this.world
    if (!world || !world.parts.size) return false
    const targets: FadeTarget[] = [...this.figures.values()].filter((f) => this.focus.has(f.spec.id)).map((f) => {
      const y = this.groundAt(f.x, f.z)
      return figureTarget({ x: f.x, y, z: f.z }, FIGURE_HIT.w, FIGURE_HIT.h, { x: f.x, y: y + FIGURE_HEAD, z: f.z })
    })
    const covering = coveringOccluders(world.occluders, targets)
    const instant = this.reducedMotion?.matches ?? false
    let busy = false
    for (const [id, part] of world.parts) {
      const goal = covering.has(id) ? FADE.opacity : 1
      if (part.alpha === goal) continue
      busy = true
      part.alpha = stepFade(part.alpha, goal, dt, { ...FADE, instant })
      const faded = part.alpha < 1
      part.group.traverse((o) => {
        const mesh = o as Mesh
        if (!mesh.isMesh) return
        const m = mesh.material as MeshLambertMaterial
        m.opacity = part.alpha
        m.transparent = faded
        m.depthWrite = !faded
        m.alphaTest = 0.5 * part.alpha
        mesh.renderOrder = faded ? part.order : 0
      })
    }
    return busy
  }

  private draw(now: number): void {
    const look = this.view.look, o = cameraOffset()
    const eye = new Vector3(look.x, look.y + o.y, look.z + o.z)
    const per = TEXELS_PER_UNIT
    const snapped = RIGHT.clone().multiplyScalar(snapToGrid(eye.dot(RIGHT), 0, per)).add(UP.clone().multiplyScalar(snapToGrid(eye.dot(UP), 0, per)))
      .add(FORWARD.clone().multiplyScalar(eye.dot(FORWARD)))
    this.camera.position.copy(snapped)
    this.camera.quaternion.setFromAxisAngle(RIGHT, -CAMERA_PITCH)
    this.camera.updateMatrixWorld()
    this.placeLamps(look)
    const f = frustum(this.device.width, this.device.height)
    const base: [number, number, number] = [new Color(this.grade.tint).r, new Color(this.grade.tint).g, new Color(this.grade.tint).b]
    const lights = this.lamps.filter((l) => l.intensity > 0).map((l) => ({ x: l.position.x, y: l.position.y, z: l.position.z, color: [l.color.r, l.color.g, l.color.b] as [number, number, number], radius: l.distance, strength: l.intensity / 9 }))
    for (const fig of this.figures.values()) {
      const ground = new Vector3(fig.x, this.groundAt(fig.x, fig.z), fig.z), rel = ground.clone().sub(snapped)
      const placed = snapped.clone().add(RIGHT.clone().multiplyScalar(snapToGrid(rel.dot(RIGHT), f.left, per)))
        .add(UP.clone().multiplyScalar(snapToGrid(rel.dot(UP), f.bottom, per))).add(FORWARD.clone().multiplyScalar(rel.dot(FORWARD)))
      fig.body.stand(placed.x, placed.y, placed.z, Math.round(fig.z * 100), tintAt(ground, base, lights))
    }
    this.renderer.info.reset()
    const effects = this.effectsOn()
    if (effects) effects.render()
    else this.renderer.render(this.scene, this.camera)
    this.recorder.frame(now)
    this.recent.push(now)
    while (this.recent.length > 0 && now - this.recent[0]! > 1000) this.recent.shift()
    if (this.firstFrame) { this.firstFrame(); this.firstFrame = null }
  }

  /** The four live lights go to the kit's lamps nearest the view's middle. */
  private placeLamps(at: { x: number; z: number }): void {
    const near = [...(this.world?.lights ?? [])].sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z))
    this.lamps.forEach((l, i) => {
      const src = near[i]
      if (!src) { l.intensity = 0; return }
      l.position.set(src.x, src.y, src.z)
      l.color.set(src.color)
      l.distance = src.radius + 2
      l.intensity = 9 * this.grade.lamps
    })
  }

  get debug(): BoardDebug {
    const sprites = [...this.figures.values()].filter((f) => f.spec.look.kind === 'sprite')
    const live = liveSets(sprites.map((f) => ({ id: f.spec.id, set: `standin-${(f.spec.look as { set: number }).set}`, x: f.x, z: f.z })), this.look)
    return {
      figures: this.figures.size, sprites: sprites.length, liveSets: live.size, drawCalls: this.renderer.info.render.calls,
      fps: this.recent.length, saver: this.saver, device: { ...this.device }, look: { ...this.look },
      faded: [...(this.world?.parts ?? [])].filter(([, p]) => p.alpha < 1).map(([id]) => id),
    }
  }

  dispose(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.effects?.dispose()
    for (const id of [...this.figures.keys()]) this.removeFigure(id)
    this.setOverlay([])
    this.setCursor(null)
    this.dropWorld()
    this.renderer.dispose()
  }
}
