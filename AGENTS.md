# AGENTS.md — guide for AI coding agents

uma-cyberpunk is a personal, never-distributed sci-fi tactics RPG inspired by *Umamusume: Pretty Derby*, with guest
heroines from other mobile RPG franchises, played on the owner's iPhone as a Home Screen web app, in landscape. Read
this before changing anything.

## Read first

1. [Handoff](docs/handoff/README.md) and the [four-act roadmap](docs/handoff/four-act-roadmap.md). Use the active packet in `docs/handoff/tasks/`.
2. [Four-act game design](docs/design/campaign-rework.md) and [systems plan](docs/technical/four-act-campaign.md). D87 governs current gameplay and supersedes old tier-based plans.
3. [Game manual](docs/game/README.md) for rules and screens already built. Use the [archive](docs/handoff/archive/README.md) for old release evidence.
4. [Decisions](docs/decisions.md), append-only, and the cross-game plan in uma-platform `docs/architecture.md`.
5. For Story or Art, use the [authoring contract](docs/design/campaign-art-delivery.md), [art direction](docs/design/art-direction.md) and the active authoring packet.

## Hard rules

- **Original-game content never goes in git.** That covers the Uma Musume franchise and every crossover franchise alike.
  - Master data comes from uma-platform's private release, and test fixtures from `@luismlorenzana/uma-data/testing`.
  - Guest rosters, names, art and stories live in the ignored `content/` folder and private buckets only.
  - Screenshots showing original art stay local.
  - `scripts/check-private-content.test.mjs` runs in CI.
- **Don't push to `main`.** Work on `feat/…`, `fix/…` or `docs/…` and open a pull request. CI must pass.
- **Owner-authorized agent delivery:** use `gh` only for GitHub. After CI passes, merge the pull request and publish any
  needed uma-art release; no further owner approval is needed. Never bypass repository protection. Use worktrees outside
  `~/workspace`, and remove them after merging, preserving unfinished work.
- **Don't touch production infrastructure** unless your task says so: `.github/workflows/`, `infra/`, `firebase.json`,
  `.env.production` and `apps/api/Dockerfile`. If this game joins GCP project `uma-rpg` (TC11), never touch the other
  apps' pieces there.
- **Never import from uma-rpg, uma-racer, uma-quest or uma-farm.** Shared code comes from `@luismlorenzana/*`
  packages. Code taken from a game is copied at a recorded commit, with its tests.
- **Logs:** append decision rows and never edit old ones. A finished packet is deleted in the commit that finishes it,
  with a Done row in the handoff README.

## Commands

Node 22+ and pnpm 10. The `@luismlorenzana/*` packages come from GitHub Packages, so export
`NODE_AUTH_TOKEN=$(gh auth token)` before installing.

| Command | What |
|---|---|
| `pnpm install` | Install the workspace |
| `pnpm lint` | Type-check every package |
| `pnpm test` | The script checks (size, private content), then every package's Vitest |
| `pnpm build` | Build everything; the web build ends with the 180 KB size check |
| `pnpm api` | The API on :8121, auth off (`AUTH_MODE=disabled`) |
| `pnpm web` | The web app on :5214, `/api` proxied to :8121 |
| `pnpm sim all --seeds 500` | The battle simulator: every scenario in `scenarios/`, AI against AI; the report goes to the ignored `sim/out/` (`--compare <report.json>` for a before-and-after) |
| `pnpm docs:update` | Rewrites the manual's live tables and its desktop pages |
| `pnpm story:check` | Validates `../uma-story-authoring/content/cyberpunk/stories/` (or the stand-in), prints the findings, writes `checks.json` beside a real story |
| `pnpm start` in `uma-story-authoring` | The [Cyberpunk book](http://127.0.0.1:4322/cyberpunk/) in the shared Story Sandbox. Drafts and verdicts live in its ignored `content/cyberpunk/stories/`. |
| `pnpm stories:import-cast` | Builds the sandbox's private cast pack (names and faces by id) from the Ranker's plan and uma-quest's pictures |
| `pnpm story:pack` | Packs a clean story into the ignored `content/story-release/`, which the API serves locally |

The preview pane starts both from `.claude/launch.json` (`cyber-api`, `cyber-web`). To try the guard locally, run the
built API with `ALLOWED_EMAIL` set and no `AUTH_MODE`.

**Deploys:** a push to `main` deploys the API to Cloud Run `cyber-api` and the web app to `uma-cyberpunk.web.app`, after
the verify job, then checks both (`docs/technical/infrastructure.md`). `infra/bootstrap.sh` creates the cloud and is
safe to re-run, always scoped: `CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-rpg bash infra/bootstrap.sh`.

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess`; Vitest next to the code; no network in tests.
- **Landscape throughout,** with 44 pt targets, safe areas and `h-dvh`.
- **Player-facing text is short:** labels, counts, buttons and plain empty states. Explanations go behind a help button.
- Conventional Commits; the body explains why.
