# CY18 — Squads, operations and faction standing

**uma-cyberpunk · Claude · M · Needs: CY16, CY17 · Unblocks: CY19**

## Why

The owner wants the game to lean on "Squads and Factions and so on and a big overall plot" (D20). This packet organizes
the crew into named squads that grow cohesion, lets squads that aren't deployed run operations on the star map, and
gives each faction a standing with the ship, all of it adding up to the readiness a finale will test.

## Context (read first)

- [Life aboard](../../design/life-aboard.md) §7 (TC69: squads and cohesion; TC70: operations; TC71: faction standing,
  readiness) and §5.3's readiness conditions (TC64).
- [The research](../../design/research-life-aboard.md): Mass Effect 3's war assets, XCOM 2's covert actions, Girls'
  Frontline's logistics, and the pitfalls (locks, failure risk, real-time timers).
- What exists after CY17: the watch, the wallet, posts and the ship log (CY16), rules version 3 with perks and
  partners, the deploy screen, the star map and world maps (`apps/web/src/ship/RoomPage.tsx`), the story's worlds and
  factions (`packages/domain/src/story/types.ts`: a world's `factions`; casting `heroines` by faction).

## Decisions made

- **Squads** (TC69): up to four, each `{ id, name, banner, leader, members }`, four members and an optional guest; an
  Uma in one squad at a time or none. A new game makes one squad from the crew aboard. The deploy screen picks a squad (or
  an ad hoc four); the Quarters show squads as rows.
- **Cohesion:** +1 a battle the same squad fights together (three or more of its members deployed), to level 5 at 2, 5,
  9, 14 and 20 battles. Perks enter the battle input as `cohesion` (rules version 3 gains it): level 1 the leader +1
  Charge at the start; level 3 Crossfire reach +1 for members; level 5 one free Cover per member. The simulator checks
  it stays small.
- **Canonical squads:** the casting's new `squads` (`[{ id, name, banner, leader, members }]`) seed squads when their
  members come aboard; the player renames any.
- **Operations** (TC70): Comms lists two to four at a time on visited worlds, each `{ world, danger, watches, reward,
  needs }` from a generic table plus the story's `operations` in a world file. Send a squad (its members can't deploy in
  missions while away; they still hold posts at half). It returns after its watches; success is deterministic: the
  squad's power (levels, cohesion, partners, bond ranks in a fixed formula) against the danger gives full, partial or
  thin rewards; partial and thin add 1 Strain each. Never anyone lost. A report card in the ship log.
- **Faction standing** (TC71): each faction in the story pack has a standing from −2 (hostile) to +2 (allied), starting
  at the story's value (default −1). It moves by story steps (a new step `standing: { faction, by }`), by operations
  that name a faction, and by freeing its heroines (+1 at three freed). Standing opens operations, Store stock and
  guests (each with a `standing` key in `needs`: `standing:<faction>:<level>`).
- **Readiness:** the Bridge shows one meter for the next finale: faction standings, operations won and the battle
  systems built add points to a total (a domain table). A story mission marked `finale` names readiness conditions
  (`readiness: [{ system | standing | total, else: condition }]`), and the briefing lists them; each unmet one adds its
  harsh condition to the battle input (fog, a hull breach hazard tile set, no reinforcements). Never permadeath.
- **Save v10:** `squads`, `operations: [{ id, squad, back }]`, `standing: Record<faction, number>`; cohesion on each
  squad. v9 migrates on the device: one squad of the crew aboard, no operations, standings from the story's defaults,
  `account.updatedAt` untouched.

## Do

1. `@cyber/domain`: squads, cohesion, operations (the table, the formula, the outcomes), standing, readiness and
   finale conditions; save v10 and its migration; tests.
2. `@cyber/battle`: cohesion perks and the readiness conditions (fog, hazard tiles, no reinforcements) in rules
   version 3; tests; the simulator's check.
3. The director and the screens: squads on the Quarters and the deploy screen; Comms' operations, sending and the
   report; standing on the Log's faction Files and the Bridge; the readiness meter and a finale briefing's conditions.
4. The story format: `squads`, a world's `operations`, the `standing` step, `standing:` keys, a mission's `finale` and
   `readiness`; the parser, the check, the stand-in (a canonical squad, two operations, a standing step, a finale with
   two conditions).
5. Write `docs/game/squads.md` (squads, cohesion, operations, standing, readiness, the save) with its page.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; the simulator shows cohesion's effect stays within its target.
- The migration test passes with `account.updatedAt` unchanged.
- Locally: a squad is named and fights to cohesion 1; a second squad runs an operation over two watches and reports; a
  standing step moves a faction; the stand-in finale's briefing lists its conditions and an unmet one changes the map; a
  reload keeps it all.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(squads): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
