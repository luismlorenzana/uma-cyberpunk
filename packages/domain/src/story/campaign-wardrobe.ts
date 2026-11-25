import { LOOKS, LOOK_CONTEXTS, type LookContext } from '../looks'
import type { CampaignWardrobe, WardrobeLook } from '../campaign-wardrobe'
import type { CampaignBook } from './campaign'
import { P } from './parse'

export function parseCampaignWardrobe(value: unknown, book: Pick<CampaignBook, 'assets' | 'scenes' | 'story'>): CampaignWardrobe {
  const p = new P('campaign.json'), root = p.object(value, 'wardrobe', ['members', 'scenes', 'crops'])
  const assets = new Set(book.assets.map(row => row.id)), cast = new Set<number | string>([...book.story.casting.crewOrder, ...book.story.casting.leads.map(row => row.outfit), ...book.story.casting.heroines.map(row => row.board)])
  const asset = (value: unknown, field: string) => { const id = p.slug(value, field); if (!assets.has(id)) p.fail(field, 'unknown image'); return id }
  const members = p.list(root.members, 'wardrobe.members', (value, field) => {
    const row = p.object(value, field, ['speaker', 'looks', 'default', 'after', 'requiresFlag', 'visibleLooks'], ['speaker', 'looks']), speaker = p.speaker(row.speaker, field + '.speaker')
    if (!cast.has(speaker)) p.fail(field, 'unknown cast identity')
    const looks = p.object(row.looks, field + '.looks', Object.keys((row.looks ?? {}) as object), typeof speaker === 'number' ? [...LOOKS] : [])
    if (!Object.keys(looks).length || Object.keys(looks).length > 32) p.fail(field, 'expected 1–32 outfits')
    const fallback = row.default === undefined ? undefined : p.slug(row.default, field + '.default')
    if (fallback && !looks[fallback] || typeof speaker === 'string' && !fallback) p.fail(field, 'expected a registered default outfit')
    const after = row.after === undefined ? undefined : p.slug(row.after, field + '.after')
    if (after && !book.scenes.has(after)) p.fail(field, 'unknown wardrobe access scene')
    const requiresFlag = row.requiresFlag === undefined ? undefined : p.slug(row.requiresFlag, field + '.requiresFlag')
    const visibleLooks = row.visibleLooks === undefined ? undefined : p.list(row.visibleLooks, field + '.visibleLooks', (value, path) => {
      const look = p.slug(value, path)
      if (!Object.hasOwn(looks, look)) p.fail(path, 'visible look must be registered')
      return look
    }, 32)
    if (visibleLooks && new Set(visibleLooks).size !== visibleLooks.length) p.fail(field + '.visibleLooks', 'duplicate visible look')
    return { speaker, ...(fallback ? { default: fallback } : {}), ...(after ? { after } : {}), ...(requiresFlag ? { requiresFlag } : {}),
      ...(visibleLooks ? { visibleLooks } : {}), looks: Object.fromEntries(Object.keys(looks).map(role => {
      p.slug(role, field + '.look')
      const look = p.object(looks[role], field + '.' + role, ['asset', 'dialogue', 'profile', 'portrait', 'label'], ['asset'])
      return [role, { asset: asset(look.asset, field), ...Object.fromEntries(['dialogue', 'profile', 'portrait'].flatMap(key => look[key] === undefined ? [] : [[key, asset(look[key], field)]])),
        ...(look.label === undefined ? {} : { label: p.text(look.label, field + '.label', 64) }) }]
    })) as Record<string, WardrobeLook> }
  }, 200)
  if (new Set(members.map(row => row.speaker)).size !== members.length) p.fail('wardrobe.members', 'duplicate identity')
  const scenes = p.list(root.scenes, 'wardrobe.scenes', (value, field) => {
    const row = p.object(value, field, ['scene', 'context', 'outfits'], ['scene', 'context']), scene = p.slug(row.scene, field), context = row.context as LookContext
    if (!book.scenes.has(scene) || !LOOK_CONTEXTS.includes(context)) p.fail(field, 'unknown scene or wardrobe context')
    const outfits = row.outfits === undefined ? undefined : p.list(row.outfits, field + '.outfits', (v, f) => {
      const o = p.object(v, f, ['speaker', 'look']), speaker = p.speaker(o.speaker, f), look = p.slug(o.look, f)
      if (!members.find(member => member.speaker === speaker)?.looks[look]) p.fail(f, 'unknown actor outfit')
      return { speaker, look }
    }, 32)
    if (outfits && new Set(outfits.map(row => row.speaker)).size !== outfits.length) p.fail(field, 'duplicate outfit override')
    return { scene, context, ...(outfits ? { outfits } : {}) }
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
  for (const member of members) for (const look of Object.values(member.looks)) {
    const crop = crops.find(row => row.base === look.asset)
    if (crop && (crop.dialogue.asset !== look.dialogue || crop.profile.asset !== look.profile)) p.fail('wardrobe.members', 'crop consumer differs from its recipe')
  }
  return { members, scenes, crops }
}
