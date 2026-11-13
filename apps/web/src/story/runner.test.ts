// The runner, headless (CY9): every step kind against a fake screen, the slot's choice of line, skipping and the effects.
import { parsePack, STAND_IN_FILES, type Step, type StoryPack } from '@cyber/domain'
import { describe, expect, it } from 'vitest'
import { nameOf, playScene, playSteps, slotLine, type SceneUi } from './runner'

const pack = parsePack(STAND_IN_FILES).pack as StoryPack
const chapter = pack.chapters['sw1-ch1']!

function fake(picks: number[] = []) {
  const log: string[] = []
  const ui: SceneUi = {
    line: async (s, t, k) => { log.push(`${k}:${s ?? '-'}:${t.slice(0, 12)}`) },
    emote: async (a, e) => { log.push(`emote:${a}:${e}`) },
    wait: async (ms) => { log.push(`wait:${ms}`) },
    choose: async () => { const i = picks.shift() ?? 0; log.push(`choose:${i}`); return i },
    call: async (c) => { log.push(`call:${c.id}`); return 0 },
    battle: async (m) => { log.push(`battle:${m}`) },
    effect: (step) => { log.push(`effect:${step.kind}`) },
  }
  return { ui, log }
}

describe('the runner', () => {
  it('plays the stand-in chapter’s scenes in order, every step kind', async () => {
    const { ui, log } = fake([0])
    let skipping = false
    for (const s of chapter.scenes) await playScene(s, ui, { pack, squad: [9000001, 9000002], skipping: () => skipping, stopSkipping: () => { skipping = false } })
    expect(log).toContain('narrate:-:The docks hu')
    expect(log).toContain('emote:9000001:smile')
    expect(log).toContain('line:9000002:Lead B would')
    expect(log).toContain('choose:0')
    expect(log).toContain('effect:lead')
    expect(log).toContain('effect:flag')
    expect(log).toContain('battle:sw1-ch1-m1')
    expect(log).toContain('call:sw1-call-1')
    expect(log).toContain('effect:join')
    expect(log[log.length - 1]).toBe('effect:aboard')
  })
  it('plays an interjection slot’s line for the first lead in the squad’s order who has one, else the fallback', () => {
    const slot = chapter.scenes[0]!.steps.find((s): s is Extract<Step, { kind: 'slot' }> => s.kind === 'slot')!
    expect(slotLine(slot, [9000003, 9000002])).toEqual({ speaker: 9000002, text: 'Lead B would have a sharper word for him.' })
    expect(slotLine(slot, [9000003])).toEqual({ speaker: null, text: 'The dockhand shrugs and steps aside.' })
  })
  it('skips lines until the next choice, keeping every effect', async () => {
    const { ui, log } = fake([1])
    let skipping = true
    await playSteps(chapter.scenes[0]!.steps, ui, { pack, squad: [], skipping: () => skipping, stopSkipping: () => { skipping = false } })
    expect(log.filter((l) => l.startsWith('line') || l.startsWith('narrate'))).toEqual([])
    expect(log).toContain('choose:1')
    expect(log).toContain('effect:flag')
    expect(log).toContain('effect:lead')
  })
  it('names a speaker from the casting’s stand-in labels', () => {
    expect(nameOf(pack, 9000001)).toBe('Lead A')
    expect(nameOf(pack, 'sw1-dockhand')).toBe('Dockhand')
    expect(nameOf(pack, 1234)).toBe('Uma 1234')
    expect(nameOf(pack, null)).toBe('')
  })
})
