# CY12 — The Chapter 1 loop on the stand-in

**uma-cyberpunk · Claude · M · Needs: CY10, CY11 · Unblocks: Phase 4 (the first worlds)**

## Why

The owner's structure is *Octopath Traveler*'s: each lead Uma's Chapter 1 plays on her home world, and finishing it
brings her aboard the ship, which then travels on to pick up the next (TC51). This packet proves that loop end to end,
twice, on invented content, so the story session's first world drops into a finished game. It's Phase 3's exit.

## Context (read first)

- [The concept](../../design/concept.md): TC51 (§5, lead Umas, Chapter 1s, interjection slots, debriefs), TC49 (§6,
  the ship grows), TC50 (the maps), TC34 (keys and the Log), TC36 (the first battle within two minutes), and §9's
  Phase 3 exit check.
- [The story brief](../../design/story-brief.md): §5 (what Octopath teaches) and §8 (the content contract, its step
  kinds `slot`, `aboard`, `join`).
- [The build plan](../../design/build-plan.md): §6 and §7.
- What exists: CY9's format, parser, `pnpm story:check`, stand-in world and scene player; CY10's ship, maps, flow and
  save v3; CY11's crew, profiles and Hangar.

## Decisions made

- **Two stand-in worlds and two invented leads,** extending CY9's stand-in. Invented ids only (as uma-farm's
  9000001–9000003), no names from any game: generic labels such as "Lead A" and "World A". Each world has a few
  locations, one Chapter 1 of one or two battles and a short debrief. They're ours and nameless, so they're in git.
- **The loop:**
  1. **A new game** opens on World A with Lead A and a starting squad of stand-in crew; the first battle starts within
     two minutes (TC36).
  2. **Lead A's Chapter 1:** scenes and one or two battles, Lead A fixed in the squad (TC51).
  3. **She comes aboard** (`aboard`), at the squad's level, never level 1.
  4. **The ship:** her joining opens a room (TC49); the stand-in casting names which.
  5. **The Bridge:** World B appears on the star map; travel there.
  6. **Lead B's Chapter 1,** then the second pickup and its room.
- **What the loop shows on the way:**
  - every node's danger level, and a locked node's key in words, on both worlds' maps (TC34, TC50);
  - **interjection slots:** in Lead B's Chapter 1, Lead A's line plays when she's in the squad, the fallback when not
    (TC51);
  - **the debrief aboard** after each chapter, replayable from the Log's Timeline;
  - a crew Uma joining through a chapter (`join`), so both kinds of arrival are proven (TC45).
- **Chapter 1s never run back to back** in the real game (TC51); the stand-in is too small to show it and doesn't try.
- **No new systems.** If the loop needs one, it's a gap in CY9–CY11: fix it there, in this packet's commit, and say so
  in the decision.

## Do

1. Extend the stand-in in git: World B, Lead B, both Chapter 1s with an interjection slot each, both debriefs, a
   `join`, and the casting entries (which lead opens which room, each lead's role tag). `pnpm story:check` passes.
2. The new-game path: World A's opening straight into Lead A's Chapter 1.
3. `aboard`: the lead joins the crew at the squad's level and opens her room; the Continue card and the Bridge show
   what's next.
4. A headless test that plays the whole loop through the director (CY10) on fixed seeds and auto-played battles: both
   pickups happen, both rooms open, both debriefs land in the Timeline.
5. Update `docs/game/story.md` (Chapter 1s, pickups, interjection slots, debriefs) and `docs/game/ship.md` (rooms
   opening with leads).

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; `pnpm story:check` passes on the stand-in.
- The headless loop test passes.
- Locally and on the deployed app: a new game reaches its first battle in under two minutes; World A's Chapter 1 plays
  to Lead A coming aboard; a room opens; the Bridge travels to World B; Lead B's Chapter 1 plays with Lead A's
  interjection when she's in the squad; Lead B comes aboard and her room opens; both debriefs replay from the Log.
- Closing the app at any point and reopening it resumes there (CY10).
- **Phase 3's exit check** (concept §9) holds: a test lead's Chapter 1 plays from the ship to her world and back,
  brings her aboard, and resumes after iOS closes the app.
- `git status` shows no `content/`.

## The owner's step

One play-through on the phone, from a new game to the second pickup (about twenty minutes). Ask for it in one line,
with the link to the deployed app.

## Deliver

Commit to `main` (Conventional Commits, `feat(story): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first). Phase 4's packets are
written when the story session delivers its first world.
