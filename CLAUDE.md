# uma-cyberpunk — working notes for Claude

- Before working here, read the cross-game plan in the sibling repo: `../uma-platform/docs/architecture.md`,
  `roadmap.md` and `decisions.md` (also on GitHub at `luismlorenzana/uma-platform`). uma-cyberpunk is uma-platform's
  Phase 10 (P144).
- **Start with [docs/handoff/README.md](docs/handoff/README.md):** the current phase, the packet queue and the owner's
  steps. The concept is [docs/design/concept.md](docs/design/concept.md) ([page](docs/design/previews/concept.html));
  its calls are TC1–TC48; the world bible is [docs/design/world.md](docs/design/world.md) (WD1–WD24) and the research
  behind both [docs/design/references.md](docs/design/references.md). New decisions go in `docs/decisions.md` from D4
  (fetch `main` first). Packets are CY-numbered from CY1.
- **`docs/game/` is the manual of the game as built.** It starts with CY3. Every rule change keeps it in step.
- **This game stands alone:** its own save, rules and economy (uma-platform P2, P3). It reads master data from
  uma-platform by stable IDs only, and never imports from uma-rpg, uma-racer, uma-quest or uma-farm at runtime.
- Shared changes (master data schema, shared packages such as `uma-kit` and `uma-stage`, original art) happen in a
  uma-platform session as a request
  ([change protocol](https://github.com/luismlorenzana/uma-platform/blob/main/docs/change-protocol.md)), never a fork
  here.
- **Original-game content never goes in git:** no master data, names, Uma art, guest-franchise rosters or art, or
  stories.
  - Stories are private, in the ignored `content/` and a private bucket once the cloud exists (TC13).
  - Uma sprites derive from original art, so they're private too: they live in master data's private release, never in
    uma-art or git. Guest heroines from other franchises follow the same rule (TC7).
  - Check `git status` before every commit. `scripts/check-private-content.test.mjs` runs in CI.
- **Claude commits and pushes to `main`** in Conventional Commits style. Delegated agents use a branch and a pull
  request. When Claude reviews a ChatGPT pull request, it sends back only must-fixes (a broken rule, original-game
  content, a failing check, a real bug).
- **Art is split by kind (uma-platform P126):** **ChatGPT draws character art end to end** (Uma sprites and keys, guest
  heroines, enemies, busts and any portrait), starting from the Character Art Studio's "Uma Cyberpunk: Combat Adult
  Character" category (P143), and the painted full-colour art that needs image generation (map kits), and publishes
  those releases. **Claude draws the code-drawn pixel art** (uma-platform's `scripts/pixel-art`: items, UI marks, crests,
  emblems, tile marks) **and the art tools,** and publishes those uma-art releases in a uma-platform session. The
  uma-cyberpunk packet that first uses the art pins it.

## Autonomy: what you do without asking

The owner gave every session full autonomy to commit, publish and deploy (2026-11-08). Do the work end to end:
- **Commit and push to `main`** (Conventional Commits; `git status` first). Watch CI with
  `gh run watch <id> -R luismlorenzana/uma-cyberpunk --exit-status` and fix forward if it fails.
- **Write packets ahead:** a phase's packets before it starts, from the concept. Then work them in order, flag each done
  (delete it, add a Done row) and log its D-decision.
- **Merge your own pull requests,** and review ChatGPT's with must-fixes only. Take a ChatGPT code packet that blocks you.
- **Sibling repos** sit beside this one in `~/workspace/` (uma-platform, uma-rpg, uma-racer, uma-quest, uma-farm). Read
  them freely. Change one only for a step a packet names, following that repo's CLAUDE.md.

**Ask in one line, then do it yourself:**
- creating or deleting cloud resources, or changing IAM, beyond what a packet already lists, with a free-tier cost
  table;
- making anything public: a repo, a bucket, a URL to private data.

**Never:** change the active gcloud account, type credentials into a sign-in page, or commit original-game content.

## How the owner works

- **No open questions:** decide with a recommendation when a sensible default exists, and log it.
- **Plain answers:** answer the literal question first. Prefer the smallest fix over a redesign, and use a task table
  when work spreads.
- **Scope:** build the owner's spec literally, with no inherited filters. Deferred topics are discussion only.
- **The owner runs nothing:** never hand them a command. Their steps are only what needs their hands: a review, a play, a
  console entry with no API. Ask for one in one line, with the link.
- **Reviews and status messages:**
  - list every HTML page and doc as a clickable link;
  - present every call (its id and one line), not highlights.
- **Docs:** clear, visual, full depth, each with a desktop HTML page. uma-rpg's
  `docs/design/tier-rework/class-progression.md` is the bar.
- **Lean assets:** features first, and the cheapest art that looks fine; no heavy pipelines.
- **Cloud cost up front:** a free-tier cost table whenever a cloud resource is added.
- **Production saves** (from CY3): never move `save.account.updatedAt`, never write into a save from a server, and a
  stale server date means stop and ask. These come from uma-rpg's 2026-10-30 incident, where a hand grant wiped unsynced
  progress.

## Building and running

Nothing runs yet. CY1 adds the workspace and its commands (in `AGENTS.md`), and `.claude/launch.json` for the web app
and the API. The preview pane can't screenshot WebGL: once the stage arrives (CY4), check scenes on a canvas fallback,
or ask the owner for a phone check. Never validate in the iOS Simulator (uma-platform P60).

**Never change the active gcloud account.** When the cloud exists (CY2), scope every command with
`CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-rpg`, and never run `gcloud config set`. Never type
credentials into sign-in pages.
