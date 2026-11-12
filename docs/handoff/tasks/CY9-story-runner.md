# CY9 — The story format, its check and the scene player

**uma-cyberpunk · Claude · M · Needs: CY3 · Unblocks: CY10, and the story session's first scripted files**

## Why

The story session writes the story; this packet is where it plugs in (TC53). It turns the brief's sketch into a real
format with a strict parser and a check the story session can run, gives the game an invented stand-in so every later
packet runs end to end with no story yet, and builds the player that shows a scene. Once this is in, the story
session's files drop in without a code change.

## Context (read first)

- [The story brief](../../design/story-brief.md) §4 (the hooks) and **§8 (the content contract)**;
  [the build plan](../../design/build-plan.md) §2.3 and §7; [the concept](../../design/concept.md) TC32–TC36, TC51,
  TC53.
- **The siblings' formats and players, to copy or follow (never import):**
  - uma-quest's format and strict parser: `/Users/luismartinez/workspace/uma-quest/packages/domain/src/story/script.ts`
    (`parseChapter`, path-reporting errors), its stand-in `story/stand-in.ts`;
  - uma-quest's headless runner: `apps/web/src/story/runner.ts` (`playScene(scene, stage, ui, opts)`, no three.js or
    React) and `runner.test.ts`;
  - uma-farm's authored format and validator:
    `/Users/luismartinez/workspace/uma-farm/packages/domain/src/story/authored.ts`, its stand-in folder
    `story/stand-in/` (invented ids 9000001–9000003), `pack.ts` and `release.ts`;
  - uma-farm's delivery: `scripts/story/release.mjs`, `apps/api/src/story/story-pack.ts` (`STORY_ALLOW`, `STORY_DIR`
    locally, `STORY_BUCKET` in production), `apps/web/src/story/load.ts` (one loader seam, stand-in fallback) and
    `delivery.ts`.
- **Uma Story's check report** (uma-platform P141,
  `/Users/luismartinez/workspace/uma-platform/docs/platform-app/story.md`): `checks.json` =
  `{ schemaVersion: 1, book, checkedAt, files: {path: sha256}, findings: [{ level: 'error' | 'todo' | 'note', file,
  where, message }], layers: {itemId: layer}, counts: {group: {label: ids[]}} }`; the layers are placeholder,
  skeleton, bible, scripted and published.
- **The production-save rules** in CLAUDE.md: never move `save.account.updatedAt`, never write a save from a server.

## Decisions made

- **Where:** the format and its pure functions in `packages/domain/src/story/` (`types.ts`, `parse.ts`, `state.ts`);
  the runner and the player in `apps/web/src/story/`; the check in `scripts/story/check.mjs`.
- **Files read** from `content/stories/`, as the brief lays them out: `casting.json`, `worlds/*.json`,
  `chapters/*.json`, `log/*.json`, `calls/*.json`. `world-notes.md` and `reviews.json` are the story session's and the
  owner's, never parsed.
- **Ids:** Umas by outfit id, heroines by board id, minor characters and everything else by a lowercase slug, as the
  brief says. Names, busts and portraits come from master data at run time.
- **Step kinds,** all fifteen from the brief: `line` (speaker, text of 160 characters at most), `slot` (lines keyed by
  lead outfit id, and a fallback), `narrate`, `thought`, `emote`, `wait`, `choice` (one-tap options; an option can gain
  a Lead and has its own steps), `flag`, `lead`, `file` (fill in a File's line), `anomaly` (open or close), `join` (a
  crew Uma comes aboard), `aboard`, `call` and `battle` (a mission of the same chapter).
- **The parser is strict and names the path of every error,** uma-quest's way: `chapters/w1-ch1.json:
  scenes[0].steps[3].slot.lines["1002"]: expected text of 160 characters at most`.
- **Cross-file rules,** checked by `pnpm story:check`:
  - errors: every id resolves (places in the world, missions in the chapter, Files, Calls, leads in the casting); a
    Chapter 1 ends with `aboard`, and only a Chapter 1 has one; every chapter has a danger level; every key in `needs`
    names a real chapter, mission or File; a `slot` keys only leads;
  - todos: a scene likely over three minutes (TC36), a lead in fewer than two crossed paths, a Chapter 1 longer than
    two battles (TC51);
  - notes: counts per world, lead and layer.
- **`pnpm story:check`** validates `content/stories/`, prints the findings, writes `content/stories/checks.json` in Uma
  Story's shape with `book: "cyberpunk"`, and exits non-zero on any error. With no `content/stories/`, it checks the
  stand-in and says so. Each file may carry a `layer`; without one, it's inferred (a chapter with scripted steps is
  `scripted`, one with only missions is `skeleton`).
- **The stand-in, in git:** one invented world, one lead's Chapter 1 with its debrief, one Log File and one Call, enough
  to use every step kind once. Invented ids in uma-farm's style: Umas 9000001–9000004, heroines `stand-in-1` up, slugs
  `sw1-…`. No names: a stand-in cast table gives them plain labels and the stage's stand-in faces.
- **Delivery, local now and the bucket later.** `pnpm story:pack` writes hashed files and a `story.json` index to the
  ignored `content/story-release/`, as uma-farm's `release.mjs` does. The API serves it through `uma-server`'s
  `PrivatePackModule` from `STORY_DIR` locally. The web's one seam, `apps/web/src/story/load.ts`, reads the index
  through `uma-kit/content` with hash checks and falls back to the stand-in on a 404 or with
  `VITE_CYBER_STORY=stand-in`.
  **The private bucket, `STORY_BUCKET` and its cost table are Phase 4's,** not this packet's; until then production
  shows the stand-in.
- **The runner** is uma-quest's, copied and cut to our steps: no walking or camera steps, since scenes here are busts
  over a backdrop for now. It has no three.js or React and is tested headless.
- **The player** (`ScenePlayer.tsx`): a text box with the speaker's name and bust (`uma-kit`'s `UmaBust` by outfit id;
  stand-in cards for stand-in ids and, until Phase 4, for heroines); an interjection slot plays the line of the first
  lead in the squad's order who has one, else the fallback; choices as one-tap buttons, a Lead marked as such; **Auto**
  (timed by line length), **Skip** (to the next choice or the end) and **Log** (the scene so far, in a sheet).
- **Story state in the save:** `StoryState` holds flags, Leads, filled File lines, Anomalies and scenes seen, with pure
  functions to change it. **This packet bumps the save from v1 to v2** to add it, with a migration that leaves
  `account.updatedAt` alone. CY10's ship, crew and worlds then come as v3.
- **A test route** `/story` plays the stand-in chapter's scenes in order, so the player can be checked before the ship
  exists (CY10 replaces it with the real flow).

## Do

1. The types and the strict parser, with a test per error kind and the stand-in passing.
2. `StoryState` and its functions; save v2 and its migration, with uma-quest's save tests copied for the bump.
3. `pnpm story:check` and `pnpm story:pack`, each with a test on fixtures.
4. The API's private-pack route from `STORY_DIR`; the web's loader seam.
5. The runner and its tests; the player; the `/story` route.
6. If the brief's sketch had to change, update
   [the story brief §8](../../design/story-brief.md#8-the-content-contract-sb8) in the same commit, and say the check
   is live there.
7. `docs/game/story.md`: the format, the check and the player as built.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass.
- `pnpm story:check` on the stand-in reports no errors and writes `checks.json`; a broken fixture fails with its path.
- `/story` plays the stand-in Chapter 1's first scene on the phone and in the preview pane: busts, a slot, a choice,
  Auto, Skip and Log, read back with the page reader.
- Story state survives a reload and a sync, and an old v1 save opens as v2 with `account.updatedAt` unchanged.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(story): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), log a D-decision (fetch `main` first), and write `docs/game/story.md` in the same commit.
