import type { Dir, PartHp, UnitStatus } from '@cyber/battle'
import { BoxGeometry, CanvasTexture, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, NearestFilter, RingGeometry, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import type { Clip, Layer } from './combat-sprite-format'
import type { CombatLook, LoadedCombatArt } from './local-combat-sprites'
import { composedClip, hasNativeHands, isBackMotion } from './combat-sprite-composition'
import { paintComposition } from './combat-sprite-gear'

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
    // Match the base ring's group order. The sprite's tile order then sorts its art above the ring.
    this.group.renderOrder = 1
    this.group.add(this.sprite)
  }

  protected paint(layers: readonly Layer[], badges: readonly string[] = []): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (const layer of layers) this.drawLayer(layer)
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

  protected drawLayer({ page, rect: [x, y, w, h], at: [left, top] }: Layer): void {
    const image = this.art.pages.get(page)
    if (image) this.context.drawImage(image, x, y, w, h, left, top, w, h)
  }

  protected redraw(draw: () => void): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    draw()
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

function nativeStateClip(action: string, hp: PartHp, twoHand: boolean): string {
  const bothArmsLost = hp.leftArm <= 0 && hp.rightArm <= 0
  if (bothArmsLost && hp.legs <= 0) {
    if (action === 'rig-break' || action === 'down' || action === 'reboot-rise') return `${action}-damaged`
    if (action === 'idle') return 'post-reboot-damaged'
  }
  if (twoHand && (hp.leftArm <= 0 || hp.rightArm <= 0)) {
    if (isBackMotion(action) || action === 'dash-walk') {
      const suffix = bothArmsLost ? 'both-arms-broken' : hp.leftArm <= 0 ? 'one-right' : 'one-left'
      return `${action}-${suffix}`
    }
    return action
  }
  if (hp.legs <= 0) {
    if (action === 'walk' || action === 'dash-walk') return `${action}-degraded`
    if (action === 'idle' || action === 'settle') return 'idle-degraded'
  }
  return action
}

export function limbPose(look: CombatLook, facing: Dir, pose: CombatPose, action: string): string | undefined {
  if (look.composed) {
    const { leftArm, rightArm } = pose.hp
    const one = leftArm <= 0 ? 'right' : 'left'
    const bundle = look.art.bundle
    const { composition, motions } = bundle
    const native = hasNativeHands(bundle)
    const bothArmsBroken = leftArm <= 0 && rightArm <= 0
    const donor = look.composed.twoHand && look.composed[look.composed.twoHand] === 'rifle'
    const blade = composition && motions[composition.blade]?.[facing].clips
    const handAttack = action === 'attack-left' || action === 'attack-right'
    if (bothArmsBroken && (handAttack || (!native && action === 'attack-back'))) return
    if (action === 'guard' || action === 'cover') {
      const { guards } = look.composed
      const left = leftArm > 0 ? guards.left : 0, right = rightArm > 0 ? guards.right : 0
      return right > left ? action + '-right' : left ? action : undefined
    }
    if (handAttack) {
      const hand = action === 'attack-left' ? 'left' : 'right'
      if (!look.composed[hand] || (!look.composed.twoHand && pose.hp[hand === 'left' ? 'leftArm' : 'rightArm'] <= 0)) return
      if (look.composed.twoHand && (leftArm <= 0 || rightArm <= 0)) {
        const key = `attack-one-${one}`
        return donor || blade?.[key] ? key : `attack-${one}-degraded`
      }
    }
    if (native) {
      const stateClip = nativeStateClip(action, pose.hp, !!look.composed.twoHand)
      if (stateClip !== action && composedClip(bundle, look.composed, facing, stateClip)) return stateClip
    }
    if (donor && ['idle', 'walk', 'settle'].includes(action) && (leftArm <= 0 || rightArm <= 0)) {
      return leftArm <= 0 && rightArm <= 0 ? 'idle-both-arms-broken' : `${action}-one-${one}`
    }
    if (look.composed.twoHand && !donor && ['idle', 'walk', 'settle'].includes(action) && (leftArm <= 0 || rightArm <= 0)) {
      const key = leftArm <= 0 && rightArm <= 0 ? 'idle-both-arms-broken' : `${action}-one-${one}`
      return blade?.[key] ? key : action + '-degraded'
    }
    return composedClip(look.art.bundle, look.composed, facing, action) ? action : undefined
  }
  const clips = look.art.bundle.motions[look.fitting.motion]?.[facing].clips
  if (!clips) return undefined
  const { leftArm, rightArm, legs } = pose.hp
  const allBroken = leftArm <= 0 && rightArm <= 0 && legs <= 0
  const life = action === 'rig-break' || action === 'down' || action === 'reboot-rise' || action === 'collar-release'
  const stateClip = life && allBroken ? action + '-damaged' : action === 'idle' && allBroken ? 'post-reboot-damaged' : action
  if (stateClip !== action && clips[stateClip]) return stateClip
  if (life) return clips[action] ? action : undefined
  const bothArmsBroken = leftArm <= 0 && rightArm <= 0
  const backClip = action + '-both-arms-broken'
  if (bothArmsBroken && isBackMotion(action) && clips[backClip]) return backClip
  if (legs <= 0) {
    const degraded = action === 'settle' ? 'idle-degraded' : action + '-degraded'
    if (['idle', 'walk', 'settle', 'dash-walk'].includes(action) && clips[degraded]) return degraded
  }
  if (bothArmsBroken && ['idle', 'walk', 'settle', 'attack'].includes(action)) {
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
  const bothShown = name.endsWith('-both-arms-broken')
  return [
    ...(hp.leftArm <= 0 && !bothShown && !name.endsWith('-one-right') && !name.endsWith('-shield-arm-broken') ? ['L'] : []),
    ...(hp.rightArm <= 0 && !bothShown && !name.endsWith('-one-left') ? ['R'] : []),
    ...(hp.legs <= 0 && !name.endsWith('-degraded') ? ['LEG'] : []),
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

  clip(facing: Dir, name: string): Clip | undefined {
    return this.look.composed ? composedClip(this.art.bundle, this.look.composed, facing, name)?.clip
      : this.art.bundle.motions[this.look.fitting.motion]?.[facing].clips[name]
  }

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
    const action = this.pose.status === 'down' ? 'down' : moving ? this.motion?.name.startsWith('back-dash') ? 'dash-walk' : 'walk' : 'idle'
    const name = motion?.name ?? limbPose(this.look, direction, this.pose, action) ?? 'idle'
    const pose = motion?.pose ?? this.pose
    const rig = this.look.composed
    const composition = rig ? composedClip(art.bundle, rig, direction, name) : undefined
    const track = composition?.track ?? art.bundle.motions[fitting.motion]![direction]
    const clip = motion?.clip ?? composition?.clip ?? track.clips[name]!
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
    const badges = missingLimbArt(name, pose.hp)
    const key = composition ? `${direction}:${name}:${index}:${Number(pose.hp.leftArm <= 0)}${Number(pose.hp.rightArm <= 0)}${Number(pose.hp.legs <= 0)}`
      : `${direction}:${clip.frames[index]!.frame}:${badges.join(',')}`
    if (key !== this.last) {
      this.last = key
      if (rig && composition) {
        this.redraw(() => {
          this.anchors = paintComposition(this.context, row, composition, { rig, facing: direction, hp: pose.hp,
            action: name, index, foot: art.bundle.foot }, layer => this.drawLayer(layer))
        })
      } else {
        this.anchors = row.anchors
        this.paint(row.layers.filter(layer => !layer.when || fitting.rig[layer.when.slot] === layer.when.part), badges)
      }
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

export class CombatTileEffect {
  readonly group = new Group()
  private readonly mesh: Mesh<BoxGeometry | RingGeometry, MeshBasicMaterial>
  private elapsed = 0

  constructor(readonly held: boolean, private readonly speed: number, private readonly still: boolean, reboot = false) {
    this.mesh = new Mesh(held ? new BoxGeometry(0.77, 0.35, 0.77) : new RingGeometry(0.18, 0.36, 24),
      new MeshBasicMaterial({ color: reboot ? 0x89e6ff : held ? 0x5bafff : 0x87e8c0,
        transparent: true, opacity: held ? 0.30 : 0.70, depthWrite: false, side: DoubleSide }))
    if (held) this.mesh.position.y = 0.175
    else this.mesh.rotation.x = -Math.PI / 2
    this.group.renderOrder = 1
    this.group.add(this.mesh)
  }

  update(dt: number): 'playing' | 'held' | 'finished' {
    if (this.held) return 'held'
    this.elapsed += dt * this.speed
    const progress = this.elapsed / 295
    if (progress >= 1) return 'finished'
    if (!this.still) {
      this.mesh.material.opacity = 0.70 * (1 - progress)
      this.mesh.scale.setScalar(1 + progress * 0.9)
    }
    return 'playing'
  }

  stand(x: number, y: number, z: number, order: number): void {
    this.group.position.set(x, y, z)
    this.mesh.renderOrder = order
  }

  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose() }
}
