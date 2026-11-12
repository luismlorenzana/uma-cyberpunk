# AGENTS.md — guide for AI coding agents

uma-cyberpunk is a personal, never-distributed sci-fi tactics RPG inspired by *Umamusume: Pretty Derby*, with guest
heroines from other mobile RPG franchises, played on the owner's iPhone as a Home Screen web app, in landscape. Read
this before changing anything.

## Read first

1. `docs/handoff/README.md`: the current phase and its queue. Your task is a packet in `docs/handoff/tasks/`.
2. `docs/design/concept.md`: the concept and its calls (TC1–TC54), the starting point every design builds on;
   `docs/design/build-plan.md` (BP1–BP9) says what's reused and how the packets build it. The story is its own
   session's: `docs/design/story-brief.md` (SB1–SB11) is its brief, `docs/design/world.md` (WD1–WD24) its first pass,
   and the research behind all of them is `docs/design/references.md`.
3. `docs/game/`: the manual of the game as built. It is empty until the hello app (CY3); after that, look up any rule or
   screen there first.
4. `docs/decisions.md` (append-only, from D1), and the cross-game plan in uma-platform `docs/architecture.md`.

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

The preview pane starts both from `.claude/launch.json` (`cyber-api`, `cyber-web`). To try the guard locally, run the
built API with `ALLOWED_EMAIL` set and no `AUTH_MODE`.

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess`; Vitest next to the code; no network in tests.
- **Landscape throughout,** with 44 pt targets, safe areas and `h-dvh`.
- **Player-facing text is short:** labels, counts, buttons and plain empty states. Explanations go behind a help button.
- Conventional Commits; the body explains why.
