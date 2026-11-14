# The app as built

> **Status: 2026-11-12, CY3 (D7).** uma-cyberpunk as it runs on https://uma-cyberpunk.web.app: the pages, the save and how
> it syncs, sign-in, updates, deploys and local setup. Visual page: [previews/architecture.html](previews/architecture.html).
> There are no game rules yet; the battle rules arrive with CY4 and the board with CY7.

## The short answer

- **One web app on the iPhone's Home Screen,** signed in with the owner's Google account, talking to one API.
- **The save lives on the phone first** (IndexedDB through Dexie) and is copied to the `cyber` database through
  `cyber-api`. Playing never waits on the network.
- **Every push to `main` checks and deploys** both halves. A new build waits behind **Update ready · Restart**.

```
iPhone (Home Screen app)                 Firebase Hosting: uma-cyberpunk.web.app
 ├─ React 19 + uma-kit (night tint)        ├─ the app shell (no-cache) and hashed assets (cached for a year)
 ├─ Dexie: the save + safety copies        └─ /api/** ──► Cloud Run cyber-api (us-central1)
 └─ service worker (precache, updates)                     ├─ owner guard (Firebase ID token, one email)
                                                           ├─ /api/save ──► Firestore `cyber`: saves, saveRescues, saveBackups
                                                           ├─ /api/master/… ──► uma-platform's master data bucket (read only)
                                                           └─ /api/content/… ──► the story pack (Phase 4's bucket) and, under looks/,
                                                                                 uma-platform's content bucket: art/universes/cyberpunk/
                                                                                 only, read only (D25)
```

## Pages

| Path | What it shows |
|---|---|
| (the gates) | uma-kit's boot gates: the splash ("Uma Cyberpunk · Rigs up. Lights out."), then **Sign in with Google** when signed out, then the boot below, then master data ("Loading game data…", or "Connect once" with **Try again**) |
| `/` | **The ship** ([ship.md](ship.md)), loaded on demand since CY16 so the first download stays under budget: the decks, the Continue card, the Menu, Duties, the ship-log and event cards; `/room/:id` a room's page, `/mission` the mission flow ([missions.md](missions.md)) |
| `/home` | **Status:** the game's name; the account; the save's state (Synced and when, Syncing, Saved on this phone, Offline, Not backed up); its revision; master data's release version; **Sync now**; links to the sandbox, the board bench and the story test |
| `/account` | **Account:** who's signed in, the save's state and when it was last backed up, **Sync now**, the phone's **safety copies** with a **Restore** each, and **Sign out** |
| `?sheet=menu` | **The menu,** over any page (the bottom bar's Menu, or the rail's on a landscape phone): Home, Account, Sign out and the build id |

Status and Account sit in uma-kit's `AppFrame` at its night tint: the account bar on top (the initial opens Account; a
sync chip shows while the save isn't synced), the bottom bar (Ship · Status · Account · Menu). The ship, its rooms, the
flow, the sandbox and the benches are landscape screens on uma-stage's turned stage. A save not backed up for ten minutes, or replaced by
a newer one, puts a red line under the bar on every page. Every other path goes to Home. The update prompt sits outside
the gates, so a waiting build shows on any screen.

## The save

**Save v6** (`packages/domain/src/save/save.ts`; v1 was CY3's, v2 added the story state in CY9, v3 the crew, the ship,
the worlds and the mission in CY10, v4 each crew member's record in CY11, v5 the captain, the watch, the inbox and each
Uma's bond in CY13, v6 each Uma's cabin, the item stock and the visits in CY14, v7 the ship as a build and the wallet in CY15, v8 duties, presets, the meal, camaraderie, the ship log and a jump's event in CY16):

```json
{ "version": 8, "account": { "uid": "…", "createdAt": "2026-11-12T17:50:22.332Z", "updatedAt": "2026-11-12T17:50:22.332Z" },
  "captain": { "name": "Captain", "pronouns": "they", "romance": "ask", "named": false }, "watch": 0, "inbox": [],
  "items": { "classic-bed": 2, "…": 2, "gift-buns": 1 }, "visits": { "watch": 0, "used": 0 },
  "wallet": { "credits": 500, "alloy": 20, "data": 20 }, "dutyPresets": [], "meal": null, "camaraderie": {}, "log": null, "event": null,
  "crew": [], "ship": { "decks": 2, "width": 5, "modules": [{ "id": "bridge", "deck": 0, "slot": 0, "level": 1, "building": null }, "…"], "unlocked": ["…"], "powered": [], "research": { "done": [], "current": null } },
  "worlds": { "current": null, "known": {}, "missions": [] },
  "story": { "flags": [], "leads": [], "files": {}, "anomalies": {}, "seen": [] },
  "mission": null }
```

Older saves open as v8 on the device, each step pure and `account.updatedAt` untouched; the fields are on
[story.md](story.md#the-story-state-save-v2), [ship.md](ship.md#the-save-v3), [missions.md](missions.md#the-save),
[crew.md](crew.md#the-save-v4), [captain-and-bonds.md](captain-and-bonds.md#the-save-v5), [cabins.md](cabins.md#the-save-v6), [ship-build.md](ship-build.md#the-save-v7) and [duties.md](duties.md#the-save-v8); a crew member is
`{ outfit, xp, role, rig, presets, strain, bond, cabin, post }`.

- **`account.updatedAt` is the conflict rule's clock.** Only the player's own change moves it (`touched`); parsing,
  syncing and the server never do. A Restore counts as the player's own change.
- **Parsing is strict:** unknown keys and a version newer than the app are refused, so an older app never half-writes a
  newer save. Every change to the shape is a new version with its migration and tests: v2 holds the story state (CY9),
  v3 the crew, the ship, the worlds and the mission in progress (CY10).
- **Nothing carries over** from any other game (uma-platform P4, TC14).
- **On the phone** (`apps/web/src/save/db.ts`): IndexedDB database `uma-cyberpunk`, one row `main` holding the save, the
  account's uid, the server revision it's based on, a dirty flag and when it last synced. Beside it, **safety copies**:
  the newest five saves this phone kept before anything replaced them (`replaced`), before a Restore (`restore`), or that
  it couldn't read (`unreadable`).
- **On the server** (`apps/api/src/save/`), in Firestore database `cyber`:

  | Document | Holds |
  |---|---|
  | `saves/{uid}` | `{ revision, save, storedAt }`: the save as JSON text, its revision (1, 2, 3 …), and the server's time of the write |
  | `saveRescues/{uid}` | The newest upload the server refused, as sent, with the reason |
  | `saveBackups/{uid}-v{n}` | The stored document, copied before the first write of a newer save version |

  With `PERSISTENCE=firestore` the API refuses to start without `FIRESTORE_DATABASE`, never falling back to `(default)`.
  Locally the same lives in `apps/api/.data/save.json` (ignored by git).

## How it syncs

The rules are uma-rpg's (its D32, D45, D260), copied through uma-quest's hello app (cc42fd1, its D11).

1. **Boot:** the phone's save opens at once and a sync starts behind it. A phone with no save reads the server's; with
   none there either, it starts the account (`newSave`) and uploads it as revision 1.
2. **A change** writes the store and the phone, then syncs.
3. **A sync round** reads `GET /api/save` and decides (`reconcile.ts`):

   | Phone | Server | Step |
   |---|---|---|
   | No save | A save | Adopt the server's |
   | A save | Empty | Push |
   | Clean | A newer revision | Adopt |
   | Changed, on the stored revision | — | Push |
   | Changed, the server moved on | — | **The save changed last wins whole** (`account.updatedAt`); a tie keeps the phone's |
   | **Started offline, never synced** (revision 0) | A save | **Adopt the server's**; the phone's is kept as a safety copy |

4. **A push** is `PUT /api/save` with the revision it was based on. A stale revision, or a save version older than the
   stored one, answers **409** with what's stored, and the round decides again (three tries).
5. **Nothing is lost:** a phone's unsynced save is never replaced without a safety copy first, and an upload the server
   refuses (a broken save, a store error) is kept in `saveRescues` before the error returns.
6. **Triggers:** after each change, when the app returns to the foreground, when the network comes back, and **Sync
   now**.

## The production-save rules

From uma-rpg's 2026-10-30 incident, where a hand grant wiped unsynced progress. They hold from CY3:

- never move `save.account.updatedAt`;
- no server ever writes into a save (the API stores what the phone sends, nothing more);
- a stale server date means stop and ask the owner.

## Signing in

- uma-kit's sign-in (`@luismlorenzana/uma-kit/auth`): **Google, by redirect,** through the Firebase web app "Uma
  Cyberpunk web" in project `uma-rpg`. The auth domain is `uma-cyberpunk.web.app`, so the sign-in handler stays inside the
  Home Screen app.
- **One login for every app** (IN3): the same Firebase Auth and the same allowed email. `cyber-api` refuses every route
  but `/api/health` without the owner's token (401).
- A production build without its sign-in config refuses to build; locally there's none, and the app runs as
  `local-dev` against an API with `AUTH_MODE=disabled`.

## Updates and the install

- **The install:** Safari → Share → Add to Home Screen. The app opens standalone, with an opaque status bar and the
  safe areas kept; the manifest's orientation is `any`, since iOS can't lock a web app's (the turned landscape stage
  arrives with the board, CY7). Its icon is a neon ring with a gap on dark ink, drawn by `scripts/make-icons.mjs` (iOS
  keeps the icon it saw at install).
- **Updates:** the service worker precaches the build. When a newer build is waiting, uma-kit shows **Update ready ·
  Restart**; Restart activates it. The shell (`/`, `index.html`, `sw.js`) is served `no-cache`, so a new build is seen
  on the next open.
- **Master data** files are hash-named and cached on the phone once downloaded; the channel pointer prefers the network.

## Deploys

Every push to `main` that touches code runs `.github/workflows/deploy.yml`: lint, tests and the build (with the 180 KB
initial-JS check), then the API image to Cloud Run and the web to Hosting, then checks: health with the commit,
`/api/save` 401, the shell `no-cache`, and uma-rpg's own site still answering. Docs-only pushes skip it. Values are in
[infrastructure.md](../technical/infrastructure.md).

## Local setup

```bash
NODE_AUTH_TOKEN=$(gh auth token) pnpm install
pnpm api   # cyber-api on :8121, auth off, the save in apps/api/.data/save.json
pnpm web   # the app on :5214, /api proxied to :8121
```

Master data comes from uma-platform's local release folder (`../uma-platform/content/release`) when no bucket is named.
