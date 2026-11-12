# CY5 — The battle rules, the rest

**uma-cyberpunk · Claude · L · Needs: CY4 · Unblocks: CY6**

## Why

CY4 gives a battle of rigs, guns and blades on a grid with height. What makes it this game is the rest: terrain that
burns and sparks, terminals that move the map, Netrunners who hack and free heroines, the five roles' Back units, the
chance skills, items, Stride from the Umas' running styles, and the first faction's mechanic. The sandbox (CY8) needs
all of it to be a real test, and the simulator (CY6) needs all of it to balance anything (TC5, TC19, TC21, TC22, TC24,
TC26, TC27, TC46, WD11).

## Context (read first)

- [The concept §4](../../design/concept.md#4-the-battle): terrain (§4.7, TC24), roles (§4.8, TC5), skills (§4.9, TC22),
  Rig Break, freeing and Strain (§4.10, TC25–TC27), weapons and Tech (§4.5, TC19), Stride (§3, TC46).
- [world.md §4–§5](../../design/world.md#4-the-three-holds-wd9): the three Holds (WD9) and the factions' mechanics
  (WD11). Phase 2 builds one faction: **the Steel Muster's cover and volley**, since CY6's test fight and CY8's sandbox
  fight the Muster.
- [The build plan §4](../../design/build-plan.md#4-the-battle-package-bp4): `terrain.ts` and `tech.ts` belong to this
  packet.
- **What exists:** CY4's `@cyber/battle`: the map format, the reducer, the forecast, the round (100 clock ticks),
  `tuning.ts`, the tests and the golden replays, and `docs/game/battle.md`.
- **uma-rpg's engine** keeps its rules versioned with old branches
  (`/Users/luismartinez/workspace/uma-rpg/packages/domain/src/rpg/battle/engine.ts`); this packet extends version 1
  if CY4's rules version hasn't shipped in a save yet, and otherwise adds version 2.

## Decisions made

- **Terrain states** (TC24), on a tile's state, with timers counted in rounds:

  | State | Rule | Made by |
  |---|---|---|
  | **Wet** | Live current spreads at once across connected Wet tiles and grating (`=`); puts out Fire | Rain, burst pipes, coolant |
  | **Oil** | Fire spreads at once across the connected slick | Leaks, barrels |
  | **Fire** | F damage to the Legs of whoever ends a turn there; burns out after 3 rounds | Flamers, missiles, sparks on Oil |
  | **Live** | Untyped damage to the Core of whoever enters or ends a turn there; ignores Coats | Live cables, current on Wet |
  | **Smoke** | Blocks line of sight; ranged hits −30%; clears after 2 rounds | Grenades, burning Oil |

  The amounts are in `tuning.ts`. A **terrain card** function returns a tile's state, height, cover, what can change it
  and its bonus, for CY8's long press.
- **The map format grows `props`:** barrels (Oil when hit), pipes (Wet when hit), live cables, terminals, turrets and
  doors, each with a tile and an id. `parseMap` checks them. **Cover** (`c`) gives +20% evasion against Short and Long
  hits from the front and sides; **grating** (`=`) carries current.
- **Terminals:** a unit with a Deck Back unit within Tech range hacks one as her action, for 1 Charge, with no roll. A
  terminal opens or shuts a door (solid tiles), turns a turret to her side, moves a lift (its tiles change height, with
  a cue so the board re-meshes) or cuts the lights (ranged hits −15% and turrets idle for 2 rounds).
- **Tech** (the Deck, range 2–4, never countered): **Stun** (2 Charge: she loses her next turn), **Jam** (1 Charge:
  −1 Charge), **Jack-Out** (2 Charge, adjacent, on a heroine below 30% Core: frees her). The chance is Wit against
  Guts: 50% + 5% a Wit band − 10% a target's Guts band, clamped 5–95%, and the forecast shows it. An impact hit on the
  Core can Stun too (a 10% base in `tuning.ts`).
- **The Holds** (WD9, TC26): a heroine unit has `hold: "anchor" | "collar" | "none"`. An Anchor or a Collar is an extra
  part on her rig with its own HP, hit only when aimed or by Tech. **Breaking it, or a Jack-Out, frees her:** she leaves
  the field, counts as beaten for the objective, and all her unbroken parts are salvage. **Rig Break beats her
  without freeing her:** only her unbroken parts are salvage. The battle's result lists each enemy as `freed`,
  `broken` or `standing`, with her salvage, so the app can open guests and Files later. A cue marks the freeing, so the
  board swaps her palette back (TC41).
- **Back units** (TC5), each a role's signature:

  | Back unit | Rule |
  |---|---|
  | **Bulwark** | Deploys a one-tile barrier on an adjacent tile (1 Charge): solid, blocks sight, has HP, lasts until broken |
  | **Thruster** | Climbs two levels a step instead of one; **Dash** (1 Charge): +2 Move this turn and ignores zones of control |
  | **Launcher** | Carries Long weapons (CY4) and grants **Aim** |
  | **Deck** | Carries Tech and hacks terminals |
  | **Med** | **Mend** (1 Charge, adjacent): restore Core HP or mend a broken arm or Legs at 25%; **Reboot** (2 Charge, adjacent): a Rig Broken ally inside her window stands at 25% Core, limbs still broken |

- **Chance skills** (TC22), five only, each with its % on the forecast, one chain per attack, +5% a Wit band:
  **Double** (a second melee hit), **Switch** (fire the other hand too), **Burst** (extra rounds on a Short weapon),
  **First** (as a defender, her counter lands before the attack) and **Stun** (a hit stuns). A unit's input lists her
  chance skills with their base %; where they come from (parts and mastery) is Phase 5's.
- **Items:** one squad stock of up to six, set in the input; using one is her action and costs no Charge. Four to
  start: a repair kit (Core HP), a patch (mends a part at 25%), a smoke charge (Smoke on a tile in range 3) and a cell
  (+1 Charge).
- **Stride** (TC46), from the input: **Break** +1 Move on her first turn; **Draft** +1 Move when she starts her turn
  next to an ally; **Surge** +1 Move on the turn after a Wait; **Kick** +2 Move while her Core is at half or less.
- **Objectives** add **escort** (a unit on the squad's side must reach a tile; the battle's lost if she's out), **hack N
  terminals** and **free the leader** (beating her without freeing her fails it).
- **The bench support call** (TC27): the input lists the resting Umas' roles; once a battle the squad spends a free
  action on one call, by role: Vanguard a barrier, Striker a strike on one tile, Gunner a mortar on a 3 × 3 area,
  Netrunner a scan (every enemy's loadout and next turn shown), Medic a repair drop.
- **The Steel Muster** (world.md WD11), switched on by `factions: ["steel-muster"]` in the input:
  - its units prefer cover tiles (the AI's part is CY6's; the rules here only give cover its bonus);
  - after a Muster unit fires a Short or Long weapon, she **reloads**: she can't counter until her next turn, which the
    timeline shows;
  - **the volley meter** is shared: +1 for each Muster attack, full at 6. When it fills, the volley is **signalled a
    round ahead** with marked tiles; at the next round's start every Muster unit with a line of fire hits the marked
    tiles once, and leaving the marks dodges it;
  - **pinning fire:** a Muster hit on an arm also costs that unit 10% hit until her next turn (it threatens arms, WD11).
- **Overrides** (TC44) and faction mechanics beyond the Muster are later packets.

## Do

1. **`terrain.ts`:** the five states, their spread by flood fill, their timers, their damage, props, cover and grating;
   `terrainCard(state, tile)`.
2. **Terminals:** doors, turrets (a hardware unit that doesn't move), lifts and lights, with their cues.
3. **`tech.ts`:** Stun, Jam and Jack-Out with their chance; the impact Stun; the Holds as parts; the battle result's
   `freed`, `broken` and `standing` lists with salvage.
4. **Back units:** the barrier, Dash and the two-level climb, Aim, Mend and Reboot.
5. **Chance skills, items, Stride and the bench support call.**
6. **The three new objectives.**
7. **The Steel Muster:** cover's rule, reload, the volley meter and its signal, pinning fire, behind its flag.
8. **The forecast** shows every new chance: Tech %, each chance skill's %, Smoke and cover, the lights, the volley's
   marked tiles, a Jack-Out's %.
9. **Tests** for each rule, and **golden replays** for at least one battle each: fire across an Oil slick, current
   across Wet and grating, a lift changing height mid-battle, a heroine freed by her Anchor and one by a Jack-Out, a
   Medic's reboot inside and outside the window, a Muster volley dodged and one that lands. CY4's golden battles still
   pass, or the rules version goes up.
10. **The manual:** extend `docs/game/battle.md` with the roles, skills, items and Stride; add `docs/game/terrain.md`
    (states, props, terminals) and `docs/game/factions.md` (the Holds and the Steel Muster), in the form CY3 sets.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass locally and in CI.
- Every golden battle replays to its exact cues and state hash, CY4's included.
- The forecast's Tech and chance-skill % match the resolved rates within two points over 2,000 seeds.
- A battle with every flag off plays exactly as CY4's rules do (a test).
- `@cyber/battle` still has no dependencies, and `grep -r "Math.random" packages/battle/src` finds nothing.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(battle): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for the rules version and anything you decided (fetch `main` first).
