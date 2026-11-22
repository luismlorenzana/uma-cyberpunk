import { lookFor, type LookContext } from './looks'
import type { CampaignBook, CampaignSceneArt } from './story/campaign'
import type { Speaker } from './story/types'

export interface WardrobeLook { asset: string; dialogue?: string; profile?: string; portrait?: string; label?: string }
export interface PortraitDerivation {
  base: string; width: number; height: number
  dialogue: { asset: string; left: number; top: number; width: number; height: number }
  profile: { asset: string; left: number; top: number; size: number }
}
export interface CampaignWardrobe {
  members: { speaker: Speaker; looks: Record<string, WardrobeLook>; default?: string; after?: string; requiresFlag?: string }[]
  scenes: { scene: string; context: LookContext; outfits?: { speaker: Speaker; look: string }[] }[]
  crops: PortraitDerivation[]
}

/** A reviewed binding selects wardrobe. Final pose layers remain independent of the talking portrait. */
export function wardrobeSceneArt(book: CampaignBook, sceneId: string): CampaignSceneArt | undefined {
  let art = book.art.find(row => row.scene === sceneId)
  const binding = book.wardrobe?.scenes.find(row => row.scene === sceneId)
  if (!book.wardrobe) return art
  const cast = book.scenes.get(sceneId)?.cast ?? []
  const missing = book.wardrobe.members.flatMap(member => {
    const look = member.default && member.looks[member.default]
    return look && cast.some(row => (row.outfit ?? row.heroine) === member.speaker) && !art?.portraits.some(row => row.speaker === member.speaker && row.emote === undefined)
      ? [{ speaker: member.speaker, asset: look.asset }] : []
  })
  if (missing.length) art = { ...art, scene: sceneId, portraits: [...(art?.portraits ?? []), ...missing] }
  if (!art) return art
  const role = binding && lookFor(binding.context, book.scenes.get(sceneId)?.look)
  const replacements = new Map<string, string>()
  const neutrals = new Map(art.portraits.filter(p => p.emote === undefined).map(p => [p.speaker, p.asset]))
  const portraits = art.portraits.flatMap(portrait => {
    const member = book.wardrobe!.members.find(member => member.speaker === portrait.speaker)
    const override = binding?.outfits?.find(row => row.speaker === portrait.speaker)?.look
    const selected = override ?? (role && member?.looks[role] ? role : member?.default)
    const look = selected ? member?.looks[selected] : undefined
    if (!look) return [portrait]
    if (portrait.emote !== undefined) return [look.asset, look.dialogue, look.portrait].includes(neutrals.get(portrait.speaker)) ? [portrait] : []
    const previous = book.wardrobe!.members.find(member => member.speaker === portrait.speaker)
    // Only a neutral master used as a declared placeholder follows the wardrobe; bespoke poses stay fixed.
    if (previous && Object.values(previous.looks).some(row => row.asset === portrait.asset)) replacements.set(portrait.asset, look.asset)
    return [{ ...portrait, asset: look.portrait ?? look.dialogue ?? look.asset, profile: look.profile }]
  })
  return { ...art, portraits, ...(art.composition ? { composition: { ...art.composition,
    layers: art.composition.layers.map(layer => ({ ...layer, asset: replacements.get(layer.asset) ?? layer.asset })) } } : {}) }
}
