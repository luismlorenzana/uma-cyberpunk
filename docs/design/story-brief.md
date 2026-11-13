# Uma Cyberpunk: the story brief

> **Status: 2026-11-12 (D4).** From the game session to the story session. The owner split the work: a separate
> session authors the world and the story, and this repo's game session builds the app and the combat. This brief is
> what the story session needs to start: the owner's direction, what the game and the platform fix, what's free, the
> first pass to start from, the questions it answers, and what it delivers back, where and in what shape. Its calls are
> **SB1–SB11**, each a recommendation from the game side, kept until the owner or the story session changes one.
> Visual page: [previews/story-brief.html](previews/story-brief.html).

## The short answer

- **You own the world and the story; the game session owns the game** (SB1). You meet at the hooks the game builds
  (SB4) and at one content contract (SB8).
- **The owner's direction:** an interplanetary world; D3's neon city on an orbital ring becomes the first world and
  its Chapter 1; the Umas join **the ship**, the hub and stronghold, once their Chapter 1 ends; the ship travels to
  other worlds and picks up other Umas on their own Chapter 1, *Octopath Traveler*'s way (SB2).
- **Fixed:** the crew is Umas only; every enemy character is a heroine from the eight franchises on the platform's
  boards, and she's freed, never killed; the battle's rules are the game's; names are ours, and casting and dialogue
  never go in git (SB3).
- **Free:** the worlds, the mystery and its layers, the leads and their chapters, the ship and why it travels, where
  each faction is and why, the rival squad, the ending (SB7).
- **Start from** the first pass, [world.md](world.md) (WD1–WD24), and [the references](references.md). Most of it
  carries across worlds, and the Ring is already a first world (SB6).
- **Deliver** a nameless world doc in git and the private casting and chapters in `content/`, the first world's
  Chapter 1 first (SB8, SB9).

## 1. Who owns what (SB1)

| Area | The story session | The game session | Where they meet |
|---|---|---|---|
| **The world:** worlds, history, the mystery, the ship, tone | Writes it | Builds for it (§4) | [world.md](world.md), in git, nameless |
| **Who's who:** leads, crew order, which heroine is in which faction, each heroine's Hold, guests, the rival squad | Decides it, privately | Reads it by stable ids | `content/stories/` (private) |
| **Chapters, scenes, dialogue, choices, the Call's questions** | Writes them, privately | Plays them | The content contract (SB8) |
| **Missions:** objective, place, enemies, side objectives, fixed squads | Writes a brief per mission | Builds the map, fills the encounter, tunes it | Mission entries in the contract |
| **The battle and its systems:** the rig, roles, Charge, terrain, faction mechanics, Holds, progression, economy, the ship's rooms, talents | Gives them meaning in the world; asks for changes | Designs and builds them ([the concept](concept.md)) | A story request (SB10) |
| **Maps and art** | Describes places, looks and moods | Builds maps; Claude draws the kits in code (uma-platform P147); ChatGPT draws the characters | Map briefs in the contract |

## 2. The owner's direction (SB2)

In the owner's words (D4): an "interplanetary type world, where maybe the whole system you described is only Chapter 1
for every Uma and then after finishing that they join into 'the spaceship' which would act as the hub or stronghold,
then, when traveling to other worlds there would be other Umas to pickup on their own Chapter 1, a little like the
Octopath Traveler approach".

What the game builds from it:
- **Interplanetary.** Worlds are separate settings, reached by the ship.
- **The first world is D3's Ring**, the neon city on an orbital ring, with its layers and its Gates (WD4, WD5). The
  owner calls that whole system Chapter 1.
- **Every lead Uma has a Chapter 1 on her own world.** Finishing it brings her aboard.
- **The ship is the hub and stronghold:** the rooms between battles, the Bridge's star map and the crew's home.
- **The ship travels and picks up leads,** each on her own Chapter 1, as Octopath's travelers are met in their home
  towns.

D3's directions still hold: Uma Musume's characters only; lore and story in the spirit of *13 Sentinels: Aegis Rim*
and League of Legends' *Star Guardian*; gameplay from *Front Mission*; the look from *Triangle Strategy*; and the other
franchises as the enemy factions, tied to the plot.

## 3. What's fixed (SB3)

These come from the owner, the platform or the battle. Changing one is the owner's call or a story request (SB10).

1. **The crew is Umas only:** the Ranker's 100 Playable Umas, keyed by outfit id (a sister shares her base Uma's
   character id), and the Uma NPCs board for rivals and Uma NPCs. They never race; they can remember or dream of it.
   Minor original characters (a ship's AI, a broker, a world's officials) are fine; named heroes are Umas.
2. **Every enemy character is a heroine** from the platform's Boss, Key and Regular boards for the eight franchises
   (Azur Lane, Genshin Impact, Wuthering Waves, Honkai: Star Rail, Zenless Zone Zero, Honkai Impact 3rd, Punishing:
   Gray Raven and NIKKE). They fight as eight factions with original names. Each faction also fields original machines.
   The franchises' own monsters stay out.
3. **A heroine is freed, never killed.** Her **Hold** decides how: an **Anchor** (a corruption grafted on her rig,
   broken in battle), a **Collar** (someone else's control, broken in battle), or **None** (deceived or hired: win, and
   the story brings her over). A Netrunner can also **Jack-Out** an Anchor or a Collar. Each heroine's Hold is yours to
   pick, privately. A new kind of Hold is a request.
4. **No one dies in battle.** A broken Core is a **Rig Break**: she's out of the fight, weary, costume intact. An Uma
   is never maimed. Whether anyone dies off the battlefield is yours; D3's tone rule was no one on screen.
5. **The shape of play:** a scene of three minutes at most; a battle of about ten; a chapter of two to four battles;
   a new game's first battle within two minutes; a session of about fifteen minutes.
6. **Each faction brings one battle mechanic, and the game builds it** (world.md WD11: cover and volley, stagger,
   reactions, artillery, typed shields and time, Remnants and overload, infection, phases). You decide where and why a
   faction appears and may rename it, but **at most two new mechanics in one world,** so the battle teaches one idea at
   a time.
7. **Names are ours.** No term from the four reference works, and no franchise's own term for a person, place or
   mechanic. **The franchises' own worlds stay off the star map:** the worlds are ours, and the factions come to them.
   Visiting a franchise's world would mean retelling it, in its names.
8. **Privacy.** Docs in git name no character: no Uma, no heroine, nothing from a franchise beyond its title. Who plays
   which part, the chapters and every line live in the ignored `content/` (CLAUDE.md;
   `scripts/check-private-content.test.mjs` runs in CI). Check `git status` before every commit.

## 4. The hooks the game builds (SB4)

Everything below is in [the concept](concept.md). Phase 3 builds most of it on test content, so your content plugs
straight in; the Call, talents, side jobs and role changes come with progression in Phase 5. The right column is what
the game needs from you.

| Hook | What the game does | What you give it |
|---|---|---|
| **A world** (TC6, TC50) | A node on the Bridge's star map; a node map of locations; its own map kits and night grade | Its name, look and mood; its locations; the factions present; its lead or leads |
| **A lead Uma** (TC51) | Fixed in the squad on her own chapters; opens or upgrades a ship room (TC49); unlocks her signature at the end (TC22) | Who she is, her home world, her chapters, her talent (TC52), the room she opens, her signature's theme |
| **Chapter 1** (TC51) | Ends with her coming aboard | The recruitment beat: why she leaves her world |
| **A later chapter** | Shows its danger level and its keys on the world's map | Its arc, its world, what it needs first |
| **Crossed paths** (TC51) | A chapter that fixes two leads | Which pairs, and when |
| **The main thread** (TC51) | The ship's own chapters, between the leads' | The spine that ties the leads together |
| **A crew Uma** (TC45) | Joins through a chapter or a side job; speaks in scenes; fights in any squad | Who joins when, and through what |
| **A mission** (TC2, TC38) | Builds the map, fills enemy slots from board pools, tunes it | Place, objective (defeat all, defeat or free the leader, reach, hold, escort, hack), who's there, side objectives, any fixed squad |
| **A scene** (TC36) | Plays dialogue with busts, auto, skip and a log; offers Leads as one-tap choices | The script |
| **An Intel scene** (TC35) | A diorama with four to six hotspots, about three minutes | The hotspots and their lines |
| **Leads** (TC34) | One-tap choices that open a branch or a File in another lead's chapter | Where each comes from and what it opens |
| **The Log** (TC34) | Files with redacted lines that fill in; a replayable Timeline; Anomalies | The Files, their redactions, the Anomalies and when each is explained |
| **The Call** (TC35) | A crew vote with tokens; visible convictions Code, Edge and Free; branches of one or two missions that rejoin | The questions, the arguments and the branches |
| **A flash-forward** (TC32) | Any mission can fix its squad and loadouts and play ahead of its chapter | Where to use one |
| **Gates and keys** (TC32, TC34) | Every lock names its key | Which chapter, mission or File opens what |
| **A guest** (TC47) | A freed heroine in the guest slot, with hand-set stats | Who joins and when, her archetype, her stats (private) |
| **Suit-up** (TC39) | Opens each battle, skippable | What it is in the world |
| **A rival squad** (TC40) | Umas from the NPC board as enemies, with the squad's own rigs; can join later | Whether, where and who |
| **Roles** (TC5) | Five jobs: Vanguard, Striker, Gunner, Netrunner, Medic | Each Uma's default role, as an authored tag (private) |
| **Side jobs** (TC8) | Repeatable missions on a world's map | Optional flavour lines per world |

## 5. What *Octopath Traveler* teaches (SB5)

The owner named Octopath as the model. A research pass on both games and their reception (sources below) gives the
facts and seven lessons. The game already builds for each lesson (TC51); the story decides how to use it.

**How Octopath works:**

| | *Octopath Traveler* (2018) | *Octopath Traveler II* (2023) |
|---|---|---|
| **The start** | Pick one of eight travelers; she stays in the party until her last chapter | The same |
| **Recruiting** | Visit her home town; play her Chapter 1 now, or later at a tavern | The same; a skipped recruit joins low and as a stranger |
| **Chapters** | Four each, 32 in all | Three to five each, some with branches |
| **Gating** | Each chapter's flag on the map shows a level, about ten levels apart; each area shows a danger level | The same |
| **Party** | Four, swapped at taverns; the bench earns nothing, blamed for grinding | The same |
| **Path actions** | One per traveler, in noble and rogue pairs (Inquire or Scrutinize, Purchase or Steal…) | A day action and a night action each |
| **Connecting the stories** | Optional two-person banter skits after story scenes; chapter cutscenes show only the lead | **Crossed Paths:** four fixed pairs, two parts each; banter replayable |
| **The finale** | Hidden behind obscure side stories; all eight fight in two teams of four | Signposted: unlocks after all stories and Crossed Paths; the whole cast in its scenes |
| **Travel** | On foot, fast travel to visited towns | Ferries, and a ship bought late for the open sea |

**What players and critics said:** the first game's stories were "strictly siloed", every chapter ran the same shape
(town, path action, dungeon, boss), nothing explained why the eight travelled together, and the true ending needed a
guide. Its defenders liked the focus on one hero at a time. The sequel's director said Crossed Paths came straight from
players asking for "dialogue between protagonists beyond travel banter", and that each story was rebuilt to feel like a
different RPG. Reviews called the signposted finale a big improvement, but still wanted more connection: each traveler
pairs only once, and other characters ignore the party in cutscenes.

**Seven lessons for this game:**
1. **The ship is the reason to travel together,** which Octopath's first game lacked. Give each lead a part to play
   aboard (the room she opens, TC49).
2. **Write the crew into every scene, cheaply:** one to three short interjection slots per scene, each filled by a lead
   who's in the squad, with a fallback line; and a short debrief aboard after each chapter, replayable from the Log.
3. **Pair every lead at least twice** in crossed paths, the first part short and early.
4. **Break up the run of Chapter 1s.** Keep each short (one or two battles). Put a later chapter or a crossed path
   between pickups. A new lead joins at the squad's level, never level 1.
5. **Give each lead's chapters their own shape:** three to five chapters, a branch here and there, and objectives other
   than beating a boss (escape, defend, escort, a heist).
6. **Show the gating:** a danger level on every chapter, in small steps. The bench earns half XP (TC27), so a lead who
   sat out isn't stranded.
7. **Signpost the finale from the start:** seed the shared threat in every lead's chapters, list its conditions, and
   bring the whole crew into it (two squads in turn).

Sources: [Kotaku on the structure](https://kotaku.com/how-octopath-travelers-structure-actually-works-1827478495) ·
[Famitsu interview, via Nintendo Everything](https://nintendoeverything.com/octopath-traveler-ii-devs-on-having-the-protagonists-interact/) ·
[Push Square interview](https://www.pushsquare.com/features/interview-octopath-traveler-2-devs-on-series-goals-the-first-game-skipping-playstation-and-more) ·
[Siliconera on travel banter](https://www.siliconera.com/octopath-travelers-travel-banter-offers-socialization-without-losing-focus/) ·
[RPG Site review](https://www.rpgsite.net/review/7465-octopath-traveler-review) ·
[Shacknews review of II](https://shacknews.com/article/134209/octopath-traveler-2-review-score) ·
[Engadget review of II](https://www.engadget.com/octopath-traveler-2-review-eight-different-stories-but-not-enough-connection-090045893.html) ·
[RPG Site on Crossed Paths](https://www.rpgsite.net/feature/13837-octopath-traveler-ii-crossed-paths-guide) ·
[Game8 story list](https://game8.co/games/Octopath-Traveler-2/archives/404331) ·
[Gameranx on the ship](https://gameranx.com/features/id/449065/article/octopath-traveler-2-how-to-unlock-the-ship-overworld-travel-guide/).
The first game's chapter levels come from player reports, not an official table.

## 6. The first pass, carried across worlds (SB6)

[world.md](world.md) was written for one city over five acts. The owner's frame widens it. What carries, as the game
session sees it; every row is yours to keep, change or drop:

| First pass | In an interplanetary frame | Suggestion |
|---|---|---|
| **The Ring and its six layers** (WD4) | The first world, whole | Keep: it's the owner's "Chapter 1" |
| **The Tithe:** the Ring runs on light siphoned from other worlds (WD1) | The ship visits the very worlds being drained | A strong main thread: each world shows the Tithe's cost first-hand |
| **The Gates** (WD5) | How the ship travels, or what it hunts | Decide early: it sets the Bridge's look |
| **The Blackout,** a hunger that eats memory (WD2) | A threat that spans worlds | Keeps 13 Sentinels' memory theme across chapters |
| **The cores,** the rigs' stolen power (WD3) | Every lead's rig runs on one | A shared secret that ties the leads |
| **The Umas came through the first Gate** and dream of a sunlit track (WD8) | Leads on many worlds who share one dream | A spine: a lost world the crew is looking for |
| **The Hideout and the double life** (WD7) | The first world only, or gone | The ship replaces it as the hub |
| **The rival squad** (WD6) | One world's heroes, or a rival ship | Yours |
| **Eight factions, their reasons and who's behind whom** (WD10, WD13) | Expeditions, mercenaries and the bound, on our worlds | Keep the reasons; place each where its mechanic suits the world |
| **The Holds** (WD9) | Unchanged | Fixed by the battle (SB3) |
| **Five acts and their order** (WD15, WD16) | Replaced by worlds and chapters | Keep the difficulty order: one or two new mechanics a world |
| **Flash-forwards and seeding** (WD17, WD18) | Tools, not a fixed shape | Keep the seeding rule: three seeds a layer, an Anomaly a world |
| **Route lenses** (WD19) | A genre per lead, as each Octopath traveler has one | Keep |
| **Tone, names, the ending** (WD20, WD21, WD24) | Unchanged in spirit | Yours |

## 7. The questions you answer (SB7)

Each has the game session's default, so nothing waits on an answer:

| # | Question | The game's default |
|---|---|---|
| 1 | How many worlds, and in what order? | The first wave is the first world and one more, so Phase 4 proves a pickup; about eight in all |
| 2 | How many leads, and which? | Eight, one per world, Octopath's count; every other Uma is crew |
| 3 | A fixed opening, or a starter the player picks? | Fixed for the first wave; a pick later, if the worlds allow it |
| 4 | How many chapters per lead? | Four, Chapter 1 included, plus the main thread |
| 5 | What's the ship, whose is it, and why does it travel? | Yours |
| 6 | What's the mystery, and how does it come out across worlds? | Yours, in layers, 13 Sentinels' way |
| 7 | Where is each faction, why, and in what order? | At most two new mechanics a world |
| 8 | Each heroine's Hold, and who joins as a guest? | Private |
| 9 | Is there a rival squad, and where? | Yours |
| 10 | Each Uma's role tag; each lead's talent, room and signature theme | Private |
| 11 | The tone and the ending | D3's tone: candy-bright neon over a tragic story, a found family |
| 12 | The names: the ship, the worlds, the factions | Ours; D3's faction names can stay or go |

## 8. The content contract (SB8)

The game reads the story from files, the way uma-quest and uma-farm do: the format and its validator live in git, the
content never does.

> **Live since CY9 (D13).** The parser and the check are built: run **`pnpm story:check`** in this repo to validate
> `content/stories/` (it writes `checks.json` beside your files and exits non-zero on any error). The exact format, every
> step's syntax and every rule are in [the manual's story page](../game/story.md). What CY9 settled beyond this sketch:
> `wait` is a number of ms; `flag` is a slug, or `{ flag, set }` to clear one; `file` is `{ file, line }`; `anomaly` is
> `{ anomaly, open }`; `join` and `aboard` are an outfit id; `call` and `battle` are a slug; a file's `id` is its file
> name; worlds give each location `danger`, `needs` and `links` (and optional `x`, `y` for the map); `casting.json`
> holds `leads` (`{ outfit, world, opens?, talent? }`), `crewOrder`, `heroines` and `minor`; any file may carry a
> `layer`; a mission may name the `scenario` the game builds for it. Further changes are logged and this section
> updated.

**Where the files live** (the ignored `content/`, on the same disk as the repo, so both sessions see them):

```text
content/stories/                 ignored by git; the story session's
  world-notes.md                 the world with its names (the nameless version is docs/design/world.md, in git)
  casting.json                   leads, crew order, heroines by faction and Hold, guests, rivals, minor characters
  worlds/<worldId>.json          a world: its name, look, mood, locations (the map's nodes), factions present
  chapters/<chapterId>.json      a chapter: its leads, world, number, danger level, keys, scenes, missions, debrief
  log/<fileId>.json              a Log File: its lines, which are redacted, and what fills each in
  calls/<callId>.json            a Call: the question, the voters' arguments, the branches
  reviews.json                   the owner's verdicts, if the owner reviews here
```

**Ids.** An Uma is her **outfit id** from master data (a sister shares her base Uma's character id, so never the
character id alone). A heroine is her **board id** from the Ranker. Everything ours (worlds, places, chapters, scenes,
missions, Files, Calls, minor characters) has a short lowercase slug of your choosing that never changes once used.
Names, portraits and busts come from master data at run time, so the files never repeat them.

**A chapter, sketched:**

```jsonc
{
  "schemaVersion": 1,
  "id": "w1-ch1",                       // a slug, ours
  "world": "w1",
  "leads": [1001],                      // outfit ids: one lead, or two for crossed paths
  "number": 1,                          // 1 = her Chapter 1, which ends with "aboard"
  "danger": 1,                          // the recommended squad level
  "needs": [],                          // keys, each named on the world's map: "chapter:…", "mission:…", "file:…"
  "scenes": [
    {
      "id": "w1-ch1-s1",
      "place": "w1-docks",               // a location on the world's map
      "trigger": { "arrive": "w1-docks" }, // or { "after": "mission-id" }, { "talk": "place-id" }
      "cast": [{ "outfit": 1001 }],
      "steps": [
        { "line": { "speaker": 1001, "text": "…" } },               // 160 characters at most
        { "slot": { "lines": { "1002": "…", "1003": "…" }, "fallback": "…" } },  // an interjection slot (TC51)
        { "choice": [{ "text": "…", "lead": "lead-id", "then": [] }] },          // a Lead as a one-tap choice
        { "narrate": "…" }
      ]
    }
  ],
  "missions": [
    {
      "id": "w1-ch1-m1",
      "place": "w1-underlevels",
      "objective": { "kind": "defeat-leader" },   // defeat-all, defeat-leader, free-leader, reach, hold, escort, hack
      "brief": "…",                                // what the map looks like, for the game session to build
      "enemies": [
        { "slot": "boss", "pool": ["board-id"] },
        { "slot": "regular", "job": "gunner", "count": 3, "faction": "steel-muster" }
      ],
      "fixedSquad": null,                          // or outfit ids, for a flash-forward (TC32)
      "side": [{ "kind": "hack", "gives": "lead-id" }]
    }
  ],
  "debrief": { "steps": [] }                       // the scene aboard after the chapter (TC51)
}
```

**Step kinds:** `line`, `slot`, `narrate`, `thought`, `emote`, `wait`, `choice`, `flag` (set a story flag), `lead`
(gain a Lead), `file` (fill in a File's line), `anomaly` (open or close one), `join` (a crew Uma comes aboard),
`aboard` (the lead comes aboard: Chapter 1's last step), `call` (hold a Call) and `battle` (play a mission). They follow
uma-quest's chapter format (`packages/domain/src/story/script.ts` there) and uma-farm's steps, so the runner and the
checks are proven ones.

**The stand-in.** Git holds an invented stand-in world and chapter with made-up ids (as uma-farm's 9000001–9000003),
so the game runs end to end before your first file lands, and the dev server falls back to it when `content/` is empty.

**Review.** Until a fourth Uma Story book exists (TC13), the owner reads chapters in the game itself, through the dev
server or the deployed app reading the private pack. The validator writes Uma Story's `checks.json` shape from day one,
so a book can follow without rework.

## 9. What you deliver, and when (SB9)

Uma Story's layers set the order: skeleton, then bible, then scripted. The owner reads each layer before the next.

| # | Deliver | Layer | Where | The game needs it for |
|---|---|---|---|---|
| 1 | **The world outline:** the worlds and their order, the ship, the main thread, the mystery's layers, the factions' places; nameless | Skeleton | `docs/design/world.md` rewritten, with its page, in git | Phase 4's map kits and maps, which Claude draws in code (uma-platform P147) |
| 2 | **The casting:** the leads and their worlds, talents, rooms and role tags; the crew order; the heroines by faction and Hold; guests | Skeleton | `content/stories/casting.json` | Phase 4's first battles and the ship's rooms |
| 3 | **The first world and its lead's Chapter 1** | Bible, then scripted | `content/stories/worlds/`, `chapters/` | Phase 4's start: the opening plays end to end |
| 4 | **The second world and its Chapter 1** | Scripted | Same | Proving the pickup |
| 5 | Then a world at a time, with its chapters, Files and Calls | Scripted | Same | Phase 6's waves |

Nothing blocks the game before item 1: Phases 1–3 run on the stand-in. The sooner item 1 lands, the sooner the first
world's kit and maps can be drawn.

## 10. How the two sessions work together (SB10)

- **One repo.** Both sessions work in `uma-cyberpunk` and commit to `main` in Conventional Commits style (fetch first):
  the story's commits are `docs(story): …`.
- **Decisions** go in [decisions.md](../decisions.md) with the next free D-number, from either session.
- **A story request** (a new mechanic, hook, room, talent or Hold) is a row in the handoff's "Story requests" table
  ([handoff](../handoff/README.md)). The game session answers it in its next packet or says why not.
- **This brief** is the game session's. When the game changes a hook, it updates the brief and logs a D-decision.
- **Each doc keeps a desktop HTML page** in `docs/design/previews/`, as the owner asks of every doc.
- **The game session reads `content/` on disk** to build maps and test chapters, and never commits it.

## 11. Starting the story session (SB11)

Give the story session this one line:

```text
Read CLAUDE.md and docs/design/story-brief.md in ~/workspace/uma-cyberpunk, then take the story brief.
```

## 12. The calls

| # | Call | Section |
|---|---|---|
| SB1 | The story session owns the world and the story; the game session owns the game; they meet at the hooks and the content contract | [1](#1-who-owns-what-sb1) |
| SB2 | The owner's direction: interplanetary; the Ring is the first world and its Chapter 1; each lead's Chapter 1 brings her aboard the ship, the hub; *Octopath Traveler*'s pickups | [2](#2-the-owners-direction-sb2) |
| SB3 | Fixed: Umas only as the crew; heroines from the eight franchises as enemies, freed never killed, by their Hold; Rig Break; the shape of play; one mechanic a faction, two new at most a world; names ours, franchise worlds off the map; privacy | [3](#3-whats-fixed-sb3) |
| SB4 | The hooks the game builds, and what each needs from the story | [4](#4-the-hooks-the-game-builds-sb4) |
| SB5 | What *Octopath Traveler* teaches | [5](#5-what-octopath-traveler-teaches-sb5) |
| SB6 | The first pass carried across worlds | [6](#6-the-first-pass-carried-across-worlds-sb6) |
| SB7 | Twelve questions for the story session, each with the game's default | [7](#7-the-questions-you-answer-sb7) |
| SB8 | The content contract | [8](#8-the-content-contract-sb8) |
| SB9 | What the story delivers, and when | [9](#9-what-you-deliver-and-when-sb9) |
| SB10 | How the sessions work together: one repo, shared decisions, story requests | [10](#10-how-the-two-sessions-work-together-sb10) |
| SB11 | The one line that starts the story session | [11](#11-starting-the-story-session-sb11) |
