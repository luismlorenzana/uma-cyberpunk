# Combat sprite authoring and album bundles

> **Reusable foundation.** This page documents the existing compact bundle and album workflow. The [four-act systems plan](four-act-campaign.md) sets new campaign requirements. Use the [current authoring contract](../design/campaign-art-delivery.md) for new bindings.

The first crew sprite delivery uses a compact helmeted 2D body and the four existing board facings.
Review at 100 CSS px against a dark board. Keep native texels and the approved apparent body height
as separate measurements. Painted silhouette, fixed foot registration and readable grip changes
are the reference for each pose. Use the 2D plates as editable art. The earlier 3D studies remain
available for pose and occlusion reference.

## Local album

Write a version folder under the private Cyberpunk Combat Sprites category, using the existing
character or encounter identity folder. Each delivery has `bundle.json` and its referenced PNGs.
Keep upstream source drawings, masks, palette specifications, exact tool/export steps and review
evidence with that version in private storage. A separate `active-bundle.json` containing
`{"schemaVersion":1,"version":"v001"}` selects its album preview. It is a local selection.
Owner approval applies to a reviewed bundle and its exact source and payload hashes. Platform
publication and campaign integration each get their own receipt.

The Combat Sprites tab plays the selected bundle. Check the fitted motion in all four facings at
the board display height, inspect cuts at native scale, scrub through impact and recovery, and
toggle anchor marks when a grip or foot appears to drift. The album labels draft and approved
bundles. Older still-image studies continue to appear as image cards.

## Bundle v1

| Field | Contract |
| --- | --- |
| Identity | `schemaVersion: 1`, `kind: "combat-sprite-bundle"`, `universe: "cyberpunk"`, exact `character` key, numeric crew outfit or string board ID, `look: "armor-helmet"`, version `vNNN`, `status` |
| Registration | `cell: [width,height]`, `foot: [x,y]`, and `figureHeight` in native pixels. `reviewHeight` is the intended CSS height at normal board scale |
| Sources | `sources[]` records source labels and SHA-256 hashes. Private version records retain the editable inputs and regeneration instructions |
| Textures | `pages` maps stable keys to relative PNG `file`, `width`, `height`, `bytes`, and `sha256`. Pages are at most 2,048 by 2,048. Place padding between atlas rectangles for future filtered use |
| Fittings | `fittings[]` gives a unique fitting ID, label, full exact nine-slot `rig`, and a `motion` key. Empty hand, Back and coat slots use null. The left equipment slot is null for a two-hand fitting |
| Motion | `motions[motion][S|W|N|E]` provides `frames` and `clips`. S is front, N rear, W left and E right. Preserve asymmetric art on its intended side |
| Frames | Each frame declares ordered `layers[]` drawn back to front with `page`, source `rect: [x,y,width,height]` and cell-space `at: [x,y]`. A `when: {slot,part}` layer draws only when its exact part is equipped. `anchors` maps names to cell-space coordinates for grip, muzzle/tip, or mount review |
| Clips | Each direction requires `idle`, `walk`, `settle` and `attack`. A clip has ordered `frames: [{frame,ms}]`, a `loop` flag and optional `events: [{frame,cue}]`, with zero-based indexes into the clip. Extra clips can represent supported guard, damage and support actions |
| Composition | The campaign export can name a layered `body` motion and the `rifle` and `blade` two-grip donors in `composition`. Its body cels carry `left-grip`, `right-grip` and `back-mount`. Tag arm, glove and leg plates with `limb`, and conditional flashes with `effect: true`. |

An authored `mixed-reverse` track supplies left melee and right ranged poses while preserving the
character's asymmetry. Its conditional layers use the actual left and right equipment slots. The
campaign compositor can share a part layer within its supported visual family. Back activations can
use the two-grip donors, and specialized movement and recovery clips follow the resolved limb state.
The battle cues determine which effects play and when an action spends ammunition or repairs a rig.

Palette masks and individual editable pieces belong in private source. The current player draws
registered PNG fragments. A part's tint or cropped texture may be baked ahead into a small overlay,
leaving motion, footprint and common frames shared. For new shapes, give every part its own registered
layer with front and rear occlusion as needed. Create distinct compatible arm and prop poses when grips
or the action differ. Preview precomposed layers are useful when importing a locked source study.

Mixed offensive fittings provide `attack-left`, `attack-right` and `attack-back` for each mounted
weapon. Select these from the resolved `attack.with` cue. The legacy `attack` clip is the fallback
only when the fitting has one offensive mount. Keep the required v1 `attack` entry as a preview alias
and record the separate anchors and pulse markers for the fitted weapons. Keep non-firing equipment
visible in the carry and attack frames.

Run `node --import tsx src/check-combat-sprites.ts <version-folder>` from Uma Art Authoring. The album
uses the same parser and checks texture sizes, dimensions and hashes before playing a bundle. Use the
[coverage matrix](../handoff/combat-sprite-coverage.json) as the authoritative work list. Its
`pilot` and `partial` rows describe the first local delivery. Art approval is recorded separately.
Use the [ground combat visual matrix](ground-combat-visual-matrix.md) to define each clip's trigger,
recipient, persistent state and fallback. Damage and live equipment operation are separate from
the fitted part conditions in bundle v1.

## Work order

Follow [CY59's batch contract](../handoff/archive/CY59.md). The shared template owns the four
facings, pivots, motion families and fitted equipment. An outfit profile supplies its source
reference, palette and any replaceable visual identity layers. Run the full mechanics suite
when the shared template or renderer changes. Run automatic intake and export checks across
every batch, with targeted board review for geometry, grip, socket or timing changes.

Generate the private crew worklist from Art's canonical roster and approved wardrobe hashes.
The campaign input supplies the current pilot boarding routes for playtest selection.

```powershell
node scripts/art/plan-combat-sprites.mjs <art-universe-root> <campaign-release-dir> <private-output-json>
```

### Shared palette export

Use a pinned template version with its game bundle, placements, review receipt and
`layer-map.json`. The exporter samples the approved armor's paint, panels, metal, signal
lights, tail and undersuit. The shared layer map limits color changes to the actor's
material regions. To adjust individual colors, pass an optional final JSON file keyed by
character with RGB overrides for `paint`, `panel`, `metal`, `signal`, `tail` or `suit`.

```powershell
node --import tsx scripts/art/export-crew-combat-sprites.ts <roster-json> <template-version> <combat-sprites-category> <fresh-output-dir>
node --import tsx scripts/art/select-crew-sprite-drafts.ts <output-dir> <template-version> <art-checkout>
```

The first command writes all drafts, palette profiles, pinned intake receipts and board-size tier
contact sheets. The second checks the shared mechanics, alpha, material scope, hashes and Art
album format before selecting all drafts in the local album. Previous versions and selection
receipts stay available. The local draft selection uses the existing `active-bundle.json`
contract. Approved Platform and campaign publication use their own selection step.

### Local Training review

In PowerShell, point the review server at the verified private intake receipt and pick a local port.

```powershell
$env:CYBER_COMBAT_SPRITE_REVIEW=(Resolve-Path 'content/cy57-training-review/intake-v011.json').Path
pnpm --filter @cyber/web exec vite --host 127.0.0.1 --port 5231
```

The normal `/campaign` Training route uses the issued fitting from the Hangar. Open
`/__cy57-training?case=shield-cover&facing=E` to review Cover with a second legal squad unit.
Other case keys are in `apps/web/src/campaign/training-review-fixture.ts`. Each fixture replays a
saved prefix on the Training Deck and exposes one checked turn for playback. It uses a separate
local page and independent input, so the stock Training scenario, rewards and save flow keep their
normal rules. Use the verified identity in the private receipt for both routes.

The `mixed-left`, `mixed-right` and `mixed-back` cases share a frozen fitting. The prefix walks to
two tiles for the Machine pistol, closes to one for the Edge blade, and withdraws to three for the
Missile pod. Capture the selected clip and the reducer's outcome sequence, including the launcher's
single ammo spend. The comparison fixture retains the exact Training Deck terrain.

### Campaign release

The active campaign release can carry `combatSprites` entries keyed by canonical outfit. Each
entry pins its manifest, effect placements and PNG pages by SHA-256. The game loads matching
entries on Training and ground deployments. Exact-fit bundles still work. Composed bundles draw
only the frozen equipped pieces for each unit and use the reducer's mount and action cues for
animation. Core, arms, legs, visors and coat values share the base armor silhouette. Long and
short Back launchers share a housing, with distinct gameplay profiles and ammo in the forecast.
Thruster, Deck and Mounted blade have their own treatments. The source album uses exact fitted
previews. The campaign export adds the shared motion and damage bindings.

Use the verified private receipts for a local preview. Pass all receipt paths before the flags.
The script validates every bundle before staging the merged release. One local selection carries
all verified versions forward together. Add `--pilot` to target the Story pilot.

```powershell
pnpm exec tsx scripts/art/combat-sprites.ts <receipt-one> <receipt-two> --local <campaign-release-dir> --dry-run
pnpm exec tsx scripts/art/combat-sprites.ts <receipt-one> <receipt-two> --local <campaign-release-dir> --select
```

### Approved bundle publication

Art Authoring's existing Cyberpunk `combat-sprites` event runs the same game command shown below.
Use `--only` with exact character keys or canonical outfit IDs. The private producer approval
index defaults to `content/campaign-art-plan/combat-sprite-sources.json`. Pass `--sprite-sources`
or set `CYBER_COMBAT_SPRITE_SOURCES` to use the producer's current index from another checkout.

```powershell
pnpm art:publish --event combat-sprites --only officer-one --dry-run
pnpm art:publish --event combat-sprites --only officer-one --stage-only
pnpm art:publish --event combat-sprites --only officer-one
```

The index uses `schemaVersion: 1`, `universe: "cyberpunk"`, `campaign: "cyberpunk"`, a producer
`revision` and a `bundles` array. Each selected entry has:

| Field | Source |
| --- | --- |
| `character`, `outfit`, `version` | Exact album key, numeric campaign outfit and approved bundle version |
| `directory` | Export folder, relative to the index or absolute |
| `manifestSha256`, `placementsSha256` | SHA-256 of the approved game export's bundle and placement JSON |
| `pages` | Every exported page with its `file` and `sha256` |
| `approval` | `{ "by": "owner", "status": "approved" }` for those exact bytes |

The producer approval index records exact release approval. The earlier Training receipt can verify
drafts on the local board. Its visual acceptance applies to the recorded revision and scope.
For an owner-approved crew batch, use `scripts/art/approve-crew-sprite-batch.ts` with the validated
batch directory, a fresh private output directory, and the approval note. It checks the album
selections and draft hashes, and records approved exports with the same placement and page hashes.
For a withdrawal, set the approval status to `withdrawn` and retain only the actor, version and
manifest hash fields. Both selections must still match the withdrawn version wherever present.
The prior payloads and immutable releases remain available.

### Heroine board bundles

Heroine rows use a string board ID in `outfit` and specify a slug `form` plus
`roles`. One form can serve both `boss-enemy` and `boss-ally`; a lieutenant uses
`sub-boss`. Numeric outfit entries keep the existing format. The producer
matches each heroine role and form against the selected campaign's encounters
or legal Ally deployments, then stages under
`combat-sprites/heroine/<board-id>/<form>/` on Platform.

New ground inputs freeze the encounter's role, form and fixed opposing fitting.
The authored form defaults to `standard`. A playable Ally matches her exact
frozen rig or uses the compatible composition tracks. The same asset can render
either side while retaining the battle's original occupancy, reach and targeting.
The renderer uses committed Collar and Talk cues for their optional exit clips.

Use `--campaign pilot` for the pilot's separate channel, or omit it for the main
campaign. Check a draft through the local review command with `--pilot`, then
pass the approved index through the same Platform stage and selection commands.

A dry run validates source pins, identities, the selected campaign and Platform versions without
writing either destination. Staging writes and reads back immutable Platform and campaign objects
before moving any pointer. Publication uses generation checks to advance the approved actors on
Platform, then the game's campaign pointer. The candidate preserves the selected story, wardrobe,
image and unselected sprite references. The private receipt records the source revision and hash,
scope, campaign generation, completed stages and any failure.

After reviewing a staged batch in the game, rerun the event with the same approval index and scope
and pass `--from-staged <release>`. It reads back the exact staged objects before selection and
refuses to activate a different campaign candidate.

If an interruption leaves Platform ahead of the game, re-run the same scoped event against the
current selections. An identical completed event is a no-op. A superseded approval or version
requires a new producer index. `pnpm art:publish --event combat-sprites --rollback <release>` restores
a verified game release and writes a rollback receipt. Platform keeps its current selection.
