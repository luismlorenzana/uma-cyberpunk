# CY7 — The board on uma-stage

**uma-cyberpunk · Claude · M · Needs: CY1 (and CY4's map type, if it's in) · Unblocks: CY8**

## Why

Every battle plays on this board, and the sandbox (CY8) is its first user. `uma-stage` 0.3.0 has no grid stage, but its
parts fit one. This packet builds the game-owned board scene from those parts, runs five checks that decide which stage
requests are real, and files the first one. If the board fails here, it fails cheaply, before any screen depends on it.

## Context (read first)

- [The build plan](../../design/build-plan.md) §3 (the scene, the five checks, the requests) and BP9 (the budgets);
  [the concept](../../design/concept.md) TC10, TC23, TC29, TC41 and TC48.
- **`uma-stage` 0.3.0** in `/Users/luismartinez/workspace/uma-platform/packages/stage/`: `README.md` (the parts table,
  the rules), `src/world/geometry.ts` (`roomGeometry` takes `{cells, heights, spots}`, up to 16 × 16),
  `src/world/build.ts` (`buildWorld`, `buildWorldParts`), `src/world/kits.ts` (`pixelTexture`; `loadKitPage` keeps one
  page per kind), `src/world/standInKit.ts`, `src/stage/pick.ts` (`rayAt`, `hitQuad`, `tileQuad`), `src/stage/camera.ts`
  (35°, 128 texels a tile, `snapToGrid`, `cameraOffset`, DPR cap 3), `src/stage/fade.ts`, `src/world/effects.ts`
  (bloom and tilt-shift are constants), `src/stage/frames.ts` (`FramePacer`, `FpsRecorder`, `SAVER_FPS`),
  `src/stage/controls.tsx` (`initialSaver`), `src/stage/TurnedStage.tsx`, `src/stage/turn.ts` (`toStage`),
  `src/stage/timing.ts` (`markStageRequested`), `src/sprites/` (`SpriteActor`, `Standee`, `standInSet`, `liveSets`).
- **Copy, never import, from the games:**
  - `BandStage`'s `applyGrade`, about six lines (`uma-platform/packages/stage/src/stage/bandStage.ts:387-394`);
  - uma-farm's render-only-on-change loop and DOM chips placed with `project()`
    (`/Users/luismartinez/workspace/uma-farm/apps/web/src/loop/FarmStage.tsx:69-124`);
  - uma-quest's lazy route and test room (`/Users/luismartinez/workspace/uma-quest/apps/web/src/app/router.tsx:10-23`,
    `apps/web/src/stage/TestRoom.tsx`, its `?debug` and `step()`), and its mount
    (`apps/web/src/town/TownScreen.tsx:81-135`).
- **How a request is filed:** uma-platform's
  [change protocol](https://github.com/luismlorenzana/uma-platform/blob/main/docs/change-protocol.md) ("Both apps",
  never a fork), and a written request like `/Users/luismartinez/workspace/uma-quest/docs/design/kl1-request.md`.
  uma-platform takes them as ST rows, one piece at a time, each checked with the owner.

## Decisions made

- **Where:** `apps/web/src/board/`. A lazy route `/board` behind the owner's sign-in is the test bench; CY8 reuses the
  scene inside `/sandbox`. The route calls `markStageRequested()`, and three.js and `uma-stage` go in the size check's
  `LAZY_MODULES`, so the main bundle stays under 180 KB.
- **Pins:** `@luismlorenzana/uma-stage` **0.3.0** and `three` **0.187.0**, exact.
- **The map format belongs to CY4** (`@cyber/battle`). If CY4 isn't in yet, write the minimal `BattleMap` in
  `packages/battle/src/map.ts` and let CY4 extend it:
  - `id`, `width`, `depth` (10–14 each);
  - `heights`: one string per row, one digit 0–3 per tile, row 0 at the back;
  - `blocked`: optional rows, `#` for no tile;
  - `spawns`: `{ squad: Tile[], enemy: Tile[] }`.

  `toRoomDesign(map)` builds `roomGeometry`'s design object **directly**, never through `parseRoomDesign`, which is
  uma-quest's dungeon format.
- **The kit:** the stand-in biome kit (`standInKitAtlas`), loaded by hand (`pixelTexture`, then `buildWorld` with an
  array of pages), because `loadKitPage` keeps one page per kind for the whole session.
- **Figures:** Umas as `SpriteActor` on `standInSet` (four facings); enemies as `Standee` cards on stand-in faces. Under
  each, a flat **base ring** in the unit's hue with a **facing wedge** (TC41, TC23). Thirteen live: four sprite sets and
  nine standees, within `liveSets` (8).
- **Overlays:** one merged quad mesh on the tile tops, rebuilt when the set changes, in TC29's colours: blue reachable
  and safe, magenta reachable inside enemy range, red attack range, yellow area, a cursor.
- **Picking:** `rayAt` + `hitQuad` over `tileQuad(x, z, level)` for every tile; the nearest hit wins; a tap on a figure
  picks its tile. A tap on a raised tile's front face misses, as the stage's picking does everywhere.
- **The camera:** fixed 35°, no rotation, no zoom; a two-axis drag pan through `toStage`, clamped to the board, and
  `snapToGrid` on the camera.
- **The look:** a night grade (dark blue-violet ambient, a cool key light) through the copied `applyGrade`; the four
  live lights from the kit's light frames; `Effects` with the saver off; `initialSaver()` sets the default (on for
  phones).
- **The loop:** `FramePacer`, rendering only when something moves (uma-farm's wake and sleep); paused when hidden. DOM
  chips (names, paper-doll pops later) are placed with `project()` only when the camera moves.
- **The fade:** `buildWorldParts` splits the terrain, and the pure fade functions fade whatever stands between the
  camera and the acting or target unit.
- **`?debug`** puts `window.__board` on the page: `step(ms)`, `pick(x, y)`, `figures`, `drawCalls`, `fps`, `saver`, and
  a small DOM readout of the same numbers. The preview pane can't screenshot WebGL, so checks read this.

## Do

1. `toRoomDesign` and its tests; two test maps in `scenarios/maps/` (a flat 14 × 14 and one with heights 0–3), original
   and nameless.
2. The scene: terrain, kit, grade, lights, effects, saver, the loop and the fade.
3. Figures with their base ring and facing wedge; a `place(unit, tile, facing)` and a `walk(unit, path)` the battle can
   drive.
4. Overlays and the cursor; picking; the pan.
5. The route `/board` on `TurnedStage`, lazy, with `?debug` and its readout.
6. **The five checks.** Record each result for the D-decision:

   | # | Check | How | Passes when |
   |---|---|---|---|
   | 1 | A level-3 tile builds | A Vitest test builds a design directly with a `3` and checks the risers reach level 3 | It builds: heights 0–3 need no request |
   | 2 | Picking with heights | A test projects every tile top's centre on a 14 × 14 map with heights and picks it back | Every visible top picks back to itself; tile depth about 24 pt at DPR 3 |
   | 3 | Thirteen figures | Four sets and nine standees on the board | `liveSets` stays at 8 or under; draw calls recorded |
   | 4 | Frame rate | `FpsRecorder`'s ten-second series while panning, saver on and off | 60 fps target, 30 fps floor; on the owner's phone if deployed, else desktop numbers, labelled so |
   | 5 | What heights hide | Count tile tops more than half covered by nearer terrain, fade on and off | Report the share; terrain rising to the back keeps it small |

7. **The stage requests.** File only those the checks and the code prove, **one at a time**, starting with tunable
   bloom and tilt-shift (bloom's threshold 0.86 on luminance means neon never blooms). Each is a written request in
   `docs/design/stage-requests/<slug>.md`, in `kl1-request.md`'s shape (what we have, what broke, what we ask for, what
   must not change for uma-quest and uma-farm), sent to the uma-platform session, and listed in the handoff's "Across
   the repos". The queue after it, each filed when the one before ships: glowing kit frames, a tactics kit kind cached
   by kit id, a lighter saver tier; then heights 0–3 only if check 1 fails, a zoom only for 2× phones.
8. `docs/game/board.md`: what the board shows, its colours, its taps and its pan.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass, and the size check passes with three.js and the stage lazy.
- `/board?debug` loads in the preview pane: `window.__board.figures` is 13, `step()` advances, `pick()` returns the
  tile under a point, and the readout shows draw calls and fps.
- The five checks' numbers are in the D-decision.
- The first request is filed, or the D-decision says why none is needed.
- `git status` shows no `content/`.

## The owner's step

If CY2 and CY3 are deployed: open `uma-cyberpunk.web.app/board` on the phone, pan around, and say whether it reads at a
glance. Otherwise the first look comes with CY8's play.

## Deliver

Commit to `main` (Conventional Commits, `feat(board): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), log a D-decision with the five checks' results and the requests filed (fetch `main` first),
and write [docs/game/board.md](../../game/README.md) in the same commit.
