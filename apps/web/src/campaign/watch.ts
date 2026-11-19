import { observeManagement, campaignSupport, campaignUpkeep, developedPort, projectCompleteFlag, setFlag, startSupply, supplyNight, type CampaignBook, type CampaignDay, type Save } from '@cyber/domain'
import { passAWatch } from '../mission/director'

export function settleCampaignDay(save: Save, day: CampaignDay, book: CampaignBook): Save {
  const next = { ...save, campaignDay: day }
  const network = book.supply
  if (day.day < save.campaignDay.day) return save
  if (day.day === save.campaignDay.day || !network) return next
  for (const project of book.projects ?? []) {
    const left = next.campaignProjects[project.id]
    if (!left) continue
    next.campaignProjects = { ...next.campaignProjects, [project.id]: left - 1 }
    if (left === 1) next.story = setFlag(next.story, projectCompleteFlag(project.id))
  }
  const support = campaignSupport(book, save)
  const ports = network.ports.map((port) => developedPort(book, next, port))
  const supply = supplyNight(save.campaignSupply ?? startSupply(network), { ...network, ports }, save.story.flags,
    { ...support, provisions: campaignUpkeep(book, save, support.ashore) })
  if (!support.ashore.size) return observeManagement(save, passAWatch({ ...next, campaignSupply: supply }, book.story), book)
  const crew = save.crew.filter(({ outfit }) => !support.ashore.has(outfit))
  const watched = passAWatch({ ...next, campaignSupply: supply, crew }, book.story)
  const aboard = new Map(watched.crew.map((member) => [member.outfit, member]))
  return observeManagement(save, { ...watched, crew: save.crew.map((member) => aboard.get(member.outfit) ?? member) }, book)
}
