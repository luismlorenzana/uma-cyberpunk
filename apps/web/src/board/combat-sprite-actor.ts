import type { Dir, PartHp, UnitStatus } from '@cyber/battle'
import { CanvasTexture, CircleGeometry, Group, Mesh, MeshBasicMaterial, NearestFilter, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import type { Clip, EffectTrack, Layer } from './combat-sprite-format'
import type { CombatLook, LoadedCombatArt } from './local-combat-sprites'

type Cel = { layers: Layer[]; ms: number }

/** One reusable cell texture per visible actor or prop. Atlas pages stay on the CPU. */
class CombatCell {
  readonly group = new Group()
  readonly sprite: Sprite
  protected readonly canvas = document.createElement('canvas')
  protected readonly context: CanvasRenderingContext2D
  private readonly texture: CanvasTexture

  constructor(protected readonly art: LoadedCombatArt, origin = art.bundle.foot) {
    const [w, h] = art.bundle.cell
    this.canvas.width = w
    this.canvas.height = h
    this.context = this.canvas.getContext('2d')!
    this.context.imageSmoothingEnabled = false
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.minFilter = this.texture.magFilter = NearestFilter
    this.texture.generateMipmaps = false
    this.sprite = new Sprite(new SpriteMaterial({ map: this.texture, alphaTest: 0.18, depthWrite: false }))
    this.sprite.center.set(origin[0] / w, 1 - origin[1] / h)
    this.group.add(this.sprite)
  }

  protected paint(layers: readonly Layer[], badges: readonly string[] = []): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (const { page, rect: [x, y, w, h], at: [left, top] } of layers) {
      const image = this.art.pages.get(page)
      if (image) this.context.drawImage(image, x, y, w, h, left, top, w, h)
    }
    if (badges.length) {
      const x = this.art.bundle.foot[0]
      this.context.font = 'bold 13px sans-serif'
      this.context.textAlign = 'center'
      this.context.fillStyle = '#161725'
      this.context.fillRect(x - 23, 15, 46, 16)
      this.context.fillStyle = '#ffc66e'
      this.context.fillText(badges.join(' '), x, 27)
    }
    this.texture.needsUpdate = true
  }

  stand(x: number, y: number, z: number, order: number, worldPerCss: number): void {
    const { reviewHeight, figureHeight, cell } = this.art.bundle
    const scale = reviewHeight * worldPerCss / figureHeight
    this.sprite.scale.set(cell[0] * scale, cell[1] * scale, 1)
    this.sprite.renderOrder = order
    this.group.position.set(x, y, z)
  }

  dispose(): void { this.sprite.material.dispose(); this.texture.dispose() }
}

export interface CombatPose { hp: PartHp; status: UnitStatus }

const intact: CombatPose = { hp: { core: 1, leftArm: 1, rightArm: 1, legs: 1 }, status: 'active' }

export function limbPose(look: CombatLook, facing: Dir, pose: CombatPose, action: string): string | undefined {
  const clips = look.art.bundle.motions[look.fitting.motion]?.[facing].clips
  if (!clips) return undefined
  const { leftArm, rightArm, legs } = pose.hp
  const allBroken = leftArm <= 0 && rightArm <= 0 && legs <= 0
  const life = action === 'rig-break' || action === 'down' || action === 'reboot-rise'
  const stateClip = life && allBroken ? action + '-damaged' : action === 'idle' && allBroken ? 'post-reboot-damaged' : action
  if (life || stateClip !== action) return clips[stateClip] ? stateClip : undefined
  if (leftArm <= 0 && rightArm <= 0 && ['idle', 'walk', 'settle', 'attack'].includes(action)) {
    if (action === 'attack') return undefined
    if (clips['idle-both-arms-broken']) return 'idle-both-arms-broken'
  }
  if (leftArm <= 0 || rightArm <= 0) {
    const oneArm = `${action}-one-${leftArm <= 0 ? 'right' : 'left'}`
    if (clips[oneArm]) return oneArm
    if (leftArm <= 0 && clips[`${action}-shield-arm-broken`]) return `${action}-shield-arm-broken`
    if (leftArm <= 0 && clips['idle-shield-arm-broken'] && (action === 'walk' || action === 'settle')) return 'idle-shield-arm-broken'
  }
  return clips[action] ? action : undefined
}

function missingLimbArt(name: string, hp: PartHp): string[] {
  if (name.endsWith('-damaged')) return []
  const bothShown = name === 'idle-both-arms-broken'
  return [
    ...(hp.leftArm <= 0 && !bothShown && !name.endsWith('-one-right') && !name.endsWith('-shield-arm-broken') ? ['L'] : []),
    ...(hp.rightArm <= 0 && !bothShown && !name.endsWith('-one-left') ? ['R'] : []),
    ...(hp.legs <= 0 ? ['LEG'] : []),
  ]
}

export class CombatSpriteActor extends CombatCell {
  readonly shadowMesh = new Mesh(new CircleGeometry(0.26, 20), new MeshBasicMaterial({ color: 0x080a14, transparent: true, opacity: 0.5, depthWrite: false }))
  private elapsed = 0
  private last = ''
  private motion: { facing: Dir; name: string; clip: Clip; frames: readonly number[]; speed: number; pose: CombatPose } | null = null
  private pose: CombatPose = intact
  private walking = false
  private fallbackTime = 0
  shown: { clip: string; frame: number; facing: Dir } | null = null
  anchors: Readonly<Record<string, readonly [number, number]>> = {}

  constructor(readonly look: CombatLook) {
    super(look.art)
    this.shadowMesh.rotation.x = -Math.PI / 2
  }

  setPose(pose: CombatPose): void { this.pose = pose; this.motion = null }

  clip(facing: Dir, name: string): Clip | undefined { return this.look.art.bundle.motions[this.look.fitting.motion]?.[facing].clips[name] }

  play(facing: Dir, name: string, pose: CombatPose, speed: number, frames?: readonly number[]): number {
    const clip = this.clip(facing, name)
    if (!clip) return 0
    this.elapsed = 0
    this.motion = { facing, name, clip, frames: frames ?? clip.frames.map((_, index) => index), speed, pose }
    this.update(0, facing, false, false)
    return this.motion.frames.reduce((sum, i) => sum + clip.frames[i]!.ms, 0) / speed
  }

  update(dt: number, facing: Dir, moving: boolean, still: boolean): boolean {
    const { art, fitting } = this.look
    if (moving !== this.walking) { this.walking = moving; this.fallbackTime = 0 }
    const motion = moving ? null : this.motion
    const direction = motion?.facing ?? facing
    const track = art.bundle.motions[fitting.motion]![direction]
    const action = this.pose.status === 'down' ? 'down' : moving ? 'walk' : 'idle'
    const name = motion?.name ?? limbPose(this.look, direction, this.pose, action) ?? 'idle'
    const pose = motion?.pose ?? this.pose
    const clip = motion?.clip ?? track.clips[name]!
    const frames = motion?.frames ?? clip.frames.map((_, index) => index)
    const total = frames.reduce((sum, index) => sum + clip.frames[index]!.ms, 0)
    if (motion) this.elapsed = Math.min(total, this.elapsed + dt * motion.speed)
    else this.fallbackTime = (this.fallbackTime + dt) % total
    let time = still ? (motion ? total : 0) : motion ? this.elapsed : this.fallbackTime
    let index = frames[frames.length - 1]!
    for (const i of frames) {
      if (time < clip.frames[i]!.ms) { index = i; break }
      time -= clip.frames[i]!.ms
    }
    const row = track.frames[clip.frames[index]!.frame]!
    this.anchors = row.anchors
    const badges = missingLimbArt(name, pose.hp)
    const key = `${direction}:${clip.frames[index]!.frame}:${badges.join(',')}`
    if (key !== this.last) {
      this.last = key
      this.paint(row.layers.filter(layer => !layer.when || fitting.rig[layer.when.slot] === layer.when.part), badges)
    }
    this.shown = { clip: name, frame: index, facing: direction }
    return !!motion && !still && this.elapsed < total
  }

  override stand(x: number, y: number, z: number, order: number, worldPerCss: number): void {
    super.stand(x, y, z, order, worldPerCss)
    this.shadowMesh.position.set(x, y + 0.012, z)
  }

  override dispose(): void { super.dispose(); this.shadowMesh.geometry.dispose(); this.shadowMesh.material.dispose() }
}

export class CombatTileEffect extends CombatCell {
  private elapsed = 0
  private active = 0
  private readonly cels: Cel[]

  constructor(art: LoadedCombatArt, track: EffectTrack, readonly held: boolean, private readonly speed: number, still: boolean) {
    super(art, art.effects.origin)
    this.cels = track.frames.map((layer, i) => ({ layers: [layer], ms: track.ms[i] ?? Infinity }))
    if (still) this.active = this.cels.length - 1
    this.paint(this.cels[this.active]!.layers)
  }

  update(dt: number): 'playing' | 'held' | 'finished' {
    this.elapsed += dt * this.speed
    const previous = this.active
    while (this.active < this.cels.length && this.elapsed >= this.cels[this.active]!.ms) {
      this.elapsed -= this.cels[this.active++]!.ms
    }
    if (this.active === this.cels.length) return 'finished'
    if (previous !== this.active) this.paint(this.cels[this.active]!.layers)
    return this.held && this.active === this.cels.length - 1 ? 'held' : 'playing'
  }
}
