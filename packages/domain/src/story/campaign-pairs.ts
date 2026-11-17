import type { CampaignHome, CampaignPair, PairMember, PairRoom } from '../campaign-pair'
import { SHIP_PROVISIONS_PER_NIGHT, type SupplyNetwork } from '../campaign-supply'
import type { CommandEncounter } from '../ship/command'
import type { CampaignQuest } from './campaign'
import { walkSteps } from './check'
import { P } from './parse'
import type { Scene, StoryPack } from './types'

export function parseCampaignPairs(value: unknown, story: StoryPack, scenes: ReadonlyMap<string, Scene>, context: {
  quests: ReadonlyMap<string, CampaignQuest>; reserved: ReadonlySet<string>; captureFlags: ReadonlySet<string>
  supply: SupplyNetwork | undefined; commands: ReadonlyMap<string, CommandEncounter>
}): CampaignPair[] {
  if (value === undefined) return []
  const { quests, reserved, captureFlags, supply, commands } = context
  const p = new P('campaign.json')
  const usedScenes = new Set(reserved), usedFlags = new Set<string>(), ids = new Set<string>()
  const homePorts = new Set<string>(), homeResidents = new Set<number>()
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
  function parseHome(value: unknown, path: string, after: string, members: readonly PairMember[]): CampaignHome {
    const h = p.object(value, path, ['port', 'base', 'defense', 'scene', 'resettle', 'stay', 'visit', 'jobs', 'support'])
    const port = p.slug(h.port, `${path}.port`)
    if (!supply?.ports.find((candidate) => candidate.id === port)?.liberation) p.fail(`${path}.port`, 'expected a port with a liberation outcome')
    if (homePorts.has(port)) p.fail(`${path}.port`, 'this port already has a home')
    homePorts.add(port)
    for (const { outfit } of members) {
      if (homeResidents.has(outfit)) p.fail(path, 'a resident already has another campaign home')
      homeResidents.add(outfit)
    }
    const base = p.slug(h.base, `${path}.base`)
    const baseQuest = quests.get(base)
    if (baseQuest?.port !== port || baseQuest.after !== after || baseQuest.encounter) p.fail(`${path}.base`, 'expected a local base quest after liberation')
    const defense = p.slug(h.defense, `${path}.defense`)
    const defenseQuest = quests.get(defense)
    const encounter = defenseQuest?.encounter && commands.get(defenseQuest.encounter)
    if (defenseQuest?.port !== port || defenseQuest.after !== base || !encounter || encounter.assault) {
      return p.fail(`${path}.defense`, 'expected a local ship defense after the base quest')
    }
    const scene = sceneRef(h.scene, `${path}.scene`)
    function branch(key: 'resettle' | 'stay') {
      const field = `${path}.${key}`
      const b = p.object(h[key], field, ['flag', 'debrief'])
      return { flag: flagRef(b.flag, `${field}.flag`), debrief: sceneRef(b.debrief, `${field}.debrief`) }
    }
    const resettle = branch('resettle'), stay = branch('stay')
    decision(`${path}.scene`, scene, [resettle.flag, stay.flag])
    const visit = sceneRef(h.visit, `${path}.visit`)
    const jobs = p.list(h.jobs, `${path}.jobs`, (value, field) => p.text(value, field, 48), 2)
    if (jobs.length !== 2) p.fail(`${path}.jobs`, 'expected one assignment per resident')
    const s = p.object(h.support, `${path}.support`, ['alloy', 'provisions', 'relay'])
    const support = { alloy: p.int(s.alloy, `${path}.support.alloy`, 1, 10),
      provisions: p.int(s.provisions, `${path}.support.provisions`, 1, SHIP_PROVISIONS_PER_NIGHT - 1),
      relay: p.int(s.relay, `${path}.support.relay`, 1, Math.min(10, 99 - encounter.transport)) }
    return { port, base, defense, scene, resettle, stay, visit, jobs: [jobs[0]!, jobs[1]!], support }
  }
  return p.list(value, 'pairs', (value, path): CampaignPair => {
    const fields = ['id', 'after', 'capture', 'members', 'recovery', 'testimony', 'release', 'bond', 'residency', 'rooms']
    const o = p.object(value, path, [...fields, 'home'], fields)
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
    const quarters = { shared: room('shared'), separate: room('separate') }
    const home = o.home === undefined ? undefined : parseHome(o.home, `${path}.home`, after, members)
    return { id, after, capture, members: [members[0]!, members[1]!], recovery: [recovery[0]!, recovery[1]!], testimony, release, bond, residency,
      rooms: quarters, ...(home ? { home } : {}) }
  }, 24)
}
