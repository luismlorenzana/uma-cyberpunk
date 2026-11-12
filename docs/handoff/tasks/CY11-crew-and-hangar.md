# CY11 — The crew and the Hangar

**uma-cyberpunk · Claude · M · Needs: CY10 · Unblocks: CY12**

## Why

The rig is the game's heart (TC17, TC18): what an Uma carries decides how she fights. Until now the sandbox set
loadouts by hand. This packet gives the crew a home aboard: a roster, each Uma's profile, and the Hangar where her rig
is built, saved and swapped. After it, the squad that deploys in CY10's flow is the crew's own, wearing what the player
chose.

## Context (read first)

- [The concept](../../design/concept.md): TC4 (§4.3, the bands), TC5 (§4.8, roles), TC17–TC19 (§4.4–4.5, the rig, the
  loadout, weapons), TC27 (§4.10, Strain), TC45 and TC46 (§3, the crew and Stride), TC42 (§6, the rooms).
- [The build plan](../../design/build-plan.md): §2.3, BP1 (the one master-data adapter lives in `@cyber/domain`).
- What exists: CY4–CY5's rules (`@cyber/battle`'s rig, parts, Load and Capacity, roles, Stride), CY10's ship with the
  Hangar and Quarters as placeholders, save v3 with `crew`.
- **The siblings to copy or follow** (copy, never import):
  - **Roster:** `uma-kit/roster` and `/album` (`FaceTile`, `UmaBust`, `UmaChibi`, `AlbumGrid`, `UmaPicker`, imported),
    as `/Users/luismartinez/workspace/uma-farm/apps/web/src/loop/RosterPage.tsx`, `RosterAlbum.tsx` and
    `roster-view.ts` use them.
  - **Profile:** `/Users/luismartinez/workspace/uma-rpg/apps/web/src/places/stable/OutfitProfile.tsx` and
    `DetailsSheet.tsx`.
  - **Loadout:** uma-rpg's `apps/web/src/places/stable/GearTab.tsx`, `gear-equip.ts`, `PresetButton.tsx`, and
    `packages/domain/src/save/presets.ts` (per-class presets and a "best" auto-wear) with its tests.
- **Master data:** `uma-data` 1.5.0's outfits by `OutfitId`, their five stats at 5★, and the `outfit-busts`,
  `outfit-faces` and `outfit-chibis` image families. A sister shares her base Uma's character id, so the crew is keyed
  by outfit id.

## Decisions made

- **The crew** is save v3's `crew`: outfit ids aboard, each with her level, role, loadouts and Strain. When master data
  hasn't loaded (offline first boot, tests), each Uma shows as a stand-in card with her id; nothing breaks.
- **Her profile** shows: her bands (from the one adapter in `@cyber/domain`, TC4) with each band's combat and rig job,
  her role and its Back unit, her Stride (from her best running style, TC46), her level, and her Strain with the bench
  rule (TC27).
- **Her default role** comes from the story's authored tag when the casting has one (TC5), else from her running style
  with ties to the earlier style. The stand-in casting tags its invented leads.
- **The Hangar** (the room's page):
  - eight slots and a Coat (Core, Left arm, Right arm, Legs, Back unit, Visor, Left hand, Right hand, Coat);
  - a **Capacity bar** against the total Load; over Capacity, she can't deploy, and the deploy screen says why;
  - the **+1 Move** mark at 70% load or less;
  - **stat changes shown before a swap:** part HP, Move, Capacity left, hit and damage for her weapons;
  - **saved loadouts:** three per Uma, named by the player;
  - **"Best for her role"** in one tap, from the parts owned, never over Capacity.
- **The rules stay in `@cyber/battle`.** The Hangar calls its Load, Capacity and Move functions; it never recomputes
  them.
- **A starter parts table** in `@cyber/domain` (`parts/starter.ts`): about 30 parts with original names (cores, arms,
  legs, the five Back units, visors, weapons in the four bands, the three Coats), enough for every role. It's ours, so
  it's in git. Shops, salvage and remodels are Phase 5.
- **Role change** happens aboard, in her profile, and swaps her Back unit to the new role's starter if she owns none.
- **Quarters** lists the crew with their Strain and who's benched next mission; optional scenes stay for later.

## Do

1. `@cyber/domain`: the crew record in save v3 (levels, roles, loadouts, Strain), the starter parts table, presets
   and "best for her role", each with tests (never over Capacity; a role's best always carries its Back unit).
2. The roster on `uma-kit/album`, with stand-in cards when master data is missing.
3. The profile, with the bands, role, Stride, level and Strain.
4. The Hangar: the slots, the Capacity bar, the swap preview, saved loadouts and "best for her role".
5. Role change, and Quarters' bench list.
6. Wire deploy (CY10) to the crew's saved loadouts, and block an over-Capacity Uma with the reason.
7. Write `docs/game/crew.md` (the crew, bands, roles, Stride, Strain) and `docs/game/hangar.md` (slots, Capacity,
   Load, loadouts, the starter parts as a generated list).

## Done when

- `pnpm lint && pnpm test && pnpm build` pass, and the size check stays under 180 KB.
- The domain tests cover: the bands from 5★ stats, the default role (tag, then running style, ties to the earlier
  style), Capacity and the +1 Move threshold through `@cyber/battle`, "best for her role" never over Capacity.
- Locally: the roster shows the stand-in crew; a loadout built in the Hangar is the one the battle uses after deploy;
  an over-Capacity Uma can't deploy and the screen says why; a reload keeps every loadout.
- `docs/game/crew.md` and `docs/game/hangar.md` name no outfit or character.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(crew): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
