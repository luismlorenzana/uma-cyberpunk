import type { Dir, PartHp } from '@cyber/battle'
import type { Frame, Layer, Point } from './combat-sprite-format'
import type { ComposedRig, CompositionClip } from './combat-sprite-composition'
import { visualOf } from './combat-sprite-composition'

type Hand = 'left' | 'right'
type PaintLayer = (layer: Layer) => void
const handSlot = { left: 'leftHand', right: 'rightHand' } as const
const armSlot = { left: 'leftArm', right: 'rightArm' } as const
const other = (hand: Hand): Hand => hand === 'left' ? 'right' : 'left'
const leftToRight = (name: string) => name.replace(/^(left|right)-/, (_, side: Hand) => other(side) + '-')

function attachment(ctx: CanvasRenderingContext2D, [x, y]: Point, silhouette: number[][], light: string, vents: number[][]) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.beginPath()
  silhouette.forEach(([px, py], index) => index ? ctx.lineTo(px!, py!) : ctx.moveTo(px!, py!))
  ctx.closePath()
  ctx.fillStyle = '#373741'
  ctx.fill()
  ctx.strokeStyle = '#161622'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#747381'
  ctx.fillRect(-3, -5, 7, 2)
  ctx.fillStyle = light
  for (const [vx, vy, w, h] of vents) ctx.fillRect(vx!, vy!, w!, h!)
  ctx.restore()
}

function pack(ctx: CanvasRenderingContext2D, at: Point, visual: ComposedRig['back'], facing: Dir): Point {
  const dir = facing === 'W' ? -1 : facing === 'E' ? 1 : 0
  const x = at[0] + 4 * dir, y = at[1] - 4
  if (visual === 'thruster') {
    attachment(ctx, [x, y], [[-11,-7],[-7,-11],[7,-11],[11,-7],[10,9],[5,12],[-5,12],[-10,9]],
      '#f9ab5c', [[-7,3,3,6],[4,3,3,6]])
    return [x, y + 10]
  }
  if (visual === 'deck') {
    attachment(ctx, [x, y], [[-9,-5],[-6,-10],[-5,-17],[-2,-17],[-1,-9],[7,-9],[11,-3],[9,8],[-7,8]],
      '#7bc8ef', [[-5,-1,10,2],[-5,3,4,2],[2,3,3,2]])
    return [x, y - 15]
  }
  if (visual === 'mounted-blade') {
    const side = dir || 1
    const blade = [[-8,8],[-4,-1],[9,-12],[17,-15],[12,-7],[3,4],[4,8],[-1,10]]
    attachment(ctx, [x, y], blade.map(([x, y]) => [x! * side, y!]),
      '#dcbbc8', [[-1,1,4,2],[7 * side - 2,-7,4,2]])
    return [x + 12 * side, y - 8]
  }
  const light = visual === 'bulwark' ? '#f3b04e' : visual === 'med' ? '#8fe4ae' : '#f68b50'
  const side = visual === 'launcher' ? 12 : 10
  attachment(ctx, [x, y], [[-side,-6],[-6,-10],[side,-9],[side,6],[6,10],[-side,8]],
    light, [[-6,-3,4,3],[2,-3,4,3],[-6,3,4,2],[2,3,4,2]])
  return [x + dir * side, y - 4]
}

function energy(ctx: CanvasRenderingContext2D, at: Point, x: number, y: number, color: string) {
  ctx.save()
  ctx.translate(Math.round(at[0]), Math.round(at[1]))
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.strokeStyle = '#fff2d2'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

export function paintComposition(ctx: CanvasRenderingContext2D, row: Frame, selection: CompositionClip, options: {
  rig: ComposedRig; facing: Dir; hp: PartHp; action: string; index: number; foot: Point
}, draw: PaintLayer): Frame['anchors'] {
  const { rig, facing, hp, index, foot } = options
  const { flip, twoGrip, native } = selection
  const action = options.action.replace(/(?:-one-(?:left|right)|-both-arms-broken)$/, '')
  const hands = (side: Hand) => flip ? other(side) : side
  const sided = facing === 'W' ? -1 : facing === 'E' ? 1 : 0
  const dir = flip ? -sided : sided
  const anchors = { ...row.anchors }
  const phase = [0, .42, .82, 1][index] ?? 0
  const knee = selection.authored ? 0 : action === 'down' ? 1 : action === 'rig-break' ? phase : action === 'reboot-rise' ? 1 - phase : 0
  const recoil = !native && action === 'hurt' ? [0, -4, 2, 0][index] ?? 0 : 0
  const dashWalk = action.startsWith('dash-walk')
  const dash = action === 'back-dash' || dashWalk
  const active = dashWalk || selection.clip.events.some(event => event.frame === index && event.cue === 'emitter')
  const shot = selection.clip.events.some(event => event.frame === index && (event.cue === 'shot-pulse' || event.cue === 'impact'))
  const mount = row.anchors['back-mount'] ?? [foot[0], foot[1] - 85]
  let emitter: Point = mount
  const transform = ([x, y]: Point): Point => [flip ? 2 * foot[0] - x + recoil : x + recoil, foot[1] + (y - foot[1]) * (1 - .36 * knee)]
  ctx.save()
  ctx.translate(foot[0] + recoil, foot[1])
  ctx.scale(flip ? -1 : 1, 1 - .36 * knee)
  ctx.translate(-foot[0], -foot[1])

  // Draw replacements in the original prop lanes so fingers, helmet and shoulders keep their occlusion.
  let backDrawn = false
  let backEffectDrawn = false
  const handDrawn = new Set<Hand>()
  for (const layer of row.layers) {
    const when = layer.when
    if (layer.effect && when) {
      if (when.slot === 'back') {
        if (native ? visualOf(when.part) === rig.back && (active || shot) : rig.back === 'launcher') {
          draw(layer)
          backEffectDrawn = true
        }
      } else if (native) {
        const hand = when.slot === 'leftHand' ? 'left' : 'right'
        const grip = options.action.endsWith('-one-left') ? 'left' : options.action.endsWith('-one-right') ? 'right' : hand
        const gear = twoGrip ? rig[rig.twoHand!] : rig[hand]
        if (shot && hp[armSlot[grip]] > 0 && gear === visualOf(when.part)) draw(layer)
      } else {
        const source = when.slot === 'leftHand' ? 'left' : 'right'
        const hand = hands(source)
        const style = action.endsWith('-degraded') ? 'greatblade' : rig[hand]
        if (hp[armSlot[hand]] > 0) {
          if ((source === 'left' && style === 'pistol') || (source === 'right' && style === 'blade')) draw(layer)
          else if (shot && style) {
            const grip = row.anchors[source + '-grip']!
            const tip = source === 'left' && row.anchors['pistol-muzzle'] || [grip[0] + dir * 8, grip[1] - 9] as Point
            energy(ctx, tip, dir * 13, dir ? -3 : -14, style === 'pistol' || style === 'rifle' ? '#75dddb' : '#dda856')
          }
        }
      }
      continue
    }
    if (when?.slot === 'back') {
      if (native && visualOf(when.part) !== rig.back) continue
      if (when.part === 'back-missiles' && rig.back === 'launcher') {
        draw(layer)
        emitter = row.anchors['pod-muzzle'] ?? mount
      } else if (native) {
        draw(layer)
        emitter = row.anchors[`back-${rig.back}-emitter`] ?? row.anchors['back-emitter'] ?? mount
      } else if (!backDrawn && rig.back) emitter = pack(ctx, mount, rig.back, flip && sided ? (dir < 0 ? 'W' : 'E') : facing)
      backDrawn = true
      continue
    }
    if (when?.slot === handSlot.left || when?.slot === handSlot.right) {
      const side = when.slot === handSlot.left ? 'left' : 'right'
      const hand = hands(side)
      const takeover = action.endsWith('-degraded') && rig.twoHand && hp[armSlot[rig.twoHand]] <= 0 && hp[armSlot[other(rig.twoHand)]] > 0
      const gear = takeover ? rig[other(hand)] : rig[hand]
      if (!gear) continue
      const damaged = hp[armSlot[hand]] <= 0
      const grip = row.anchors[side + '-grip'] ?? mount
      handDrawn.add(hand)
      ctx.save()
      if (damaged && !(native && options.action.endsWith('-damaged'))) {
        ctx.filter = 'saturate(.35) brightness(.68)'
        ctx.translate(0, 7)
      }
      if (native ? gear === visualOf(when.part) : (gear === 'blade' && side === 'right') || (gear === 'pistol' && side === 'left')) draw(layer)
      else if (when.part === 'hand-blade' && gear === 'shield') {
        const width = dir ? 16 : 25
        attachment(ctx, grip, [[-width/2,-15],[0,-20],[width/2,-15],[width/2,12],[0,21],[-width/2,12]], '#edbb61',
          [[-2,-12,4,3],[-2,3,4,8]])
      } else if (when.part === 'hand-pistol' && gear === 'shield') {
        attachment(ctx, grip, [[-10,-15],[0,-20],[10,-15],[10,12],[0,21],[-10,12]], '#edbb61', [[-2,-12,4,3],[-2,3,4,8]])
      } else if (gear === 'gauntlet' || gear === 'greatblade' || gear === 'blade') {
        const size = gear === 'gauntlet' ? 7 : gear === 'greatblade' ? 31 : 23
        attachment(ctx, grip, [[-5,6],[-6,-1],[-4,-size],[1,-size-4],[5,-size+5],[5,7]], '#e5b04e',
          [[-2,-size+4,2,size-4]])
      } else {
        attachment(ctx, grip, [[-7,5],[-7,-8],[dir*14,-10],[dir*17,-7],[dir*15,-3],[2,-2],[1,6]], '#86e4df', [[dir*7-3,-7,6,2]])
      }
      ctx.restore()
      continue
    }
    const limb = layer.limb
    const affected = limb === 'leftArm' || limb === 'rightArm' ? armSlot[hands(limb === 'leftArm' ? 'left' : 'right')] : limb
    const bakedDamage = native && (options.action.endsWith('-damaged') || options.action.endsWith('-both-arms-broken') && affected !== 'legs'
      || affected === 'legs' && action.endsWith('-degraded')
      || affected === 'leftArm' && options.action.endsWith('-one-right')
      || affected === 'rightArm' && options.action.endsWith('-one-left'))
    ctx.save()
    if (affected && hp[affected] <= 0 && !bakedDamage) {
      ctx.filter = 'saturate(.35) brightness(.63)'
      if (affected !== 'legs') ctx.translate(0, 7)
      else if (action.startsWith('walk')) ctx.translate(index % 4 < 2 ? 1 : -1, 0)
    }
    draw(layer)
    ctx.restore()
    // Legacy two-grip cels combine the feet with the torso. Keep their pose and apply the same
    // damage finish below the knee until the authoring source supplies independent greave layers.
    if (!native && twoGrip && !affected && hp.legs <= 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, foot[1] - 29, 2 * foot[0], 34)
      ctx.clip()
      ctx.filter = 'saturate(.35) brightness(.63)'
      draw(layer)
      ctx.restore()
    }
  }
  if ((!twoGrip && selection.authored && (action === 'down' || action === 'rig-break' || action === 'reboot-rise')) || native) {
    // Collapse and rise cels use the actual bent legs and lowered arms from the recovery rig.
    // Keep each mounted prop at its surviving grip or retention point throughout the transition.
    for (const hand of ['left', 'right'] as const) {
      const grip = row.anchors[hand + '-grip'], gear = rig[hand]
      if (!grip || !gear || handDrawn.has(hand) || native && twoGrip && hand === rig.twoHand) continue
      const x = grip[0], y = grip[1] + (hp[armSlot[hand]] <= 0 ? 6 : 0)
      const length = gear === 'shield' ? 14 : gear === 'blade' || gear === 'greatblade' ? 16 : 6
      attachment(ctx, [x, y], [[-5, 4],[-5,-length],[1,-length-3],[5,-length],[6,5]],
        hp[armSlot[hand]] <= 0 ? '#827b74' : '#e2ac5c', [[-1,-length+2,3,3]])
    }
  }
  if (!backDrawn && rig.back) emitter = pack(ctx, mount, rig.back, facing)
  if (active && !backEffectDrawn) {
    const color = action === 'back-med' ? '#7cf8af' : action === 'back-tech' ? '#65e3ff' : dash ? '#ff9851' : '#fdc960'
    energy(ctx, emitter, dash ? -dir * 16 : dir * 9, dash ? 20 + index % 4 : -12, color)
  } else if (action === 'attack-back' && shot && !backEffectDrawn && (native || rig.back !== 'launcher' || twoGrip)) {
    energy(ctx, emitter, dir * 17, dir ? -3 : -16, '#fca152')
  }
  ctx.restore()
  const out = Object.fromEntries(Object.entries(anchors).map(([name, point]) => [flip ? leftToRight(name) : name, transform(point)]))
  out['back-emitter'] = transform(emitter)
  if (rig.back && action === 'attack-back') out['pod-muzzle'] = transform(emitter)
  return out
}
