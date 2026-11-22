import { applyBattleAction, dirTo, startBattle, type BattleAction, type BattleInput, type Cue, type Dir, type PartId, type Tile } from '@cyber/battle'
import { issuedCampaignRig, loadoutOf } from '@cyber/domain'
import { groundInput } from './training'

export const TRAINING_REVIEWS = [
  'issued-rifle', 'issued-blade', 'issued-med', 'rifle-right', 'rifle-left', 'rifle-both', 'rifle-mend',
  'shield-front', 'shield-side', 'shield-rear', 'shield-disabled', 'shield-miss', 'shield-cover', 'shield-attack',
  'bulwark', 'bench', 'barrier-break', 'mend', 'patch', 'break', 'break-intact', 'med-reboot', 'order-reboot', 'med-reboot-intact', 'expiry',
] as const
export type TrainingReview = typeof TRAINING_REVIEWS[number]
const dirs = ['N', 'E', 'S', 'W'] as const
const step: Record<Dir, Tile> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }
const add = (a: Tile, b: Tile): Tile => [a[0] + b[0], a[1] + b[1]]
const rotate = (dir: Dir, n: number) => dirs[(dirs.indexOf(dir) + n) % dirs.length]!
const trainee = 'trainee', helper = 'review-partner', drone = 'practice-drone'

export interface TrainingReplay {
  input: BattleInput
  prefix: BattleAction[]
  action: BattleAction
  cues: Cue[]
  error: string | null
}

/** Local-only fixtures. Each prefix is legal reducer play on the unchanged Training Deck terrain. */
function attempt(outfit: number, review: TrainingReview, face: Dir, seed: number): TrainingReplay | null {
  const med = issuedCampaignRig('hand-rifle', 'back-med')
  const main = review === 'issued-blade' ? 'hand-greatblade' : review.startsWith('shield') ? 'hand-blade' : 'hand-rifle'
  const back = ['issued-med', 'mend', 'patch'].includes(review) ? 'back-med' : 'back-bulwark'
  const rig = { ...issuedCampaignRig(main, back), leftHand: review.startsWith('shield') ? 'hand-tower' : null }
  const base = groundInput('training', outfit, 'Trainee', main, back, undefined, [], rig)
  const issued = review.startsWith('issued')
  const slowTrainee = ['break', 'break-intact', 'med-reboot', 'order-reboot', 'med-reboot-intact', 'expiry'].includes(review)
  const a = base.units.find(u => u.id === trainee)!, e = base.units.find(u => u.id === drone)!
  // Leave the west-facing rifle's eastward move in front of the deck wall for the grip review.
  const westRifle = face === 'W' && (review === 'rifle-right' || review === 'rifle-left')
  const center: Tile = westRifle ? [1, 2] : [2, 2]
  const incoming = review === 'shield-side' ? rotate(face, 1) : review === 'shield-rear' ? rotate(face, 2) : face
  const sides = [rotate(incoming, 1), rotate(incoming, 3)].map(dir => add(center, step[dir]))
  const canStand = ([x, y]: Tile) => base.map.tiles[y]?.[x] === '.' || base.map.tiles[y]?.[x] === 'c'
  const stepAhead = (tile: Tile) => add(tile, step[incoming])
  const range = review === 'shield-attack' || westRifle ? stepAhead : (tile: Tile) => stepAhead(stepAhead(tile))
  const partnerOptions = slowTrainee || review === 'mend' || review === 'patch'
    ? [add(center, step.W), add(center, step.E), ...sides] : sides
  const partnerTile = partnerOptions.find(tile => review !== 'shield-cover'
    || (canStand(stepAhead(tile)) && canStand(range(tile))))!
  const enemyTile: Tile = review === 'bulwark' || review === 'bench' ? [4, 3]
    : range(review === 'shield-cover' ? partnerTile : center)
  const support = { ...a, id: helper, label: 'Review partner', spawn: 1, facing: face, chargeCap: 4,
    bands: { ...a.bands, speed: 5 as const }, loadout: loadoutOf(med), frozenRig: med, link: false }
  const input: BattleInput = issued ? base : {
    ...base, seed: `cy57-${review}-${face}-${seed}`, rulesVersion: 4,
    map: { ...base.map, spawns: { ...base.map.spawns, squad: [center, partnerTile, ...base.map.spawns.squad.slice(2)], enemy: [enemyTile] } },
    units: [
      { ...a, facing: face, link: review === 'shield-cover', ...(slowTrainee ? { bands: { ...a.bands, speed: 1 } } : {}) },
      support,
      { ...e, facing: dirTo(enemyTile, center), link: false, ...(review.endsWith('intact') ? { bands: { ...e.bands, speed: 5 } } : {}), loadout: {
        ...e.loadout, visor: { ...e.loadout.visor, aim: true }, leftHand: null,
        rightHand: { kind: 'weapon', band: 'short', type: 'P', power: review.startsWith('shield') ? review === 'shield-disabled' ? 44 : 24 : 130,
          accuracy: review === 'shield-miss' ? 0 : 150, range: [1, 3], hits: 1, load: 1 },
      } },
    ],
    bench: ['vanguard'], items: { patch: 1 }, orders: { slots: 2, kinds: ['reboot'] },
  }
  let state = startBattle(input).state
  const prefix: BattleAction[] = []
  const turn = (unit: string, act: Extract<BattleAction, { kind: 'turn' }>['act'], to?: Tile): BattleAction =>
    ({ kind: 'turn', unit, act, ...(to ? { to } : {}), face: unit === drone ? dirTo(enemyTile, center) : face })
  const addAction = (action: BattleAction): boolean => {
    const result = applyBattleAction(state, action)
    if (result.error) return false
    prefix.push(action)
    state = result.state
    return true
  }
  const align = (unit: string): boolean => {
    for (let n = 0; n < 20 && state.active && state.active !== unit; n++) {
      if (!addAction(turn(state.active, { kind: 'none' }))) return false
    }
    return state.active === unit
  }
  const hurt = (unit: string, part: PartId): boolean => align(drone) && addAction(turn(drone, { kind: 'attack', with: 'right', target: unit, aim: part }))
    && state.units.find(u => u.id === unit)?.hp[part] === 0
  const finish = (action: BattleAction, check: (cues: Cue[], error: string | null) => boolean): TrainingReplay | null => {
    const r = applyBattleAction(state, action)
    return check(r.cues, r.error) ? { input, prefix, action, cues: r.cues, error: r.error } : null
  }

  if (issued) {
    if (!align(trainee)) return null
    return finish(turn(trainee, { kind: 'none' }), (_, error) => !error)
  }
  if (review.startsWith('rifle')) {
    if (review !== 'rifle-left' && !hurt(trainee, 'leftArm')) return null
    if (review !== 'rifle-right' && !hurt(trainee, 'rightArm')) return null
    if (review === 'rifle-mend') {
      if (!align(helper)) return null
      return finish(turn(helper, { kind: 'mend', target: trainee, part: 'rightArm' }), (cues, error) => !error && cues.some(c => c.kind === 'mended'))
    }
    if (!align(trainee)) return null
    const to = review === 'rifle-both' ? center : add(center, step[rotate(face, 2)])
    return finish(turn(trainee, { kind: 'attack', with: 'right', target: drone }, to),
      (cues, error) => review === 'rifle-both' ? !!error && !cues.length : !error && cues.some(c => c.kind === 'attack' && c.unit === trainee))
  }
  if (review === 'shield-attack') {
    if (!align(trainee)) return null
    return finish(turn(trainee, { kind: 'attack', with: 'right', target: drone }), (cues, error) => !error && cues.some(c => c.kind === 'attack' && c.unit === trainee))
  }
  if (review.startsWith('shield')) {
    if (review === 'shield-disabled' && !hurt(trainee, 'leftArm')) return null
    if (!align(drone)) return null
    const target = review === 'shield-cover' ? helper : trainee
    return finish(turn(drone, { kind: 'attack', with: 'right', target, aim: 'core' }), (cues, error) => {
      if (error) return false
      if (review === 'shield-cover') return cues.some(c => c.kind === 'cover' && c.unit === trainee && c.for === helper)
      if (review === 'shield-miss') return cues.some(c => c.kind === 'guard' && c.unit === trainee) && cues.some(c => c.kind === 'miss' && c.target === trainee)
      if (review === 'shield-rear' || review === 'shield-disabled') return !cues.some(c => c.kind === 'guard') && cues.some(c => c.kind === 'hit' && c.target === trainee)
      return cues.some(c => c.kind === 'guard' && c.unit === trainee) && cues.some(c => c.kind === 'hit' && c.target === trainee)
    })
  }
  if (review === 'bulwark' || review === 'bench') {
    if (!align(trainee)) return null
    const at = add(center, step[rotate(face, 2)])
    const action: BattleAction = review === 'bench' ? { kind: 'bench', unit: trainee, role: 'vanguard', at } : turn(trainee, { kind: 'barrier', at })
    return finish(action, (cues, error) => !error && cues.some(c => c.kind === 'barrier'))
  }
  if (review === 'barrier-break') {
    if (!align(trainee) || !addAction(turn(trainee, { kind: 'barrier', at: stepAhead(center) })) || !align(drone)) return null
    const target = state.field?.barriers[0]?.id
    return target ? finish(turn(drone, { kind: 'attack', with: 'right', target }),
      (cues, error) => !error && cues.some(c => c.kind === 'barrierHit' && c.id === target && c.broke)) : null
  }
  if (review === 'mend' || review === 'patch') {
    if (!hurt(helper, 'leftArm') || !align(trainee)) return null
    const action = review === 'mend' ? turn(trainee, { kind: 'mend', target: helper, part: 'leftArm' })
      : turn(trainee, { kind: 'item', item: 'patch', target: helper, part: 'leftArm' })
    return finish(action, (cues, error) => !error && cues.some(c => c.kind === 'mended'))
  }

  if (!review.endsWith('intact')) for (const part of ['leftArm', 'rightArm', 'legs'] as const) if (!hurt(trainee, part)) return null
  if (!align(drone)) return null
  const breakCore = turn(drone, { kind: 'attack', with: 'right', target: trainee, aim: 'core' })
  if (review.startsWith('break')) return finish(breakCore, (cues, error) => !error && cues.some(c => c.kind === 'rigBreak' && c.unit === trainee)
    && applyBattleAction(state, breakCore).state.units.find(u => u.id === trainee)?.status === 'down')
  if (!addAction(breakCore) || state.units.find(u => u.id === trainee)?.status !== 'down') return null
  if (review === 'expiry') {
    for (let n = 0; n < 10 && state.active; n++) {
      const action = turn(state.active, { kind: 'none' })
      const final = finish(action, (cues, error) => !error && cues.some(c => c.kind === 'extracted' && c.unit === trainee))
      if (final) return final
      if (!addAction(action)) break
    }
    return null
  }
  if (!align(helper)) return null
  const action: BattleAction = review === 'order-reboot' ? { kind: 'order', unit: helper, order: 'reboot', target: trainee }
    : turn(helper, { kind: 'reboot', target: trainee })
  return finish(action, (cues, error) => !error && cues.some(c => c.kind === 'rebooted' && c.target === trainee))
}

export function trainingReview(outfit: number, review: TrainingReview, facing: Dir): TrainingReplay {
  for (let seed = 1; seed <= 100; seed++) {
    const fixture = attempt(outfit, review, facing, seed)
    if (fixture) return fixture
  }
  throw new Error(`No legal Training replay for ${review} in ${facing}`)
}
