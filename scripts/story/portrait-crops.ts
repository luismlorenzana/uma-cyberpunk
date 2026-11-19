import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { P, type CampaignBook } from '../../packages/domain/src/story/index'

export interface CampaignImageSource {
  id: string
  bytes: Buffer
  extension: string
}

const PROFILE_SIZE = 192

function cropId(base: string, variant: 'dialogue' | 'profile'): string {
  const id = `${base}-${variant}`
  if (id.length <= 64) return id
  const hash = createHash('sha256').update(base).digest('hex').slice(0, 12)
  return `${base.slice(0, 50 - variant.length)}-${hash}-${variant}`
}

function parseBox(p: P, input: unknown, field: string, square = false): sharp.Region {
  const dimensions = square ? ['size'] : ['width', 'height']
  const box = p.object(input, field, ['left', 'top', ...dimensions])
  const integer = (key: string, min: number) => p.int(box[key], `${field}.${key}`, min, Number.MAX_SAFE_INTEGER)
  const left = integer('left', 0), top = integer('top', 0)
  if (square) {
    const size = integer('size', 1)
    return { left, top, width: size, height: size }
  }
  return { left, top, width: integer('width', 1), height: integer('height', 1) }
}

function checkBounds(box: sharp.Region, width: number, height: number, label: string) {
  if (box.left < 0 || box.top < 0 || box.left + box.width > width || box.top + box.height > height) {
    throw new Error(`${label}: crop extends beyond the image`)
  }
}

export async function derivePortraitCrops(config: object, book: CampaignBook, assets: CampaignImageSource[], source: unknown) {
  const p: P = new P('portrait-crops.json')
  const plan = p.object(source, 'plan', ['schemaVersion', 'crops'])
  p.version(plan)
  const definitions = p.list(plan.crops, 'crops', (value, field) => {
    const entry = p.object(value, field, ['base', 'dialogue', 'profile'])
    return { base: p.slug(entry.base, `${field}.base`), dialogue: parseBox(p, entry.dialogue, `${field}.dialogue`),
      profile: parseBox(p, entry.profile, `${field}.profile`, true) }
  })
  const neutral = new Set(book.art.flatMap(({ portraits }) =>
    portraits.filter(({ emote }) => emote === undefined).map(({ asset }) => asset)))
  const originals = new Map(assets.map((asset) => [asset.id, asset]))
  const ids = new Set(originals.keys())
  const crops = new Map<string, { dialogue: string; profile: string; box: sharp.Region }>()
  const generated: CampaignImageSource[] = []

  for (const { base, dialogue, profile } of definitions) {
    const master = originals.get(base)
    if (!master || !neutral.has(base)) p.fail(base, 'expected an existing neutral scene portrait')
    if (crops.has(base)) p.fail(base, 'duplicate crop plan')
    const dialogueId = cropId(base, 'dialogue')
    const profileId = cropId(base, 'profile')
    if (ids.has(dialogueId) || ids.has(profileId)) p.fail(base, 'a derived asset ID is already in use')
    ids.add(dialogueId)
    ids.add(profileId)
    const image = sharp(master.bytes)
    const { width, height } = await image.metadata()
    if (!width || !height) p.fail(base, 'expected a readable still image')
    checkBounds(dialogue, width, height, `${base} dialogue`)
    checkBounds(profile, width, height, `${base} profile`)
    const [dialogueBytes, profileBytes] = await Promise.all([
      image.clone().extract(dialogue).webp({ lossless: true }).toBuffer(),
      image.clone().extract(profile).resize(PROFILE_SIZE, PROFILE_SIZE).webp({ quality: 90 }).toBuffer(),
    ])
    crops.set(base, { dialogue: dialogueId, profile: profileId, box: dialogue })
    generated.push({ id: dialogueId, bytes: dialogueBytes, extension: '.webp' },
      { id: profileId, bytes: profileBytes, extension: '.webp' })
  }

  const art = book.art.map((scene) => ({
    ...scene,
    portraits: scene.portraits.map((portrait) => {
      const crop = crops.get(portrait.asset)
      return crop && portrait.emote === undefined ? { ...portrait, asset: crop.dialogue, profile: crop.profile } : portrait
    }),
  }))
  const portraitFaces = await Promise.all((book.portraitFaces ?? []).map(async (face) => {
    const crop = crops.get(face.base)
    if (!crop) return face
    const at = { x: face.at.x - crop.box.left, y: face.at.y - crop.box.top }
    const expression = originals.get(face.asset) ?? p.fail(face.asset, 'missing face crop')
    const { width, height } = await sharp(expression.bytes).metadata()
    if (!width || !height) p.fail(face.asset, 'expected a readable face crop')
    checkBounds({ left: at.x, top: at.y, width, height },
      crop.box.width, crop.box.height, `${face.base} ${face.emote}`)
    return { ...face, base: crop.dialogue, at }
  }))

  return {
    config: {
      ...config, art,
      ...(book.commandCinematics ? { commandCinematics: { ...book.commandCinematics, actors: book.commandCinematics.actors.map(actor => {
        const crop = crops.get(actor.base)
        return crop ? { ...actor, base: crop.dialogue, profile: crop.profile, poseFallback: actor.poseFallback ?? actor.base } : actor
      }) } } : {}),
      assets: [...book.assets, ...generated.map(({ id, extension }) => ({ id, file: id + extension }))],
      ...(book.portraitFaces ? { portraitFaces } : {}),
    },
    assets: [...assets, ...generated],
  }
}
