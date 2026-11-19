import { describe, expect, it } from 'vitest'
import { parseCabinEvenings } from './campaign-cabins'
import type { CampaignBook } from './campaign'
import type { Scene } from './types'

const actor = 9000001
const raw = () => ({ id: 'officer-cabin', source: { companion: actor }, chatRapport: 100,
  chats: { acquaintance: ['first-chat'], friend: ['friend-chat'], partner: ['partner-chat'] },
  invitation: { scene: 'invite', stay: 0, leave: 1, wait: 2 }, bed: ['bed'], morning: { stay: 'stay-morning', leave: 'leave-morning' }, changeMind: 'withdraw' })
function fixture() {
  const scenes = new Map(['first-chat', 'friend-chat', 'partner-chat', 'invite', 'bed', 'stay-morning', 'leave-morning', 'withdraw']
    .map(id => [id, { id, place: 'cabin', trigger: { arrive: 'cabin' }, cast: [{ outfit: actor }],
      steps: id === 'invite' ? [{ kind: 'choice', options: ['Stay', 'Leave', 'More time'].map(text => ({ text, then: [] })) }]
        : [{ kind: 'line', speaker: actor, text: 'A quiet moment.' }] } as Scene]))
  const book: Pick<CampaignBook, 'dates' | 'pairs' | 'sectors' | 'scenes'> = {
    dates: [{ companion: actor, after: 'joined', milestones: [], regular: { scene: 'old-chat', title: 'Chat', morning: null }, awards: [] }], pairs: [], scenes }
  return { book, scenes }
}

describe('the campaign cabin authoring contract', () => {
  it('accepts explicit rotation and outcome mappings independently of scene art', () => {
    const { book } = fixture()
    expect(parseCabinEvenings([raw()], book, new Set())[0]).toEqual(raw())
    const decline = { ...raw(), invitation: { scene: 'invite', stay: 0, leave: 1, decline: 2 } }
    expect(parseCabinEvenings([decline], book, new Set())[0]!.invitation).toEqual(decline.invitation)
  })
  it('rejects unknown sources, missing cast, reused quest scenes, duplicate IDs and unbound outcomes', () => {
    for (const mutate of [
      (r: ReturnType<typeof raw>) => { r.source.companion = 9000002 },
      (r: ReturnType<typeof raw>) => { r.bed = ['missing'] },
      (r: ReturnType<typeof raw>) => { r.invitation.leave = 0 },
      (r: ReturnType<typeof raw>) => { r.invitation.wait = 5 },
      (r: ReturnType<typeof raw>) => { r.chats.friend = [] },
      (r: ReturnType<typeof raw>) => { r.morning.leave = r.morning.stay },
    ]) { const { book } = fixture(), row = raw(); mutate(row); expect(() => parseCabinEvenings([row], book, new Set())).toThrow() }
    const { book, scenes } = fixture()
    expect(() => parseCabinEvenings([raw(), raw()], book, new Set())).toThrow(/duplicate/)
    expect(() => parseCabinEvenings([raw()], book, new Set(['bed']))).toThrow(/assigned/)
    scenes.get('bed')!.cast = []
    expect(() => parseCabinEvenings([raw()], book, new Set())).toThrow(/participants/)
  })
  it('keeps narrative choices while refusing hidden rewards, roster mutations and nested invitation choices', () => {
    for (const step of [ { kind: 'flag', flag: 'unearned-release', set: true }, { kind: 'join', outfit: actor },
      { kind: 'captain', options: [{ tone: 'warm', text: 'Reward', rapport: 10, then: [] }] } ]) {
      const { book, scenes } = fixture()
      scenes.get('bed')!.steps.push(step as Scene['steps'][number])
      expect(() => parseCabinEvenings([raw()], book, new Set())).toThrow(/cannot grant/)
    }
    const { book, scenes } = fixture(), invite = scenes.get('invite')!.steps[0]!
    if (invite.kind !== 'choice') throw Error('Choice fixture missing')
    invite.options[0]!.then.push(structuredClone(invite))
    expect(() => parseCabinEvenings([raw()], book, new Set())).toThrow(/top-level choice/)
  })
})
