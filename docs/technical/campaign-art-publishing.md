# Approved art to Platform and the Cyberpunk campaign

`uma-art-authoring` publishes approved Cyberpunk sources to its existing Platform collections, then
runs this game's `art:publish` CLI. The game builds an art-only candidate from the currently selected
private campaign. The candidate retains its story, quests, gates, rules and save IDs. No web build
is required for a replacement that the deployed presentation format already supports.

The source of truth for scenes and layering is the [campaign contract](campaign-content.md).
CY48's optional composition supports room plates/poses and a talking portrait over the illustration.
The relationship flow and draft overnight scripts are implemented in CY48. Final character poses,
expressions and Story approval remain in CY49/CY50.

## Two deliveries and their boundaries

The [six-look wardrobe](campaign-wardrobe.md) implements Ship Casual and all 300 identity/role
bindings, with 600 dialogue/profile crops and reviewed scene routing. CY67 integrates the 46
approved general sources, including the 25 absent from CY54, and independent Fuel/Provisions props.
The compatible reader must deploy before selecting this reviewed content migration. Subsequent
approved replacements use the art-only path below. [CY68 and CY69's first approved cohort](campaign-art-intake.md)
add the supported strike composition and first environment bindings. [The full CY69 delivery](campaign-environments.md)
integrates the remaining approved environments and scoped setting fixes. New first consumers require a reviewed content migration;
subsequent registered-image replacements follow the same general-art publisher.

| Delivery | Destination | What it changes |
|---|---|---|
| Authoring publisher | `art/universes/cyberpunk/` and `enemy-art/cyberpunk/` in the existing private content bucket | Approved looks, splashes, portrait recipes and supported categories visible to Platform |
| Game publisher | `campaign/cyberpunk/` in that bucket | Hash-addressed game images, an immutable campaign manifest and finally its selected pointer |

The game storage adapter only reads those Cyberpunk prefixes and only writes its campaign prefix.
It cannot write the master-data bucket, its `latest`/`candidate` channels, Farm art or any other game.
The existing Farm publisher still follows its existing Platform release hook. Cyberpunk never enters
Farm's character-indexed portrait/illustration families, avoiding same-character universe collisions.

Both sides verify bytes. Platform publication completes first. If the game step fails, Platform can
already show the approved source while the game needs repair; the command exits nonzero and prints
the repair path. Inspect the receipt and current selection after a final network interruption.
Re-running the game CLI imports the already-published source and is idempotent. Never roll back
Platform's index automatically over another authoring session's work.

## Private bindings

Keep the registry at `content/campaign-art-plan/art-publish.json`, or set `CYBER_ART_CONFIG`/`--config`.
Bind the exact published identity/look to an existing game asset ID. Named private cast belongs here,
not in git. The following names and numeric speaker are synthetic examples.

```json
{
  "schemaVersion": 1,
  "bindings": [
    {
      "asset": "officer-pilot",
      "from": { "collection": "looks", "character": "Officer One", "outfit": "pilot" }
    },
    {
      "asset": "commander-station",
      "from": { "collection": "enemies", "unitId": "synthetic-commander", "look": "combat-station" }
    },
    {
      "asset": "officer-weapon",
      "from": { "collection": "looks", "id": "officer-one-rifle", "category": "weapons" }
    }
  ],
  "portraits": [],
  "wardrobes": [
    { "speaker": 9000001, "character": "officer-one", "from": { "collection": "looks", "character": "Officer One" } },
    {
      "speaker": "synthetic-commander", "character": "commander-one",
      "from": { "collection": "enemies", "unitId": "synthetic-commander" },
      "default": "combat-station", "after": "commander-release", "requiresFlag": "commander-released",
      "labels": { "combat-station": "Command Suit", "quarters-front": "Quiet Hours" },
      "routes": [{ "scene": "commander-evening", "outfit": "quarters-front" }]
    }
  ]
}
```

Selectors are exact source metadata, not inferred character-name matches. `--only` scopes the source
IDs/character keys/names or enemy selectors passed by the authoring publisher. Category events remain
distinct. Multiple source matches fail. Future-tier game assets absent from the selected campaign
are reported as unbound and do not pull their story drafts into a live release. A new scene or action
must first have an implemented, selected campaign binding before its image can appear.

### Automatic cast wardrobes (CY70)

`wardrobes` registers exact story speakers, portrait-library character keys and native collection
identities. These mappings are authored privately once; runtime does not infer a speaker from a name.
The publisher discovers each registered actor's approved native outfits and available portrait recipes.
Existing native asset IDs and mechanical crop recipes remain intact. New outfits receive deterministic
asset IDs. Optional `labels` supply approved display names without renaming source keys.

All six crew roles remain required. Ally wardrobes may use their actual published outfit keys and a
declared `default`. `after` names the existing release/hearing scene that unlocks their wardrobe in
Crew Stories; optional `requiresFlag` also requires its existing release outcome, so merely reviewing
a release choice cannot expose the wardrobe while custody continues. Neither awards progress.
`routes` explicitly assigns an outfit to an existing scene. No
choice, line, relationship, release gate or quest changes through these fields. A route whose outfit
has not landed waits for that source; it does not block an actor's approved subset.

Looks, enemies and portraits events reconcile both native art and available expression recipes for
their scoped actors. Missing future recipes are reported as pending. Future approved outfits and sparse
states on registered actors need no new game code, registry entry per expression, or web build. Existing
explicit `bindings` continue to control non-wardrobe illustrations and equipment. New cast identities,
new scenes and changes to gameplay still require their own implemented campaign content.

The native full-body master, its mechanical dialogue/profile crops and the approved expression-library
base are separate assets. `WardrobeLook.portrait` selects that library base for talking portraits.
Face coordinates remain in its literal pixels; a normalized bust never replaces a full-body master or
borrows its crop coordinates. Native revisions refresh their existing mechanical crops. Portrait-base
revisions replace their sparse recipes together. Withdrawn states disappear from that recipe, and a
withdrawn portrait base falls back to the native/derived neutral. No flattened expression matrix or
additional mask layer is required. Missing expression tags use neutral.

Campaign dialogue, matching ship-command portraits and the read-only wardrobe expression preview
consume the same speaker/base-specific placements. Bespoke scene poses, backgrounds, combat models
and equipment composition retain their own contracts. Approved source publication does not approve
unmade character poses or complete CY49/CY50/CY55/CY56/CY59.

An approved local campaign asset uses `collection: "local"`, its stable `id`, a `file` relative to this
game's `content/`, and `approval: { "by": "owner", "sha256": "<approved-64-hex-hash>" }`.
The file's resolved path must remain inside content. `--event general` imports these assets into
the game. Character and reusable assets use their existing Platform collections; this command does
not invent a Platform gallery for campaign-local scenery.

## Portrait recipes and profiles

Add a `portraits` entry for each existing neutral game base to consume the published Cyberpunk portrait
recipe. The base, face pieces and positions are read from one index snapshot and verified together.

```json
{
  "base": "officer-pilot",
  "speaker": 9000001,
  "character": "officer-one",
  "outfit": "pilot",
  "profile": {
    "asset": "officer-pilot-profile",
    "baseSha256": "<reviewed-base-64-hex-hash>",
    "crop": { "left": 40, "top": 20, "size": 240 }
  }
}
```

Neutral remains the base. Non-neutral states require the published approved-state hash, correct
character/outfit, a face image and an in-bounds placement. The game retains native portrait/face
pixels and reuses identical face bytes across outfit placements. An optional reviewed crop becomes
a 192 × 192 WebP profile. New base bytes invalidate an old profile crop's hash binding; review and
update the registry instead of silently using stale coordinates. Replacing a base that already has
face placements requires its expression recipe in the same publication.

The optional campaign wardrobe declares native-master crop recipes and their dialogue/profile
consumers. A compatible replacement regenerates both mechanical crops from new native bytes.
Changed dimensions require a reviewed recipe; native or derived face placements require their new
recipe in the same push. Coordinates are translated into the dialogue crop and checked against its
bounds. The gameplay fingerprint excludes image declarations, scene art, face placements and wardrobe
presentation. All story files and the remaining campaign rules remain fingerprinted. The complete
candidate is parsed before upload, and selection still requires the original pointer generation.
Identical published native hashes avoid downloading the full image again. Cloud reads/uploads use
bounded workers and settle started work before reporting a failure.

## Commands

From the authoring checkout, the normal commands publish to Platform and then to the game:

```powershell
pnpm run publish cyberpunk --only officer-one
pnpm run publish cyberpunk --portraits --only officer-one
pnpm run publish cyberpunk --enemies --only synthetic-commander
pnpm run publish cyberpunk --category weapons --only officer-one
```

The game checkout is resolved from `UMA_CYBERPUNK_ROOT`, then the existing ignored authoring handoff's
`canonicalGameCheckout`, then the sibling of `UMA_PLATFORM_ROOT`. The hook launches Node directly
with an argument array, preserving scoped selectors on Windows. `--no-release` stops at Platform.
A publisher `--dry-run` also dry-runs the game using currently published sources; sources not yet
uploaded are reported as pending, so it does not claim to verify future bytes.

From this game checkout:

```powershell
pnpm art:sync --only officer-one --dry-run
pnpm art:sync --only officer-one
pnpm art:publish --event looks --only officer-one --dry-run
pnpm art:publish --event enemies --only synthetic-commander --stage-only
pnpm art:publish --event portraits --only officer-one
pnpm art:publish --event general
pnpm art:publish --select art-0123456789abcdef0123
pnpm art:publish --rollback previous-reviewed-release
```

`art:sync` is the complete wardrobe delivery: it runs the existing authoring publisher for looks,
enemy/ally looks and portrait pieces, scoped to each relevant collection's registered actor keys with `--no-release`, then runs
one game import. Set `UMA_ART_AUTHORING_ROOT`, `--authoring-root`, or private registry `authoringRoot`
to the real authoring code checkout. The explicit registry resolves crew IDs and ally keys. Native
ally publication uses stable unit IDs across renamed records; portrait publication uses library keys.
An unknown actor or failed source stage stops before game selection.
The producer still validates every owner approval and hash. `--dry-run` sends nothing and the final
game preflight reads currently published sources; `--stage-only` publishes sources but only stages the
game candidate. Both retain the existing failed-publication recovery rules below. Art sessions may
also continue using their scoped individual source commands.

The accepted sparse workflow promotes expression studies into the shared portrait library. Sync reads
only that library's character-name keys to discover available portrait identities; the producer remains
responsible for all approval/hash checks. Registered allies absent from the library are pending, and
their native wardrobes can still ship. Promoting their approved study makes the next sync include it.

`--stage-only` uploads and reads back a candidate without selecting it. Selection/rollback verifies
the immutable files and refuses a different gameplay/story release. Normal publishing selects after
validation. Local JSON receipts record the base release/generation, selected candidate, source index
hashes, binding hash, gameplay fingerprint, changed IDs and pending bindings. Use `--receipt` to name
a specific evidence file. Failed imports also leave a failure receipt once the base is loaded.

## Transaction and recovery

1. Read the selected campaign pointer and verify its story files. Use those immutable files as the base.
2. Read the scoped published Cyberpunk indexes, verifying universe, approval metadata and image hashes,
   sizes, dimensions, portrait identities and coordinates. Draft local edits are not remote sources.
3. Build a candidate changing only declared art/presentation. Check the gameplay fingerprint and run
   the campaign parser. Reused assets retain their exact references. A no-op does not move selection.
4. Recheck source snapshots, upload changed immutable images and the manifest, and read them back.
5. Recheck the sources and base pointer. Replace selection using its exact object generation as the
   write precondition. Concurrent story/art publication causes a safe conflict and rebuild.

Old images and manifests remain available. The client reads the mutable pointer at entry or its
content check and validates payload hashes. An already open scene keeps the loaded release until
the game checks for an update; artwork does not reset a save or award story effects.

New art formats require deployed reader support before selecting them. For example, a composition
can use the CY48 layer contract, but publishing a weapon sheet does not implement CY57's sprite
equipment system, and an attack picture does not implement CY61's signature action.
