# CY19 — The life-aboard loop

**uma-cyberpunk · Claude · M · Needs: CY13–CY18 · Unblocks: Phase 5 (the first worlds)**

## Why

Phase 4's exit (D20, TC74): several stops of ship life play end to end on the stand-in, and the battle feels each
system. CY12 proved the Chapter 1 loop; this packet proves the life between battles: bonds rising, a cabin decorated,
duties producing, a module built and researched, a squad on an operation, the battle changed by all of it, and resume
at every point.

## Context (read first)

- [Life aboard](../../design/life-aboard.md) §9 (TC74's exit), §8 (TC72: aboard up to five minutes, all optional).
- What exists after CY18: everything life aboard builds; CY12's headless loop test (`apps/web/src/mission/loop.test.ts`)
  as the model; the stand-in story (`packages/domain/src/story/stand-in.ts`).

## Decisions made

- **The stand-in grows** to exercise every system once more: bond scenes and tastes for all four invented Umas, a
  third small world reached by a capability key, two operations, an event pool, a canonical squad, a finale with two
  readiness conditions. Invented ids and plain labels only; in git.
- **A headless loop test** plays a new game through the stand-in on fixed seeds with auto-played battles, as CY12's does,
  and at each stop: assigns duties (auto), makes three visits (a talk, a gift, a decoration), builds or researches when it
  can afford to, sends an operation when a squad is free, and powers the systems the next map wants. It asserts that
  ranks rise and a rank-8 path is chosen, a cabin reaches Comfort 3, the ship log pays every watch, a module and a
  project finish, an operation reports, standing moves, the finale's conditions follow readiness, and every save round-
  trips through JSON and the parser.
- **Time aboard:** the test measures the taps a stop takes with auto-assign and three visits, against TC72's five
  minutes (estimated at the scene check's pace); a stop with no input needs none.
- **The battle feels it:** a pair of simulator runs on the same seeds, bare and life-aboard, shows the difference stays
  within CY17's targets.
- **Resume:** reloads mid-visit, mid-build, mid-operation and mid-battle each reopen where they were (a visit's scene
  from its start).

## Do

1. Extend the stand-in and pass `pnpm story:check`.
2. The headless life-aboard loop test, with the measures above.
3. Fix any gap the loop finds in CY13–CY18, in this packet's commit, and say so in the decision.
4. A play-through in the preview pane; update `docs/game/` pages the loop touches and the manual's index.
5. Phase 4's exit in [the handoff](../README.md): the owner's step below.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; `pnpm story:check` passes on the stand-in.
- The loop test passes, and its measures meet the targets.
- Locally and on the deployed app: several stops of ship life play end to end; every reload resumes where it was.
- `git status` shows no `content/`.

## The owner's step

One play on the phone of a few stops of ship life (about thirty minutes): visits, decorating, duties, a build, an
operation and two battles. Ask for it in one line, with the link to the deployed app.

## Deliver

Commit to `main` (Conventional Commits, `feat(aboard): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first). Phase 5's packets are
written when the story session's base elements land.
