import { LOOKS, LOOK_CONTEXTS, type Look, type LookContext } from '../looks'
import type { CampaignWardrobe } from '../campaign-wardrobe'
import type { CampaignBook } from './campaign'
import { P } from './parse'

export function parseCampaignWardrobe(value: unknown, book: Pick<CampaignBook, 'assets' | 'scenes' | 'story'>): CampaignWardrobe {
  const p = new P('campaign.json'), root = p.object(value, 'wardrobe', ['members', 'scenes', 'crops'])
  const assets = new Set(book.assets.map(row => row.id)), cast = new Set([...book.story.casting.crewOrder, ...book.story.casting.leads.map(row => row.outfit)])
  const asset = (value: unknown, field: string) => { const id = p.slug(value, field); if (!assets.has(id)) p.fail(field, 'unknown image'); return id }
  const members = p.list(root.members, 'wardrobe.members', (value, field) => {
    const row = p.object(value, field, ['speaker', 'looks']), speaker = p.int(row.speaker, field + '.speaker', 1, Number.MAX_SAFE_INTEGER)
    if (!cast.has(speaker)) p.fail(field, 'unknown playable identity')
    const looks = p.object(row.looks, field + '.looks', [...LOOKS])
    return { speaker, looks: Object.fromEntries(LOOKS.map(role => {
      const look = p.object(looks[role], field + '.' + role, ['asset', 'dialogue', 'profile'], ['asset'])
      return [role, { asset: asset(look.asset, field), ...(look.dialogue === undefined ? {} : { dialogue: asset(look.dialogue, field) }), ...(look.profile === undefined ? {} : { profile: asset(look.profile, field) }) }]
    })) as CampaignWardrobe['members'][number]['looks'] }
  }, 100)
  if (new Set(members.map(row => row.speaker)).size !== members.length) p.fail('wardrobe.members', 'duplicate identity')
  const scenes = p.list(root.scenes, 'wardrobe.scenes', (value, field) => {
    const row = p.object(value, field, ['scene', 'context']), scene = p.slug(row.scene, field), context = row.context as LookContext
    if (!book.scenes.has(scene) || !LOOK_CONTEXTS.includes(context)) p.fail(field, 'unknown scene or wardrobe context')
    return { scene, context }
  }, 4096)
  if (new Set(scenes.map(row => row.scene)).size !== scenes.length) p.fail('wardrobe.scenes', 'duplicate scene')
  const crops = p.list(root.crops, 'wardrobe.crops', (value, field) => {
    const row = p.object(value, field, ['base', 'width', 'height', 'dialogue', 'profile'])
    const width = p.int(row.width, field, 1, 8192), height = p.int(row.height, field, 1, 8192), base = asset(row.base, field)
    const d = p.object(row.dialogue, field + '.dialogue', ['asset', 'left', 'top', 'width', 'height'])
    const f = p.object(row.profile, field + '.profile', ['asset', 'left', 'top', 'size'])
    const dw = p.int(d.width, field, 1, width), dh = p.int(d.height, field, 1, height), size = p.int(f.size, field, 1, Math.min(width, height))
    return { base, width, height, dialogue: { asset: asset(d.asset, field), width: dw, height: dh,
      left: p.int(d.left, field, 0, width - dw), top: p.int(d.top, field, 0, height - dh) },
    profile: { asset: asset(f.asset, field), size, left: p.int(f.left, field, 0, width - size), top: p.int(f.top, field, 0, height - size) } }
  }, 600)
  const derived = crops.flatMap(row => [row.dialogue.asset, row.profile.asset])
  if (new Set(crops.map(row => row.base)).size !== crops.length || new Set(derived).size !== derived.length
    || derived.some(id => crops.some(row => row.base === id))) p.fail('wardrobe.crops', 'duplicate or recursive crop')
  for (const member of members) for (const role of LOOKS as readonly Look[]) {
    const look = member.looks[role]
    const crop = crops.find(row => row.base === look.asset)
    if (crop && (crop.dialogue.asset !== look.dialogue || crop.profile.asset !== look.profile)) p.fail('wardrobe.members', 'crop consumer differs from its recipe')
  }
  return { members, scenes, crops }
}
