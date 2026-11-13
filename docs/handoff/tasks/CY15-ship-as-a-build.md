# CY15 — The ship as a build

**uma-cyberpunk · Claude · L · Needs: CY14 · Unblocks: CY16, CY17**

## Why

The owner wants the ship to be "a huge part of the gameplay" (D20). This packet turns CY10's fixed cutaway into a ship
the player builds: decks of module slots, rooms with three levels, the battle systems installed and powered per sortie,
a wallet that missions pay into, building over watches, and the Lab's research. Duties at the rooms' posts follow in
CY16; the battle systems' Orders and passives in CY17.

## Context (read first)

- [Life aboard](../../design/life-aboard.md) §5.1 (TC62: decks, modules, rooms, the battle systems, install everything
  and power a few), §5.2 (TC63: research), §5.5 (TC66: the ship opening the map), §4.1 (cabins and berths).
- [The research](../../design/research-life-aboard.md) §1: XCOM 2's Avenger, FTL, Starfield, Suikoden, Valkyria
  Chronicles 4, and the pitfalls (upkeep, trap modules, walking hubs).
- What exists: the ship screen and its cutaway (`apps/web/src/ship/ShipScreen.tsx`, `LAYOUT`), the rooms
  (`packages/domain/src/ship/rooms.ts`: the seven, `OPEN_FROM_START`, `roomsOpenedBy`), the room page
  (`apps/web/src/ship/RoomPage.tsx`), the mission results and `rewards()` (`apps/web/src/mission/director.ts`), the
  deploy screen (`apps/web/src/mission/MissionScreen.tsx`), the watch (CY13), cabins (CY14).

## Decisions made

- **The hull** (TC62): decks of slots; two decks of four at a new game. The cutaway draws each deck as a row and each
  module as a panel in its slot, its level shown as one to three bars and a lit edge, all in SVG drawn in code (ours).
  One screen: a tap opens a room's quick look, a long press or **Build** opens the build sheet.
- **Modules:** a table in the domain (`ship/modules.ts`): each room and battle system with its width (one or two slots),
  its three levels' costs and watches, what each level adds, its posts per level (used in CY16), and whether it's a
  **room** (always runs) or a **battle system** (costs pips when powered). The seven existing rooms are modules already
  placed; eight rooms (Lab, Med Bay, Galley, Observation Deck, Workshop, Garden, Guest Wing, Engineering) and five
  systems (Battery, Sensors, Shield Projector, Drone Bay, Engines) can be built.
- **Who opens what:** a room or system can be built once it's **unlocked**: from the start (Engineering, the Lab, the
  Galley), by a lead's `opens` (TC49, as today, now naming any module), or by research. Placing it needs a free slot.
- **The wallet:** `credits`, `alloy`, `data` in the save. Results pay what they show today (credits) plus Alloy (the
  salvage number) and Data (5 a battle, 10 a win), and the ship-log shows it. No upkeep, ever.
- **Building:** pay the cost, the module is **under construction** for its watches (one to three), then done. One build
  at a time at Engineering level 1, two at level 3; CY16's engineers make it a watch faster.
- **Decks:** a third and a fourth deck come from research (Hull I and II) or a story refit (a scene's new step `refit`,
  live in the format); decks widen to six slots with Hull III.
- **Power:** Engineering's reactor has pips (3 at level 1, 5 at 2, 7 at 3, more from research). **Before each sortie**
  the deploy screen shows the installed battle systems with their pip costs and the reactor's pips; the player toggles
  which are powered; the choice goes into the battle's frozen input as `systems` (played by the rules in CY17; this
  packet records it and shows it).
- **Quarters:** the Quarters module's level sets cabins: level 1 shared berths (two Umas a cabin, sharing slots), level
  2 private cabins for the crew's first twenty, level 3 for all. Berths never block a visit.
- **The Lab** (TC63): one project at a time from a domain table (`ship/research.ts`) in four branches (Ship, Rigs,
  Tactics, Quarters); each costs Data and takes watches; first pass about sixteen projects (Reactor I–III, Hull I–III,
  module level 3 for each family, private cabins, new furniture lines, and three Tactics projects CY17 consumes).
- **The map by capability** (TC66): a world's or location's `needs` can name `ship:<capability>` (`drive-2`, `storm`,
  `sensors`); the star map and world map show the key in words ("Needs the storm shielding"). The stand-in gains one
  such location.
- **Save v7:** `ship` grows from `{ rooms }` to `{ decks, modules: [{ id, deck, slot, level, building }], unlocked,
  powered, research: { done, current } }`; the save gains `wallet`. v6 migrates on the device: the open rooms placed on
  two decks in a fixed order at level 1, a starter wallet, nothing researched, `account.updatedAt` untouched.

## Do

1. `@cyber/domain`: modules, the hull, building over watches, unlocks, power and pips, research, capability keys, the
   wallet; save v7 and its migration; tests (placing, a two-slot module, a build finishing after its watches, power over
   the reactor refused, research unlocking a module, the migration).
2. The director: the wallet paid at results; the watch finishing builds and research; the deploy screen's power choice
   into the battle input.
3. The screens: the ship's deck cutaway with modules and levels, the build sheet (costs, watches, what it adds), the Lab,
   the wallet on the ship, the power toggles on deploy.
4. The story format: `refit` step, `ship:` keys in `needs`; the parser, the check and the stand-in (a refit in Lead B's
   chapter, a storm-shielded location).
5. Write `docs/game/ship-build.md` (decks, modules, levels, building, power, the Lab, the map by capability, the
   wallet, the save; the module and project tables generated from the code) with its page; update `ship.md`.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; the size check stays under 180 KB.
- The migration test passes with `account.updatedAt` unchanged.
- Locally: missions fill the wallet; a Galley is placed and built over two watches; Engineering's upgrade adds pips;
  the deploy screen powers two systems within the pips and refuses a third; a research project finishes and unlocks a
  module; Lead B's refit adds a deck; a storm-shielded location names its key; a reload keeps it all.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(ship): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
