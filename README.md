# uma-cyberpunk

A personal, never-distributed sci-fi tactics RPG inspired by *Umamusume: Pretty Derby*, played on the owner's iPhone as
a Home Screen web app, in landscape (working title). It has:
- Front Mission-style battles on Triangle Strategy-style HD-2D grid maps: a squad of Umas in combat rigs whose parts
  break, against heroines and machines from other mobile RPG worlds;
- a neon megacity on an orbital ring that runs on light stolen through its Gates, and the star lanes beyond it, in a
  mystery told 13 Sentinels' way with Star Guardian's colours;
- eight enemy factions from the platform's franchise boards, whose heroines are freed when beaten, some joining the
  squad.

**Status (2026-11-12):** the repo, its concept, its world bible, its references and its private-content guard exist;
there's no code yet. Phase 1 is next: CY1, the workspace, is ready.

## Where things are

| Path | What |
|---|---|
| [docs/handoff/README.md](docs/handoff/README.md) | **Start here:** the current phase, its packets and the owner's steps |
| [docs/design/concept.md](docs/design/concept.md) | The concept: the game, the battle, the cast, the stack and the phases; calls TC1–TC48 ([page](docs/design/previews/concept.html)) |
| [docs/design/world.md](docs/design/world.md) | The world bible: the Ring, the truth in five layers, the eight factions and the five acts; calls WD1–WD24 ([page](docs/design/previews/world.html)) |
| [docs/design/references.md](docs/design/references.md) | The research: 13 Sentinels, Star Guardian, Front Mission, Triangle Strategy and the eight franchises, and what the game takes ([page](docs/design/previews/references.html)) |
| [docs/decisions.md](docs/decisions.md) | The decision log, from D1 |
| [docs/game/](docs/game/README.md) | The manual of the game as built, from CY3 |
| [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) | How to work here |

## The other Uma repos

- **uma-platform:** the cross-game plan (`docs/architecture.md`, `roadmap.md`, `decisions.md`; this game is its Phase 10,
  P144), master data, the shared packages (uma-data, uma-kit, uma-work, uma-server, uma-art, uma-stage), the Uma Ranker
  with the franchise boards, and the Uma Platform app.
- **uma-quest:** the HD-2D travelers RPG. Its stage is now `@luismlorenzana/uma-stage`, which this game's battle maps
  build on (TC10).
- **uma-rpg:** the live party RPG. Its GCP project hosts uma-quest's, uma-farm's and the platform app's cloud, and is
  where this game's goes (TC11).
- **uma-farm** and **uma-racer:** the farm and the racer. Nothing is shared with them at the start (TC14).
