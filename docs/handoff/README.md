# Handoff: open work

> **Status: 2026-11-12, after D2.** The repo exists with its concept and its private-content guard. There is no code
> yet. **The next phase is Phase 1: the workspace, the cloud and the hello app** ([the concept](../design/concept.md#8-phases)).
>
> - **The manual of the game as built** will be [docs/game/](../game/README.md). It starts with CY3.
> - Each task is a self-contained packet in [tasks/](tasks/). Start a worker, Claude or ChatGPT, with uma-platform's
>   [master prompt](https://github.com/luismlorenzana/uma-platform/blob/main/docs/handoff/master-prompt.md) and name the
>   packet: "Take CY1".
> - Workers decide what a packet leaves open, record it, and flag their own packets done: delete the packet and add a
>   Done row below. Claude merges and deploys its own finished packets; ChatGPT merges its own.

## Phase 1: the workspace, the cloud and the hello app

Packet ids start at CY1; decision numbers continue from D3.

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
| CY4 | Phase 2, the stage spike: a tile grid with height on `uma-stage`, tile picking, the tactical camera and the turn timeline (TC10). If it fails, the fallback board is a Phaser 4 isometric scene | Claude | CY3 |
| CY5–CY6 | Phase 2, the battle prototype: the battle rules as a pure domain package with tests (TC3–TC5), then one map, four against four, on stand-ins | Claude | CY4 |
| — | Phase 3, the first chapter: the Hideout, three missions, the story runner, the first squad from master data, the first art | Claude; ChatGPT for character art and kits | Phase 2 |
| — | Phase 4, progression and the map of districts and stations; Phase 5, content waves with guest heroines | Claude; ChatGPT | Phase 3 |

## Across the repos

- **uma-platform:** P144 logs this repo as Phase 10. Shared changes (a grid mode for `uma-stage`, kit pieces, the guest
  rosters' delivery from the franchise boards, TC7) go there as requests, never forks here.
- **uma-rpg:** CY2 adds this game's pieces to its project and its cloud plan's isolation matrix, touching none of the
  other apps' pieces.
- **The Character Art Studio** already has an "Uma Cyberpunk: Combat Adult Character" category (P143). ChatGPT's art
  for this game starts there.

## The owner's steps

| When | What |
|---|---|
| Now | Read [the concept page](../design/previews/concept.html) and say what to change; silence keeps TC1–TC16 as written |
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
