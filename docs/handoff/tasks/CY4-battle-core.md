# CY4 — The battle rules, core

**uma-cyberpunk · Claude · L · Needs: CY1 · Unblocks: CY5**

## Why

Every later piece of the game plays these rules: the board (CY7) plays their cues, the sandbox (CY8) drives them, the
simulator (CY6) balances them and the story's missions run on them. No sibling has grid battle code, so the rules are
new, and they're built first as a pure package with tests, so nothing above them has to guess (TC54, BP4). This packet
is the core: the rig, the loadout, the timeline, Charge, movement, facing, the three non-Tech weapon bands, counters,
Crossfire, Cover, Rig Break, four objectives and the forecast. CY5 adds the rest.

## Context (read first)

- [The concept §4](../../design/concept.md#4-the-battle): every rule here, TC2–TC4, TC17–TC23, TC25, TC29, TC30.
- [The build plan §4–§5](../../design/build-plan.md#4-the-battle-package-bp4): the package's files, the reducer's shape,
  and how the combat is tested.
- **uma-rpg's battle engine is the pattern** (copy the shape, never import; games stand alone, uma-platform P2):
  - `/Users/luismartinez/workspace/uma-rpg/packages/domain/src/rpg/battle/engine.ts`: `createBattle` (:345),
    `applyBattleAction` (:1134) returning `{ state, cues, error }`, `replayBattle` (:1217), `battleStateHash` (:77),
    the seeded `hashNumber` (:60) keyed by `seed:round:unit:purpose`, and `engineVersion` with old branches kept;
  - its `types.ts`, `caps.ts` (versioned limits) and `index.ts`.
- **Golden replays are uma-rpg's and uma-quest's pattern:**
  `/Users/luismartinez/workspace/uma-rpg/packages/domain/src/rpg/battle/v15-replays.fixture.json`,
  `v15-replays.fixture.ts` and `v15-replays.test.ts` (uma-quest has the same set up to v20 in
  `/Users/luismartinez/workspace/uma-quest/packages/domain/src/rpg/battle/`).
- **uma-stage's room format** is where the map's height rows come from: digit rows read by `gridOf`
  (`/Users/luismartinez/workspace/uma-platform/packages/stage/src/formats/design.ts:83-92`), row 0 at the back. CY7
  feeds this package's maps straight into `roomGeometry`.
- **What exists:** CY1's workspace (`apps/web`, `apps/api`, `packages/domain`), its lint, test and build, and CI.

## Decisions made

- **The package:** `packages/battle`, named `@cyber/battle`, ESM, TypeScript strict, Vitest. **It depends on
  nothing**, not even `uma-data`: it takes plain numbers. The adapter from master data's stats to bands lives in
  `@cyber/domain` later (BP1). The web loads it lazily with the board.
- **The files** follow the build plan: `types.ts`, `map.ts`, `tuning.ts`, `rng.ts`, `battle.ts`, `legal.ts`,
  `move.ts`, `sight.ts`, `attack.ts`, `timeline.ts`, `forecast.ts`, `version.ts`, `index.ts`.
- **The map format** (owned here; CY5 adds the props and states, CY6 and CY7 read it):

  ```jsonc
  {
    "schemaVersion": 1,
    "id": "test-yard",
    "width": 10, "depth": 10,                 // 6–14 each
    "heights": ["0000000000", "…"],           // one digit 0–3 a tile; row 0 is the back (north), x grows east
    "tiles": ["..........", "…"],             // one char a tile: "." floor, "#" solid (no standing, blocks sight),
                                              // "=" grating, "c" cover; CY5 gives "=" and "c" their rules
    "spawns": { "squad": [[1, 8], …], "enemy": [[7, 1], …] }   // five squad tiles (four and a guest)
  }
  ```

  Heights stay digit rows, the same as uma-stage's room format, so the board builds them with no translation.
  `parseMap` checks every rule and names the path of any error.
- **Directions** are N, E, S and W. On screen, S faces the camera (CY7 maps them to the stage's front, back, left and
  right).
- **A round** is 100 ticks of the timeline's clock, one turn at Speed band 3. It's what "hold for N turns" counts, and
  what CY5's terrain timers count. The timeline shows a round marker.
- **The battle input** is frozen at the start: the rules version, the seed, the map, the objective, and every unit with
  its side, bands (Speed, Stamina, Power, Guts, Wit, each 1–5), Charge cap, link toggle, leader flag, spawn index,
  facing and **resolved loadout** (each part's numbers, not a catalogue id). A unit may carry a `ref` (`standin`, `uma`,
  `heroine` or `hardware`, with an id) and a `label`, which the rules never read: names come from master data in the
  app, and git only ever holds stand-ins.
- **A turn is one action:** `{ kind: "turn", unit, to?, act, face }`, where `act` is an attack (hand, target, optional
  aimed part), `wait` or `none`. The UI holds the two-tap move and its undo locally and dispatches the whole turn, so an
  autosave after every action is exact (TC29). The link toggle is a free action, `{ kind: "link", unit, on }`.
- **Wait** means no action this turn (moving is still allowed): +1 Charge more, and her clock restarts at 25 instead of
  0, so her next turn comes sooner.
- **Movement:** a step climbs or drops one level at most; Move comes from the Speed band (3, 3, 4, 4, 5), +1 at 70%
  load or less; broken Legs mean Move 1 and no level changes. **Zones of control:** entering a tile next to an enemy
  ends the move. Squad units pass through each other, never through enemies.
- **A shield's Guard** is a flat cut to a hit from the front or side (a tower shield 40%, a buckler 20%, in the tuning
  table), never from behind. It's off when its arm breaks.
- **Hits:** hit % = the weapon's accuracy + 3% a Wit band − the target's evasion (2% a Speed band, 0 with broken Legs),
  − 25% when aimed, clamped to 5–95%. Crit: the weapon's base (5% unless it says), ×1.5 damage.
- **Where hits land** (the tuning table's starting weights): Melee leans to the Core (Core 60, each arm 15, Legs 10);
  Short rolls each of its hits on Core 40, each arm 20, Legs 20; Long is one hit on Core 50, each arm 15, Legs 20. An
  aimed hit goes where aimed. A hit on a broken part goes to the Core.
- **Damage:** the weapon's power (plus 2 a Power band for Melee), × the side (+25%) or back (+50%), × 10% a height level
  above (−10% below), × 0.5 against a matching Coat, − the Guard, rounded down, at least 1.
- **Crossfire** picks the first two eligible allies in timeline order; the forecast shows exactly who joins.
- **Rig Break** leaves the unit kneeling and **rebootable until the end of her next turn**; then she extracts. The
  reboot itself is the Medic's, in CY5. Guts band 4 or more gives **Hold on** once a battle: she survives at 1 Core.
- **The forecast doesn't resolve the attack on a copy.** The seed would leak the real rolls. It calls the same pure
  functions the resolution calls (hit %, damage, part weights, counter and Crossfire eligibility, Charge, the timeline
  shift) and returns chances and ranges, so the card and the result can't disagree.
- **The rules version starts at 1.** `createBattle` refuses an unknown version; a later version keeps the old branches,
  as uma-rpg's does, so a saved battle still replays.
- **Every number lives in `tuning.ts`:** the bands' thresholds (70, 90, 110, 130, 150), part HP (Core 30 + 10 a Stamina
  band, each arm 15 + 5, Legs 20 + 6), Capacity (10 + 2 a Power band, plus the Core's and Back unit's bonus), Charge
  (start 1, +1 a turn, cap 3, counter 1, Crossfire 1, Cover 1, Wait +1), modifiers, weights, Guard, crit. CY6's
  simulator tunes this file and nothing else.

## Do

1. **The package:** `package.json`, `tsconfig.json` from the base, Vitest, and the build and lint scripts turbo runs.
2. **`types.ts` and `map.ts`:** the map format above with `parseMap`; units, rigs, parts, weapons, the input, the state,
   actions and cues. Cues cover at least: turn started, moved, faced, waited, Charge changed, attack, hit (part, amount,
   crit, broke), miss, guard, counter, Crossfire joined, Cover taken, part broke, Rig Break, Hold on, extracted,
   objective progress, battle ended.
3. **`rng.ts`:** a seeded hash of `seed:round:unit:purpose:n` to a number in [0, 1). No `Math.random` anywhere in the
   package; a test greps for it.
4. **`timeline.ts`:** clocks filled by Speed; ties broken by Speed band, then the seeded hash; the next eight turns as
   a list, and the shift a Wait would cause.
5. **The rig and loadout:** eight slots and a Coat; Load against Capacity (over Capacity, `createBattle` refuses the
   unit); +1 Move at 70% load or less; two-handed weapons; what breaks when each part breaks (TC17's table).
6. **`move.ts` and `sight.ts`:** reachable tiles with paths (height, zones of control, broken Legs, solid tiles); line
   of fire over heights and solid tiles; Melee and Short reach two levels up or down at most; Long +1 range from two
   levels up.
7. **`attack.ts`:** Melee, Short and Long (Long needs a Launcher Back unit, 2–3 ammo a battle, can't counter or be
   countered); hit %, crit, part weights, Aim, the damage formula, Guard; counters from the front and side when the
   defender has Charge and a Melee or Short weapon in range; Crossfire by pincer or line of fire; Cover by an adjacent
   shield for 1 Charge.
8. **`battle.ts` and `legal.ts`:** `createBattle(input)`, `applyBattleAction(state, action)` → `{ state, cues, error }`,
   `replayBattle(input, actions)`, `legalTurns(state)`, `battleStateHash(state)`. Illegal actions return an error and
   change nothing.
9. **Objectives:** defeat all, defeat the leader, reach a tile, hold for N rounds. The battle ends the moment one is met
   or failed; it's lost when every squad unit is out.
10. **`forecast.ts`:** `forecast(state, turn)` → hit %, damage range and crit % for the attack, each Crossfire and the
    counter; side or back; the likely parts with their chances and any that will or may break; the Charge cost; the
    timeline after the turn.
11. **Tests:** one file per rule (the bands, each part breaking, Capacity and the light-rig bonus, the timeline and
    Wait, Charge, movement with heights and zones, line of fire, every modifier, Guard, counters, Crossfire both ways,
    Cover, Rig Break and Hold on, each objective, the forecast against many resolved outcomes over seeds).
12. **Golden replays:** at least six hand-built battles on two small test maps (an input, its actions, the exact cues
    and the final state hash) in `src/golden/`, checked by a test; `UPDATE_GOLDEN=1` rewrites them, and the commit says
    why.
13. **The manual:** `docs/game/battle.md`, the core rules as built, in the form CY3 sets for `docs/game/`, with the
    tuning table's numbers.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass locally and in CI, with the new package in turbo's run.
- Replaying any golden battle gives the same cues and state hash; changing one number in `tuning.ts` makes the golden
  test fail and name the battle.
- A test shows the forecast's hit % within two points of the resolved hit rate over 2,000 seeds, for each weapon band.
- `grep -r "Math.random" packages/battle/src` finds nothing.
- `@cyber/battle`'s `package.json` has no dependencies.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(battle): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for the rules version, the map format and anything else you decided
(fetch `main` first).
