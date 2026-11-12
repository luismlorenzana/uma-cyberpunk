# CY6 — The enemy AI, scenarios and the simulator

**uma-cyberpunk · Claude · M · Needs: CY5 · Unblocks: CY8**

## Why

The rules (CY4, CY5) can't be played without an opponent, and their numbers can't be trusted until thousands of
battles have run on them. This packet gives the enemies a mind that never idles, gives the squad an Auto that plays
the same way, fixes the **scenario** files the sandbox and the simulator share, and builds the simulator that turns the
tuning table into a report. Its first balance pass is the first time the concept's numbers meet each other (TC30, TC54,
BP5).

## Context (read first)

- [The build plan §5](../../design/build-plan.md#5-combat-testing-three-ways-bp5): the three ways of testing, the
  scenarios and the simulator's targets.
- [The concept §4.1](../../design/concept.md#41-the-board-tc2-tc30) (TC30's guard rails: no idle AI, enemy turns fast)
  and §4.3 (the bands the simulator tunes).
- [world.md §5.1](../../design/world.md#51-the-table-wd10-wd11): the Steel Muster holds cover and times its volley.
- **What exists:** `@cyber/battle` with the core and the rest (CY4, CY5): `legalTurns`, `forecast`, `replayBattle`,
  `tuning.ts`, the map format and the golden replays.
- **The patterns** (copy the shape, never import):
  - enemy choices: uma-rpg's `intentFor` and `chooseTarget`
    (`/Users/luismartinez/workspace/uma-rpg/packages/domain/src/rpg/battle/engine.ts`, about :262–330), drawn by the
    fight's seeded hash;
  - ally Auto: uma-rpg's `autoAction` scoring
    (`/Users/luismartinez/workspace/uma-rpg/packages/domain/src/rpg/battle/auto.ts`);
  - the simulator: uma-racer's `scripts/sim/strategy-balance.ts`
    (`/Users/luismartinez/workspace/uma-racer/scripts/sim/strategy-balance.ts`), run as
    `pnpm dlx tsx scripts/sim/strategy-balance.ts`, synthetic data only;
  - balance plays: uma-rpg's `balance-play.ts` and `balance-measure.ts`
    (`/Users/luismartinez/workspace/uma-rpg/packages/domain/src/world/`), and its gated runs
    (`SIM=1 npx vitest run …`, `it.runIf(process.env.SIM)`).

## Decisions made

- **The AI lives in `packages/battle/src/ai.ts`:** `chooseTurn(state, unit) → turn`. It scores candidate turns (the
  reachable tiles, pruned to the best dozen by distance and cover, × each legal action × the facings) with the
  forecast's expected values:
  - expected damage, the chance to break each part (weighted by the part), the chance of a Rig Break;
  - the threat at the destination: the expected damage the other side could deal there next round;
  - cover and height at the destination; facing toward the most threats;
  - objective pressure (the leader, the escort, the tiles to reach or hold);
  - focus fire on damaged targets; keeping 1 Charge for a counter unless spending it wins more;
  - Holds: a heroine with an Anchor or Collar keeps it away from Netrunners.

  Ties go to the seeded hash, so the same battle always plays the same way. **It never idles** (TC30): with no attack
  worth taking, it advances toward the nearest target or objective.
- **The Steel Muster's AI** holds cover tiles, fires from them, and keeps at least one unit out of reload when the
  volley is a round away.
- **Ally Auto** is the same scorer for the squad's side. The simulator plays both sides with it; the app can offer it
  later.
- **A decision takes 50 ms at most on the phone** (13 units on 14 × 14): a test times it on the CI machine at a tenth
  of that.
- **The scenario format** (owned here; CY8's sandbox reads and writes it), one JSON file each in `scenarios/`, in git:

  ```jsonc
  {
    "schemaVersion": 1,
    "id": "muster-underlevels",
    "title": "Four against the Steel Muster",
    "map": "underlevels",                  // a map in scenarios/maps/
    "input": { /* BattleInput: rules version, objective, units with resolved loadouts; the seed comes from below */ },
    "seeds": [1, 2, 3],                    // optional: the sandbox's default seed is the first
    "control": { "squad": "player", "enemy": "ai" }   // the simulator plays both with the AI regardless
  }
  ```

  `parseScenario` checks it against the battle's own parsers. **Scenarios are nameless:** stand-in units only (`ref`
  of kind `standin`, labels like "Vanguard A" and "Muster trooper 2"), never an Uma, a heroine or a franchise term.
- **The test maps,** in `scenarios/maps/`, original: a flat **yard** (10 × 10, open, a few cover tiles); the
  **underlevels** (12 × 12, heights 0–2 and one 3, cover, grating, Oil barrels, a pipe, a terminal and a lift); the
  **arena** (6 × 6, TC43's one-against-one).
- **The scenarios,** at least: an even **mirror** on the yard; **four against the Steel Muster** on the underlevels
  (Phase 2's test fight, TC15); **melee against ranged**; **the high ground**; **the chain** (fire, current and a lift);
  **a free** (a heroine with a Collar, to free or to break); **the arena**.
- **The simulator** is `scripts/sim/battle.ts`, run as `pnpm sim <scenario | all> [--seeds N] [--compare <report.json>]`
  (`pnpm dlx tsx`, as uma-racer). It plays each scenario AI against AI over N seeds (200 by default) and writes a
  markdown report and its JSON to `sim/out/`, which `.gitignore` ignores. A battle that passes 60 rounds is a
  **stalemate** and counts against the targets.
- **What it reports,** per scenario: the win rate per side; player turns and rounds, and minutes at 40 seconds a player
  turn until CY8 measures the real pace; damage by weapon band and by damage type; parts broken, by part; Rig Breaks
  and how many came after a part broke first; counters, Crossfires and Covers a battle; Charge spent and left;
  first-turn Rig Breaks; freed, broken and standing heroines; stalemates.
- **The targets** are the build plan's (§5): an even win rate of 45–55%; 8–14 player turns; no full-HP Core broken in
  one hit at equal bands; no weapon band above 40% of a mixed squad's damage; at least one counter, Crossfire and
  Cover a battle on average; more than half the Rig Breaks after a part broke first; little Charge left at the end.
- **The first balance pass** edits `tuning.ts` only. The D-decision logs the report's numbers before and after, and
  every target it misses, with why.

## Do

1. **`ai.ts`:** the scorer, the candidates, the tie-break, the advance fallback, the Muster's behaviour; ally Auto.
2. **Scenarios:** `parseScenario`, the three maps, the seven scenarios, all nameless.
3. **The simulator:** `scripts/sim/battle.ts`, the `sim` script in the root `package.json`, `sim/out/` in
   `.gitignore`, the report with the targets marked met or missed, and `--compare` for a before-and-after diff.
4. **Tests:** the AI never idles when an attack or an advance exists; it takes a sure Rig Break over chip damage; it
   leaves a tile that a volley has marked; the same scenario and seed give the same battle twice; every scenario parses
   and plays to an end within 60 rounds for three seeds (a fast test that always runs); the 50 ms budget.
5. **The first balance pass:** `pnpm sim all --seeds 500`, tune, rerun; golden replays are rewritten with
   `UPDATE_GOLDEN=1` and the commit says why.
6. **The manual:** `docs/game/enemy-ai.md` (how enemies choose, in plain words) and a **Balance** section in
   `docs/game/battle.md` with the targets and the last report's numbers, in the form CY3 sets.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass locally and in CI.
- `pnpm sim all --seeds 500` runs locally, writes its report, and the report marks each target; the D-decision quotes
  it.
- Running the same scenario and seed twice gives the same state hash.
- The scenarios and maps in git name no Uma, heroine or franchise term; `scripts/check-private-content.test.mjs` passes.
- `git status` shows no `content/` and no `sim/out/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(battle): …` for the AI, `feat(sim): …` for the simulator). Then delete
this packet, add a Done row in [the handoff](../README.md), and log a D-decision with the balance report's numbers
(fetch `main` first).
