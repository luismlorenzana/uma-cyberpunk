# uma-cyberpunk

A personal sci-fi tactics RPG for landscape play on the owner’s iPhone Home Screen. The Captain recruits up to 50 Umas, follows their independent stories, liberates five systems, and sends story-defined duos on ten-member expeditions against the Seraine. A final battle and soft ending close the campaign.

**Current development.** D86 defines the four-act campaign and a fresh profile in the existing app. Read the [game design](docs/design/campaign-rework.md), [production roadmap](docs/handoff/four-act-roadmap.md) and [handoff queue](docs/handoff/README.md). The previous campaign and local pilot supply reusable systems and historical play evidence.

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
| [Active handoff](docs/handoff/README.md) | Start here for current packets |
| [Four-act game design](docs/design/campaign-rework.md) | Recruitment, rehabilitation, planetary liberation, expeditions and the finale |
| [Production roadmap](docs/handoff/four-act-roadmap.md) | Sequenced development, Story, General Art, Character Art, Sprite Art and release work |
| [Systems plan](docs/technical/four-act-campaign.md) | Graph, eligibility, ship context, ten-unit battles and fresh save |
| [Authoring and delivery contract](docs/design/campaign-art-delivery.md) | Coverage, assets, Story, review and publishing |
| [Earlier design and code foundations](docs/design/concept.md) | Historical design and numbered calls |
| [Visual style](docs/design/art-direction.md) | Approved art treatment and references |
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

## Local Story Sandbox

Run `pnpm start` in the sibling [uma-story-authoring](https://github.com/luismlorenzana/uma-story-authoring) repo.
Choose this game in the Story Sandbox at http://127.0.0.1:4322. Private drafts and verdicts live with the Story authoring checkout.
