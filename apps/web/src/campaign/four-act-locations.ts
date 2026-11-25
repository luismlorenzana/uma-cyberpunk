import type { CampaignBook, CampaignReleaseFile, ManagementLocation } from '@cyber/domain'

/** The pinned four-act book has ports and backgrounds. Explicit Story management bindings take precedence. */
export function fourActLocations(book: CampaignBook, assets: ReadonlyMap<string, CampaignReleaseFile>): CampaignBook {
  if (book.management || !book.fourAct || !book.supply) return book
  const room = (id: string, title: string, family: ManagementLocation['family'], entry: ManagementLocation['entry'],
    asset: string, scene = ''): ManagementLocation => ({
    id, title, family, entry, scene, visual: { slot: id, fallback: assets.has(asset) ? asset : '' }, states: {},
  })
  const backdrop = new Map(book.art.map(row => [row.scene, row.backdrop]))
  const opening = book.quests.find(row => row.id === book.opening)?.scene
  const locations = [
    room('bridge', 'Homestretch bridge', 'command', { kind: 'quest', quest: book.opening }, 'homestretch-bridge', opening),
    room('crew-quarters', 'Crew quarters', 'living', { kind: 'quest', quest: book.opening }, 'homestretch-cabin-seated-neutral'),
    room('ship-medbay', 'Medbay', 'care', { kind: 'quest', quest: book.opening }, 'homestretch-medbay'),
    room('engineering', 'Engineering', 'operations', { kind: 'module', module: 'engineering' }, ''),
  ]
  if (book.workshop) locations.push(room('workshop', 'Campaign Hangar', 'operations', { kind: 'workshop' }, ''))
  for (const port of book.supply.ports) {
    locations.push(room(port.id, port.name, 'planet', { kind: 'port' }, backdrop.get(port.scene) ?? '', port.scene))
  }
  return { ...book, management: { after: book.supply.after, locations, reports: [] } }
}
