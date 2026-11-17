import type { CampaignPair, PairMember, PairRoom } from '../campaign-pair'
import { walkSteps } from './check'
import { P } from './parse'
import type { Scene, StoryPack } from './types'

export function parseCampaignPairs(value: unknown, story: StoryPack, scenes: ReadonlyMap<string, Scene>, quests: ReadonlySet<string>,
  reserved: ReadonlySet<string>, captureFlags: ReadonlySet<string>): CampaignPair[] {
  if (value === undefined) return []
  const p = new P('campaign.json')
  const usedScenes = new Set(reserved), usedFlags = new Set<string>(), ids = new Set<string>()
  const cast = new Set([...story.casting.crewOrder, ...story.casting.leads.map(({ outfit }) => outfit)])
  function sceneRef(value: unknown, path: string): string {
    const id = p.slug(value, path)
    const scene = scenes.get(id)
    if (!scene) return p.fail(path, `unknown scene ${id}`)
    if (usedScenes.has(id)) p.fail(path, `scene ${id} is already in use`)
    if ([...walkSteps(scene.steps, path)].some(({ step }) => step.kind === 'battle')) p.fail(path, 'pair scenes cannot start a battle')
    usedScenes.add(id)
    return id
  }
  function flagRef(value: unknown, path: string): string {
    const flag = p.slug(value, path)
    if (usedFlags.has(flag)) p.fail(path, `duplicate pair flag ${flag}`)
    usedFlags.add(flag)
    return flag
  }
  function decision(path: string, scene: string, flags: readonly string[]) {
    const top = scenes.get(scene)!.steps
    const choice = top.find((step) => step.kind === 'choice')
    const setFlags = (steps: Scene['steps']) => [...walkSteps(steps, path)].flatMap(({ step }) =>
      step.kind === 'flag' && flags.includes(step.flag) ? [step] : [])
    if (!choice || choice.options.length !== 2 || setFlags(top.filter((step) => step !== choice)).length > 0) p.fail(path, 'expected two choices with distinct outcome flags')
    const seen = new Set<string>()
    for (const option of choice!.options) {
      const marks = setFlags(option.then)
      const last = option.then.at(-1)
      if (marks.length !== 1 || last?.kind !== 'flag' || !last.set || !flags.includes(last.flag) || seen.has(last.flag)) {
        p.fail(path, 'each choice must end in its own outcome flag')
      } else seen.add(last.flag)
    }
  }
  return p.list(value, 'pairs', (value, path): CampaignPair => {
    const o = p.object(value, path, ['id', 'after', 'capture', 'members', 'recovery', 'testimony', 'release', 'bond', 'residency', 'rooms'])
    const id = p.slug(o.id, `${path}.id`)
    if (ids.has(id)) p.fail(`${path}.id`, `duplicate pair ${id}`)
    ids.add(id)
    const after = p.slug(o.after, `${path}.after`), capture = p.slug(o.capture, `${path}.capture`)
    if (!quests.has(after)) p.fail(`${path}.after`, `unknown quest ${after}`)
    if (!captureFlags.has(capture)) p.fail(`${path}.capture`, `unknown ground outcome ${capture}`)
    const members = p.list(o.members, `${path}.members`, (value, field): PairMember => {
      const member = p.object(value, field, ['outfit', 'trust'])
      const outfit = p.outfit(member.outfit, `${field}.outfit`)
      if (!cast.has(outfit)) p.fail(`${field}.outfit`, `unknown crew outfit ${outfit}`)
      return { outfit, trust: flagRef(member.trust, `${field}.trust`) }
    }, 2)
    if (members.length !== 2 || members[0]!.outfit === members[1]!.outfit) p.fail(`${path}.members`, 'expected two different crew outfits')
    const recovery = p.list(o.recovery, `${path}.recovery`, sceneRef, 2)
    if (recovery.length !== 2) p.fail(`${path}.recovery`, 'expected two recovery visits')
    for (const { trust } of members) {
      if (!recovery.some((id) => [...walkSteps(scenes.get(id)!.steps, path)].some(({ step }) => step.kind === 'flag' && step.set && step.flag === trust))) {
        p.fail(`${path}.members`, `missing trust flag ${trust} in recovery scenes`)
      }
    }
    const testimony = p.slug(o.testimony, `${path}.testimony`)
    if (!Object.hasOwn(story.files, testimony)) p.fail(`${path}.testimony`, `unknown file ${testimony}`)
    const release = sceneRef(o.release, `${path}.release`)
    if (!scenes.get(release)!.steps.some((step) => step.kind === 'join' && step.outfit === members[1]!.outfit)) {
      p.fail(`${path}.release`, 'release must join the former captive as a crew member')
    }
    const b = p.object(o.bond, `${path}.bond`, ['scene', 'romance', 'friendship'])
    const bond = { scene: sceneRef(b.scene, `${path}.bond.scene`), romance: flagRef(b.romance, `${path}.bond.romance`), friendship: flagRef(b.friendship, `${path}.bond.friendship`) }
    decision(`${path}.bond.scene`, bond.scene, [bond.romance, bond.friendship])
    const r = p.object(o.residency, `${path}.residency`, ['scene', 'shared', 'separate'])
    const residency = { scene: sceneRef(r.scene, `${path}.residency.scene`), shared: flagRef(r.shared, `${path}.residency.shared`), separate: flagRef(r.separate, `${path}.residency.separate`) }
    decision(`${path}.residency.scene`, residency.scene, [residency.shared, residency.separate])
    const rooms = p.object(o.rooms, `${path}.rooms`, ['shared', 'separate'])
    function room(key: string): PairRoom {
      const field = `${path}.rooms.${key}`
      const x = p.object(rooms[key], field, ['move', 'visit', 'morning'])
      return { move: sceneRef(x.move, `${field}.move`), visit: sceneRef(x.visit, `${field}.visit`), morning: sceneRef(x.morning, `${field}.morning`) }
    }
    return { id, after, capture, members: [members[0]!, members[1]!], recovery: [recovery[0]!, recovery[1]!], testimony, release, bond, residency,
      rooms: { shared: room('shared'), separate: room('separate') } }
  }, 24)
}
