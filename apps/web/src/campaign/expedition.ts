import { hash32 } from '@cyber/battle'
import { awayMembers, expeditionReadiness, SHIP_CARGO_MAX, startSupply, type CampaignBook, type CampaignQuest, type ExpeditionRun, type FixedDuo, type Save } from '@cyber/domain'

export function expeditionForQuest(book: CampaignBook, quest: string, activeDuo?: string): FixedDuo | undefined {
  if (book.fourAct?.transit?.quests.includes(quest)) return activeDuo ? book.fourAct.duos.get(activeDuo) : undefined
  return [...book.fourAct?.duos.values() ?? []].find(duo => {
    const route = duo.expedition?.route
    return route && (route.launch === quest || route.return === quest || route.stops.includes(quest))
  })
}

export function expeditionQuestBlock(save: Save, book: CampaignBook, quest: string, duo: FixedDuo | undefined,
  complete: (q: CampaignQuest) => boolean): string | null {
  const transit = book.fourAct?.transit
  const gateQuest = transit?.quests.includes(quest)
  if (save.expedition) {
    if (save.expedition.duo !== duo?.id) return 'Finish the active expedition'
    const route = duo.expedition?.route
    if (route?.launch === quest) return 'Already launched'
    if (transit && route && !save.story.flags.includes(transit.flag)) {
      const after = route.transitAfter ?? route.launch
      if (gateQuest) {
        const stage = book.quests.find(entry => entry.id === after)
        return stage && complete(stage) ? null : 'Finish departure'
      }
      if (quest !== after && route.stops.indexOf(quest) >= 0
        && route.stops.indexOf(quest) < route.stops.indexOf(after)) return null
      if (quest !== after) return 'Cross the Gate first'
    }
    return null
  }
  if (gateQuest) return 'Launch the expedition first'
  if (!duo) return null
  const plan = duo.expedition?.route
  if (plan?.launch !== quest || !book.fourAct || !book.supply) return 'Launch the expedition first'
  const progress = expeditionReadiness(book.fourAct, duo.id, new Set(book.quests.filter(complete).map(q => q.id)))!
  if (progress.capitals < 5) return 'Liberate all five capitals'
  if (progress.returned < 6) return 'Bring back all six lieutenants'
  if (progress.cleared < 2) return 'Clear both Generals'
  const away = awayMembers(save.operations, save.squads)
  if (duo.umas.some(outfit => !save.crew.some(member => member.outfit === outfit) || away.includes(outfit))) return 'Muster both expedition leads'
  if (duo.expedition?.members.some(member => member.role === 'boss-ally'
    && !save.crew.some(crew => crew.heroine === member.heroine && crew.expeditionOnly))) return 'Muster both cleared Generals'
  const stock = save.campaignSupply ?? startSupply(book.supply)
  const port = book.quests.find(entry => entry.id === plan.launch)?.port
  if (port && stock.port !== port) return 'Return to the launch berth'
  if (stock.fuel < plan.cargo.fuel || stock.provisions < plan.cargo.provisions) return 'Load more expedition supplies'
  return null
}

export function expeditionWatchScene(save: Save, book: CampaignBook, complete: ReadonlySet<string>) {
  const active = save.expedition
  if (!active || save.mission || save.campaignDay.pending) return null
  const route = book.fourAct?.duos.get(active.duo)?.expedition?.route
  const watch = route?.watch
  if (!route || !watch || !complete.has(watch.after)) return null
  const upcoming = route.stops.find(id => {
    if (complete.has(id)) return false
    const encounter = book.quests.find(quest => quest.id === id)?.encounter
    return encounter !== undefined && book.commands.has(encounter)
  })
  const encounter = book.quests.find(quest => quest.id === upcoming)?.encounter
  const cost = encounter ? book.commands.get(encounter)?.cost : undefined
  const shortfall = !!cost && (active.fuel < cost.fuel || active.provisions < cost.provisions)
  const scene = shortfall ? watch.shortfall : watch.rest
  const aboard = new Set(active.members.map(member => member.role === 'uma' ? member.outfit : member.heroine))
  const cast = book.scenes.get(scene)?.cast
  const present = cast?.every(member => {
    const actor = member.outfit ?? member.heroine
    return actor === undefined || aboard.has(actor)
  })
  return present && !save.story.seen.includes(scene) ? { scene, shortfall } : null
}

export function commitExpedition(save: Save, book: CampaignBook, quest: string, duo?: FixedDuo): Save {
  const formation = duo?.expedition, plan = formation?.route
  if (!duo || !formation || !plan || !book.supply) return save
  const stock = save.campaignSupply ?? startSupply(book.supply)
  if (quest === plan.launch && !save.expedition) {
    return { ...save, expedition: { duo: duo.id, ship: formation.ship, members: formation.members,
      fuel: plan.cargo.fuel, provisions: plan.cargo.provisions },
      campaignSupply: { ...stock, fuel: stock.fuel - plan.cargo.fuel, provisions: stock.provisions - plan.cargo.provisions } }
  }
  if (quest === plan.return && save.expedition?.duo === duo.id) {
    return { ...save, expedition: null, campaignSupply: { ...stock,
      fuel: Math.min(SHIP_CARGO_MAX, stock.fuel + save.expedition.fuel),
      provisions: Math.min(SHIP_CARGO_MAX, stock.provisions + save.expedition.provisions) } }
  }
  return save
}

/** The expedition's temporary squad keys are distinct from ordinary crew records. The unit's identity stays in its ref. */
export const expeditionSquad = (run: ExpeditionRun): number[] =>
  run.members.map(member => member.role === 'uma' ? member.outfit : 10_000_000_000 + hash32(member.heroine))
