# CY1 — The workspace and its checks

**uma-cyberpunk · Claude · S · Needs: the owner's package access (below) · Unblocks: CY2**

## Why

CY2's pipeline needs something to build and deploy, and CI must prove that this repo can install the six platform
packages before any cloud exists. This is the same step uma-quest's Q1 and uma-farm's F1 took. It is placeholders only:
the real stack arrives in CY3.

## Context (read first)

- [The concept](../../design/concept.md), its Phases section, and the decisions D1–D2.
- **uma-quest is the closest model** (it already runs on `uma-stage`): its root `package.json`, `pnpm-workspace.yaml`,
  `turbo.json`, `tsconfig.base.json`, `.npmrc`, `scripts/check-size.mjs` (180 KB), `apps/api` (NestJS, `uma-server`'s
  `AuthGuard`, `/api/health`), and the `verify` job of `.github/workflows/deploy.yml`. uma-rpg is where those came
  from. Copy, never import.
- **The packages**, all on GitHub Packages under `@luismlorenzana`. Today's versions are `uma-data` 1.5.0, `uma-kit`
  0.19.0, `uma-work` 0.1.0, `uma-server` 0.2.0, `uma-art` 2.26.0 and `uma-stage` 0.1.0. Check for newer ones when you
  start, and pin exact versions.
- **What exists:** `.gitignore`, `.nvmrc`, `.npmrc`, `scripts/check-private-content.test.mjs` and
  `.github/workflows/check.yml` (the guard alone).

## Decisions made

- **Names:** `@cyber/web`, `@cyber/api` and `@cyber/domain`. pnpm 10, Node 22 and turbo, at uma-quest's versions.
- **`apps/web`:** Vite and React 19, with one static page that says "uma-cyberpunk" in uma-kit's theme (import
  `@luismlorenzana/uma-kit/theme.css`). It is not yet a PWA. It depends on `uma-kit` and `uma-stage` but renders no
  stage yet, so three.js stays out of the main bundle.
- **`apps/api`:** NestJS 11 with `uma-server`'s `AuthGuard` on every route except health:
  - `GET /api/health` → `{ ok: true, build }`, where `build` is `BUILD_ID` or `"local"`;
  - `GET /api/save` → 401 without a token (there is no save yet).
- **`packages/domain`:** one exported constant and one Vitest test. It depends on `uma-data`, `uma-work` and `uma-art`
  so all six packages install (`uma-kit` and `uma-stage` from the web, `uma-server` from the API).
- **Auth off locally,** as in uma-quest: `ALLOWED_EMAIL` unset and a dev flag let the local API answer without a token.
- **Checks:**
  - `pnpm lint` (tsc), `pnpm test`, `pnpm build`;
  - `scripts/check-size.mjs` at 180 KB, with its test;
  - the private-content guard.

  `pnpm test` runs the `scripts/` tests first, as uma-quest's does.
- **CI:** replace `check.yml` with `deploy.yml`, holding uma-quest's `verify` job only (install, lint, `test:ci`, build).
  It needs `packages: read` and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. The deploy job arrives in CY2.
- **Local running:** `.claude/launch.json` with `cyber-api` (`pnpm --filter @cyber/api dev`, port 8121) and
  `cyber-web` (`pnpm --filter @cyber/web dev`, port 5214, `/api` proxied to 8121).

## Do

1. The workspace root: `package.json` (scripts `dev`, `build`, `lint`, `test`, `test:ci`, `web`, `api`),
   `pnpm-workspace.yaml`, `turbo.json` and `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`).
2. The three placeholders above, each with a test.
3. Copy `check-size.mjs` and its test with the 180 KB budget, and add the step to the web build as uma-quest does.
4. `deploy.yml` (verify only); delete `check.yml`.
5. `.claude/launch.json`.
6. Write the commands into `AGENTS.md` (its Commands section) and the layout into `README.md`.

## Done when

- Locally: `NODE_AUTH_TOKEN=$(gh auth token) pnpm install`, then `pnpm lint && pnpm test && pnpm build` pass.
- Locally: `/api/health` answers 200 and `/api/save` 401 with auth on (`ALLOWED_EMAIL` set). The page loads on 5214, and
  its `/api/health` comes through the proxy.
- CI is green on `main`. If the install fails with 403 or 404 on `@luismlorenzana/*`, the owner's step below isn't done
  yet: stop and say so in one line.
- `git status` shows no `content/`.

## The owner's step (once, before CI can install)

On GitHub, for each of `uma-data`, `uma-kit`, `uma-work`, `uma-server`, `uma-art` and `uma-stage`: open the package's
**Package settings** → **Manage Actions access** → **Add repository** → `uma-cyberpunk` with **Read**. That's six
entries, and GitHub has no API for it.

## Deliver

Commit to `main` (Conventional Commits, `feat(workspace): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
