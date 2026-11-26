// The private content route (CY9, as uma-farm's F56): uma-server's `PrivatePackModule` at `/api/content/…`, where uma-kit's
// content client reads private packs, behind the owner guard. It serves an allowlist only, from two places:
// - **the story:** the index `story.json`, revalidated on every read, and the release's hash-named files, cached for good.
//   Locally `STORY_DIR` (the ignored `content/story-release/` that `pnpm story:pack` writes); the private bucket
//   `STORY_BUCKET` is Phase 4's. With neither (production now), its paths answer 404 and the game plays the stand-in.
// - **the looks** (D25, LK10): the Cyberpunk universe's approved looks in Uma Character Art, at `looks/index.json` and
//   `looks/images/<id>.<hash16>.png`. In production `LOOKS_BUCKET` (uma-platform's content bucket, read-only and only
//   `LOOKS_PREFIX`, `art/universes/cyberpunk/`); locally `LOOKS_DIR` (the ignored `content/looks/cyberpunk/`, a mirror).
//   With neither, 404s, and the game shows master data's busts.
import { resolve } from 'node:path'
import { BucketFileSource, DirectoryFileSource, fileSource, PrivatePackModule, type FileSource, type PackAllow } from '@luismlorenzana/uma-server/content'
import type { DynamicModule } from '@nestjs/common'
import { CAMPAIGN_FILE_PATH, CAMPAIGN_PREVIEW_INDEX, FOUR_ACT_PREVIEW_INDEX, PILOT_PREVIEW_INDEX } from '@cyber/domain'

/** `story.json`, and `story/<name>.<hash8>.json` (`scripts/story/pack.ts`'s names). */
/** Owner pack reader only serves immutable releases of the current campaign. */
export const FOUR_ACT_ARCHIVE = /^campaign\/releases\/four-act\/[a-z0-9][a-z0-9-]{0,63}\.json$/
export const STORY_ALLOW: PackAllow = ['story.json', /story\/[a-z0-9]+(-[a-z0-9]+)*\.[a-f0-9]{8}\.json/]
/** The universe's index, and its images as `pnpm art:push` names them: `<character>-<look>.<hash16>.png`. */
export const LOOKS_ALLOW: PackAllow = ['looks/index.json', /looks\/images\/[a-z0-9]+(-[a-z0-9]+)*\.[a-f0-9]{16}\.png/]
export const LOOKS_PREFIX = 'art/universes/cyberpunk/'

/** One source for the route: `looks/…` from the looks' bucket folder or local mirror, everything else from the story's. */
export function contentSource(story: FileSource, looks: FileSource | null, prefix = LOOKS_PREFIX, campaign: FileSource | null = null): FileSource {
  return {
    read: (path) => {
      if (path.startsWith('campaign/')) return campaign?.read(path) ?? Promise.resolve(null)
      if (!path.startsWith('looks/')) return story.read(path)
      return looks ? looks.read(`${prefix}${path.slice('looks/'.length)}`) : Promise.resolve(null)
    },
  }
}

export function storyPackModule(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): DynamicModule {
  const story = fileSource({ bucket: env.STORY_BUCKET || undefined, dir: resolve(cwd, env.STORY_DIR || '../../content/story-release') }, (dir) => new DirectoryFileSource(dir))
  // The local mirror keeps the bucket's layout under the prefix, so both read the same relative paths.
  const looks = env.LOOKS_BUCKET ? new BucketFileSource(env.LOOKS_BUCKET) : new DirectoryFileSource(resolve(cwd, env.LOOKS_DIR || '../../content/looks'))
  const campaignBucket = env.CAMPAIGN_PACK_BUCKET
  const campaignPrefix = env.CAMPAIGN_PACK_PREFIX?.replace(/^\/+|\/+$/g, '')
  const campaign = campaignBucket ? new BucketFileSource(campaignBucket) : new DirectoryFileSource(resolve(cwd, env.CAMPAIGN_PACK_DIR || '../../content/campaign-release'))
  const campaignSource: FileSource = campaignBucket && campaignPrefix ? { read: (path) => campaign.read(`${campaignPrefix}/${path}`) } : campaign
  return PrivatePackModule.forRoot({
    route: 'content',
    allow: [...STORY_ALLOW, ...LOOKS_ALLOW, CAMPAIGN_PREVIEW_INDEX, PILOT_PREVIEW_INDEX, FOUR_ACT_PREVIEW_INDEX, FOUR_ACT_ARCHIVE, CAMPAIGN_FILE_PATH],
    source: contentSource(story, looks, env.LOOKS_PREFIX || LOOKS_PREFIX, campaignSource),
  })
}
