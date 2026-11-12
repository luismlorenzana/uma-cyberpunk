# CY2 — The cloud and the pipeline

**uma-cyberpunk · Claude · M · Needs: CY1, and the owner's go on the cost table below · Unblocks: CY3**

> **The owner's go comes first.** This packet creates resources in the live `uma-rpg` GCP project, which runs uma-rpg's
> production and uma-quest's and uma-farm's. Ask in one line, with the cost table's total: "CY2 creates uma-cyberpunk's
> cloud in the uma-rpg project, under 10 cents a month: go?" Wait for a yes.

## Why

The game needs its own database, API, accounts, images, deploy sign-in and site before the hello app (CY3) can sign
in and sync a save. Every piece is its own, as uma-quest's and uma-farm's are, so no other app can reach this one's data
and this one can reach no other's (TC11, D2, uma-platform P88 and P144). The pipeline then deploys CY1's placeholders on
every push to `main`.

## Context (read first)

- [The concept](../../design/concept.md): TC11 and TC14. [The build plan](../../design/build-plan.md): BP2's foundation
  table. The decisions D2 and D4.
- **The cloud plan:**
  [uma-rpg docs/design/cloud/plan.md](https://github.com/luismlorenzana/uma-rpg/blob/main/docs/design/cloud/plan.md).
  Its calls IN1–IN26 are this packet's decisions: one project for the apps, every app piece its own (IN1–IN12), the
  shared `github-actions` pool, one login and the $5 budget. Its matrix (Step 4) has no cyberpunk rows; this packet
  checks the same cells for `cyber` and records them here (step 5).
- **The model to copy is uma-quest,** which did this as its Q2 (closed in its D7), the same week as uma-farm's F2 (its
  D5). Copy, never import:
  - `infra/bootstrap.sh`: idempotent, describe before create, the REST calls gcloud lacks, the variables at the end;
  - `firebase.json`: the site, the `/api/**` rewrite to Cloud Run, the `no-cache` shell and immutable assets;
  - `apps/api/Dockerfile`: the two-stage build with the npm token as a build secret, never in a layer;
  - the `deploy` job of `.github/workflows/deploy.yml`: keyless sign-in, build and push, deploy, and the checks;
  - `scripts/check-hosting-site.mjs` and its test;
  - `docs/technical/infrastructure.md`: the live values, the re-run note, the rollback.

  Drop what this game doesn't have: no content bucket yet, no farm link, no push pieces, no measurements.
- **What exists:** CY1's workspace, with `deploy.yml` holding the `verify` job only, and the API's `/api/health` and
  `/api/save` (401 without a token).

## Decisions made

- **Every gcloud command runs with `CLOUDSDK_ACTIVE_CONFIG_NAME=default CLOUDSDK_CORE_PROJECT=uma-rpg`.** The one
  master-data grant uses `CLOUDSDK_CORE_PROJECT=uma-platform-lm` instead. Never `gcloud config set`, never change the
  active account, and never touch a piece named `rpg-*`, `quest-*`, `farm-*`, `(default)`, `quest`, `farm`,
  `github-deployer`, or the sites `uma-rpg`, `uma-quest` and `uma-farm`.
- **The names:**

  | Piece | Name |
  |---|---|
  | Firestore database | `cyber` |
  | Runtime account | `cyber-api-runtime` |
  | Image repository | `cyber` |
  | Cloud Run API | `cyber-api` |
  | Deployer | `cyber-deploy` |
  | Deploy provider | `uma-cyberpunk`, in the existing `github-actions` pool |
  | Hosting site | `uma-cyberpunk` (`uma-cyberpunk-lm` if the name is taken) |
  | Firebase web app | "Uma Cyberpunk web" |
  | Label | `app=cyber`, on everything that takes one |

- **Region `us-central1`** for everything, as the other apps.
- **No content bucket yet.** The story's private bucket (`gs://uma-cyberpunk-content`) comes in Phase 4 with its own
  cost line (BP7), when there's a first world to ship. Until then the story lives in the ignored `content/`.
- **No parcels and no server-to-server calls** (TC14), so no `FARM_API_URL` and no ping.
- **The image is built in GitHub Actions** with Docker, as uma-quest's is. No Cloud Build.
- **When CY4 adds `packages/battle`,** the Dockerfile copies it too (the API reads `@cyber/domain`, which imports it).
  This packet's Dockerfile copies `packages/domain` only, since that's all there is.

## Do

### 1. `infra/bootstrap.sh`, in this order

Copy uma-quest's script and change its names. It's idempotent and prints what it did.

| # | Piece | How |
|---|---|---|
| 1 | Database `cyber` | `gcloud firestore databases create --database=cyber --location=us-central1 --type=firestore-native --delete-protection --enable-pitr` |
| 2 | Runtime account `cyber-api-runtime` | Create it. Grant `roles/datastore.user` on the project with the condition `resource.name == "projects/uma-rpg/databases/cyber"`, titled `cyber-database-only`. Grant `roles/storage.objectViewer` on `gs://uma-platform-master-data` (in `uma-platform-lm`) |
| 3 | Images `cyber` | Docker, `us-central1`, the label, and the cleanup policy uma-quest's has: keep the last 3, delete what's older than a day |
| 4 | API `cyber-api` | `gcloud run deploy cyber-api --image=us-docker.pkg.dev/cloudrun/container/hello` with the runtime account, `--min-instances=0 --max-instances=1 --memory=512Mi --cpu=1 --allow-unauthenticated` and the label. Created once from Google's sample image (IN8); the workflow replaces the image |
| 5 | Deployer `cyber-deploy` | Create it, then grant: `artifactregistry.writer` on the `cyber` repository; `run.admin` on the `cyber-api` service; `iam.serviceAccountUser` on `cyber-api-runtime`; and on the project, `firebasehosting.admin`, `serviceusage.serviceUsageConsumer` and `serviceusage.apiKeysViewer`, as the other deployers have |
| 6 | Deploy sign-in | Provider `uma-cyberpunk` in the `github-actions` pool, with uma-quest's attribute mapping and the condition `assertion.repository == 'luismlorenzana/uma-cyberpunk' && assertion.ref == 'refs/heads/main'`. Then `iam.workloadIdentityUser` on `cyber-deploy` for that repository's principal set |
| 7 | Site and sign-in | Hosting site `uma-cyberpunk`, keeping 20 versions; the Firebase web app "Uma Cyberpunk web" (its public config goes in `apps/web/.env.production` in CY3); `uma-cyberpunk.web.app` **added** to Auth's authorized domains. Read the list first and add to it, never replace it |
| 8 | The variables | Print `GCP_PROJECT_ID=uma-rpg`, `WIF_PROVIDER`, `DEPLOY_SA`, `ALLOWED_EMAIL` (read from uma-rpg's variable), `MASTER_BUCKET`, `FIRESTORE_DATABASE=cyber` and `HOSTING_SITE` |

Use the REST APIs (with `gcloud auth print-access-token` under the scoped configuration) for what gcloud lacks: the
Hosting site, its version limit, the web app and the authorized domains. uma-quest's `rest()` helper does exactly this.

### 2. The pipeline

- Set the variables with `gh variable set -R luismlorenzana/uma-cyberpunk`, and `DEPLOY_ENABLED=true` last.
- **`firebase.json`** names `"site": "uma-cyberpunk"`, serves `apps/web/dist`, and rewrites `/api/**` to `cyber-api` in
  `us-central1`. The shell (`/`, extensionless paths, `index.html`, `sw.js`, `registerSW.js`, the manifest and
  `workbox-*.js`) is served `no-cache`; `/assets/**` is immutable for a year.
- **The site check** (IN7): copy `check-hosting-site.mjs` and its test. It fails unless `firebase.json`'s site equals
  the workflow's `HOSTING_SITE` default and the workflow deploys `--only hosting:uma-cyberpunk`.
- **`apps/api/Dockerfile`:** uma-quest's, with `@cyber/api` and `@cyber/domain`. Build it locally once
  (`docker build --secret id=npm_token,env=NODE_AUTH_TOKEN -f apps/api/Dockerfile .`) before the first push.
- **The deploy job** in `deploy.yml`, after `verify`, only on `main` and only when `vars.DEPLOY_ENABLED == 'true'`,
  with a `uma-cyberpunk-production` concurrency group that never cancels:
  - keyless sign-in as `cyber-deploy` (`google-github-actions/auth@v3`), then `setup-gcloud@v3`;
  - build the API image and push it to `us-central1-docker.pkg.dev/uma-rpg/cyber/cyber-api:<sha>`;
  - deploy `cyber-api` (`deploy-cloudrun@v3`, label `app=cyber`, the step 1 flags) with `PERSISTENCE=firestore`,
    `FIRESTORE_DATABASE`, `MASTER_BUCKET`, `ALLOWED_ORIGIN` (the site's URL), `ALLOWED_EMAIL` and `BUILD_ID`;
  - build the web app and deploy it with `firebase-tools` at uma-quest's pinned version, `--only hosting:uma-cyberpunk`.
- **Its checks**, copied from uma-quest's job:
  - `/api/health` answers 200 directly and through the site, with `build` equal to the commit;
  - `/api/save` answers 401, directly and through the site;
  - the shell is served `no-cache`;
  - `https://uma-rpg.web.app/api/health` still answers 200, a guard against a site mix-up.

### 3. The owner's sign-in entries

CY3's sign-in needs two entries that have no API (see CY3). As soon as the site exists, ask for them in one line, with
the link, and carry on: this packet's checks don't need them.

### 4. Isolation (IN21)

With Policy Troubleshooter (`gcloud policy-troubleshoot iam`, scoped), check this game's cells:
- `cyber-api-runtime` is granted on `cyber` and refused on `(default)`, `quest` and `farm`;
- `cyber-deploy` can deploy `cyber-api` and push to `cyber`, and is refused on `rpg-api`, `quest-api`, `farm-api` and
  the `rpg`, `quest` and `farm` images.

Policy Troubleshooter doesn't accept Firestore databases (uma-quest D7, uma-rpg D311), so the database cells are checked
from the grant's condition. Every API is public at the edge by design; each one's own token check is what isolates it.

### 5. Docs

- **Create `docs/technical/infrastructure.md`** (it doesn't exist yet), on uma-quest's model: every live value
  (names, URLs, the provider's full name, the variables), the matrix results from step 4, the cost table below, the
  bootstrap's re-run note, and the rollback (delete the provider, then the service, the deployer and the runtime
  account; the database keeps its delete protection).
- `AGENTS.md`: how deploys happen (a push to `main`), and that `infra/bootstrap.sh` is re-runnable with the scoped
  configuration.

uma-rpg's repo isn't edited from here. uma-quest's Q2 left uma-rpg's cloud plan alone, and so does this packet; the
results live in this repo's infrastructure page.

## The cost table

| Added to the `uma-rpg` project | Free tier | At one player |
|---|---|---|
| Firestore `cyber` | None: the free quota covers only `(default)` | A few cents a month |
| Point-in-time recovery on `cyber` | None; billed by the database's size | Under a cent: a save is a few KB |
| Cloud Run `cyber-api` (0 to 1 instances, 512 MiB) | Shared across the billing account: 2M requests, 180k vCPU-seconds and 360k GiB-seconds a month | $0 |
| Hosting site `uma-cyberpunk` | Shared across the project: 10 GB stored, 360 MB a day | $0 |
| Images `cyber` (keep 3, delete older than a day) | 0.5 GB per billing account, shared with the other apps' images | $0; a cent a month if all pass 0.5 GB |
| Deploy provider, accounts, IAM, the web app | Free | $0 |
| Image builds | In GitHub Actions on the private repo's minutes, not in Google Cloud | $0 |
| **Total** | | **Under 10 cents a month.** The $5 alert (emails at $1 and $5) covers every app |

Sources: [Firestore pricing](https://cloud.google.com/firestore/pricing),
[point-in-time recovery](https://firebase.google.com/docs/firestore/pitr),
[Cloud Run pricing](https://cloud.google.com/run/pricing),
[Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing),
[Firebase Hosting pricing](https://firebase.google.com/pricing).

## Done when

- A push to `main` deploys, and the workflow's checks pass.
- Locally, `pnpm test` runs the site check's test with the other `scripts/` tests, and it passes.
- Every cell in step 4 comes back as expected, and the page records it.
- uma-rpg's, uma-quest's and uma-farm's sites, `/api/health` and `/api/save` 401 are unchanged.
- The billing budget still lists the project.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (`feat(infra): …`) with `infra/bootstrap.sh`, `firebase.json`, the Dockerfile, the deploy job, the site
check and the new `docs/technical/infrastructure.md`, and watch the run with
`gh run watch <id> -R luismlorenzana/uma-cyberpunk --exit-status`. Then delete this packet, add a Done row in
[the handoff](../README.md) with the workflow run's link, and log the packet's D-decision (fetch `main` first).
