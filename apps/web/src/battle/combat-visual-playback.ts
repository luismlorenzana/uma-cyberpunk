import { dirTo, targetTile, type BattleAction, type BattleState, type Cue, type Dir, type Mount, type UnitState } from '@cyber/battle'
import type { Clip } from '../board/combat-sprite-format'
import type { BoardScene } from '../board/scene'

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i)
const wait = (ms: number) => ms > 0 ? new Promise<void>(resolve => setTimeout(resolve, ms)) : Promise.resolve()

/** Reuse an authored firing beat for extra rounds and jump to recovery after the last resolved pulse. */
export function attackFrames(clip: Clip, count: number): { frames: number[]; pulses: number[] } {
  const markers = (cue: string) => [...new Set(clip.events.filter(e => e.cue === cue).map(e => e.frame))].sort((a, b) => a - b)
  const beats = [markers('shot-pulse'), markers('effect'), markers('impact')].find(rows => rows.length) ?? [0]
  const last = beats[beats.length - 1]!
  const frames: number[] = [], pulses: number[] = []
  let elapsed = 0
  const add = (start: number, end: number) => {
    for (const i of range(start, end)) { frames.push(i); elapsed += clip.frames[i]!.ms }
  }
  for (let shot = 0; shot < count; shot++) {
    const beatIndex = Math.min(shot, beats.length - 1)
    const beat = beats[beatIndex]!
    const start = beatIndex > 0 ? beats[beatIndex - 1]! + 1 : shot > 0 ? Math.max(0, beat - 1) : 0
    add(start, beat)
    pulses.push(elapsed)
    add(beat, beat + 1)
  }
  if (!count) add(0, beats[0]!)
  add(last + 1, clip.frames.length)
  return { frames: frames.length ? frames : [0], pulses }
}

type Attack = Extract<Cue, { kind: 'attack' }>

function outcomes(cues: readonly Cue[], at: number, attack: Attack): number[] {
  const out: number[] = []
  for (let i = at + 1; i < cues.length; i++) {
    const cue = cues[i]!
    if (cue.kind === 'attack' || cue.kind === 'faced' || cue.kind === 'turnStarted' || cue.kind === 'ended') break
    if ((cue.kind === 'hit' || cue.kind === 'miss' || cue.kind === 'holdHit') && cue.unit === attack.unit && cue.target === attack.target) out.push(i)
    if ((cue.kind === 'barrierHit' && cue.unit === attack.unit && cue.id === attack.target) || (cue.kind === 'burst' && cue.prop === attack.target)) out.push(i)
  }
  return out
}

export type CombatTrace = { cue: Cue['kind']; unit?: string; clip?: string; facing?: Dir; tile?: readonly [number, number]; mount?: Mount; pulses?: number; source?: string; anchor?: string }

/** Only a single offensive mount can use the old fitting-wide attack clip. */
export function singleOffensiveMount(loadout: BattleState['input']['units'][number]['loadout']): Mount | undefined {
  const mounts: Mount[] = []
  if (loadout.leftHand?.kind === 'weapon') mounts.push('left')
  if (loadout.rightHand?.kind === 'weapon') mounts.push('right')
  if (loadout.back.kind === 'launcher' && loadout.back.weapon) mounts.push('back')
  return mounts.length === 1 ? mounts[0] : undefined
}

export class CombatVisualPlayback {
  private readonly units: UnitState[]
  private readonly guarding = new Set<string>()
  private attack: { ends: number; pulses: Map<number, number>; firstContact?: number; covered: boolean; miss: boolean } | null = null

  constructor(private readonly scene: BoardScene, private readonly action: BattleAction, private readonly cues: readonly Cue[],
    private readonly before: BattleState, private readonly speed: number, private readonly skipped: () => boolean,
    private readonly trace: (entry: CombatTrace) => void) {
    this.units = before.units.map(unit => ({ ...unit, hp: { ...unit.hp } }))
  }

  private unit(id: string): UnitState | undefined { return this.units.find(unit => unit.id === id) }

  private play(unit: UnitState | undefined, clip: string, cue: Cue['kind'], anchor?: string) {
    if (!unit || this.skipped()) return { ends: 0, anchor: 0 }
    const selection = this.scene.combatClip(unit.id, clip, unit, unit.facing)
    if (!selection) return { ends: 0, anchor: 0 }
    const frame = anchor ? selection.clip.events.find(event => event.cue === anchor)?.frame : undefined
    const offset = frame === undefined || this.scene.stillCombat ? 0 : selection.clip.frames.slice(0, frame).reduce((time, cel) => time + cel.ms, 0) / this.speed
    this.trace({ cue, unit: unit.id, tile: [unit.x, unit.y], facing: unit.facing, clip: selection.name, ...(anchor ? { anchor } : {}) })
    return { ends: this.scene.playCombat(unit.id, selection.name, unit.facing, unit, this.speed), anchor: offset }
  }

  async beforeCue(cue: Cue, index: number): Promise<boolean> {
    if (this.skipped()) return false
    if (cue.kind === 'attack' || cue.kind === 'faced' || cue.kind === 'turnStarted' || cue.kind === 'ended') await this.finishAttack()
    const at = this.attack?.pulses.get(index)
    if (at === undefined) return false
    await wait(at - performance.now())
    return true
  }

  async finishAttack(): Promise<void> {
    if (this.attack && !this.skipped()) await wait(this.attack.ends - performance.now())
    this.attack = null
    this.guarding.clear()
  }

  async beforeRemoval(cue: Extract<Cue, { kind: 'freed' | 'extracted' | 'talked' }>): Promise<void> {
    const id = cue.kind === 'talked' ? cue.target : cue.unit
    if (!this.before.input.units.find(unit => unit.id === id)?.sprite) return
    const clip = cue.kind === 'freed' ? 'collar-release' : cue.kind === 'talked' ? 'talk-exit' : 'withdraw'
    const { ends } = this.play(this.unit(id), clip, cue.kind)
    if (!this.scene.stillCombat) await wait(ends)
  }

  async afterCue(cue: Cue, index: number): Promise<void> {
    if (this.skipped()) return
    const actor = 'unit' in cue ? this.unit(cue.unit) : undefined
    if (cue.kind === 'dash' && actor) {
      const nextMove = this.cues.slice(index + 1).find(c => c.kind === 'moved' && c.unit === actor.id)
      if (nextMove?.kind === 'moved' && nextMove.path[0] && nextMove.path[1]) actor.facing = dirTo(nextMove.path[0], nextMove.path[1])
      await wait(this.play(actor, 'back-dash', cue.kind, 'emitter').anchor)
    } else if ((cue.kind === 'tech' || cue.kind === 'hacked') && actor) {
      await wait(this.play(actor, 'back-tech', cue.kind, 'emitter').ends)
      this.scene.setCombatPose(actor.id, actor)
    } else if (cue.kind === 'moved' && actor) {
      const end = cue.path.at(-1), previous = cue.path.at(-2)
      if (end && previous) {
        ;[actor.x, actor.y] = end
        actor.facing = dirTo(previous, end)
        this.scene.face(actor.id, actor.facing)
        await wait(this.play(actor, 'settle', cue.kind).ends)
      }
    } else if (cue.kind === 'faced' && actor) {
      actor.facing = cue.facing
      this.scene.setCombatPose(actor.id, actor)
    } else if (cue.kind === 'attack' && actor) {
      const hitIndices = outcomes(this.cues, index, cue)
      const firstContact = hitIndices.find(hit => this.cues[hit]?.kind !== 'miss')
      this.attack = { ends: performance.now(), pulses: new Map(), firstContact, covered: false, miss: firstContact === undefined }
      const target = targetTile({ ...this.before, units: this.units }, cue.target)
      if (!target) return
      const direction = dirTo([actor.x, actor.y], target)
      const loadout = this.before.input.units.find(unit => unit.id === actor.id)?.loadout
      const selection = this.scene.combatClip(actor.id, `attack-${cue.with}`, actor, direction)
        ?? (loadout && singleOffensiveMount(loadout) === cue.with ? this.scene.combatClip(actor.id, 'attack', actor, direction) : null)
      if (!selection) return
      const { frames, pulses } = attackFrames(selection.clip, hitIndices.length)
      const now = performance.now()
      const duration = this.scene.playCombat(actor.id, selection.name, direction, actor, this.speed, frames)
      this.trace({ cue: 'attack', unit: actor.id, clip: selection.name, facing: direction, tile: [actor.x, actor.y], mount: cue.with, pulses: hitIndices.length })
      this.attack.ends = now + duration
      this.attack.pulses = new Map(hitIndices.map((hit, i) => [hit, now + (this.scene.stillCombat ? 0 : pulses[i]! / this.speed)]))
    } else if ((cue.kind === 'guard' || cue.kind === 'cover') && actor) {
      if (cue.kind === 'guard' && this.attack?.covered) return
      if (cue.kind === 'cover' && this.attack) this.attack.covered = true
      const selection = this.scene.combatClip(actor.id, cue.kind, actor, actor.facing)
      if (!selection) return
      this.guarding.add(actor.id)
      const contact = selection.clip.events.find(event => event.cue === 'shield-contact')?.frame
      const misses = this.attack?.miss ?? false
      const frames = range(0, selection.clip.frames.length).filter(i => !misses || i !== contact)
      this.trace({ cue: cue.kind, unit: actor.id, clip: selection.name, facing: actor.facing, tile: [actor.x, actor.y], ...(!misses ? { anchor: 'shield-contact' } : {}) })
      const preContact = contact === undefined ? 0 : selection.clip.frames.slice(0, contact).reduce((sum, cel) => sum + cel.ms, 0)
      const now = performance.now()
      const index = this.attack?.firstContact
      const time = index === undefined ? undefined : this.attack?.pulses.get(index)
      const reactionSpeed = time === undefined ? this.speed : preContact / Math.max(1, time - now) || this.speed
      if (this.attack && index !== undefined && time === undefined && !this.scene.stillCombat) {
        this.attack.pulses.set(index, now + preContact / this.speed)
      }
      const duration = this.scene.playCombat(actor.id, selection.name, actor.facing, actor, reactionSpeed, frames)
      if (this.attack) this.attack.ends = Math.max(this.attack.ends, now + duration)
    } else if (cue.kind === 'hit' || cue.kind === 'burn') {
      const recipient = cue.kind === 'hit' ? this.unit(cue.target) : actor
      if (recipient && !this.guarding.has(recipient.id)) this.play(recipient, 'hurt', cue.kind)
    } else if (cue.kind === 'partBroke' && actor) {
      actor.hp[cue.part] = 0
      if (cue.part !== 'core') this.scene.setCombatPose(actor.id, actor)
    } else if (cue.kind === 'rigBreak' && actor) {
      actor.status = 'down'
      await wait(this.play(actor, 'rig-break', cue.kind).ends)
      this.scene.setCombatPose(actor.id, actor)
    } else if (cue.kind === 'barrier') {
      const fitted = this.action.kind === 'turn' && this.action.act.kind === 'barrier' && this.action.unit === cue.unit
      const pose = fitted ? this.play(actor, 'back-deploy', cue.kind, 'emitter') : { ends: 0, anchor: 0 }
      await wait(pose.anchor)
      if (this.skipped()) return
      this.scene.placeBarrier(cue.id, cue.at, this.speed)
      this.trace({ cue: cue.kind, tile: cue.at, source: fitted ? 'bulwark' : this.action.kind })
      await wait(Math.max(pose.ends - pose.anchor, this.scene.stillCombat ? 0 : 250 / this.speed))
      if (actor && fitted) this.scene.setCombatPose(actor.id, actor)
    } else if (cue.kind === 'barrierHit' && cue.broke) {
      this.scene.removeCombatEffect(cue.id)
    } else if (cue.kind === 'mended' || cue.kind === 'rebooted' || cue.kind === 'drone') {
      const recipient = this.unit(cue.target)
      if (!recipient) return
      const fitted = this.action.kind === 'turn' && (this.action.act.kind === 'mend' || this.action.act.kind === 'reboot') && this.action.unit === cue.unit
      const pose = fitted ? this.play(actor, 'back-med', cue.kind, 'emitter') : { ends: 0, anchor: 0 }
      await wait(pose.anchor)
      if (this.skipped()) return
      const effect = cue.kind !== 'rebooted' ? 'mend' : fitted ? 'med-reboot' : 'order-reboot'
      this.scene.combatRepair(effect, [recipient.x, recipient.y], this.speed)
      this.trace({ cue: cue.kind, unit: recipient.id, tile: [recipient.x, recipient.y], source: effect })
      let rise = 0
      if (cue.kind === 'rebooted') {
        rise = this.play(recipient, 'reboot-rise', cue.kind).ends
        recipient.status = 'active'
        this.scene.setDown(recipient.id, false)
      } else {
        recipient.hp[cue.part] = cue.hp
        if (recipient.id !== actor?.id || !fitted) this.scene.setCombatPose(recipient.id, recipient)
      }
      await wait(Math.max(rise, pose.ends - pose.anchor, this.scene.stillCombat ? 0 : 295 / this.speed))
      this.scene.setCombatPose(recipient.id, recipient)
      if (actor && fitted) this.scene.setCombatPose(actor.id, actor)
    }
  }
}
