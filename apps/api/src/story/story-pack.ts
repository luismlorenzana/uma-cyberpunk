// The story pack's route (CY9, as uma-farm's F56): uma-server's `PrivatePackModule` at `/api/content/…`, where uma-kit's
// content client reads private packs, behind the owner guard. It serves an allowlist only: the index `story.json`,
// revalidated on every read, and the release's hash-named files, cached for good. Locally `STORY_DIR` (the ignored
// `content/story-release/` that `pnpm story:pack` writes); the private bucket `STORY_BUCKET` is Phase 4's. With neither
// (production now), every path answers 404 and the game plays the stand-in.
import { resolve } from 'node:path'
import { PrivatePackModule, type PackAllow } from '@luismlorenzana/uma-server/content'
import type { DynamicModule } from '@nestjs/common'

/** `story.json`, and `story/<name>.<hash8>.json` (`scripts/story/pack.ts`'s names). */
export const STORY_ALLOW: PackAllow = ['story.json', /story\/[a-z0-9]+(-[a-z0-9]+)*\.[a-f0-9]{8}\.json/]

export function storyPackModule(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): DynamicModule {
  return PrivatePackModule.forRoot({
    route: 'content',
    bucket: env.STORY_BUCKET || undefined,
    dir: resolve(cwd, env.STORY_DIR || '../../content/story-release'),
    allow: STORY_ALLOW,
  })
}
