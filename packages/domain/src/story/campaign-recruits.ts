import { startSupply, type SupplyNetwork } from '../campaign-supply'
import type { CampaignQuest } from './campaign'
import { walkSteps } from './check'
import type { P } from './parse'
import type { Scene, StoryPack } from './types'

export interface CampaignRecruit {
  outfit: number
  request: string
  signOn: string
  story: string[]
}

function withinStartingFuel(network: SupplyNetwork): Set<string> {
  const fuel = startSupply(network).fuel
  const reachable = Array.from({ length: fuel + 1 }, () => new Set<string>())
  reachable[0]!.add(network.start)
  for (const [spent, ports] of reachable.entries()) {
    for (const port of ports) for (const route of network.routes) {
      if (route.needs || route.flag || spent + route.fuel > fuel) continue
      const next = route.from === port ? route.to : route.to === port ? route.from : null
      if (next) reachable[spent + route.fuel]!.add(next)
    }
  }
  return new Set(reachable.flatMap((ports) => [...ports]))
}

export function parseCampaignRecruits(p: P, value: unknown, context: {
  opening: string
  byQuest: ReadonlyMap<string, CampaignQuest>
  scenes: ReadonlyMap<string, Scene>
  story: StoryPack
  supply?: SupplyNetwork
}): CampaignRecruit[] {
  const { opening, byQuest, scenes, story, supply } = context
  if (byQuest.get(opening)?.encounter) p.fail('opening', 'open recruitment needs a dialogue opening')
  if (!supply || supply.after !== opening) return p.fail('supply.after', 'open civilian travel after the shared opening')
  const reachable = withinStartingFuel(supply)
  const ports = new Set(supply.ports.map(({ id }) => id))
  const cast = new Set([...story.casting.leads.map(({ outfit }) => outfit), ...story.casting.crewOrder])
  const outfits = new Set<number>()
  const usedQuests = new Set<string>()
  return p.list(value, 'recruits', (raw, path) => {
    const row = p.object(raw, path, ['outfit', 'request', 'signOn', 'story'])
    const outfit = p.outfit(row.outfit, `${path}.outfit`)
    if (!cast.has(outfit) || outfits.has(outfit)) p.fail(`${path}.outfit`, 'expected a unique crew outfit in the casting')
    outfits.add(outfit)
    const signOn = p.slug(row.signOn, `${path}.signOn`)
    const quest = byQuest.get(signOn)
    if (!quest?.port || !ports.has(quest.port) || !quest.after || quest.encounter || quest.sceneWhen || usedQuests.has(signOn)) {
      return p.fail(`${path}.signOn`, 'expected a unique dialogue quest at a civilian port with a campaign prerequisite')
    }
    if (quest.after === opening && (!reachable.has(quest.port) || quest.requires?.length || quest.requiresAny?.length || quest.flags?.length)) {
      return p.fail(`${path}.signOn`, 'opening sign-ons must be available on starting fuel after the shared opening')
    }
    usedQuests.add(signOn)
    const scene = scenes.get(quest.scene)!
    const pickups = [...walkSteps(scene.steps, '')].filter(({ step }) => step.kind === 'join' || step.kind === 'aboard')
    if (pickups.length !== 1 || !scene.steps.some((step) => step.kind === 'join' && step.outfit === outfit)) {
      p.fail(`${path}.signOn`, 'the sign-on scene must directly join its own recruit once')
    }
    let prior = signOn
    const objectives = p.list(row.story, `${path}.story`, (raw, field) => {
      const id = p.slug(raw, field)
      if (usedQuests.has(id) || byQuest.get(id)?.after !== prior) p.fail(field, 'expected the next unique quest in this recruit’s story')
      usedQuests.add(id)
      prior = id
      return id
    }, 32)
    if (!objectives.length) p.fail(`${path}.story`, 'give the recruit a separate first objective')
    return { outfit, signOn, request: p.text(row.request, `${path}.request`, 180), story: objectives }
  }, 60)
}
