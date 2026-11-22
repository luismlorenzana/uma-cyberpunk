# Combat sprite authoring and album bundles

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

Palette masks and individual editable pieces belong in private source. The current player draws
registered PNG fragments. A part's tint or cropped texture may be baked ahead into a small overlay,
leaving motion, footprint and common frames shared. For new shapes, give every part its own registered
layer with front and rear occlusion as needed. Create distinct compatible arm and prop poses when grips
or the action differ. Preview precomposed layers are useful when importing a locked source study.

Run `node --import tsx src/check-combat-sprites.ts <version-folder>` from Uma Art Authoring. The album
uses the same parser and checks texture sizes, dimensions and hashes before playing a bundle. Use the
[coverage matrix](../handoff/combat-sprite-coverage.json) as the authoritative work list. Its
`pilot` and `partial` rows describe the first local delivery. Art approval is recorded separately.

## Work order

1. Review the Laser rifle with Bulwark, Great blade with Bulwark, and Laser rifle with Med unit in the
   local album. The pair of rifle fittings shares its clips and changes the Back layer. Close the
   first crew member's remaining pose and equipment coverage against the matrix before roster rollout.
2. Extend the existing Cyberpunk Art publisher with a bundle index under
   `art/universes/cyberpunk/combat-sprites/` in the private Platform bucket. Publish approved versioned
   manifests and their hash-addressed pages, then update the index. Platform's existing Combat Sprites
   gallery can link a rendered preview. This is the next delivery after the local milestone.
3. CY57 imports the approved bundle into a campaign art release. Capture exact part IDs with the
   battle fitting, resolve its draw layers when entering the battle, and drive clips from actual cues.
   Check Training, boarding, replay, texture footprint and the physical iPhone. CY60 follows with
   the matching enemy bodies and their distinct equipment coverage.
