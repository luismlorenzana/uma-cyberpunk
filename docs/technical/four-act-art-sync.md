# Four-act art synchronization

[CY96](../handoff/tasks/CY96.md) owns synchronization from approved Art Authoring sources through
Platform and into the selected four-act campaign. Open one intake batch for each **cast category
× art type** below. Track source approval, Platform publication, campaign destination approval,
staging, and selection on the same batch. The first inventory is
`content/art-sync/intake-2026-11-26.json` in the private game workspace.

## Publishing routes

| Cast category | Base art | Splash | Expressions | Sprites |
| --- | --- | --- | --- | --- |
| Character | Approved Uma look IDs in Character Art. Import with `looks`. | Scene-splash role `crew`. Bind by source ID and reviewed scene or action. | Published portrait recipes for the selected Uma keys. Import with `portraits`. | Approved bundle keyed by numeric outfit. Verify the actual rig and motion. |
| Boss | Enemy Art look IDs for the General. Track enemy, custody, resident and cleared ally use by destination. Import with `enemies`. | Scene-splash roles `boss-enemy` and `boss-ally`. Run each role separately. | Published portrait recipes for the General's keys. Bind the exact outfit and role used in the scene. | Approved bundle keyed by board identity and form. Confirm `boss-enemy` and/or `boss-ally` for the game fitting. |
| Lieutenant | Lieutenant look IDs in Enemy Art. Import with `enemies` using only those IDs and their game bindings. | Scene-splash role `lieutenant`. Bind canonical Platform IDs to the exact scenes and supporting cast. | Published portrait recipes for selected Lieutenant keys. Verify pre-return and returned scene routing. | Approved bundle keyed by board identity and form, with the campaign role `sub-boss`. Check encounter and returned-ally fittings. |
| Seraine | Publish active original bases with `art:originals`. Match the original actor and state to an exact four-act asset. | Publish the original splash album alongside bases. Keep the existing combat scene keys and bind variants to their reviewed destinations. | The original image channel accepts approved standalone expressions. Campaign use requires a matching expression asset. Face-crop recipes require the reviewed base, crop geometry and dialogue routing. | Publish static views in the original collection. Publish active approved complete animation bundles under an original combat-sprite key. Bind the fixed appearance to the approved actor, joined form and encounter. |

Here, base art means approved native looks and their game dialogue/profile crops. Expression
recipes include their own neutral base, face pieces, placements and tags. If a base revision
changes coordinates, put the dependent crop and recipe in the same candidate and record both
changes in their respective batches. A mixed-cast splash has one source row and an explicit
supporting cast at the destination.

## Campaign portraits and combat splashes

The Roster and recruitment menus prefer an approved profile crop for the current outfit,
then its approved portrait, dialogue crop or native look. The cabin directory and care rooms
use the existing resident and custody states. A returned Lieutenant is eligible for her roster
portrait even when her place on the roster is derived from a completed return.

The art release can bind a station splash to the actor who is actually speaking from her station.
A ground splash matches the deployed actor, side and recorded hand weapon. It plays for a resolved
signature or the matching Laser rifle Thermal fire mode in full cut-in playback. Quick and off settings
keep their normal pacing. These are presentation fields in the wardrobe and add no battle actions.

Story-only artwork stays in the Platform album until a reachable scene has the depicted cast,
outfit and phase. Existing ordered cuts keep their timing and return cues.

## Source and release mechanics

- **Art Authoring.** Use the active approved manifests in `uma-art-authoring`. Pin the source
  revision, approved asset ID and exact image or bundle SHA-256. Seraine uses the original registry
  under `content/authoring/character-universes/cyberpunk/originals/seraine/`. Keep its original actor
  IDs, ranks and courts in the private handoff. Follow the [original-character contract](https://github.com/luismlorenzana/uma-art-authoring/blob/feat/initial-preview/docs/original-character-authoring.md).
- **Platform.** The private `gs://uma-platform-content` bucket has Character Art at
  `art/universes/cyberpunk/index.json` and shared Boss and Lieutenant looks at
  `enemy-art/cyberpunk/index.json`. Expressions use the `portraits/index.json` under Character Art,
  splashes use `scene-splashes/index.json`, and sprites use `combat-sprites/<key>/index.json`.
  Read back the indexed bytes and generation after publication. Platform's gallery consumes
  approved indexes, while Cyberpunk binds approved payloads to the game. The Platform
  master-data `art:release` flow is for its master-data consumers.
- **Cyberpunk.** Use `--campaign four-act`. The private selected pointer is
  `campaign/cyberpunk/campaign/four-act.json`, with immutable manifests under
  `campaign/cyberpunk/campaign/releases/four-act/`. The [publisher](campaign-art-publishing.md#transaction-and-recovery)
  verifies sources, bindings, gameplay fingerprint, staged payloads and the pointer generation.

## Run a scoped batch

1. Record the category, type, source and approval hashes, exact actor and role, and each proposed
   game destination in the ignored `content/art-sync/` workspace. Include the outfit and emote,
   scene and branch, action, or gear and fitting where relevant. Retain explicit fallbacks and
   mark missing or rejected destination approvals separately from source approval.
2. Dry-run the exact producer scope, then verify the approved payloads and index readback. For
   base/look pushes use specific approved look IDs. For expressions use the exact portrait-library
   keys. From Art Authoring, the usual preflights are:

   ```powershell
   pnpm run publish cyberpunk --only $lookIds --no-release --dry-run
   pnpm run publish cyberpunk --enemies --only $lookIds --no-release --dry-run
   pnpm run publish cyberpunk --portraits --only $portraitKeys --no-release --dry-run
   ```

   Set `$lookIds` and `$portraitKeys` to the corresponding comma-separated IDs for one category.
   Re-run the reviewed source command without `--dry-run` to publish to Platform. Keep
   `--no-release` so the game's candidate can be reviewed independently. A whole Character
   selector can also match splashes. The dedicated splash command below validates one album role
   at a time, with `$authoringContent` pointing to the Art Authoring `content/authoring` directory.
   Its dry run validates local source files. Compare its source IDs and hashes to Platform for the
   actual delta. Use the sprite publisher for its combined staging transaction in step 3.

   ```powershell
   pnpm exec tsx scripts/art/publish-splashes.ts "$authoringContent" --role=crew --dry-run
   ```

3. Dry-run the game event for that scope, then stage with `--stage-only`. For base art and
   expressions, pass the private `--config` registry narrowed to the approved bindings. Use
   explicit portrait rows when a batch should only change expressions. Automatic wardrobe
   reconciliation can bring both native art and dependent recipes into the same candidate.
   For splashes and sprites, use the matching private binding or approval index.

   ```powershell
   pnpm art:publish --campaign four-act --event looks --config "$bindings" --only $gameKeys --dry-run
   pnpm art:publish --campaign four-act --event splashes --splash-bindings "$splashBindings" --only $sourceIds --dry-run
   pnpm art:publish --campaign four-act --event combat-sprites --sprite-sources "$spriteSources" --only $spriteKeys --dry-run
   ```

   Use `enemies` for Boss or Lieutenant base art and `portraits` for an expression batch.
   Sprite staging verifies immutable objects for both destinations. Use the original publishing
   route below for Seraine. Existing Seraine bindings remain evidence for [CY128](../handoff/tasks/CY128.md).
4. Review the candidate in the actual scene or encounter and confirm the receipt records only
   the expected assets and presentation changes. Select the reviewed immutable game release
   with `pnpm art:publish --campaign four-act --select $release`. For sprites, use the same
   scoped command with `--from-staged $release` in place of `--dry-run`. This moves the verified
   Platform indexes before the game pointer. Read the selected generation back and retain
   the prior release for [rollback](campaign-art-publishing.md#transaction-and-recovery). A
   pointer conflict requires a fresh dry run against the new selected release.

The receipt records category, type, asset IDs, source and approval pins, Platform index generation,
game destination status, candidate and selected releases, and verification results. Keep exact
source IDs, images, named cast and review evidence under ignored `content/`.

## Original collections

Pass the original album directory containing `collection.json` and the reviewed private
binding file. Each binding gives the destination `asset`, exact Art `source` ID,
approved `sha256` and current destination hash in `prior`. Use `prior: null` only
for a new joined-base key for an existing named opponent. The publisher checks the
active study and per-image owner approval, verifies the native bytes and preserves
the original actor, rank, court and depicted state in the Platform index.

```powershell
pnpm art:originals --album "$originalAlbum" --bindings "$bindings" --receipt "$receipt" --dry-run
pnpm art:originals --album "$originalAlbum" --bindings "$bindings" --receipt "$receipt" --stage-only
pnpm art:originals --album "$originalAlbum" --bindings "$bindings" --receipt "$receipt" --expect-release "$reviewedRelease"
```

Staging writes the verified Platform index at
`art/universes/cyberpunk/originals/<collection>/index.json` and an immutable
campaign candidate. Review that candidate in the authored scenes or encounters before
selecting it. The normal command rechecks the source, Platform and campaign generation
before selection. Mounting Summit, resting and other undirected variants belong in the
Platform album until an exact Story beat calls for them.

For animation, use the existing `combat-sprites` approval index and include an
`original` object with the namespaced album `actor`, `rank`, `court` and
reviewed `weaponBand`. Use the existing Story actor as `outfit`, `joined` as
`form` and `boss-enemy` as the game role for a named opponent. The writer checks the
active bundle selection, owner approval receipt, placement rows and frozen atlas pins.
With `compatibleOnly: true`, an empty `loadouts` list publishes the approved bundle
to Platform for review. A playable assignment adds the exact encounter unit fitting
and matching hand mount. The board checks the deployed weapon band before selecting the
clip. Review all four facings and attack timing in that encounter before selection.
