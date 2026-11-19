import { lookFor, type Look, type LookContext } from './looks'
import type { CampaignBook, CampaignSceneArt } from './story/campaign'

export interface WardrobeLook { asset: string; dialogue?: string; profile?: string }
export interface PortraitDerivation {
  base: string; width: number; height: number
  dialogue: { asset: string; left: number; top: number; width: number; height: number }
  profile: { asset: string; left: number; top: number; size: number }
}
export interface CampaignWardrobe {
  members: { speaker: number; looks: Record<Look, WardrobeLook> }[]
  scenes: { scene: string; context: LookContext }[]
  crops: PortraitDerivation[]
}

/** A reviewed binding selects wardrobe. Final pose layers remain independent of the talking portrait. */
export function wardrobeSceneArt(book: CampaignBook, sceneId: string): CampaignSceneArt | undefined {
  const art = book.art.find(row => row.scene === sceneId), binding = book.wardrobe?.scenes.find(row => row.scene === sceneId)
  if (!art || !binding) return art
  const role = lookFor(binding.context, book.scenes.get(sceneId)?.look)
  const replacements = new Map<string, string>()
  const neutrals = new Map(art.portraits.filter(p => p.emote === undefined).map(p => [p.speaker, p.asset]))
  const portraits = art.portraits.flatMap(portrait => {
    const look = book.wardrobe!.members.find(member => member.speaker === portrait.speaker)?.looks[role]
    if (!look) return [portrait]
    if (portrait.emote !== undefined) return [look.asset, look.dialogue].includes(neutrals.get(portrait.speaker)) ? [portrait] : []
    const previous = book.wardrobe!.members.find(member => member.speaker === portrait.speaker)
    // Only a neutral master used as a declared placeholder follows the wardrobe; bespoke poses stay fixed.
    if (previous && Object.values(previous.looks).some(row => row.asset === portrait.asset)) replacements.set(portrait.asset, look.asset)
    return [{ ...portrait, asset: look.dialogue ?? look.asset, profile: look.profile }]
  })
  return { ...art, portraits, ...(art.composition ? { composition: { ...art.composition,
    layers: art.composition.layers.map(layer => ({ ...layer, asset: replacements.get(layer.asset) ?? layer.asset })) } } : {}) }
}
