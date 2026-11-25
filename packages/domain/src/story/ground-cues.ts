import type { Cue, TalkContact } from '@cyber/battle'
import { walkSteps } from './check'
import type { P } from './parse'
import type { Scene } from './types'

export interface GroundCues {
  preparation?: string
  victory?: string
  withdrawal?: string
  retry?: string
  refusal?: { target: string; scene: string }
  talk?: { target: string; attempt: string; yes: string; refused: string; broken: string; notYet?: string }[]
  duo?: { unit: string; scene: string }[]
}

export function parseGroundCues(p: P, value: unknown, field: string, scenes: ReadonlyMap<string, Scene>,
  contacts: readonly TalkContact[]): GroundCues {
  const contexts = ['preparation', 'victory', 'withdrawal', 'retry'] as const
  const row = p.object(value, field, [...contexts, 'talk', 'duo', 'refusal'], [])
  const scene = (raw: unknown, path: string) => {
    const id = p.slug(raw, path), record = scenes.get(id)
    if (!record || [...walkSteps(record.steps, '')].some(({ step }) => !['line','thought','narrate','emote','wait','illustration','slot','choice'].includes(step.kind)))
      p.fail(path, 'expected a presentation-only scene')
    return id
  }
  const targets = new Set<string>(), units = new Set<string>()
  const talk = row.talk === undefined ? undefined : p.list(row.talk, `${field}.talk`, (raw, path) => {
    const keys = ['target','attempt','yes','refused','broken']
    const item = p.object(raw, path, [...keys, 'notYet'], keys), target = p.slug(item.target, `${path}.target`)
    const contact = contacts.find(candidate => candidate.target === target)
    if (!contact || targets.has(target) || (item.notYet !== undefined) !== (contact.requires === 'actorHit'))
      p.fail(path, 'expected a unique Talk target with matching prerequisites')
    targets.add(target)
    return { target, attempt: scene(item.attempt, `${path}.attempt`), yes: scene(item.yes, `${path}.yes`),
      refused: scene(item.refused, `${path}.refused`), broken: scene(item.broken, `${path}.broken`),
      ...(item.notYet === undefined ? {} : { notYet: scene(item.notYet, `${path}.notYet`) }) }
  }, 8)
  const duo = row.duo === undefined ? undefined : p.list(row.duo, `${field}.duo`, (raw, path) => {
    const item = p.object(raw, path, ['unit','scene']), unit = p.slug(item.unit, `${path}.unit`)
    if (units.has(unit)) p.fail(path, 'expected one reaction per Duo participant')
    units.add(unit)
    return { unit, scene: scene(item.scene, `${path}.scene`) }
  }, 4)
  const refusal = row.refusal === undefined ? undefined : (() => {
    const path = field + '.refusal'
    const value = p.object(row.refusal, path, ['target', 'scene'])
    const target = p.slug(value.target, path + '.target')
    if (!contacts.some(contact => contact.target === target)) p.fail(path, 'expected a Talk contact')
    return { target, scene: scene(value.scene, path + '.scene') }
  })()
  return { ...(talk ? { talk } : {}), ...(refusal ? { refusal } : {}), ...(duo ? { duo } : {}),
    ...Object.fromEntries(contexts.flatMap(key => row[key] === undefined ? [] : [[key, scene(row[key], `${field}.${key}`)]])) }
}

export function groundCueScenes(binding: GroundCues, cues: readonly Cue[]): string[] {
  return [...new Set(cues.flatMap((cue) => {
    if (cue.kind === 'duo') return [cue.unit, cue.partner].flatMap(unit => binding.duo?.find(row => row.unit === unit)?.scene ?? [])
    if (cue.kind !== 'rigBreak' && cue.kind !== 'talked') return []
    const talk = binding.talk?.find(row => row.target === (cue.kind === 'talked' ? cue.target : cue.unit))
    return talk ? cue.kind === 'talked' ? [talk.attempt, talk.yes] : [talk.broken] : []
  }))]
}
