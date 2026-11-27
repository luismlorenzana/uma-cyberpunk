import type { CampaignBook, CampaignReleaseFile, CampaignWardrobe, Speaker } from '@cyber/domain'

export function menuPortrait(member: CampaignWardrobe['members'][number] | undefined,
  assets: ReadonlyMap<string, CampaignReleaseFile>, preferred: readonly string[], fallback?: CampaignBook['art'][number]['portraits'][number]) {
  const looks = member?.looks ?? {}
  const keys = [...new Set([...preferred, ...(member?.default ? [member.default] : []), ...(member?.visibleLooks ?? Object.keys(looks))])]
  for (const key of keys) {
    const look = looks[key]
    if (!look) continue
    for (const id of [look.profile, look.portrait, look.dialogue, look.asset]) {
      const asset = id && assets.get(id)
      if (asset) return asset
    }
  }
  return (fallback?.profile && assets.get(fallback.profile)) || (fallback && assets.get(fallback.asset)) || undefined
}

export function residentPortrait(book: CampaignBook, assets: ReadonlyMap<string, CampaignReleaseFile>, speaker: Speaker) {
  return menuPortrait(book.wardrobe?.members.find(row => row.speaker === speaker), assets,
    typeof speaker === 'number' ? ['ship-casual', 'quarters'] : ['quarters-front', 'combat-station'])
}

export function recruitPortrait(book: CampaignBook, assets: ReadonlyMap<string, CampaignReleaseFile>, speaker: Speaker, scene?: string) {
  return menuPortrait(book.wardrobe?.members.find(row => row.speaker === speaker), assets, ['street', 'ship-casual'],
    book.art.find(row => row.scene === scene)?.portraits.find(row => row.speaker === speaker && !row.emote))
}
