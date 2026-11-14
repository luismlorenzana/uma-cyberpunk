# Uma Cyberpunk: the Story Sandbox

> **Status: 2026-11-13, built (D17); the Bibles page added (D30).** The owner asked for "a third app" for Uma Cyberpunk, beside the Story Sandboxes
> uma-quest's and uma-farm's sessions built, where they author and review their stories locally (uma-platform P150).
> This game's story had a format, a check and a player in the game (CY9), but no page to read it, judge it and leave
> verdicts for the story session. This page records the sandbox as built and its calls, **SX1–SX12**. No name or line
> of story is in git. Visual page: [previews/story-sandbox.html](previews/story-sandbox.html).

## The short answer

- **A local page in this repo:** `pnpm stories`, then http://127.0.0.1:4322 (uma-quest's is on 4320, uma-farm's on
  4321). Run `pnpm stories:import-cast` once for names and faces.
- **It reads the story with the game's own code,** so it shows exactly what `pnpm story:check` reports and what the game
  plays. Until the story session's first file lands, it shows the game's invented stand-in.
- **Thirteen pages:** the story's state and its five deliverables, the worlds and their maps, the bibles, the chapters,
  a scene player, the cast, the Log, the Calls, the checks, the format, the notes and the combat sprites.
- **Your verdicts** (liked, rework or question, and a note) go to the private `content/stories/reviews.json`, which the
  story session reads before writing the next layer.

## How it fits

```text
 the story session                          the game session
   writes ─► content/stories/  ◄── reads ── packages/domain/src/story/  (format, parser, check, stand-in)
             casting.json, worlds/,                 ▲
             chapters/, log/, calls/,               │ imports, in place
             events/, bibles/                       │
                    │                               │
                    ▼                               │
          tools/story-sandbox/  ────────────────────┘
          pnpm stories · 127.0.0.1:4322
                    │
          you read, play and judge
                    │
                    ▼
          content/stories/reviews.json ──► the story session reads it before the next layer
```

## The pages (SX4)

| Page | What it shows |
|---|---|
| **Story** | Totals (worlds, leads, chapters, scenes, battles, words, reading time, errors, to-dos); the story brief's five deliverables (SB9), read off the files; every file's layer; each world with its chapters |
| **Worlds** | The star map, each world where its file places it; each world's look, places, factions and leads |
| **A world** | Its look, mood and factions; its place map with links and locked places; which scenes happen where; its chapters |
| **Bibles** | *(D30)* The story session's private bibles, `content/stories/bibles/*.md`: the casting first, then the worlds in the Circuit's order, each a card with its words and your verdict mark; one bible read in full (headings, tables, lists, quotes) with a verdict box |
| **Chapters** | Every chapter in danger order: leads, number, danger, layer, scenes, battles, words, reading time, and your verdict mark |
| **A chapter** | Its leads, keys and length; each scene with its place, trigger, cast, reading time (over three minutes flagged, TC36) and script; each battle's brief, enemies and side objectives; the debrief aboard |
| **Player** | One scene a step at a time, as below |
| **Cast** | The leads with their worlds, rooms, talents, roles, chapters and where each comes aboard; the crew's order; the heroines by faction and Hold; minor characters; the Ranker's Umas by batch, marked lead or crew |
| **Log** | Each Log File's lines, which are redacted, and which scene fills each in; every Lead and where it's gained; every Anomaly, where it opens and where it's explained; every flag |
| **Calls** | Each Call's question, the voters' arguments, the branches and where it's held |
| **Checks** | Exactly `pnpm story:check`'s errors, to-dos and counts |
| **Format** | The files, the fifteen step kinds with how often each is used, ids, objectives and layers |
| **Notes** | The private `world-notes.md`, and the nameless world doc in git |
| **Sprites** | *(D24)* ChatGPT's combat sprite sheets from the private `content/design/character-looks/combat-masters/`: each Uma's fourteen sheets and what's back; a sheet cut by the request's grid, measured (figure in each cell, a clear background, feet on y 480, standing heights within 4%), played on a night tile at the phone's size beside her approved chibi, as silhouettes, and cell by cell |

## The calls

| Id | Call |
|---|---|
| SX1 | **A local page in this repo,** `tools/story-sandbox/`, run with `pnpm stories` at http://127.0.0.1:4322: plain modules and Node's `http`, through the repo's `tsx`; loopback only; code in git with no names |
| SX2 | **The game's own code reads the story:** the server imports `packages/domain/src/story/` (parser, check, stand-in) and `scripts/story/files.ts`, so the sandbox and the game never disagree on the format. A file that doesn't parse is listed as an error, and the rest still shows while it's being written |
| SX3 | **The stand-in until the first file:** with no story in `content/stories/`, the page shows the game's invented stand-in and says so; verdicts are refused on it |
| SX4 | **Thirteen pages** *(D24: Sprites; D30: Bibles)*, as the table above |
| SX5 | **The player:** a scene or a debrief one step at a time, with Back, Next, Auto, Restart and the arrow keys; choices and a Call's branches are one-tap picks, and Back takes a pick back; **interjection slots are resolved by a squad you set,** using the casting's crew order (TC51), so you hear who would speak; story changes (a Lead, a File line, an Anomaly, a flag, a join, coming aboard, a battle) show as cards; the script beside it marks the current step |
| SX6 | **Verdicts:** liked, rework or question, and a note, on any item (a file, `chapters/<id>.json#<scene>`), saved to the private `content/stories/reviews.json` in the shape uma-quest's and uma-farm's sandboxes write; the story session reads it before each next layer (SB9) |
| SX7 | **The cast pack, for names and faces:** `pnpm stories:import-cast` builds the private `content/stories/cast-pack/` from the Ranker's plan (the Playable Umas in the ten batches by outfit id, a sister under her own name; the Uma NPCs; every unit on the boss, key and regular boards by board id) and copies the pictures uma-quest's pack already holds for those ids. Nothing is downloaded. Without a pack, ids show as themselves, or as the stand-in's labels |
| SX8 | **Lengths with the game's own measure:** each scene's reading time is the game's `sceneSeconds`; words are counted per scene and chapter |
| SX9 | **Safety, as the siblings':** 127.0.0.1 only, other hosts refused, a same-origin content policy, writes only from the page itself as JSON, pictures served only when the cast pack lists them, and the only write is the verdicts file |
| SX10 | **Local first:** the owner authors and reviews stories in the games' local sandboxes (uma-platform P150), so there's no Uma Story book for this game. This sandbox replaces the brief's "read it in the game" (SB8's Review) |
| SX11 | *(D24)* **The Sprites page,** for the owner's gates on the combat sprite request: read-only, sheets served only by the request's file names inside their Uma's folder, her approved chibi stills read from uma-platform's private authoring folder (`UMA_PLATFORM_SPRITES`), the masters folder from `UMA_CYBER_SPRITES`. It judges geometry; the face, the armor and the accessory sides stay the owner's call |
| SX12 | *(D30)* **The Bibles page:** the story session's prose layer (the casting's reasons, each world's bible) is read and judged where everything else is. Read-only, from `content/stories/bibles/`, file names `[a-z0-9-]` only; the page's small Markdown reader draws headings, tables, nested lists, quotes, bold, code and a link's words as DOM nodes, never as HTML; a verdict is keyed `bibles/<name>.md` |

## As built

| What | Where |
|---|---|
| The server | `tools/story-sandbox/server.ts` |
| The page | `tools/story-sandbox/public/` (`app.js`, `views.js`, `player.js`, `app.css`, `index.html`) |
| The model and its tests | `tools/story-sandbox/lib/model.mjs`, `model.test.mjs` (in `pnpm test`) |
| The cast import and its tests | `tools/story-sandbox/import-cast.mjs`, `import-cast.test.mjs` (in `pnpm test`) |
| The private files | `content/stories/` (the story), `content/stories/cast-pack/` (names and faces), `content/stories/reviews.json` (verdicts) |
| Launch | `.claude/launch.json`: `cyber-story-sandbox`, here and in uma-platform |

**Checked on 2026-11-13** on the stand-in: every page renders with no console error; the player walks scene 1 through
its slot (the fallback, then Lead B's line once she's in the squad), its choice (Back takes the pick back), and scene 3's
join, Call and coming aboard; a verdict on the stand-in is refused; at 375 px no page scrolls sideways. The cast pack
built from the Ranker's revision 337: 154 Umas, 833 heroines, 120 with pictures.
