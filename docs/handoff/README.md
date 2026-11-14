# Handoff: open work

> **Status: 2026-11-13, after D26: CY15 is done (the ship as a build: decks, modules, the wallet, power, the Lab; save v7); CY16 is next.** After D25: CY14 is done (cabins, decor, visits; save v6; the approved looks served to the game). After D24: sprites are for combat only, as chibis, and ChatGPT's image request is written ([the combat sprites request](../design/combat-sprites-request.md)), with the Story Sandbox's Sprites page for reviewing the sheets. After D22: CY13 is done. After D21: Phase 4's packets are written (CY13–CY19, below). After D20: [life aboard](../design/life-aboard.md) is designed (the captain, bonds, cabins, duties, the ship as a build, squads and factions; TC55–TC74, a new Phase 4), with [the story session's open brief](../design/story-brief-life-aboard.md). After D17: the [Cyberpunk Story Sandbox](../design/story-sandbox.md) is built (`pnpm stories`, :4322). 2026-11-12, after D16: CY1–CY12 are done: Phases 1–3's code is complete and every push to `main` deploys
> to [uma-cyberpunk.web.app](https://uma-cyberpunk.web.app). What's left of Phases 2 and 3 is the owner's: the steps
> below (the sandbox play is Phase 2's exit, the Chapter 1 play-through Phase 3's). **Phase 4's packets are written when
> the story session delivers its first world** ([SB9](../design/story-brief.md#9-what-you-deliver-and-when-sb9)). The owner split the work (D4): **the story has its own session,** which writes the world
> and the story from [the story brief](../design/story-brief.md), and **this queue builds the app and the combat
> testing,** on test content, so the story drops into a finished game. The world is now interplanetary: each lead Uma's Chapter 1 on her
> own world, then the ship as the hub.
>
> - **The design:** [the concept](../design/concept.md) (TC1–TC54, [page](../design/previews/concept.html)),
>   [the build plan](../design/build-plan.md) (BP1–BP9, [page](../design/previews/build-plan.html)),
>   [the story brief](../design/story-brief.md) (SB1–SB11, [page](../design/previews/story-brief.html)),
>   [the world's first pass](../design/world.md) (WD1–WD24, [page](../design/previews/world.html)) and
>   [the references](../design/references.md) ([page](../design/previews/references.html)).
> - **The manual of the game as built** is [docs/game/](../game/README.md), from CY3's [app as built](../game/architecture.md).
> - Each task is a self-contained packet in [tasks/](tasks/). Start a worker, Claude or ChatGPT, with uma-platform's
>   [master prompt](https://github.com/luismlorenzana/uma-platform/blob/main/docs/handoff/master-prompt.md) and name the
>   packet: "Take CY1".
> - Workers decide what a packet leaves open, record it, and flag their own packets done: delete the packet and add a
>   Done row below. Claude merges and deploys its own finished packets; ChatGPT merges its own.

Packet ids run CY1–CY19; decision numbers continue from D27.

## Phase 1: the foundation

Done: see the Done table.

## Phase 2: the combat, tested three ways

Done (CY4–CY8); its exit is the owner's sandbox play (below).

## Phase 3: the app, on test content

Done (CY9–CY12); its exit is the owner's Chapter 1 play-through (below).

## Phase 4: life aboard, on test content

The captain, bonds, cabins, duties, the ship as a build, squads and factions ([life aboard](../design/life-aboard.md),
D20), built on the stand-in while the story session writes its base elements. In number order:

| Id | What | Who | Size | Needs | State |
|---|---|---|---|---|---|
| CY16 | [Duties, the ship log and travel events](tasks/CY16-duties-and-travel.md): posts, aptitude by thresholds, running style as tenure, mastery, chiefs, one ship-log card, auto-assign, event cards; save v8 | Claude | M | CY15 | Written |
| CY17 | [Bonds and the ship in battle](tasks/CY17-bonds-and-ship-in-battle.md): rules version 3: bond perks, Resonance, Orders, ship support, meals, partners and duo techniques; the balance pass; save v9 | Claude | L | CY13, CY15, CY16 | Written |
| CY18 | [Squads, operations and faction standing](tasks/CY18-squads-and-operations.md): squads and cohesion, operations, standing, readiness and finale conditions; save v10 | Claude | M | CY16, CY17 | Written |
| CY19 | [The life-aboard loop](tasks/CY19-life-aboard-loop.md): the stand-in extended, a headless loop test, resume everywhere; Phase 4's exit | Claude | M | CY13–CY18 | Written |

**Order:** the packets in number order, CY2 to CY12 (the owner, 2026-11-12, D5), so the cloud and the hello app come
first and every later packet can be checked on the phone ([the build plan §8](../design/build-plan.md#8-the-packets-bp8)).

## Later phases

Each phase's packets are written when it starts:

| Phase | What | Who | Needs |
|---|---|---|---|
| 5 | The first worlds: the story session's first world and its arcs on the D20 spine, then a second; master data's chibi sets, renders and the Ranker's standees; the story's private bucket, with its cost table; the first world's map kit | Claude; ChatGPT for the Combat Adult keys; Claude in uma-platform for the kit | Phase 4; the story session's base elements (SB13) and items 1–3 ([SB9](../design/story-brief.md#9-what-you-deliver-and-when-sb9)) |
| 6 | Progression and the ship's later systems: levels, roles, licences, the Store, salvage and remodels, side jobs, the Sim Pod, the Call, talents, boarding missions | Claude | Phase 5 |
| 7 | Worlds as content waves, with their leads, factions and guests | Claude; ChatGPT | Phase 6; the story session's worlds |

## Story requests

The story session asks here for anything the game doesn't give it yet: a new mechanic, hook, room, talent or Hold
([SB10](../design/story-brief.md#10-how-the-two-sessions-work-together-sb10)). The game session answers in its next
packet, or says why not.

| # | Date | Asked | Answer |
|---|---|---|---|

## Across the repos

- **The story session** works in this repo from [the story brief](../design/story-brief.md). **Its check is live (CY9):**
  `pnpm story:check` validates `content/stories/`. **Its review page is live (D17):** `pnpm stories` opens the
  [Cyberpunk Story Sandbox](../design/story-sandbox.md) on :4322, where the owner reads each layer and leaves verdicts. It starts with one line:
  "Read CLAUDE.md, docs/design/story-brief.md and docs/design/story-brief-life-aboard.md in ~/workspace/uma-cyberpunk, then take the story brief, starting with part two's base elements."
- **uma-platform:** P144 logs this repo as Phase 10. Shared changes go there as requests, never forks here:
  - **`uma-stage`:** one request at a time, each proven by the board's checks (TC48). **The first,**
    [tunable bloom and tilt-shift](../design/stage-requests/tunable-effects.md), shipped in uma-stage 0.5.0 (ST5, P156) and
    is pinned with the board's own values (D18). Queued behind it: glowing kit frames, a tactics kit kind cached by id, a lighter saver tier. Heights 0–3 aren't
    needed (level 3 builds);
  - **the cabins' furniture** as pixel art ([the furniture request](../design/art-requests/cabin-furniture.md), D25):
    48 items' icons and room-size pieces, drawn by Claude in a uma-platform session (`scripts/pixel-art`) and shipped in
    uma-art; code-drawn stand-ins until then. Handed to the uma-platform session 2026-11-13;
  - **the map kits** are drawn in code by Claude in a uma-platform session (`scripts/kit-art`, P147), from the story
    session's world outline, in Phase 4;
  - **the heroines' delivery** from the franchise boards and the Ranker's images (TC7, TC12), when Phase 4 needs its
    first;
  - **no Uma Story book:** the story is read in this repo's own [Story Sandbox](../design/story-sandbox.md) (D17);
    uma-platform's Story App is parked (its P150).
- **uma-rpg:** CY2 adds this game's pieces to its project, touching none of the other apps' pieces.
- **The Character Art Studio** already has an "Uma Cyberpunk: Combat Adult Character" category (P143). ChatGPT's art
  for this game starts there: each Uma in her rig, side-on, facing left, for the cut-in (TC12, TC28).

## The owner's steps

| When | What |
|---|---|
| D24 | Hand ChatGPT [the combat sprites request](../design/previews/combat-sprites-request.html) with the private prompts (`content/design/character-looks/combat-sprites-prompts.md`) and reference boards (`sprite-refs/`); it saves the sheets to `content/design/character-looks/combat-masters/`. Then look at each pilot's identity sheet (S1) when it's back, in the Story Sandbox's **Sprites** page (`http://127.0.0.1:4322/#/sprites`), which plays each sheet at the phone's size beside her chibi and flags what's off. The spec is [character-sprites](../design/previews/character-sprites.html) (LK1–LK14) |
| D20 | Read [life aboard](../design/previews/life-aboard.html) (the captain, bonds, cabins, duties, the ship, squads; TC55–TC74) and say what to change; silence keeps it. Then hand the story session its new line (above) to start [part two](../design/previews/story-brief-life-aboard.html): worldbuilding first |
| Earlier | Read [the story brief](../design/previews/story-brief.html) and [the build plan](../design/previews/build-plan.html) pages, and the D4 changes in [the concept](../design/previews/concept.html); silence keeps them as written. Then hand the story session its one line (above) |
| CY3 | The phone check (the OAuth entries are in, 2026-11-13): open [uma-cyberpunk.web.app](https://uma-cyberpunk.web.app) in Safari, add it to the Home Screen, open it from there, sign in, and see the ship; **Status** in the menu shows the save synced |
| CY7 | Open [uma-cyberpunk.web.app/board](https://uma-cyberpunk.web.app/board) on the phone, pan around, tap a unit: does it read at a glance? |
| CY8 | One play of the sandbox on the phone: open [uma-cyberpunk.web.app/sandbox](https://uma-cyberpunk.web.app/sandbox) from the Home Screen, pick tier 1's Umas for the squad (D19), play the test scenario to the end, and say in a line what felt wrong. **Phase 2's exit** |
| CY12 | One play-through on the phone, about twenty minutes: open [uma-cyberpunk.web.app](https://uma-cyberpunk.web.app) from the Home Screen; a new game goes straight into Lead A's Chapter 1; play it to her pickup and debrief, jump to sw2 from the Bridge, play Lead B's to hers, and close the app once mid-way to see it resume. Say in a line what felt wrong. **Phase 3's exit.** |

## Done

Packets finished go here, newest first.

| Id | Task | Commit |
|---|---|---|
| CY13 | The captain and bonds (D22): the captain screen and Account's panel, the watch, bonds 1–10 with rapport from battles, replies and the captain's choices, the catch-up, the story's gates, bond scenes with the `captain` and `path` steps, Trust or Heart at rank 8 (Friends only takes Trust), messages, the bond panel and the Log's Bonds tab; save v5; [the captain and bonds](../game/captain-and-bonds.md) in the manual | `381ca5b` |
| CY14 | Cabins, decor and visits (D25): the Quarters deck of doors, each cabin's six slots in a diorama with a world-tinted window, 30 pieces in six styles, 6 keepsakes and 12 gifts, Comfort's five lights and its Strain rules, tastes written or derived and revealed by visits, three visits a watch (talk, gift, decorating together, invitations from rank 4) with a result card and requests, theme kits, a first win's item; the approved looks served through `/api/content/looks/` (read-only, that folder only); save v6; [cabins](../game/cabins.md) in the manual; the furniture request | `891e50e` |
| CY15 | The ship as a build (D26): decks of module slots (two of five at a new game), 20 modules (rooms and battle systems) with three levels built over watches, unlocks from the start, leads and research, the wallet paid by results, the reactor's pips and the sortie's power choice into the battle input, the Lab's 21 projects, `ship:` keys and the `refit` step, berths by the Quarters level; save v7; [the ship as a build](../game/ship-build.md) in the manual | — |
| — | **The Cyberpunk Story Sandbox** (D17, no packet: the owner asked for "a third app"): `tools/story-sandbox/`, `pnpm stories` on :4322, the sibling of uma-quest's and uma-farm's. It reads `content/stories/` with the game's own parser and `pnpm story:check`'s findings, falling back to the stand-in; pages for the story's state and its five deliverables (SB9), worlds with their maps, chapters, the scene player (a squad picker for interjection slots, choices and Calls as picks, story changes as cards), the cast (leads, crew order, heroines by Hold, the Ranker's Umas by batch), the Log's Files, Leads, Anomalies and flags, Calls, Checks, Format and Notes; the owner's verdicts to `content/stories/reviews.json`. `pnpm stories:import-cast` builds the private cast pack (154 Umas, 833 heroines, pictures from uma-quest's pack). [Design](../design/story-sandbox.md) | this commit |
| CY12 | The Chapter 1 loop (D16): the stand-in's two worlds and two Chapter 1s, the headless loop test, debriefs on the ship and in the Timeline, slots that hear the real squad, newcomers at the squad's level, the map's available-means-playable rule, a new game straight into its first scene, the Continue card's four cases; story.md's loop and ship.md's rooms opening with leads. **Phase 3's code is done** | `4e4c1bb` |
| CY11 | The crew and the Hangar (D15): save v4 with each crew member's record, the master-data adapter (bands, Stride, the fallback role), the casting's `roles` tag, 32 starter parts, best for her role, role change, Strain and XP after a mission, the Quarters with profiles, the Hangar (slots, Capacity bar, swap preview, saved loadouts), deploy in the crew's own rigs; [the crew](../game/crew.md) and [the Hangar](../game/hangar.md) in the manual | `10764d4` |
| CY10 | The ship and the mission flow (D14): the ship as the home screen with seven rooms and their keys, the Bridge's star map and a world's node map, the Log's Timeline, Files and Anomalies, the director, briefing to deploy to battle to results to the scene aboard, resume at every step, save v3 with its migration; [the ship and the worlds](../game/ship.md) and [the mission flow](../game/missions.md) in the manual | `8f20d90` |
| CY9 | The story format and runner (D13): the strict parser, `pnpm story:check` (Uma Story's `checks.json`) and `pnpm story:pack`, the API's private pack and the web's loader with the stand-in, the runner and the scene player, `/story`, save v2 with the story state; [the story](../game/story.md) in the manual; the brief's §8 says the check is live | `78db2f6` |
| CY8 | The sandbox (D12): setup from scenarios with Copy, Paste and Save; the battle screen (timeline, two-tap move, the arc, the forecast card, reach, the terrain card, paper dolls, a DOM cut-in, enemy turns at double speed with Skip); autosave in its own local database with Resume and Restart; results with Retry; the test scenario on `underlevels-14`; [the sandbox](../game/sandbox.md) and battle.md's battle screen in the manual. Phase 2's exit waits on the owner's play | `1ed6a40` |
| CY7 | The board on uma-stage (D11): the scene from the stage's parts, sprites and standees with rings and wedges, TC29's overlays, picking, the pan, the fade, render on change; the bench at `/board` with `?debug`; the five checks (level 3 builds, 159 of 159 visible tops pick back, 13 figures at 41 draw calls, 120 and 30 fps on desktop, 9.2% hidden); the first stage request filed; [the board](../game/board.md) in the manual | `94a493a` |
| CY6 | The AI and the simulator (D10): one scorer for enemies and ally Auto, never idle, 0.2 ms a decision; the scenario format with three maps and seven stand-in scenarios; `pnpm sim` with its report and targets; the first balance pass (the mirror 50.6%, the Muster fight 49.0%, stalemates 4 in 3,500); [how enemies choose](../game/enemy-ai.md) and battle.md's Balance section | `29179c8`, `1cfa508` |
| CY5 | The battle rules, the rest (D9), as **rules version 2** with version 1 frozen: terrain and props, terminals, Tech and the Holds, the Back units' actions, chance skills, items, Stride, the bench call, escort, hack and free-the-leader, the Steel Muster; 112 tests; nine version-2 golden battles; [battle](../game/battle.md), [terrain](../game/terrain.md) and [factions](../game/factions.md) in the manual | `5460ca6` |
| CY4 | The battle rules, core (D8): `@cyber/battle`, rules version 1, no dependencies; the map format (schema 1), the rig and loadout, the timeline and Charge, movement, line of fire, attacks, Guard, Cover, Crossfire, counters, Rig Break and Hold on, four objectives, the forecast; 60 tests and seven golden replays; [the manual's battle page](../game/battle.md) ([page](../game/previews/battle.html)) with the tuning tables live | `5683d30` |
| CY3 | The hello app (D7): uma-quest's hello-app wiring (cc42fd1) with uma-farm's shell at the night tint; Google sign-in through "Uma Cyberpunk web"; save v1 synced to `cyber` with five safety copies and a Restore; master data through `/api/master`; the update prompt, the PWA and a neon ring icon; [the manual's first page](../game/architecture.md) ([page](../game/previews/architecture.html)). Main JS 134 KB of 180 | `1a06650` |
| CY2 | The cloud (D6): database `cyber`, `cyber-api-runtime`, images `cyber`, Cloud Run `cyber-api`, `cyber-deploy`, the provider `uma-cyberpunk`, site [uma-cyberpunk.web.app](https://uma-cyberpunk.web.app), the web app and its sign-in domain, all in `uma-rpg`; the variables and the deploy job on; isolation checked in every cell; [infrastructure](../technical/infrastructure.md). First green deploy: [run 43337938264](https://github.com/luismlorenzana/uma-cyberpunk/actions/runs/43337938264) | `ae47a91` |
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
