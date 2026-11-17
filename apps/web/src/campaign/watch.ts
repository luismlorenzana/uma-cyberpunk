import { campaignHomeSupport, startSupply, supplyNight, type CampaignBook, type CampaignDay, type Save } from '@cyber/domain'
import { passAWatch } from '../mission/director'

export function settleCampaignDay(save: Save, day: CampaignDay, book: CampaignBook): Save {
  const next = { ...save, campaignDay: day }
  const network = book.supply
  if (day.day === save.campaignDay.day || !network) return next
  const support = campaignHomeSupport(book.pairs, save.story)
  const supply = supplyNight(save.campaignSupply ?? startSupply(network), network, save.story.flags, support)
  if (!support.ashore.size) return passAWatch({ ...next, campaignSupply: supply }, book.story)
  const crew = save.crew.filter(({ outfit }) => !support.ashore.has(outfit))
  const watched = passAWatch({ ...next, campaignSupply: supply, crew }, book.story)
  const aboard = new Map(watched.crew.map((member) => [member.outfit, member]))
  return { ...watched, crew: save.crew.map((member) => aboard.get(member.outfit) ?? member) }
}
