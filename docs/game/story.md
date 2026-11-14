# The story: its format, its check and the player

> **Status: 2026-11-12, CY9 (D13), CY12 (D16).** Where the story session's files plug in (TC53): the format and its strict parser in
> `packages/domain/src/story/`, `pnpm story:check` and `pnpm story:pack`, the delivery, the runner and the scene player.
> The story itself is the story session's, written from [the story brief](../design/story-brief.md) in the ignored
> `content/stories/`; this page holds the format only.

## The short answer

- **The story is files** in `content/stories/`: `casting.json`, `worlds/*.json`, `chapters/*.json`, `log/*.json` and
  `calls/*.json`. Notes and reviews there aren't parsed.
- **`pnpm story:check`** parses them with the game's own parser, runs the cross-file rules, prints errors, todos and
  notes, and writes `checks.json` in Uma Story's shape.
- **`pnpm story:pack`** turns a clean story into hash-named files the API serves; the game falls back to an invented
  **stand-in** story when none is served (production until Phase 4's bucket).
- **The scene player** shows a scene as busts and a text box; the story's changes go into the synced save (v2).
- **The owner reviews the story in the Cyberpunk Story Sandbox** (`pnpm stories`, :4322; D17,
  [story-sandbox.md](../design/story-sandbox.md)), which reads the same files with this same parser and check.

```mermaid
flowchart LR
  files[content/stories/*.json] --> check[pnpm story:check] --> report[checks.json]
  files --> pack[pnpm story:pack] --> release[content/story-release/: story.json + story/*.hash.json]
  release --> api[cyber-api /api/content/…] --> loader[load.ts: verify each hash, parse]
  standin[The stand-in, in git] -.->|404 or VITE_CYBER_STORY=stand-in| loader
  loader --> runner[The runner] --> player[The scene player]
  runner --> save[(Save v2: the story state)]
```

## The files

| File | Holds |
|---|---|
| `casting.json` | `leads` (each `{ outfit, world, opens?, talent? }`), `crewOrder` (outfit ids: the order the squad's interjection slots prefer), `roles` (each Uma's authored role by outfit id, CY11: untagged, she takes her running style's, [crew.md](crew.md#her-role-tc5)), `bondGates` (CY13: the key each bond rank 4, 6, 8 and 10 waits on, in the `needs` syntax), `tastes` (CY14: each Uma's `{ favourite, disliked, gift, topics }` by outfit id; one not written derives hers, [cabins.md](cabins.md#her-tastes)), `chiefs` (CY16: an Uma's room by outfit id, [duties.md](duties.md)), `heroines` (`{ board, faction, hold }`, the Hold `anchor`, `collar` or `none`), `minor` (slugs); `labels` for the stand-in only |
| `worlds/<id>.json` | `id`, `look`, `mood`, `factions`, `locations` (each `{ id, danger, needs, links, x?, y? }`: the world map's nodes), and the world's place on the star map (`x`, `y`) |
| `chapters/<id>.json` | `id`, `world`, `leads` (one, or two for crossed paths), `number` (1 is her Chapter 1), `danger`, `needs`, `scenes`, `missions`, `debrief` |
| `log/<id>.json` | A Log File: its `lines`, each `{ text, redacted }` |
| `calls/<id>.json` | A Call: the `question`, the `voters` (`{ outfit, argument }`) and the `branches` (`{ id, text, then }`) |
| `bonds/<outfit>.json` | *(CY13)* Her bond scenes: `outfit` (the file's name), `scenes` (each `{ rank, place, steps }`, ranks 2, 4, 6, 8 and 10), an optional `epilogue` (her card once she reaches rank 10, 400 characters at most), and *(CY14)* `talk` (her small talk in a visit: `{ <topic>: [lines] }`, up to four lines of 160 characters a topic). A bond scene may name a `look` (D24). See [captain-and-bonds.md](captain-and-bonds.md) and [cabins.md](cabins.md) |
| `events/<region>.json` | *(CY16)* A region's jump events: `region` (the file's name) and `events`, each `{ id, title, text, choices }`; a world names its region with `region`. See [duties.md](duties.md#jump-events-tc66) |

Every file has `schemaVersion: 1` and may carry a `layer` (placeholder, skeleton, bible, scripted, published); a file's
`id` is its file name. **Ids:** an Uma is her outfit id, a heroine her board id, everything else a lowercase slug that
never changes once used. Names, busts and portraits come from master data at run time.

**A scene** is `{ id, place, trigger, cast, steps }`: `place` is a location on the chapter's world; `trigger` is one of
`{ arrive: place }`, `{ talk: place }` or `{ after: mission }`; `cast` lists `{ outfit }`, `{ heroine }` or `{ minor }`.

**A mission** is `{ id, place, objective: { kind }, brief, enemies, fixedSquad?, side?, scenario? }`: the objective one
of defeat-all, defeat-leader, free-leader, reach, hold, escort or hack; `enemies` a list of `{ slot: "boss", pool }` and
`{ slot: "regular", job, count, faction }`; `scenario` the battle the game built for it (a file in `scenarios/`).

## The steps

| Step | Written as | Does |
|---|---|---|
| line | `{ "line": { "speaker": 1001, "text": "…" } }` | A spoken line, 160 characters at most |
| slot | `{ "slot": { "lines": { "1002": "…" }, "fallback": "…" } }` | An interjection slot (TC51): the first lead in the squad's order who has a line says it, else the fallback is narrated |
| narrate | `{ "narrate": "…" }` | Narration, 240 characters at most |
| thought | `{ "thought": { "speaker": 1001, "text": "…" } }` | A thought, shown in brackets |
| emote | `{ "emote": { "actor": 1001, "emote": "smile" } }` | A beat |
| wait | `{ "wait": 400 }` | A pause, in ms |
| choice | `{ "choice": [{ "text": "…", "lead": "…", "then": [] }] }` | One-tap options (four at most); an option with a `lead` gains it, marked as a Lead |
| flag | `{ "flag": "slug" }` or `{ "flag": { "flag": "slug", "set": false } }` | Sets or clears a story flag |
| lead | `{ "lead": "slug" }` | Gains a Lead |
| file | `{ "file": { "file": "slug", "line": 0 } }` | Fills in a Log File's line |
| anomaly | `{ "anomaly": { "anomaly": "slug", "open": true } }` | Opens or closes an Anomaly |
| join | `{ "join": 1003 }` | A crew Uma comes aboard (the crew is CY10's) |
| aboard | `{ "aboard": 1001 }` | The lead comes aboard: Chapter 1's last step |
| call | `{ "call": "slug" }` | Holds a Call and plays the branch picked |
| captain | `{ "captain": [{ "tone": "warm", "text": "…", "rapport": 20, "then": [] }] }` | *(CY13)* The captain's choice: two or three options, each a tone (warm, steady, wry), 80 characters, the rapport it earns (0–30) |
| path | `{ "path": { "trust": [], "heart": [] } }` | *(CY13)* Trust or Heart, only in a bond scene at rank 8 (once) or 10 (to change it); under Friends only the game takes `trust` without asking |
| battle | `{ "battle": "mission-slug" }` | Plays a mission of the same chapter |

## The check

`pnpm story:check [--dir <folder>]` reads `content/stories/` (with none there yet, the stand-in, and it says so):

| Level | Rules |
|---|---|
| **Error** | Every file parses: its shape, unknown keys refused, each error naming its file and path, such as `chapters/w1-ch1.json scenes[0].steps[3].slot.lines["1002"]: expected text of 160 characters at most`. Every id resolves (places on the chapter's world, triggers, missions in the chapter, Files and their lines, Calls, leads in the casting, worlds); a Chapter 1 ends with one `aboard`, her last scene's last step, and only a Chapter 1 has one; a `battle` step is its scene's last step (CY10: what follows goes in a scene triggered `after` the mission); every key in `needs` names a real chapter, mission or File, or (CY15) a known ship capability (`ship:drive-1`…`drive-3`, `ship:storm`, `ship:sensors`); a `slot` keys only leads; **bonds (CY13):** `bondGates` name real keys, a bond file's name is its outfit, its scenes sit at distinct ranks, the rank-8 scene has exactly one `path`, a `path` only at 8 or 10, no `battle`, `aboard` or `join` in a bond scene; **the captain's placeholders** anywhere are spelled `{captain}`, `{they}`, `{them}`, `{their}`, `{theirs}` or `{they're}` |
| **Todo** | A scene likely over three minutes (four seconds a line and a second every fifteen characters; TC36); a lead in fewer than two crossed paths; a Chapter 1 with more than two battles (TC51); a lead with no bond scenes yet, a bond file for someone outside the casting, a bond scene likely over two and a half minutes (TC57) |
| **Note** | Counts per world, lead and layer |

It writes `checks.json` beside a real story (`{ schemaVersion, book: "cyberpunk", checkedAt, files: { path: sha256 },
findings, layers, counts }`, Uma Story's shape, uma-platform P141) and exits non-zero on any error. A file's layer, when
it doesn't say, is inferred: a chapter with scripted steps is `scripted`, one with only missions `skeleton`; a world with
a look or mood is a `bible`.

## Delivery

- **`pnpm story:pack`** refuses a story with errors, then writes each file as `story/<name>.<hash8>.json` and an index
  `story.json` (each file's source, path, SHA-256 and size) to the ignored `content/story-release/`.
- **The API** serves it at `/api/content/…` through uma-server's `PrivatePackModule`, behind the owner guard: the index
  revalidated on every read, the hash-named files cached for good, nothing else. Locally from `STORY_DIR`; the private
  bucket `STORY_BUCKET` and its cost table are Phase 4's.
- **The web's one seam** (`apps/web/src/story/load.ts`) reads the index through uma-kit's content client, verifies each
  file by its hash and parses the lot. On a 404 (no release locally; production now), or with
  `VITE_CYBER_STORY=stand-in`, it plays **the stand-in**: invented worlds and two leads' Chapter 1s, with invented ids
  (Umas 9000001–9000004, the heroine `stand-in-1`) and plain labels ([the loop](#the-chapter-1-loop-cy12)):
  - **sw1 and sw2**, each Chapter 1 with a battle, an interjection slot, a crew Uma who joins and a debrief, two Log
    Files and a Call, using every step kind;
  - **life aboard** (CY13–CY19): bond scenes and tastes for all four Umas, the Vanguard squad, two factions, three
    story operations, two event pools, a standing step;
  - **a storm-ridge finale** on sw2 behind the storm shielding;
  - **sw3**, a third world the Engines' drive reaches ([the life-aboard loop](#the-life-aboard-loop-cy19)).

## The player

- **A scene** plays over a dark backdrop with the place's id at the top: the speaker's **bust** (a stand-in card in her
  colour now; master data's busts by outfit id when the album is wired, CY11) and the **text box** with her name. A tap
  moves on.
- **Choices** are one-tap buttons, a Lead marked as one. **A Call** shows the question, each voter's argument and the
  branches. **A battle** step shows the mission and **Deploy** (CY10 plays it).
- **Auto** moves on by the line's length (0.9 s and 45 ms a character); **Skip** passes lines to the next choice or the
  end, keeping every change; **Log** shows the scene so far.
- **The test route** `/story` lists the loaded story's first chapter and plays it scene by scene, then its debrief; a
  scene seen is marked. The game itself plays scenes from the ship's flow ([ship.md](ship.md), [missions.md](missions.md)).

## The Chapter 1 loop (CY12)

The Octopath structure (TC51): each lead's Chapter 1 plays on her home world, and finishing it brings her aboard; the
ship then travels on to the next. The stand-in proves it twice, end to end, and a headless test plays it all through the
director on fixed seeds with auto-played battles (`apps/web/src/mission/loop.test.ts`).

```mermaid
flowchart LR
  new[A new game] -->|straight in| a1[sw1: Lead A's Chapter 1] --> ma[Its battle] --> pa[Lead A aboard: Comms opens]
  pa --> da[Her debrief, aboard] --> jump[The Bridge: jump to sw2]
  jump --> b1[sw2: Lead B's Chapter 1] --> mb[Its battle] --> pb[Lead B aboard: the Store opens] --> db[Her debrief]
```

| Step | What happens | The rule |
|---|---|---|
| **A new game** | The ship goes straight to the Bridge and plays the first lead's first scene | Nothing seen and no mission: the opening (TC36). The stand-in reaches its first battle in about 45 s of reading (the check's estimate), under two minutes |
| **Her Chapter 1** | Its scenes in order, then its battle, with her locked in the squad | A chapter's scenes play in order ([ship.md](ship.md#a-worlds-map)); the battle step ends its scene |
| **A crew Uma joins** | `join` in a chapter's scene: Crew C in Lead A's, Crew D in Lead B's | Both kinds of arrival (TC45) |
| **She comes aboard** | `aboard`, the last step of her chapter's last scene, usually the scene after its battle | She joins **at the squad's level**: the crew's average XP, or the XP of the battle she just fought, whichever is higher, so never level 1 after a fight. A `join` follows the same rule. Her room opens (`casting.json`'s `opens`, which may name any module since CY15) |
| **A refit** | *(CY15)* `refit` (`{ "refit": true }`) | The ship gains a deck, to six ([ship-build.md](ship-build.md#the-storys-refit)) |
| **Her debrief** | Plays on the ship as soon as her chapter's last scene ends; then it's in the Log's Timeline with the scenes, replayable | A chapter is finished when all its scenes are seen; its debrief is due once |
| **The next world** | The Continue card says "jump to …"; the Bridge's star map shows the world her chapter opened | A world appears once a location on it has every key met |

**Interjection slots** (TC51): a `slot` plays the line of the first lead in the squad who has one, by the casting's
`crewOrder`, else its fallback. **Who counts as the squad:** in the scene after a battle, the squad that fought it; in a
scene on the map or a debrief, the crew aboard. So in Lead B's chapter, Lead A speaks at the gate once she's aboard, and
after the battle only if she was deployed (the test plays both).

**Chapter 1s never run back to back** in the real game (TC51); the stand-in is too small to show it and doesn't try.

## The life-aboard loop (CY19)

Phase 4's exit (TC74). A headless test (`apps/web/src/mission/aboard.test.ts`) plays a new game through the stand-in on
fixed seeds. It plays both Chapter 1s and the finale, every battle at rules version 3 with the ship's life frozen into
its input. Between chapters it jumps between known worlds while the builds finish.

**Every stop aboard** does what a player does, counting the taps:
- closes the ship-log card and answers an event card;
- runs Auto-assign, and puts someone in the Workshop's artisan post if it's empty;
- replies to messages;
- makes three visits: Lead A gets a talk and a decoration (a gift once her cabin glows at three), and the Uma with the
  lowest bond gets a talk;
- places a piece in Lead A's favourite style where it raises her Comfort;
- plays any bond scene that's ready;
- builds (the Lab, the Sensors, the Shield, the Engines, the Workshop) and researches when the wallet allows;
- sends a squad on an operation when no story mission waits, but only one Comms shows as a full success;
- powers the systems built.

**What it proves**, with every save through JSON and the parser:

| Measure | Result |
|---|---|
| The story | Both Chapter 1s and the storm-ridge finale won; sw3 reached by the drive |
| Bonds | Every rank rises (5, 8, 5, 5); Lead A reaches rank 8 and picks Heart |
| A cabin | Lead A's at Comfort 3, with the Workshop's sporty pieces |
| The ship log | Every watch pays once the posts are held |
| Builds and research | The Lab, the Sensors, the Shield Projector, the Engines and the Workshop; three projects |
| Operations | Reports on the log; four won in full |
| Standing | The union to Friendly; the muster moved both ways |
| The finale | Fog listed while the Sensors weren't built, none at the battle; readiness rose |
| Cohesion | The Vanguard fought together three times |
| Resume | Mid-build, mid-operation, mid-battle (the replay matches) and mid-scene (it plays again from its start) |
| Time aboard (TC72) | At most 35 taps and about 100 s a stop at the scene check's pace, under five minutes |

The battle's side is the simulator's balance pass (`pnpm sim balance`, D31): life aboard wins 20.6 points more often on
average than a bare squad, every scenario gaining and none at 100%.

## The story state (save v2)

The save's `story` holds `flags`, `leads`, each Log File's filled `files` lines, each Anomaly open or closed in
`anomalies`, and the scenes `seen`, kept sorted. A step's change is the player's own, so it moves `account.updatedAt`
and syncs. **A v1 save opens as v2** with an empty story and its `account.updatedAt` untouched; the server backs up the
v1 document on the version change ([the app as built](architecture.md#the-save)).
