import sharp from 'sharp'
import type { PortraitDerivation } from '../../packages/domain/src/campaign-wardrobe'
import type { SelectedCampaign } from './publish'
import { sha, type ImageReplacement, type ResolvedArt } from './model'

/** Fixed, reviewed framing is reusable only while the native dimensions stay the same. */
export async function deriveWardrobeImages(image: ImageReplacement, recipe: PortraitDerivation): Promise<ImageReplacement[]> {
  if (image.width !== recipe.width || image.height !== recipe.height) throw new Error(`${image.asset}: portrait framing needs review against new dimensions`)
  const source = sharp(image.bytes), d = recipe.dialogue, f = recipe.profile
  const [dialogue, profile] = await Promise.all([
    source.clone().extract({ left: d.left, top: d.top, width: d.width, height: d.height }).webp({ lossless: true }).toBuffer(),
    source.clone().extract({ left: f.left, top: f.top, width: f.size, height: f.size }).resize(192, 192).webp({ quality: 90 }).toBuffer(),
  ])
  return [{ asset: d.asset, bytes: dialogue, extension: '.webp', width: d.width, height: d.height },
    { asset: f.asset, bytes: profile, extension: '.webp', width: 192, height: 192 }]
}

export async function refreshWardrobeImages(selected: SelectedCampaign, input: ResolvedArt): Promise<ResolvedArt> {
  const result = { ...input, images: [...input.images], portraits: [...input.portraits] }
  for (const recipe of selected.book.wardrobe?.crops ?? []) {
    const image = input.images.find(image => image.asset === recipe.base)
    if (!image) continue
    const changed = selected.release.assets.find(row => row.id === image.asset)?.sha256 !== sha(image.bytes)
    const faces = selected.book.portraitFaces?.some(face => face.base === recipe.base || face.base === recipe.dialogue.asset)
    const portrait = input.portraits.find(row => row.base === recipe.base)
    if (changed && faces && !portrait) throw new Error(`${recipe.base}: replace its base and expression recipe together`)
    if (changed) result.images.push(...await deriveWardrobeImages(image, recipe))
    if (portrait) {
      const translated = portrait.faces.map(face => {
        const at = { x: face.at.x - recipe.dialogue.left, y: face.at.y - recipe.dialogue.top }
        if (at.x < 0 || at.y < 0 || at.x + face.image.width > recipe.dialogue.width || at.y + face.image.height > recipe.dialogue.height) {
          throw new Error(`${recipe.base}: face extends beyond the dialogue crop`)
        }
        return { ...face, at }
      })
      result.portraits.push({ ...portrait, base: recipe.dialogue.asset, faces: translated, profile: recipe.profile.asset })
    }
  }
  return result
}
