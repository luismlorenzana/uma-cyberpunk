// The scene runner (CY9, uma-quest's runner copied in shape and cut to these steps): plays a scene's steps one after
// another. A line waits for the player's tap; an interjection slot plays the line of the first lead in the squad's order
// who has one, else its fallback; a choice and a Call wait for a pick and play its steps; a battle hands the mission to
// the flow; the rest change the story at once. Skipping passes lines, emotes and waits until the next choice. No three.js
// and no React: the screen comes in as a small interface, so it's tested headless.
import type { BondPath, Call, CaptainOption, ChoiceOption, EffectStep, Romance, Scene, Speaker, Step, StoryPack } from '@cyber/domain'

export interface SceneUi {
  /** Shows a line (by its speaker, or narration) and resolves when the player taps on. */
  line(speaker: Speaker | null, text: string, kind: 'line' | 'thought' | 'narrate'): Promise<void>
  emote(actor: Speaker, emote: string): Promise<void>
  wait(ms: number): Promise<void>
  /** Resolves with the option picked. */
  choose(options: readonly ChoiceOption[]): Promise<number>
  /** Holds a Call; resolves with the branch picked. */
  call(call: Call): Promise<number>
  /** Plays a mission (CY10's flow); the scene goes on after it. */
  battle(mission: string): Promise<void>
  /** A step that changes the story, the crew or the ship: flag, lead, file, anomaly, join, aboard, refit. */
  effect(step: EffectStep): void
  /** The captain's choice (CY13): resolves with the option picked. Without it, the first. */
  captain?(options: readonly CaptainOption[]): Promise<number>
  /** Trust or Heart (CY13). Without it, Trust. */
  path?(): Promise<BondPath>
  /** What a bond scene changes: rapport from a captain's choice, the path chosen. */
  bond?(effect: BondEffect): void
}

export type BondEffect = { kind: 'rapport'; amount: number } | { kind: 'path'; path: BondPath }

export interface RunOptions {
  pack: StoryPack
  squad: readonly number[]
  skipping: () => boolean
  stopSkipping: () => void
  /** The captain's Romance setting: with Friends only, a path step takes Trust without asking. */
  romance?: Romance
}

/** An interjection slot's line (TC51): the first lead in the squad's order who has one, else the fallback. */
export function slotLine(step: Extract<Step, { kind: 'slot' }>, squad: readonly number[]): { speaker: number | null; text: string } {
  for (const id of squad) {
    const text = step.lines[String(id)]
    if (text) return { speaker: id, text }
  }
  return { speaker: null, text: step.fallback }
}

export async function playSteps(steps: readonly Step[], ui: SceneUi, o: RunOptions): Promise<void> {
  for (const step of steps) {
    const skip = o.skipping()
    switch (step.kind) {
      case 'line': case 'thought': if (!skip) await ui.line(step.speaker, step.text, step.kind); break
      case 'narrate': if (!skip) await ui.line(null, step.text, 'narrate'); break
      case 'slot': { if (skip) break; const l = slotLine(step, o.squad); await ui.line(l.speaker, l.text, l.speaker === null ? 'narrate' : 'line'); break }
      case 'emote': if (!skip) await ui.emote(step.actor, step.emote); break
      case 'wait': if (!skip) await ui.wait(step.ms); break
      case 'choice': {
        o.stopSkipping()
        const i = await ui.choose(step.options)
        const option = step.options[i]
        if (!option) break
        if (option.lead) ui.effect({ kind: 'lead', lead: option.lead })
        await playSteps(option.then, ui, o)
        break
      }
      case 'call': {
        const call = o.pack.calls[step.call]
        if (!call) break
        o.stopSkipping()
        const i = await ui.call(call)
        await playSteps(call.branches[i]?.then ?? [], ui, o)
        break
      }
      case 'battle': o.stopSkipping(); await ui.battle(step.mission); break
      case 'captain': {
        o.stopSkipping()
        const i = ui.captain ? await ui.captain(step.options) : 0
        const option = step.options[i]
        if (!option) break
        if (option.rapport) ui.bond?.({ kind: 'rapport', amount: option.rapport })
        await playSteps(option.then, ui, o)
        break
      }
      case 'path': {
        o.stopSkipping()
        const path: BondPath = o.romance === 'friends' || !ui.path ? 'trust' : await ui.path()
        ui.bond?.({ kind: 'path', path })
        await playSteps(path === 'trust' ? step.trust : step.heart, ui, o)
        break
      }
      default: ui.effect(step)
    }
  }
}

export const playScene = (scene: Pick<Scene, 'steps'>, ui: SceneUi, o: RunOptions): Promise<void> => playSteps(scene.steps, ui, o)

let nameSource: (outfit: number) => string | undefined = () => undefined
/** Master data's names, once loaded (CY11). */
export function setNameSource(source: (outfit: number) => string | undefined): void { nameSource = source }

/** A speaker's label: the casting's (stand-ins), else master data's name, else a placeholder until it loads. */
export function nameOf(pack: StoryPack, speaker: Speaker | null): string {
  if (speaker === null) return ''
  const label = pack.casting.labels?.[String(speaker)]
  if (label) return label
  if (typeof speaker === 'number') return nameSource(speaker) ?? `Uma ${speaker}`
  return speaker.replace(/^[a-z0-9]+-/, '').split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')
}
