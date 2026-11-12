# Uma Cyberpunk: the concept

> **Status: 2026-11-12, the starting concept (D1).** The owner asked for a new repo for a tactics RPG with a
> science-fiction and space story, crossing Uma Musume with other mobile RPG franchises, and for "a simple doc to be
> built upon". This page is that doc: what the game is, how a battle plays, who's in it, how it's built and in what
> order. Its sixteen calls (TC1–TC16) are recommendations, adopted until the owner changes one. Later designs (the
> battle spec, the first chapter) build on them and keep their ids. Visual page:
> [previews/concept.html](previews/concept.html).

## The short answer

- **A turn-based grid tactics RPG** on the owner's iPhone, in landscape: a squad of four Umas, plus a guest when one has
  joined, fights on small HD-2D maps with height, in battles of about ten minutes (TC1, TC2).
- **Speed decides who moves next** on a visible timeline, and the Umas' five stats from master data become battle
  stats through one adapter (TC3, TC4). Five roles (Vanguard, Striker, Gunner, Netrunner, Medic) start from each Uma's
  running-style aptitude (TC5).
- **The setting is original:** a neon megacity on an orbital ring, and the star lanes beyond it. Gates in the lanes pull
  heroines in from other worlds, which is how the crossover works (TC6).
- **The crossover cast** comes from the platform's franchise boards: Azur Lane, Genshin Impact, Wuthering Waves, Honkai:
  Star Rail, Zenless Zone Zero, Honkai Impact 3rd and Punishing: Gray Raven. Guests appear as rivals and bosses first,
  and some join the squad after their chapter. None of it goes in git (TC7).
- **It's built on what exists:** uma-quest's HD-2D stage (`uma-stage`) for the battle maps, the shared packages for the
  rest, and its own cloud in the `uma-rpg` project, like uma-quest and uma-farm (TC10, TC11).
- **The order:** the workspace, the cloud and a hello app first (Phase 1), then a battle prototype on stand-ins
  (Phase 2), then the first chapter (Phase 3) (TC15).

## 1. The game in one page

| | |
|---|---|
| **Genre** | Turn-based grid tactics RPG, in the line of tactics games with height, facing and a turn timeline |
| **Platform** | The owner's iPhone, a Home Screen web app, landscape only; personal and never distributed (TC1) |
| **Session** | One battle is about ten minutes, so a battle fits a short sitting; a chapter is three to five battles |
| **Core cast** | Umas from master data, as the playable squad |
| **Crossover** | Heroines from other mobile RPG worlds, as rivals, bosses and some guest units |
| **Tone** | Neon city, orbital stations and star lanes; a found-family squad, not grimdark |

**Three pillars:**
1. **Tactics first.** Every system serves the grid: position, height, turn order and roles. Nothing auto-battles.
2. **Short and readable on a phone.** Small maps, a squad of four, big targets, and a timeline that shows the next
   eight turns.
3. **Built from what exists.** The stage, the kit, the save and sync, the master data and the art pipeline already
   work in the other Uma games. This game adds the battle rules and the story.

## 2. The setting (TC6)

An original setting, so nothing in it belongs to another franchise:
- **The Ring:** a megacity built on an orbital ring around a planet. Districts stack in layers, from the neon markets to
  the corporate spires and the dark underlevels. The first act stays here.
- **The Lanes:** routes between stations, moons and planets. Later acts follow the squad out along them.
- **The Gates:** rifts in the Lanes that pull people in from other worlds. That's why heroines from other games turn up:
  some arrive lost and hostile, some are hunted by the same people hunting the squad, and some stay.

The plot, its names and every line of dialogue are the story, written privately (TC13). This page only sets the frame.

## 3. The cast and the crossover (TC7)

| Who | Where from | Role in the game | Where it lives |
|---|---|---|---|
| **Umas** | Master data (uma-platform's private release) | The playable squad, levelled in this game (TC4) | Read by stable id, never in git |
| **Guest heroines** | The platform's franchise boards in the Uma Ranker: Azur Lane, Genshin Impact, Wuthering Waves, Honkai: Star Rail, Zenless Zone Zero, Honkai Impact 3rd, Punishing: Gray Raven | Rivals and bosses first; some join as guest units after their chapter | Read by stable id through the platform, never in git |
| **Original foes** | This game | Drones, mechs, security squads and gangs: the regular enemies | Original art, so they can go in uma-art |

- **How guests reach the game** is a uma-platform request when Phase 3 needs its first guest: the boards' ids, names and
  art travel the same private way master data does. Until then, battles use stand-ins.
- **Which guests, and in what order,** follows the owner's ranking in the Uma Ranker's boss boards, the same way
  uma-quest's careers read the Uma boards.
- **Guest units** use the same five roles and the same stat model as Umas, with stats set by hand per guest in the
  private content, since other franchises' stats don't map to Uma stats.

## 4. The battle (TC2–TC5)

**The board (TC2):**
- maps of 10 × 10 to 14 × 14 tiles, with up to four height levels;
- a squad of four Umas, plus one guest slot once a guest has joined;
- facing matters: hits from the side and back land harder;
- one objective per map: defeat all, defeat the leader, reach a tile, hold for N turns, or escort.

**The turn order (TC3):** each unit acts when its own clock fills, at a rate set by Speed, and a timeline across the top
shows the next eight turns. There are no player and enemy phases. A unit's turn is **move, then one action** (attack,
ability or item), then **face**. Waiting without acting brings the next turn sooner.

**The stats (TC4):** one adapter turns the master data's five Uma stats into battle stats, so every Uma plays
differently from day one. Levels, gear and growth are this game's own (uma-platform P8).

| Uma stat | Battle stat | What it does |
|---|---|---|
| Speed | Initiative, Move | How often the unit acts, and how far it moves |
| Stamina | HP | How much damage it takes before it's down |
| Power | Kinetic damage | Melee and gun damage |
| Guts | Armor, Last stand | Damage taken, and a once-a-battle survive-at-1 when it's high enough |
| Wit | Tech | Tech damage, hacking, healing and accuracy |

**The roles (TC5):** five, each with its own abilities. A Uma's default role comes from its best running-style
aptitude; Medic is open to anyone. Roles change in the Hideout.

| Role | Plays like | Default from |
|---|---|---|
| **Vanguard** | Front line: guards, taunts, holds a choke point | Front Runner |
| **Striker** | Fast melee: dashes, flanks, hits from behind | Pace Chaser |
| **Gunner** | Ranged: height bonus, overwatch, suppression | Late Surger |
| **Netrunner** | Hacks: turns turrets and drones, slows the clock, opens doors | End Closer |
| **Medic** | Support: heals, shields, revives | Any Uma, by choice |

## 5. The loop and the structure (TC8, TC9)

```text
 The map ──▶ a mission ──▶ loadout ──▶ the battle ──▶ rewards ──▶ the Hideout ──▶ the story ──┐
    ▲                                                                                        │
    └────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Acts → chapters → missions (TC8).** Act 1 is the Ring. Later acts open stations, moons and planets along the Lanes.
  Story missions move the plot; **contracts** are repeatable missions for levels and gear.
- **The map** starts as the Ring's districts and becomes a star map when the Lanes open.
- **The Hideout (TC9)** is the hub between battles: the squad, roles, gear (weapons and implants), levels and the story
  log. It uses uma-kit's shell and screens where they fit.
- **Rewards:** experience, credits and parts. Parts build gear in the Hideout. There's no gacha: Umas join through the
  story and the roster, and guests through their chapters.

## 6. How it's built (TC10, TC11, TC14)

- **The battle view (TC10)** is an HD-2D diorama on `@luismlorenzana/uma-stage` (uma-platform P142), the stage uma-quest
  already plays on: sprites in a lit 3D scene, with a grid overlay, height, tile picking and a top-down tactical camera
  to toggle. **CY4 is a spike** that proves the grid on the stage before anything else builds on it. If it fails, the
  fallback is a Phaser 4 isometric board, the platform's baseline for 2D scenes. A grid mode for the stage, if one is
  needed, is a uma-platform request, never a fork here.
- **The stack (TC11)** is uma-rpg's: React, Vite, Tailwind, Zustand and Dexie on the web, NestJS on Cloud Run,
  Firebase Hosting and Auth, a PWA. It installs uma-data, uma-kit, uma-work, uma-server, uma-art and uma-stage.
- **The cloud (TC11)** goes in the `uma-rpg` GCP project like uma-quest's and uma-farm's (uma-platform P88), every piece
  its own: site `uma-cyberpunk`, Cloud Run `cyber-api`, Firestore database `cyber`. CY2 creates it on the owner's go,
  with a free-tier cost table.
- **It stands alone (TC14):** its own save, rules and economy, and no parcels from uma-farm at the start. Parcels can be
  added later the way uma-quest takes them (uma-platform P89), on the owner's word.

## 7. Art and story (TC12, TC13)

**Art (TC12)** follows uma-platform's split (P126), and the cheapest art that looks fine comes first:

| What | Who | Where |
|---|---|---|
| Uma sprites, busts and keys | ChatGPT, starting from the Character Art Studio's "Uma Cyberpunk: Combat Adult Character" category (P143) | Master data's private release |
| Guest heroines' sprites and busts | ChatGPT | Private, like the Umas |
| Original foes (drones, mechs, squads) | ChatGPT | uma-art |
| Map kits (city, station and lane tiles) | ChatGPT, after its character work | uma-art |
| Items, UI marks, crests, emblems, tile marks | Claude (`scripts/pixel-art`) | uma-art |

Battles start on stand-ins (Phase 2), so no art blocks the prototype.

**Story (TC13):** written in this repo's sessions and kept private, in the ignored `content/` and a private bucket once
the cloud exists. When the owner wants it readable beside the other games' stories, it becomes a fourth book in the
platform's Story App (uma-platform P141).

## 8. Phases

| Phase | What | Packets | Exit check |
|---|---|---|---|
| **0** | The repo, the concept and the guard | (this commit) | Done 2026-11-12 |
| **1** | The workspace, the cloud and the hello app | CY1, CY2, CY3 | Signed in on the phone, with the save synced |
| **2** | The battle prototype: the stage spike, the battle rules as a pure, tested domain package, one map four against four on stand-ins | CY4–CY6 | A full battle plays on the phone, start to win or loss |
| **3** | The first chapter: the Hideout, three missions, the story runner, the first squad from master data, the first art | Written when Phase 2 ends | Chapter 1 plays end to end |
| **4** | Progression and the map: levels, gear, contracts, the districts, then the star map | Written when Phase 3 ends | A second chapter needs the progression to win |
| **5** | Content waves: acts along the Lanes, guests joining | One wave at a time | Each wave plays end to end |

## 9. The calls

| # | Call | Section |
|---|---|---|
| TC1 | Personal, private and never distributed; an iPhone Home Screen web app, landscape only | [1](#1-the-game-in-one-page) |
| TC2 | Turn-based grid tactics: 10 × 10 to 14 × 14 tiles with up to four heights, facing, one objective per map; four Umas plus a guest slot; battles of about ten minutes | [4](#4-the-battle-tc2tc5) |
| TC3 | Turn order by Speed on a visible eight-turn timeline, not phases; a turn is move, one action, face | [4](#4-the-battle-tc2tc5) |
| TC4 | The five Uma stats become battle stats through one adapter (Speed, Stamina, Power, Guts, Wit → initiative and move, HP, kinetic, armor, tech); levelling is this game's own | [4](#4-the-battle-tc2tc5) |
| TC5 | Five roles (Vanguard, Striker, Gunner, Netrunner, Medic), the default from the best running-style aptitude, swapped in the Hideout | [4](#4-the-battle-tc2tc5) |
| TC6 | An original setting: a megacity on an orbital ring, the Lanes between worlds, and Gates that bring in heroines from other worlds | [2](#2-the-setting-tc6) |
| TC7 | Umas are the squad; guests from the platform's seven franchise boards are rivals, bosses and some guest units; original foes fill the ranks; none of it in git | [3](#3-the-cast-and-the-crossover-tc7) |
| TC8 | Acts, chapters and missions; story missions and repeatable contracts; the map grows from the Ring's districts to a star map | [5](#5-the-loop-and-the-structure-tc8-tc9) |
| TC9 | The Hideout is the hub between battles: squad, roles, gear, levels and the story log, on uma-kit's shell; no gacha | [5](#5-the-loop-and-the-structure-tc8-tc9) |
| TC10 | Battles are an HD-2D diorama on `uma-stage`, proved by the CY4 spike; the fallback is a Phaser 4 isometric board | [6](#6-how-its-built-tc10-tc11-tc14) |
| TC11 | uma-rpg's stack and the six platform packages; the cloud in the `uma-rpg` project with every piece its own, created on the owner's go | [6](#6-how-its-built-tc10-tc11-tc14) |
| TC12 | Art split by kind (P126): ChatGPT for characters and kits, Claude for code-drawn pixel art; stand-ins first | [7](#7-art-and-story-tc12-tc13) |
| TC13 | The story is private, written in this repo's sessions; a fourth book in the Story App later | [7](#7-art-and-story-tc12-tc13) |
| TC14 | It stands alone: its own save, rules and economy; no parcels at the start | [6](#6-how-its-built-tc10-tc11-tc14) |
| TC15 | Six phases: the repo, the foundation, the battle prototype, the first chapter, progression, content waves | [8](#8-phases) |
| TC16 | Deferred, for discussion only: ship-to-ship battles, permadeath, recruiting beyond the story, difficulty modes. Never: multiplayer | [Deferred](#deferred) |

## Deferred

Discussion only, not planned (TC16):
- **Ship-to-ship battles** along the Lanes, as a second battle mode.
- **Permadeath,** as an option.
- **Recruiting beyond the story,** such as contracts that unlock extra Umas.
- **Difficulty modes.**
- **Multiplayer** is never planned: the game is personal (TC1).
