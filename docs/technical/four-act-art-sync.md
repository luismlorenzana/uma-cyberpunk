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
| Seraine | Original collection. Reconcile any installed art by the original actor ID and approved game destination. Dedicated Platform route pending. | Original collection. Preserve the five installed Queen finale splash bindings. The scene-splash publisher has no Seraine role. | Original collection. Confirm an approved recipe for the exact outfit and speaker. A route from original expressions to Platform and the game is pending. | Original collection. Track authored motion by actor, form and encounter. The complete-bundle publisher currently accepts crew outfits and ranked heroine roles. |

Here, base art means approved native looks and their game dialogue/profile crops. Expression
recipes include their own neutral base, face pieces, placements and tags. If a base revision
changes coordinates, put the dependent crop and recipe in the same candidate and record both
changes in their respective batches. A mixed-cast splash has one source row and an explicit
supporting cast at the destination.

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
   Sprite staging verifies immutable objects for both destinations. The first Seraine batch
   needs a reviewed original-identity and destination mapping through [CY128](../handoff/tasks/CY128.md)
   before it uses a dedicated publisher. Existing Seraine bindings are evidence for that intake.
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
