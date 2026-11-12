# Handoff: open work

> **Status: 2026-11-12, after D3.** The repo exists with its concept, its references, its world bible and its
> private-content guard. There is no code yet. The owner's direction (D3) reshaped the concept: Front Mission's rigs on
> Triangle Strategy's boards, a world from 13 Sentinels and Star Guardian, the eight franchises as enemy factions.
> **The next phase is still Phase 1: the workspace, the cloud and the hello app** ([the concept](../design/concept.md#9-phases-tc15)).
>
> - **The design:** [the concept](../design/concept.md) (TC1–TC48, [page](../design/previews/concept.html)),
>   [the world](../design/world.md) (WD1–WD24, [page](../design/previews/world.html)) and
>   [the references](../design/references.md) ([page](../design/previews/references.html)).
>
> - **The manual of the game as built** will be [docs/game/](../game/README.md). It starts with CY3.
> - Each task is a self-contained packet in [tasks/](tasks/). Start a worker, Claude or ChatGPT, with uma-platform's
>   [master prompt](https://github.com/luismlorenzana/uma-platform/blob/main/docs/handoff/master-prompt.md) and name the
>   packet: "Take CY1".
> - Workers decide what a packet leaves open, record it, and flag their own packets done: delete the packet and add a
>   Done row below. Claude merges and deploys its own finished packets; ChatGPT merges its own.

## Phase 1: the workspace, the cloud and the hello app

Packet ids start at CY1; decision numbers continue from D4.

| Id | What | Who | Size | Needs | State |
|---|---|---|---|---|---|
| CY1 | [The workspace and its checks](tasks/CY1-workspace.md): placeholders installing the six platform packages, CI, ports 8121 and 5214 | Claude | S | The owner's six package-access entries, for CI | **Ready** |
| CY2 | The cloud in the `uma-rpg` project: site `uma-cyberpunk`, Cloud Run `cyber-api`, Firestore `cyber`, the deploy pipeline (TC11, D2) | Claude | M | CY1; the owner's go on its cost table | Packet written after CY1 |
| CY3 | The hello app: uma-rpg's stack, Google sign-in, save v1 synced, the update prompt, the Home Screen | Claude | M | CY2; the owner's two sign-in entries | After CY2 |

**Order:** CY1 can start now. CY2 follows CY1 and the owner's go. CY3 follows CY2.

## Later phases

Each phase's packets are written when it starts, from [the concept](../design/concept.md):

| Id | What | Who | Needs |
|---|---|---|---|
| CY4 | Phase 2, the stage spike: a game-owned battle scene from `uma-stage`'s parts (TC10): a 14 × 14 grid with heights at the fixed 35° in landscape, tile picking at about 24 pt, game-side range overlays, tilt-shift and bloom with battery saver off, about thirteen figures live, how much heights hide. It files only the stage requests it shows are needed (TC48). If it fails, the fallback board is a Phaser 4 isometric scene | Claude | CY3 |
| CY5–CY6 | Phase 2, the battle prototype: the battle rules as a pure domain package with tests (the rig, Charge, the timeline, counters, Crossfire, facing, height, terrain, Rig Break, Jack-Out: TC3–TC5, TC17–TC27), then one Underlevels map, four against the Steel Muster, on stand-ins | Claude | CY4 |
| — | Phase 3, Act I's opening: the flash-forward, the first Operation and the first route chapter; the Hideout's Workshop and Archive; the story runner; the first batch from master data on chibi sets, renders and standees (TC12) | Claude; ChatGPT for the Combat Adult keys and kits | Phase 2 |
| — | Phase 4, progression and the Ring's map: levels, roles, licences, the Shop, salvage, contracts, the Sim Pod, the Call; Phase 5, Acts II–V as content waves with their factions and guests | Claude; ChatGPT | Phase 3 |

## Across the repos

- **uma-platform:** P144 logs this repo as Phase 10. Shared changes go there as requests, never forks here:
  - **`uma-stage`:** CY4 files only what its spike needs, from TC48's seven (a grid stage, heights 0–3, overlays, a
    tactical camera, glowing frames and tunable effects, rain, a battery-saver tier of effects);
  - **the heroines' delivery** from the franchise boards and the Ranker's images (TC7, TC12), when Phase 3 needs its
    first;
  - **a fourth Story App book,** when the owner wants the story readable beside the others (TC13).
- **uma-rpg:** CY2 adds this game's pieces to its project and its cloud plan's isolation matrix, touching none of the
  other apps' pieces.
- **The Character Art Studio** already has an "Uma Cyberpunk: Combat Adult Character" category (P143). ChatGPT's art
  for this game starts there: each Uma in her rig, side-on, facing left, for the cut-in (TC12, TC28).

## The owner's steps

| When | What |
|---|---|
| Now | Read [the concept](../design/previews/concept.html), [the world](../design/previews/world.html) and [the references](../design/previews/references.html) pages and say what to change; silence keeps TC1–TC48 and WD1–WD24 as written |
| For CY1's CI | On GitHub, for `uma-data`, `uma-kit`, `uma-work`, `uma-server`, `uma-art` and `uma-stage`: Package settings → **Manage Actions access** → add `uma-cyberpunk` with **Read** |
| CY2 | The go for the cloud; then the two sign-in entries for `uma-cyberpunk.web.app` in the Cloud console |
| CY3 | The phone check: install, sign in, see the save sync |

## Done

Packets finished go here, newest first.

| Id | Task | Commit |
|---|---|---|

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
