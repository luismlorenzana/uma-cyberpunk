# Uma Cyberpunk: the build plan

> **Historical foundation.** The [four-act design](campaign-rework.md) and [active roadmap](../handoff/four-act-roadmap.md) govern future campaign work. Earlier calls and trials remain here as evidence.

> **Status: 2026-11-12 (D4).** The owner asked for the work here to start with "the full app buildout and some of the
> combat testing side of things", and to "see what we can reuse from the uma-platform HD-2D engine and so on". This page
> answers both: what's reused and how, the shape of the code, how the combat is tested, the app's screens, and the
> packets in order. Two read-only audits back it: one of `uma-stage` 0.3.0, one of the sibling games' app shells, battle
> code and story pipelines. Its calls are **BP1–BP9**, each a recommendation, adopted until the owner changes one. The
> game it builds is [the concept](concept.md); the story's side is [the story brief](story-brief.md). Visual page:
> [previews/build-plan.html](previews/build-plan.html).
>
> **D20 (2026-11-13):** Phases 1–3 are built (CY1–CY12). The next phase is **life aboard** (CY13–CY19), planned in
> [life-aboard.md §9](life-aboard.md#9-the-plan-tc74); it reuses this plan's shapes (the pure domain, the director, the
> save's versioned migrations, the manual) and adds furniture and module art drawn in code in a uma-platform session.

## The short answer

- **Reuse first, in three ways** (BP2): **import** the platform packages (uma-kit's sign-in, update prompt, shell and
  roster tiles; uma-data's master data; uma-server's guard and proxies; uma-stage's parts; uma-art's atlases); **copy** what each sibling game copies (uma-quest's wiring, save
  sync and PWA set-up; uma-farm's story delivery; uma-rpg's place registry and star chart); and follow **patterns**
  where the code can't be shared (uma-rpg's battle reducer and autosave-by-replay, uma-racer's simulator).
- **The HD-2D engine fits as parts, not as a finished stage** (BP3). `uma-stage` 0.3.0's two scenes are uma-quest's
  field and uma-farm's band, and neither suits a grid. Its terrain builder, figures, picking, camera, fade, effects and
  frame pacer do, so the board is a game-owned scene, as uma-quest's fights already are. Four stage requests are likely
  (tunable bloom, glowing frames, a tactics kit kind, a saver tier), filed one at a time by CY7.
- **No sibling has grid battle code,** so the rules are new: a pure, seeded package, `@cyber/battle`, on uma-rpg's
  reducer pattern (BP4).
- **The combat is tested three ways** before any story depends on it: unit tests and golden replays, a sandbox on the
  phone, and a headless simulator (BP5).
- **The whole app is built on test content** (BP6): the ship and its rooms, the Bridge's star map, a world's map, the
  mission flow with resume, the crew, the Hangar and the story runner. The story session's files then drop in (BP7).
- **Two tracks after CY1** (BP8): the foundation (the cloud and the hello app) and the combat (the rules, the AI and
  simulator, the board). They meet at the sandbox, CY8, and the app follows in CY9–CY12.

## 1. The workspace (BP1)

The layout every sibling uses, with the battle rules in a package of their own:

```text
apps/web          @cyber/web      React 19, Vite 7, Tailwind 4, Zustand 5, Dexie 4, the PWA        (CY1, CY3)
apps/api          @cyber/api      NestJS 11 on Cloud Run: health, save, master data, private packs (CY1, CY3, CY9)
packages/battle   @cyber/battle   the battle rules: pure TypeScript, seeded, no DOM, no master data (CY4)
packages/domain   @cyber/domain   the save, the crew, the ship, progression, the story format; the one adapter
                                  from master data's stats to battle numbers                       (CY1, CY3, CY9)
scenarios/                        skirmish files for the sandbox and the simulator, in git, nameless (CY6)
sim/out/                          ignored: the simulator's reports (CY6)
scripts/                          size check, private-content guard, hosting check, icons, sim, story check
content/                          ignored: the story session's files and private art
```

- **`@cyber/battle` depends on nothing.** It takes plain numbers (bands, part HP, weapon stats), so the simulator and
  its tests run anywhere, and master data's shape never leaks into the rules. `@cyber/domain` holds the adapter
  (uma-platform's architecture §2.4: one adapter module per game).
- **The web reads the packages' ESM source; the API reads a CommonJS build,** as in uma-quest. Heavy code (the board,
  three.js, the story runner) loads lazily, and the main bundle stays under **180 KB gzip** (`check-size.mjs` and its
  `LAZY_MODULES`).
- **Ports:** API **8121**, web **5214** (D2).

## 2. What's reused, and how (BP2)

**Import** means installing the package and calling it. **Copy** means taking a sibling's file into this repo and
owning it from then on, as uma-quest and uma-farm both copied uma-rpg's. **Pattern** means writing new code the same
way. Games never import each other (uma-platform P2, P3).

### 2.1 The foundation

| Need | From | How | Packet |
|---|---|---|---|
| The workspace root, turbo, tsconfig, the size check, the guard | uma-quest | Copy | CY1 |
| CI's verify job; the deploy job gated on `DEPLOY_ENABLED` | uma-quest's `deploy.yml` | Copy | CY1, CY2 |
| The cloud: Hosting site, Cloud Run, Firestore database, runtime account, images | uma-quest's `infra/bootstrap.sh`, `firebase.json`, `Dockerfile` | Copy | CY2 |
| Sign-in | `uma-kit/auth` (`AuthProvider`, `idToken`); `uma-server/auth` (`AuthModule`, `@Public`, `CurrentUid`) | Import | CY3 |
| Boot gates and the update prompt | `uma-kit/places` (`BootGates`, `UpdateNotice`, `watchAppUpdates`) | Import | CY3 |
| The PWA: manifest, Workbox, the prompt, iOS meta tags | uma-quest's `vite.config.ts`, `index.html`, `installed-app.test.ts` | Copy | CY3 |
| **Save sync:** Dexie with five safety copies, a revision envelope, 409 with the server's copy, rescues and backups | uma-quest's `save/` (web, domain, API); its D11 and uma-farm's D9 | Copy | CY3 |
| Master data | `uma-data`'s release client; `uma-server/content`'s `ReleaseProxyModule` (`/api/master/…`) | Import | CY3 |
| The app shell | `uma-kit/shell` (`AppFrame`, `AccountBar`, `BottomBar`, `PlaceMenu`, `PeekPanel`), as uma-farm wires it | Import | CY3 |
| Icons | uma-quest's `make-icons.mjs` | Copy | CY3 |

### 2.2 The combat

| Need | From | How | Packet |
|---|---|---|---|
| **The rules as a reducer:** a frozen input plus actions, each returning state and cues; a seeded hash for randomness; a rules version | uma-rpg's battle engine (`createBattle`, `applyBattleAction`), copied by uma-quest | Pattern (the grid rules are new) | CY4 |
| The forecast, from the same pure functions the resolution uses | uma-rpg's `previewTarget` | Pattern | CY4 |
| Golden replays | uma-quest's replay fixtures | Pattern | CY4 |
| Enemy AI and ally Auto | uma-rpg's `intentFor`, `chooseTarget`, `autoAction` scoring | Pattern | CY6 |
| The simulator | uma-racer's `scripts/sim` (`pnpm sim:balance`), uma-rpg's `balance-play` | Pattern | CY6 |
| Terrain meshes | `uma-stage`'s `roomGeometry`, `buildWorld`, `buildWorldParts`, `pixelTexture` | Import | CY7 |
| Figures | `SpriteActor`, `Standee`, `standInSet`, `liveSets` (cap 8), `loadSpriteSet`, `SetCache` | Import | CY7 |
| Tile picking | `rayAt`, `hitQuad`, `tileQuad` | Import | CY7 |
| Camera and pixel rules | `camera.ts`: 35°, 128 texels a tile, `snapToGrid`, `cameraOffset`, DPR cap 3 | Import | CY7 |
| The landscape mount | `TurnedStage` (and `uma-kit`'s `KitStage`) | Import | CY7 |
| Effects, the frame pacer, battery saver | `Effects`, `FramePacer`, `FpsRecorder`, `initialSaver` | Import | CY7 |
| Occluder fade | `fade.ts`'s pure functions over `buildWorldParts` | Import | CY7 |
| The night grade | `BandStage`'s `applyGrade` (six lines) | Copy | CY7 |
| Render only when something moves; DOM chips placed with `project()` | uma-farm's `FarmStage.tsx` | Copy | CY7 |
| `?debug` puts the scene on `window` with a `step()`, for headless checks | uma-quest's `TestRoom` | Pattern | CY7, CY8 |
| The cut-in: a side-view scene on the borrowed renderer, cues timed by impact and release | uma-quest's `fight/stage.ts`, `playback.ts` | Copy | CY8 |
| The sandbox | uma-quest's `/test-room` | Pattern | CY8 |
| **Autosave after every action, resume after iOS closes** | uma-rpg's run state (`input` + `actions[]`, `replayBattle`, `ResumeFight`), its D52 | Pattern | CY8 |

### 2.3 The app

| Need | From | How | Packet |
|---|---|---|---|
| The story format and its strict parser | uma-quest's `story/script.ts` (`parseChapter`); uma-farm's `authored.ts` | Pattern | CY9 |
| The scene runner, headless and tested | uma-quest's `story/runner.ts` | Copy | CY9 |
| The stand-in story in git, with invented ids | uma-farm's `story/stand-in/` | Pattern | CY9 |
| Private delivery: hashed files and an index, served behind the owner guard | uma-farm's `pack.ts`, `release.ts`, `scripts/story/release.mjs`; `uma-server`'s `PrivatePackModule`; `uma-kit/content` | Copy, import | CY9 (local), Phase 4 (bucket) |
| The check report | Uma Story's `checks.json` shape (uma-platform P141) | Pattern | CY9 |
| **The ship's rooms** | uma-rpg's place registry (a lazy Peek, Page and Counter per place) on `uma-kit/shell` | Pattern, import | CY10 |
| The star map | uma-rpg's observatory star chart (SVG, 44 pt buttons, tested geometry) | Copy | CY10 |
| A world's node map | uma-quest's `WorldMap`; uma-rpg's region map topology and node states | Pattern | CY10 |
| The mission flow | uma-quest's dungeon director (pure glue, tested headless) | Pattern | CY10 |
| The crew roster | `uma-kit/roster` and `/album` (`FaceTile`, `UmaBust`, `UmaChibi`, `AlbumGrid`, `UmaPicker`); uma-farm's `RosterPage` | Import, copy | CY11 |
| Loadouts and presets | uma-rpg's `GearTab`, `gear-equip.ts`, `presets.ts` | Pattern | CY11 |

### 2.4 What's not reused

- **`StageEngine` and `BandStage`:** uma-quest's field and uma-farm's band; their scenes are private and their cameras
  don't fit a grid.
- **`uma-kit/hub`'s `HubMap`:** a Phaser top-down town on a 16 px grid. The ship is rooms, not a walkable town.
- **`uma-work`:** timed jobs; installed (D2) but unused until a room needs a timer.
- **Any sibling's battle rules:** they're round-based with no grid, facing or height.

## 3. The HD-2D board on uma-stage (BP3)

**The scene CY7 builds,** in `apps/web/src/board/`:

```text
 battle state ──▶ board scene (three.js, game-owned) ◀── uma-stage parts
   (cues)          │  terrain: roomGeometry from our map, buildWorldParts for fading
                   │  figures: SpriteActor (Umas), Standee (heroines), facing wedge, hue ring
                   │  overlays: one merged quad mesh on tile tops (ranges, cursor, area)
                   │  picking: rayAt + hitQuad over every tile top
                   │  camera: 35°, two-axis pan, snapToGrid; render only on change
                   │  look: night grade, 4 live lights, Effects (bloom, tilt-shift), fade
                   ▼
 DOM over the canvas: timeline, forecast card, commands, paper dolls (placed with project())
```

**What fits on a phone.** One texel per device pixel makes a tile 128 px wide and about 73 px deep. On the owner's 3×
iPhone in landscape that's about 20 tiles across and 16 deep: a flat 14 × 14 board fits, and heights at the back
overflow, so the board pans. A 2× phone fits about 10 tiles each way and would need a zoom (a request, only if needed).

**What CY7 checks before anything builds on it:**
1. A map built directly into `roomGeometry`'s design object, **with a level-3 tile:** if it builds, heights 0–3 need
   no request.
2. Picking on every tile top at about 24 pt deep, with heights.
3. Thirteen figures live (four sprite sets and nine standees, about 56 MB of the 112 MB budget).
4. Frame rate with the saver on and off (`FpsRecorder`: mean, 1% low), against 60 fps with a 30 fps floor.
5. How much heights hide, with the fade on.

**The stage requests,** filed with uma-platform one at a time (the change protocol; its ST rows), each with the
evidence:

| Request | Evidence | Likely |
|---|---|---|
| Tunable bloom and tilt-shift | Threshold fixed at 0.86 on luminance: magenta (about 0.28) and cyan (about 0.79) never bloom | Needed |
| Glowing kit frames | `KitFrame.light` makes a light but nothing glows | Needed |
| A tactics kit kind, cached by kit id | A biome kit must carry dungeon frames; one page per kind for the whole session | Needed |
| A lighter saver tier | The saver is on by default on phones and turns every effect off | Needed |
| Heights 0–3 | `MAX_LEVEL` 2 in the format | If check 1 fails |
| A tactical zoom | 2× phones | If needed |
| Rain; overlays in the stage | Both drawn game-side first | Only if game-side costs too much |

Until a request ships, the board runs without it: neon reads by colour, the saver tier is off, and the kit loads by
hand (`pixelTexture`, then `buildWorld` with an array of pages).

## 4. The battle package (BP4)

```text
packages/battle/src/
  types.ts        Map, Tile, Unit, Rig, Part, Loadout, Weapon, Action, Cue, Objective
  tuning.ts       every number in one table: bands, part HP, Capacity, damage, hit, Charge (TC4, TC17–TC20)
  rng.ts          a seeded hash: (seed, turn, actor, roll) → number; never Math.random
  battle.ts       createBattle(input) → state; applyBattleAction(state, action) → { state, cues, error }
  legal.ts        the legal actions for the unit whose turn it is
  move.ts         reachable tiles: Move, height, jump, Stride, broken Legs, zones of control
  sight.ts        line of fire and the pincer test for Crossfire
  attack.ts       hits, parts, damage types, Coat, facing, height, counters, Crossfire, Cover
  timeline.ts     clocks filled by Speed; the next eight turns; Wait
  forecast.ts     the resolution's own functions, as chances and ranges, never the seeded roll (TC29)
  terrain.ts      Wet, Oil, Fire, Live, Smoke, terminals (CY5)
  tech.ts         Stun, Jam, Jack-Out, the Holds (CY5)
  ai.ts           enemy AI and ally Auto (CY6)
  version.ts      the rules version; an old battle replays on its own version
```

- **A battle is a frozen input plus a list of actions.** The save keeps exactly that, so an autosave after every
  action is a few bytes, and a resume replays to the same state.
- **Cues** are what the board and the cut-in play: moved, faced, hit (part, amount, broke), countered, joined, broke,
  freed, terrain changed. The scene never decides anything.
- **Factions' mechanics** arrive one at a time with their worlds; Phase 2 builds the Steel Muster's cover and volley as
  the first, since the test map fights the Muster.

## 5. Combat testing, three ways (BP5)

| Way | What it is | Run by | Catches |
|---|---|---|---|
| **1. Tests and golden replays** | Vitest per rule; golden files hold an input, its actions and the exact cues | `pnpm test`, in CI | A rule that changed by accident |
| **2. The sandbox** | A route in the app: pick a map, squad, loadouts, enemies and seed; play with the full battle UI; save the setup as a scenario | The owner, on the phone; Claude headless through `?debug` | How it feels: readability, taps, the ten-minute target |
| **3. The simulator** | `pnpm sim` plays scenarios AI against AI over many seeds and writes a report | Claude, after any tuning change | Balance: win rates, battle length, what dominates |

**Scenarios** are small JSON files in `scenarios/`, shared by the sandbox and the simulator, nameless (stand-in units,
test maps, generic enemies), so they belong in git.

**The simulator's report** (`pnpm sim all --seeds 500`, written to the ignored `sim/out/`):

| Measure | Target |
|---|---|
| Win rate in an even scenario | 45–55% |
| Battle length | 8–14 player turns, about ten minutes at the sandbox's measured pace |
| A full-HP Core broken in one hit, at equal bands | Never, except a boss's signature |
| Each weapon band's share of damage | No band above 40% in a mixed squad |
| Counters, Crossfires and Covers a battle | At least one each, on average |
| Parts broken before the Core | More than half the Rig Breaks |
| Charge left unspent at the end | Low, or Charge is too cheap |

A balance pass is an edit to `tuning.ts` and a rerun; the report's diff goes in the packet's decision.

## 6. The app on test content (BP6)

```text
 boot ─▶ the ship ─┬─ Bridge ─▶ star map ─▶ a world's map ─▶ chapter or side job
                   │                                             │
                   │                                  briefing ─▶ deploy ─▶ battle ─▶ results
                   │                                                                   │
                   ├─ Hangar: loadouts, parts      ◀───────────────────────────────────┘
                   ├─ Quarters: the crew, Strain, optional scenes
                   ├─ Log: Files, Timeline, Anomalies
                   └─ Store, Comms, Sim Pod: locked until a lead opens them (TC49)
```

- **The ship starts as a 2D cutaway** (DOM and SVG, uma-kit's shell, the rooms as places), the cheapest view that looks
  fine. An HD-2D deck on the stage can come later with a kit.
- **The star map and a world's map are SVG,** from uma-rpg's star chart, with 44 pt targets: a node per world, a node
  per location, each showing its danger level and any lock's key.
- **The save** grows from CY3's v1, through CY9's v2 (the story state) to CY10's v3: the crew (by outfit id), parts
  and loadouts, the ship's rooms, each world's progress, story flags, Leads and Files, and the battle in progress as
  its input and actions.
- **Stand-ins everywhere:** `uma-stage`'s stand-in sprite sets and kits, test maps, an invented world with two invented
  leads. Master data's chibi sets, renders and the Ranker's images swap in during Phase 4.

## 7. Where the story plugs in (BP7)

The contract is in [the story brief §8](story-brief.md#8-the-content-contract-sb8). CY9 makes it real:
- the format's types and a strict parser that names the path of any error, in `@cyber/domain`;
- `pnpm story:check`, which validates every file in `content/stories/` and writes Uma Story's `checks.json`;
- one loader seam: the dev server reads `content/stories/` and falls back to the stand-in when it's empty; production
  reads a private pack through `uma-server`'s `PrivatePackModule` once the bucket exists (Phase 4, with its cost table);
- the scene player: lines with busts, interjection slots, choices and Leads, auto, skip and a log.

## 8. The packets (BP8)

```text
 CY1 workspace
  ├──▶ CY2 cloud ──▶ CY3 hello app ────────────────────┬──▶ CY9 story ──┐
  │                                                    ▼               ▼
  ├──▶ CY4 rules ──▶ CY5 the rest ──▶ CY6 AI, sim ──▶ CY8 sandbox ──▶ CY10 ship ──▶ CY11 crew ──▶ CY12 loop
  │                                                    ▲
  └──▶ CY7 the board ──────────────────────────────────┘
```

| Id | Phase | What | Size | Needs |
|---|---|---|---|---|
| CY1 | 1 | The workspace and its checks | S | The owner's six package-access entries, for CI |
| CY2 | 1 | The cloud in the `uma-rpg` project, with its cost table | M | CY1; the owner's go |
| CY3 | 1 | The hello app: sign-in, save v1 synced, the update prompt, the Home Screen, master data | M | CY2; the owner's two sign-in entries |
| CY4 | 2 | The battle rules, core: the rig, loadout, timeline, Charge, movement, attacks, counters, Crossfire, Cover, Rig Break, objectives, the forecast; golden replays | L | CY1 |
| CY5 | 2 | The battle rules, the rest: terrain states and terminals, Tech and the Holds, Back units, chance skills, items, Stride, the Steel Muster's mechanic | L | CY4 |
| CY6 | 2 | The enemy AI, ally Auto, scenarios and the simulator; the first balance pass | M | CY5 |
| CY7 | 2 | The board on uma-stage: the game-owned scene, its five checks, and the stage requests | M | CY1 |
| CY8 | 2 | The sandbox: the battle screen on the phone, the cut-in, autosave and resume, scenario files | L | CY3, CY6, CY7 |
| CY9 | 3 | The story format, its check, the stand-in story, the loader and the scene player; save v2 | M | CY3 |
| CY10 | 3 | The ship, the star map, a world's map and the mission flow; save v3 | L | CY8, CY9 |
| CY11 | 3 | The crew and the Hangar: roster, profiles, loadouts, parts, roles, the bench | M | CY10 |
| CY12 | 3 | The Chapter 1 loop on the stand-in: two worlds, two pickups, rooms opening, debriefs | M | CY10, CY11 |

**The working order:** number order, CY1 to CY12 (the owner, D5), so the cloud and the hello app come first and every
later packet can be checked on the phone. Phase 4's packets are written when the story session delivers its first
world.

## 9. Budgets (BP9)

| Budget | Value | From |
|---|---|---|
| Main JS | 180 KB gzip, three.js and the stage lazy | `check-size.mjs`, as every sibling |
| Frame rate | 60 fps target, 30 fps floor; paused when hidden; render only on change | uma-quest's HD-2D notes |
| Sprite sets live | 8 (about 112 MB GPU) | `uma-stage`'s cap |
| Live lights | 4 | `uma-stage` |
| Device-pixel ratio | Capped at 3 | `uma-stage` |
| A battle | About ten minutes; at most eight enemies and 14 × 14 tiles | TC2, TC30 |
| A new game to its first battle | Two minutes | TC36 |
| A save | Small: a battle is its input and actions | BP4 |

## 10. The calls

| # | Call | Section |
|---|---|---|
| BP1 | The workspace: web, API, a pure `@cyber/battle` that depends on nothing, and `@cyber/domain` with the one master-data adapter; scenarios in git | [1](#1-the-workspace-bp1) |
| BP2 | Reuse first: import the six packages, copy what the siblings copy, follow patterns where code can't be shared; games never import each other | [2](#2-whats-reused-and-how-bp2) |
| BP3 | The board is a game-owned scene from `uma-stage` 0.3.0's parts; CY7 runs five checks and files the stage requests one at a time, with evidence | [3](#3-the-hd-2d-board-on-uma-stage-bp3) |
| BP4 | The battle rules: a seeded reducer, a frozen input plus actions, cues for the scene, a forecast from the same functions, one tuning table, a rules version | [4](#4-the-battle-package-bp4) |
| BP5 | Combat testing three ways: tests and golden replays, the sandbox with scenario files, the simulator with targets | [5](#5-combat-testing-three-ways-bp5) |
| BP6 | The whole app on test content: a 2D ship cutaway, SVG star and world maps, the save growing to v3, stand-ins everywhere | [6](#6-the-app-on-test-content-bp6) |
| BP7 | The story plugs in through CY9: a strict parser, `pnpm story:check`, one loader seam, the scene player | [7](#7-where-the-story-plugs-in-bp7) |
| BP8 | Twelve packets in three phases; the combat track starts beside the cloud | [8](#8-the-packets-bp8) |
| BP9 | Budgets: 180 KB, 60 fps with a 30 floor, eight sprite sets, four lights, ten-minute battles | [9](#9-budgets-bp9) |
