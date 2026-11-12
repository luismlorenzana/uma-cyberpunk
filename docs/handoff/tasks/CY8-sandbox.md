# CY8 — The sandbox: the battle on the phone

**uma-cyberpunk · Claude · L · Needs: CY3, CY6, CY7 · Unblocks: CY10**

## Why

The rules (CY4–CY6) and the board (CY7) meet here, on the owner's phone. The sandbox is the second of the three ways the
combat is tested (TC54): any skirmish can be set up and played with the full battle screen, long before any chapter
exists. Its exit is Phase 2's: a battle that plays start to finish on the phone in about ten minutes.

## Context (read first)

- [The concept](../../design/concept.md): TC2, TC3, TC20, TC21, TC23, TC28, TC29, TC30, TC54; the worked exchange in
  §4.12. [The build plan](../../design/build-plan.md) §4–§5.
- **What exists by now:** `@cyber/battle` (the reducer, the forecast, the AI), CY6's **scenario format** and
  `scenarios/`, CY7's board scene in `apps/web/src/board/`, and CY3's app (sign-in, save v1, master data).
- **Copy, never import:**
  - the cut-in: uma-quest's `/Users/luismartinez/workspace/uma-quest/apps/web/src/fight/stage.ts` (`FightStage`, a
    side-view scene on a borrowed renderer) and `fight/playback.ts` (cues grouped and timed by impact and release);
  - the resume: uma-rpg's battle as an input plus actions
    (`/Users/luismartinez/workspace/uma-rpg/packages/domain/src/rpg/campaign/run-state.ts`, `replayBattle` in
    `packages/domain/src/rpg/battle/engine.ts:1217`, `apps/web/src/places/scenario-gate/ResumeFight.tsx`) and its D52;
  - the test room's `?debug`: uma-quest's `apps/web/src/stage/TestRoom.tsx`.
- **The production-save rules** in CLAUDE.md apply from CY3: never move `save.account.updatedAt`, never write a save
  from a server.

## Decisions made

- **The route:** `/sandbox`, lazy, behind the owner's sign-in like every route. It shares CY7's scene; only one canvas
  engine is alive at a time, and the cut-in borrows the board's renderer.
- **The setup sheet** reads and writes CY6's scenario format: the map, four squad slots and the guest slot, each unit's
  loadout, the enemies, the seed (typed or rolled) and who controls each side (player or AI). Scenarios load from
  `scenarios/` and from a local list; **Copy** puts a scenario's JSON on the clipboard and **Paste** reads one back.
  With CY3's master data loaded, a squad slot can hold a real Uma by outfit id, named at run time; scenarios in git use
  stand-ins only.
- **The battle screen** is DOM over the board, in `apps/web/src/battle/`:
  - **the timeline** across the top: the next eight turns, tap to inspect, ghosted shifts on the forecast (TC3);
  - **two-tap move:** the first tap shows her ghost and path, the second moves. The move stays undoable until the
    action commits. If CY4 takes the move and the act as separate actions, the screen holds the move until the act is
    confirmed, then sends both, so an undone move never reaches the log;
  - **the commands arc** at the bottom right, one thumb; **Wait** always there;
  - **the forecast card:** damage and hit % for the attack, each Crossfire and the counter; crit; side or back; the
    parts likely hit and any that break; the Charge cost; the timeline's shift. Any enemy can be inspected out of
    range;
  - **range colours** from CY7's overlays, and a toggle that paints every enemy's reach;
  - **the terrain card** on a long press: state, height, whether it can change, its bonus;
  - **paper dolls** that pop above a hit unit, placed with `project()`;
  - **face:** arrows preset toward the last target.
- **Enemy turns** play at double speed, with **Skip** jumping to the end state.
- **The cut-in** at **Full**, **Quick** or **Off** (TC28): Full the first time for each weapon and skill and always for
  a boss, Quick otherwise; a setting changes it. Stand-in side poses first; the Umas' full-body renders from master data
  when CY3's master data is in. Part damage always shows on the map too.
- **Autosave and resume: a local-only Dexie row, not the synced save.** After every committed action the screen writes
  `{ scenario, input, actions, rulesVersion, updatedAt }` to a `sandbox` table, and again when the page hides. Opening
  `/sandbox` with a row there offers **Resume**, which replays the actions on the stored rules version.
  - **Why local:** a sandbox battle is a test, not progress. Keeping it out of the synced save means no save version
    bump, no sync traffic per action, and no risk to `account.updatedAt`.
  - CY10 moves mission battles into the save with the same shape, as uma-rpg's run state.
  - If a replay fails after a rules change, Resume offers **Restart** from the scenario instead of crashing.
- **Results:** win or loss, player turns, wall-clock minutes, parts broken, counters, Crossfires and Covers; **Retry**
  with the same seed or a new one; **Back to setup**. The minutes feed the simulator's "about ten minutes" pace.
- **The test scenario,** in git, original and nameless: one Underlevels-style map, 12 × 12 to 14 × 14 with heights 0–3,
  cover tiles, a Wet area, an Oil slick and a terminal. Four stand-in Umas (Vanguard, Striker, Gunner, Netrunner)
  against Steel Muster stand-ins: android troopers using CY5's cover and volley, and one Key standee as the leader.
  Objective: defeat the leader.
- **`?debug`** adds `window.__sandbox`: `state`, `act(action)`, `step(ms)`, `auto()` (both sides on the AI), so a whole
  battle can be driven headless in the preview pane and the DOM checked with the page reader.

## Do

1. The route, the setup sheet and scenario load, save, Copy and Paste.
2. The battle screen's pieces above, wired to the reducer, the forecast and the AI.
3. The cut-in, copied and adapted to our cues, at its three speeds.
4. Autosave, Resume and Restart.
5. Results and Retry.
6. The test scenario and its map.
7. `docs/game/battle.md` (the battle screen as built: what each piece shows) and `docs/game/sandbox.md`.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; the size check passes with the sandbox lazy.
- Headless: `/sandbox?debug` plays the test scenario AI against AI to a result; the timeline, the forecast card and the
  results read right in the page reader.
- Resume works: a battle closed mid-turn reopens on the same state, checked by replaying a stored row in a test.
- The owner's play (below) reaches a win or a loss in about ten minutes, and the D-decision records the minutes, the
  turns and what the owner said. **That is Phase 2's exit** ([the concept §9](../../design/concept.md#9-phases-tc15)),
  with CY6's simulator report beside it.
- `git status` shows no `content/`.

## The owner's step

One play on the phone: open `uma-cyberpunk.web.app/sandbox` from the Home Screen, play the test scenario to the end,
and say in a line what felt wrong.

## Deliver

Commit to `main` (Conventional Commits, `feat(sandbox): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), log a D-decision (fetch `main` first), and write the two `docs/game/` pages in the same
commit.
