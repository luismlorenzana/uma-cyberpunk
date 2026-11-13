# uma-cyberpunk

A personal, never-distributed sci-fi tactics RPG inspired by *Umamusume: Pretty Derby*, played on the owner's iPhone as
a Home Screen web app, in landscape (working title). It has:
- Front Mission-style battles on Triangle Strategy-style HD-2D grid maps: a squad of Umas in combat rigs whose parts
  break, against heroines and machines from other mobile RPG worlds;
- an interplanetary story told *Octopath Traveler*'s way: each lead Uma's Chapter 1 plays on her own world, then she
  joins the ship, the squad's hub, which travels on to the next world; the first world is a neon city on an orbital
  ring, and the mystery is told in 13 Sentinels' spirit with Star Guardian's colours;
- eight enemy factions from the platform's franchise boards, whose heroines are freed when beaten, some joining the
  squad.

The world and the story are written in their own session, from [the story brief](docs/design/story-brief.md); this repo's
game work starts with the app and the combat testing ([the build plan](docs/design/build-plan.md)).

**Status (2026-11-12):** live at [uma-cyberpunk.web.app](https://uma-cyberpunk.web.app) (CY2), with Google sign-in
and a synced save (CY3). The battle rules are in (`@cyber/battle`, rules version 2: CY4, CY5), with an enemy AI, seven
scenarios and a simulator (CY6). Next: the board on uma-stage (CY7), then the sandbox (CY8) and the app on test content
(CY9–CY12). The packet queue is in [the handoff](docs/handoff/README.md).

## Layout

| Path | What |
|---|---|
| `apps/web` | `@cyber/web`: the Home Screen PWA (Vite, React 19, uma-kit), its save synced through the API |
| `apps/api` | `@cyber/api`: NestJS 11 behind uma-server's owner guard: `/api/health`, `/api/save`, `/api/master/…` |
| `packages/domain` | `@cyber/domain`: the game's rules and contracts (the save), pure, no I/O |
| `packages/battle` | `@cyber/battle`: the battle rules, a pure seeded reducer with no dependencies, the forecast, the AI, the scenario format and the golden replays |
| `scenarios/` | The simulator's and the sandbox's scenarios and their maps, stand-ins only |
| `scripts/` | The checks (size, private content, hosting site, icons, manual pages) with tests; `sim/battle.ts`, the simulator |
| `infra/bootstrap.sh`, `firebase.json` | The cloud in the `uma-rpg` project and the site ([infrastructure](docs/technical/infrastructure.md)) |
| `.github/workflows/deploy.yml` | Verify on every push and pull request; deploy on `main` |

## Where things are

| Path | What |
|---|---|
| [docs/handoff/README.md](docs/handoff/README.md) | **Start here:** the current phase, its packets and the owner's steps |
| [docs/design/concept.md](docs/design/concept.md) | The concept: the game, the battle, the cast, the ship, the stack and the phases; calls TC1–TC54 ([page](docs/design/previews/concept.html)) |
| [docs/design/build-plan.md](docs/design/build-plan.md) | The build plan: what's reused from uma-platform and the siblings, the battle package, combat testing, the app and the packets; calls BP1–BP9 ([page](docs/design/previews/build-plan.html)) |
| [docs/design/story-brief.md](docs/design/story-brief.md) | The brief for the story session: who owns what, what's fixed, the hooks, Octopath's lessons, the content contract; calls SB1–SB11 ([page](docs/design/previews/story-brief.html)) |
| [docs/design/world.md](docs/design/world.md) | The world's first pass, now the story session's: the Ring, the truth in layers, the eight factions; calls WD1–WD24 ([page](docs/design/previews/world.html)) |
| [docs/design/references.md](docs/design/references.md) | The research: 13 Sentinels, Star Guardian, Front Mission, Triangle Strategy, the eight franchises and Octopath Traveler, and what the game takes ([page](docs/design/previews/references.html)) |
| [docs/decisions.md](docs/decisions.md) | The decision log, from D1 |
| [docs/game/](docs/game/README.md) | The manual of the game as built, from CY3 |
| [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) | How to work here |

## The other Uma repos

- **uma-platform:** the cross-game plan (`docs/architecture.md`, `roadmap.md`, `decisions.md`; this game is its Phase 10,
  P144), master data, the shared packages (uma-data, uma-kit, uma-work, uma-server, uma-art, uma-stage), the Uma Ranker
  with the franchise boards, and the Uma Platform app.
- **uma-quest:** the HD-2D travelers RPG. Its stage is now `@luismlorenzana/uma-stage`, whose parts this game's battle
  board builds on (TC10), and its wiring, save sync and story runner are what this game copies (the build plan).
- **uma-rpg:** the live party RPG. Its GCP project hosts uma-quest's, uma-farm's and the platform app's cloud, and is
  where this game's goes (TC11).
- **uma-farm** and **uma-racer:** the farm and the racer. Nothing is shared with them at the start (TC14).
