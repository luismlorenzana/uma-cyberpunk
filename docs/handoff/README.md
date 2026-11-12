# Handoff: open work

> **Status: 2026-11-12, after D4.** The repo exists with its concept, its build plan, its story brief, its references,
> the world's first pass and its private-content guard. There is no code yet. The owner split the work (D4): **the
> story has its own session,** which writes the world and the story from [the story brief](../design/story-brief.md),
> and **this queue starts with the app and the combat testing,** on test content, so the story drops into a finished
> game. The world is now interplanetary: each lead Uma's Chapter 1 on her own world, then the ship as the hub.
>
> - **The design:** [the concept](../design/concept.md) (TC1–TC54, [page](../design/previews/concept.html)),
>   [the build plan](../design/build-plan.md) (BP1–BP9, [page](../design/previews/build-plan.html)),
>   [the story brief](../design/story-brief.md) (SB1–SB11, [page](../design/previews/story-brief.html)),
>   [the world's first pass](../design/world.md) (WD1–WD24, [page](../design/previews/world.html)) and
>   [the references](../design/references.md) ([page](../design/previews/references.html)).
> - **The manual of the game as built** will be [docs/game/](../game/README.md). It starts with CY3.
> - Each task is a self-contained packet in [tasks/](tasks/). Start a worker, Claude or ChatGPT, with uma-platform's
>   [master prompt](https://github.com/luismlorenzana/uma-platform/blob/main/docs/handoff/master-prompt.md) and name the
>   packet: "Take CY1".
> - Workers decide what a packet leaves open, record it, and flag their own packets done: delete the packet and add a
>   Done row below. Claude merges and deploys its own finished packets; ChatGPT merges its own.

Packet ids run CY1–CY12; decision numbers continue from D6.

## Phase 1: the foundation

| Id | What | Who | Size | Needs | State |
|---|---|---|---|---|---|
| CY2 | [The cloud](tasks/CY2-cloud.md) in the `uma-rpg` project: site `uma-cyberpunk`, Cloud Run `cyber-api`, Firestore `cyber`, the deploy job, with its cost table | Claude | M | CY1; the owner's go | Written |
| CY3 | [The hello app](tasks/CY3-hello-app.md): uma-quest's wiring, Google sign-in, save v1 synced, the update prompt, master data, the Home Screen | Claude | M | CY2; the owner's two sign-in entries | Written |

## Phase 2: the combat, tested three ways

Starts as soon as CY1 is in, beside the cloud.

| Id | What | Who | Size | Needs | State |
|---|---|---|---|---|---|
| CY4 | [The battle rules, core](tasks/CY4-battle-core.md): `@cyber/battle`, the map format, the rig, loadout, timeline, Charge, movement, attacks, counters, Crossfire, Cover, Rig Break, objectives, the forecast; golden replays | Claude | L | CY1 | Written |
| CY5 | [The battle rules, the rest](tasks/CY5-battle-rest.md): terrain states and terminals, Tech and the Holds, Back units, chance skills, items, Stride, the Steel Muster's cover and volley | Claude | L | CY4 | Written |
| CY6 | [The AI and the simulator](tasks/CY6-ai-and-simulator.md): enemy AI, ally Auto, the scenario format, `pnpm sim`, the first balance pass | Claude | M | CY5 | Written |
| CY7 | [The board on uma-stage](tasks/CY7-board.md): the game-owned scene from the stage's parts, its five checks, the stage requests | Claude | M | CY1 | Written |
| CY8 | [The sandbox](tasks/CY8-sandbox.md): the battle screen on the phone, the cut-in, autosave and resume, scenario files | Claude | L | CY3, CY6, CY7 | Written |

## Phase 3: the app, on test content

| Id | What | Who | Size | Needs | State |
|---|---|---|---|---|---|
| CY9 | [The story format and runner](tasks/CY9-story-runner.md): the parser, `pnpm story:check`, the stand-in, the loader, the scene player, save v2 | Claude | M | CY3 | Written |
| CY10 | [The ship and the mission flow](tasks/CY10-ship-and-flow.md): the rooms, the star map, a world's map, briefing to results, save v3 | Claude | L | CY8, CY9 | Written |
| CY11 | [The crew and the Hangar](tasks/CY11-crew-and-hangar.md): roster, profiles, loadouts, parts, roles, the bench | Claude | M | CY10 | Written |
| CY12 | [The Chapter 1 loop](tasks/CY12-chapter-one-loop.md): two stand-in worlds, two pickups, rooms opening, debriefs | Claude | M | CY10, CY11 | Written |

**Order:** the packets in number order, CY2 to CY12 (the owner, 2026-11-12, D5), so the cloud and the hello app come
first and every later packet can be checked on the phone ([the build plan §8](../design/build-plan.md#8-the-packets-bp8)).

## Later phases

Each phase's packets are written when it starts:

| Phase | What | Who | Needs |
|---|---|---|---|
| 4 | The first worlds: the story session's first world and its Chapter 1, then a second; master data's chibi sets, renders and the Ranker's standees; the story's private bucket, with its cost table; the first world's map kit | Claude; ChatGPT for the Combat Adult keys; Claude in uma-platform for the kit | Phase 3; the story session's items 1–3 ([SB9](../design/story-brief.md#9-what-you-deliver-and-when-sb9)) |
| 5 | Progression: levels, roles, licences, the Store, salvage and remodels, side jobs, the Sim Pod, the Call, talents | Claude | Phase 4 |
| 6 | Worlds as content waves, with their leads, factions and guests | Claude; ChatGPT | Phase 5; the story session's worlds |

## Story requests

The story session asks here for anything the game doesn't give it yet: a new mechanic, hook, room, talent or Hold
([SB10](../design/story-brief.md#10-how-the-two-sessions-work-together-sb10)). The game session answers in its next
packet, or says why not.

| # | Date | Asked | Answer |
|---|---|---|---|

## Across the repos

- **The story session** works in this repo from [the story brief](../design/story-brief.md). It starts with one line:
  "Read CLAUDE.md and docs/design/story-brief.md in ~/workspace/uma-cyberpunk, then take the story brief."
- **uma-platform:** P144 logs this repo as Phase 10. Shared changes go there as requests, never forks here:
  - **`uma-stage`:** CY7 files only what its checks prove, one at a time (TC48): likely tunable bloom and tilt-shift,
    glowing kit frames, a tactics kit kind cached by id, and a saver tier;
  - **the map kits** are drawn in code by Claude in a uma-platform session (`scripts/kit-art`, P147), from the story
    session's world outline, in Phase 4;
  - **the heroines' delivery** from the franchise boards and the Ranker's images (TC7, TC12), when Phase 4 needs its
    first;
  - **a fourth Uma Story book,** when the owner wants the story readable beside the others (TC13).
- **uma-rpg:** CY2 adds this game's pieces to its project, touching none of the other apps' pieces.
- **The Character Art Studio** already has an "Uma Cyberpunk: Combat Adult Character" category (P143). ChatGPT's art
  for this game starts there: each Uma in her rig, side-on, facing left, for the cut-in (TC12, TC28).

## The owner's steps

| When | What |
|---|---|
| Now | Read [the story brief](../design/previews/story-brief.html) and [the build plan](../design/previews/build-plan.html) pages, and the D4 changes in [the concept](../design/previews/concept.html); silence keeps them as written. Then hand the story session its one line (above) |
| CY2 | The go for the cloud, on its cost table |
| CY3 | The two sign-in entries for `uma-cyberpunk.web.app` (the packet names the pages); then the phone check: install, sign in, see the save sync |
| CY8 | One play of the sandbox on the phone |
| CY12 | One play-through of the Chapter 1 loop on the phone |

## Done

Packets finished go here, newest first.

| Id | Task | Commit |
|---|---|---|
| CY1 | The workspace and its checks (D5): pnpm 10.33.0 and turbo; `@cyber/web`, `@cyber/api` and `@cyber/domain`, installing uma-data 1.5.0, uma-kit 0.19.0, uma-work 0.1.0, uma-server 0.2.0, uma-art 2.27.0 and uma-stage 0.3.0 with three 0.187.0; lint, tests, build, the 180 KB size check (69.4 KB, three.js marked lazy) and the private-content guard; CI's verify job. Locally with the guard on: health 200, save 401; the page and its proxied health on :5214 | `f2cc71b` |

## How a packet reads

Each packet stands alone:
- **Why** the work matters;
- **Context:** what to read and what exists;
- **Decisions made:** the decisions already taken;
- **Do:** the work;
- **Done when:** checks anyone can run;
- **Deliver:** the commit or pull request, and how to flag it done.

A worker decides anything a packet leaves open, records it under Decisions, and logs the packet's D-decision in
[decisions.md](../decisions.md) (fetch `main` first for the number).
