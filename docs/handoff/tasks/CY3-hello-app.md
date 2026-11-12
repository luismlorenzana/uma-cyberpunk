# CY3 — The hello app

**uma-cyberpunk · Claude · M · Needs: CY2 and the owner's two sign-in entries (below) · Unblocks: CY8 and CY9**

## Why

This takes CY1's placeholders to a real app on the owner's iPhone: Google sign-in, a save that syncs, master data
loaded, the update prompt and the Home Screen install. The sandbox (CY8) and the whole app (CY9–CY12) then build on a
working app instead of on placeholders. It's the step uma-quest's Q14 and uma-farm's F3 took, copied from uma-quest.

## Context (read first)

- [The concept](../../design/concept.md): TC1, TC11 and TC14. [The build plan](../../design/build-plan.md): BP1, BP2's
  foundation table and BP9's budgets. The decisions D2 and D4, and CY2's.
- **uma-quest is the model, copied rather than imported.** Its `main` has grown far past a hello app, so take the files
  below and trim them to save v1; uma-quest at `cc42fd1` (its Q14 closed, D11) shows the hello-app-sized version.
  - **Wiring:** `apps/web/src/main.tsx` (`configureKit`, `initAppearance`, `watchAppUpdates(registerSW)`,
    `setTokenProvider`), `app/Root.tsx` (`UpdateNotice` outside the gates; a production build without sign-in config
    refuses to start), `app/router.tsx`, `app/firebase-config.ts`, `app/build.ts`, `apps/web/index.html` (the iOS meta
    tags), `app/installed-app.test.ts`, and `apps/web/.env.production` (un-ignored in `.gitignore`).
  - **The PWA:** `apps/web/vite.config.ts`: the `VitePWA` block (`registerType: 'prompt'`, `injectRegister: null`, the
    manifest, Workbox runtime caching for `/api/master/*`, `navigateFallbackDenylist` for `/api/` and `/__/`), the
    `chunkModules` plugin that feeds the size check, and the check that fails a production build without the Firebase
    variables.
  - **Save sync:** web `save/game.ts` (the store, `boot`, `commit`, `startSyncTriggers`), `save/db.ts` (the Dexie row
    and its five safety copies), `save/reconcile.ts`, `api/client.ts`; domain `packages/domain/src/save/save.ts`; API
    `apps/api/src/save/` (controller, module, repository, the Firestore and local repositories, `save-size.test.ts`),
    `app.module.ts` and `health.controller.ts`.
  - **Master data:** `master/master.ts` (`loadMaster`, `useMaster`), on `uma-kit/content` and `uma-server/content`.
  - **Home:** `home/Home.tsx` (account, sync state, revision, master version, Sync now; the menu with the build id and
    sign-out).
  - **Icons:** `scripts/make-icons.mjs` and its test.
  - **The rules behind it:** uma-quest's D11 and uma-farm's D9, which record the sync as uma-rpg built it.
- **uma-farm's shell is the model for the kit's shell:** `apps/web/src/shell/{Shell,Bars,MenuSheet,SyncWarning}.tsx`,
  `home/AccountView.tsx` and `master/MasterGate.tsx`.
- **The kit and the server give most of it:** `uma-kit`'s `/auth`, `/places` (`BootGates`, `UpdateNotice`,
  `watchAppUpdates`), `/shell` (`AppFrame`, `AccountBar`), `/ui` and `/content`; `uma-server`'s `/auth`
  (`AuthModule.forRootAsync`, `@Public`, `CurrentUid`) and `/content` (`ReleaseProxyModule` for `/api/master/…`).
- **What exists:** CY1's placeholders and checks; CY2's cloud, `firebase.json` and deploy job; the "Uma Cyberpunk web"
  app's public config, printed by CY2's bootstrap.

## Decisions made

- **The stack (TC11):**
  - web: React 19, Vite 7, `react-router` 7, Tailwind 4, Zustand 5, Dexie 4, Firebase 12, `vite-plugin-pwa` and
    `workbox-window`, uma-kit's theme, ui, shell, places, auth and content;
  - api: NestJS 11 with `uma-server`'s guard and master-data proxy, `firebase-admin` 13, and the save module.

  No three.js and no stage on any screen yet: the board arrives in CY7, lazily, and the main JS stays under 180 KB gzip.
- **Save v1:** `{ version: 1, account: { uid, createdAt, updatedAt } }`. Nothing carries over from any other game
  (uma-platform P4, TC14). The sync, exactly as uma-quest's D11 records it:
  - local first, in Dexie, with the **newest five device safety copies** per account and a Restore;
  - `GET` and `PUT /api/save` with a **revision envelope** `{ revision, save }`; a stale or older-version write gets
    **409** with what's stored;
  - when both sides changed, the save with the newer `account.updatedAt` **wins whole** (a tie keeps the device's), and
    the loser becomes a device safety copy;
  - a device save that never reached the server (revision 0) never replaces the server's: the server's is adopted and
    the device's kept as a safety copy;
  - `saveRescues/{uid}` keeps an upload the server refused; `saveBackups/{uid}-v{n}` keeps the stored save whenever
    the version changes;
  - Firestore's document is `{ revision, save, storedAt }` under `saves/{uid}` in the `cyber` database, the save as JSON
    text; `storedAt`, never `updatedAt`, so no server field shares the protected name;
  - with `PERSISTENCE=firestore` the API **refuses to start without `FIRESTORE_DATABASE`**, never falling back to
    `(default)`; in dev, a local JSON file.
- **The production-save rules** (CLAUDE.md), written into `docs/technical/infrastructure.md` here:
  - never move `save.account.updatedAt`;
  - no server ever writes into a save;
  - a stale server date means stop and ask.
- **One login for every app** (IN3): the same Firebase Auth, Google sign-in and `ALLOWED_EMAIL`. Locally, auth is off
  (`AUTH_MODE=disabled`), as in CY1.
- **Boot:** `BootGates` (sign-in, then master data through uma-farm's `MasterGate`), with `UpdateNotice` outside the
  gates. A new account starts its save at boot; save v1 has nothing to choose, so there's no first-launch step.
- **The screens:** sign-in, then one Home page in uma-kit's shell (`AppFrame` at its night tint, `AccountBar` with the
  sync chip, the menu sheet). It shows "uma-cyberpunk", the signed-in account, the save's sync state and revision,
  master data's release version, and **Sync now**; the menu has the build id and sign-out. Master data proves the path
  only: nothing from it is drawn yet.
- **Orientation:** the game is landscape (TC1), but iOS can't lock a web app's orientation, so the manifest says `any`
  (uma-quest D11). Home works either way. The turned landscape box (`uma-stage`'s `TurnedStage` around uma-kit's
  `KitStage`) comes with the first stage screen in CY7, behind a lazy route.
- **The icon:** a plain generated mark drawn by the copied `make-icons.mjs`: a ring with a gap in neon on uma-kit's dark
  ink, original and abstract. Its test compares the committed PNGs' decoded pixels, since CI's zlib compresses
  differently (uma-quest D11). Real icon art is Claude's code-drawn pixel art later (uma-platform P147).
- **Updates:** the kit's **Update ready · Restart** prompt, with the shell served `no-cache` by CY2's `firebase.json`.
- **Tests:** Vitest inlines uma-kit so it shares the app's `react-router` (uma-quest D11); `fake-indexeddb` for Dexie.

## Do

1. Replace CY1's placeholders with the stack above, keeping CY1's checks. The main JS stays ≤ 180 KB gzip.
2. **The save:** `@cyber/domain`'s save v1 type and its strict parser, with tests; the API's save module on
   `FIRESTORE_DATABASE`, with its tests (the 409, the backup on a version change, the refusal without a database, the
   size test); the web's Dexie store, sync and reconcile, with tests.
3. **Master data:** the API's `ReleaseProxyModule` on `MASTER_BUCKET`; the web's `loadMaster`, `useMaster` and
   `MasterGate`.
4. **Sign-in, Home and the update prompt;** the PWA manifest ("Uma Cyberpunk", dark theme and background colours,
   standalone, orientation `any`) and icons; `apps/web/.env.production` with CY2's public Firebase config.
5. **Docs:**
   - `docs/technical/infrastructure.md`: the save's shape, the sync rules and the production-save rules;
   - the manual's first page: `docs/game/architecture.md`, the app as built (pages, the save, sync, deploy, local
     setup), on uma-quest's manual's model, listed in [docs/game/README.md](../../game/README.md);
   - `AGENTS.md` and `README.md`: the commands and layout, if anything changed.

## Done when

- Locally, with auth off: the app runs on 5214 against 8121, and the save round-trips through the local store.
- `pnpm lint && pnpm test && pnpm build` pass, and the size check reports the main JS under 180 KB gzip.
- In production, after the push:
  - the workflow's checks pass;
  - sign-in works in Safari;
  - the save syncs: the document appears in the `cyber` database's `saves`;
  - a second deploy shows **Update ready · Restart**.
- **The owner's phone check** (below) is asked for, in one line with the link.
- uma-rpg's, uma-quest's and uma-farm's sites and saves are unchanged.
- `git status` shows no `content/`.

## The owner's steps

1. **The two sign-in entries** (once; there's no API for them). In the Google Cloud console for `uma-rpg`, open **APIs &
   Services → Credentials** ([link](https://console.cloud.google.com/apis/credentials?project=uma-rpg)) and open the
   OAuth client **"Web client (auto created by Google Service)"**, the same client every app uses. Add:
   - `https://uma-cyberpunk.web.app/__/auth/handler` under **Authorized redirect URIs**;
   - `https://uma-cyberpunk.web.app` under **Authorized JavaScript origins**;

   then **Save**. CY2 asks for these as soon as the site exists. If its name fell back to `uma-cyberpunk-lm`, the
   entries use that name.
2. **The phone check:** open [uma-cyberpunk.web.app](https://uma-cyberpunk.web.app) in Safari, add it to the Home
   Screen, sign in inside the installed app, and see the save synced on Home.

## Deliver

Commit to `main` (`feat(app): …`), and watch the run with
`gh run watch <id> -R luismlorenzana/uma-cyberpunk --exit-status`. Then delete this packet, add a Done row in
[the handoff](../README.md) with the workflow link, and log the packet's D-decision (fetch `main` first).
