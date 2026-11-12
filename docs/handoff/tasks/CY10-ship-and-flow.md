# CY10 — The ship, the star map, a world's map and the mission flow

**uma-cyberpunk · Claude · L · Needs: CY8, CY9 · Unblocks: CY11, CY12**

## Why

The ship is the game's hub: every session starts and ends aboard (TC9). CY8 made a battle playable and CY9 made a
scene playable, but nothing joins them. This packet builds the frame that does: the ship and its rooms, the Bridge's
star map, a world's map, and the path from a mission's briefing to the battle and back aboard. It runs on CY9's
stand-in world, so it's whole before the story session's first file lands. After it, a mission can be picked, played,
left, resumed after iOS closes the app, and finished.

## Context (read first)

- [The concept](../../design/concept.md): TC9, TC42, TC49, TC50 (§6), TC8 and TC51 (§5), TC29's autosave (§4.11).
- [The build plan](../../design/build-plan.md): §2.3 (what's reused for the app), §6 (the app on test content), BP4 (a
  battle is a frozen input plus actions).
- What exists: CY3's shell, sign-in and save v1 with sync (CY9 bumps it to v2 for the story state); CY8's battle
  screen, its autosave of the battle in progress and its resume; CY9's story format, stand-in world, loader and scene
  player, with its story state.
- **The siblings to copy or follow** (copy, never import):
  - **The place registry:** `/Users/luismartinez/workspace/uma-rpg/apps/web/src/places/registry.tsx` (each place gets
    a lazy Peek, Page and Counter), with `PlacePage.tsx` and `packages/domain/src/hub/places.ts` there.
  - **The shell:** `uma-kit/shell` (`AppFrame`, `AccountBar`, `BottomBar`, `PlaceMenu`, `PeekPanel`, `PlaceHeader`),
    as uma-farm wires it in `/Users/luismartinez/workspace/uma-farm/apps/web/src/shell/Shell.tsx`.
  - **The star chart:** `/Users/luismartinez/workspace/uma-rpg/apps/web/src/places/observatory/` (`StarChart.tsx`,
    `star-chart.ts` with its tests, `star-marks.tsx`): SVG, 44 pt buttons, pure geometry.
  - **Node maps:** uma-quest's `apps/web/src/map/WorldMap.tsx` (places, roads, `canTravel`) and uma-rpg's
    `apps/web/src/places/scenario-gate/map/` (`topology.ts`, `layout.ts`), with node states from `rpgNodeStatus` in
    `packages/domain/src/rpg/campaign/run.ts`.
  - **The director:** uma-quest's `apps/web/src/dungeon/director.ts` and `director.test.ts`: pure glue between the
    screen and the rules, tested headless with a stand-in.
  - **Resume:** uma-rpg's `packages/domain/src/rpg/campaign/run-state.ts` and `ResumeFight.tsx` (its D52).
- **The production-save rules** (CLAUDE.md): never move `save.account.updatedAt` outside a player's own change, never
  write a save from a server, and a stale server date means stop and ask.

## Decisions made

- **The ship is a 2D cutaway,** in DOM and SVG on `uma-kit/shell`: a side view of the decks with each room a hotspot of
  at least 44 pt. No stage and no kit: an HD-2D deck can come later (BP6).
- **Landscape throughout** (TC1, AGENTS.md): the ship, the maps and every flow screen sit in uma-kit's `KitStage`
  landscape layout, turned on an upright phone as the battle is (CY7), with safe areas and 44 pt targets.
- **The rooms are places** on the registry pattern, each with a lazy Peek (a quick look in the side panel), a Page and
  an optional Counter:

  | Room | Opens | Its page in CY10 |
  |---|---|---|
  | **Bridge** | From the start | The star map, then a world's map |
  | **Hangar** | From the start | A placeholder until CY11 |
  | **Quarters** | From the start | A placeholder until CY11 |
  | **Log** | From the start | CY9's Timeline of played scenes, replayable; Files and Anomalies as lists |
  | **Store**, **Comms**, **Sim Pod** | With a lead (TC49) | Shown locked, each naming its key ("opens when … comes aboard") |

  Which lead opens which room is story data (the stand-in names one). The room list and their order are the game's,
  in `@cyber/domain` (`ship/rooms.ts`).
- **The star map** copies uma-rpg's star chart: a node per known world, travel a tap and a short jump card, no fuel
  and no clock (TC50). Unknown worlds don't show.
- **A world's map** is an SVG node map of its locations. Each node is **locked, available or cleared**, shows its
  danger level, and a locked node names its key (a chapter, a mission or a File, TC34). A world never closes.
- **The mission flow:** briefing → deploy → battle → results → aboard.
  - **Briefing:** the objective, the place, the danger level, the enemies known, side objectives.
  - **Deploy:** four Umas and the guest slot; a chapter's fixed members are locked in; a flash-forward's whole squad
    and loadouts are fixed (TC32).
  - **Battle:** CY8's screen, unchanged.
  - **Results:** win or loss, XP, credits and salvage as plain numbers for now (the economy is Phase 5), Leads gained;
    Retry on a loss.
  - **Aboard:** the chapter's next scene, or the ship.
- **The director** (`apps/web/src/mission/director.ts`) holds the flow's rules: what's next, what a result changes,
  what a scene trigger fires. No React and no three.js; tested headless with a stand-in battle and stand-in scenes.
- **Save v3** in `@cyber/domain`:
  - `crew`: outfit ids aboard, in join order (CY11 adds levels and loadouts);
  - `ship`: rooms open;
  - `worlds`: each known world's nodes cleared, the current world;
  - `story`: CY9's flags, Leads, Files and scenes seen, moved unchanged;
  - `mission`: the mission in progress (its id and step), and its battle as **input plus actions**, CY8's shape.
- **The migration from v2** (CY9's) is pure and tested: v2 fields carry over, the new fields start empty, and
  `account.updatedAt` is untouched. It runs on load, on the device. The server only stores the envelope (CY3) and
  backs the v2 copy up on the version change, as uma-quest does; it never rewrites a save.
- **Resume anywhere:** after iOS closes the app, boot reopens where the player was: a scene mid-way restarts at its
  start, a battle replays its actions, a briefing or results screen reopens. A **Continue** card on the ship says
  what's waiting.

## Do

1. `@cyber/domain`: `ship/rooms.ts` (the seven rooms, which open from the start, the key of each locked one);
   `worlds/map.ts` (node states from the save and the story's needs, danger levels, a lock's key in words); save v3
   and its migration from v2, with tests (a v2 save in, the same account and a valid v3 out; a v3 save untouched).
2. The ship: the cutaway, the registry, the four open rooms' Peeks and Pages, the three locked rooms' Peeks naming
   their keys, and the Continue card.
3. The Bridge: the star map (copy uma-rpg's chart and its geometry tests) and a world's node map, with travel.
4. The mission flow: `mission/director.ts` with its headless tests, then the briefing, deploy, results and aboard
   screens around CY8's battle screen and CY9's scene player.
5. Resume after a reload at each step of the flow; a test per step on the director.
6. Write `docs/game/ship.md` (the rooms, travel, the maps, locks and keys) and `docs/game/missions.md` (the flow,
   resume); update `docs/game/architecture.md`'s save section for v3.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass, and the size check stays under 180 KB (the rooms' pages and the maps
  are lazy).
- The migration test passes: a v2 save comes out as v3 with `account.updatedAt` unchanged.
- Locally, on the stand-in: from the ship, the Bridge opens the star map, the stand-in world's map shows its nodes with
  danger levels and named keys, a mission plays from briefing to results, and the next scene plays aboard.
- Reloading the page at a briefing, mid-battle, at results and mid-scene reopens each where it was; the battle's state
  matches its pre-reload state exactly.
- The deployed app does the same on the owner's phone, checked headless through `?debug` where the preview can't
  screenshot.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(ship): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
