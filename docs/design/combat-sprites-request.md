# Combat sprites: full-proportion cel-shaded first character

> **Historical source trial.** Use [CY95](../handoff/tasks/CY95.md) and the compact bundle contract for current production.

**Earlier 3D source study · 2026-11-20 (D77).** Use the [current compact 2D bundle contract](../technical/combat-sprite-bundles.md)
for active sprite authoring. This archived source trial built one real recruit with full adult proportions and clean
cel shading, then export 2D sprites from the editable 3D source. [CY59](../handoff/archive/CY59.md) owns
the character source, [CY58](../handoff/archive/CY58.md) equipment and [CY57](../handoff/archive/CY57.md)
game integration. [CY63](../handoff/archive/CY63.md) keeps the actual cast and staging aligned.

## First character and campaign loadout

Use the recruit identified in the current private first-cohort handoff. Pin her approved helmeted
combat armor, identity references and palette. Match the full adult proportions and armor design
of the approved full-body reference. Preserve the
helmet/ear housings, tail, emblem and anatomical asymmetry. Record any unshown construction that
needs interpretation. The model is a sprite-authoring source with its own review status.

Start with the existing issued Training rig: **right-hand `hand-rifle`, empty left equipment slot,
Back `back-bulwark`**, with the issued core/arms/legs/visor. The rifle uses both anatomical hands:
right primary grip, left support. Render both the rifle and Bulwark as fitted parts. Pin the current
equipment sources and identify draft sources or explicit placeholders. Source approval and new
model/export approval are separate. The shield and compact-pod references in CY58 retain their
exact approvals and follow after the first loadout works.

CY57 uses this same recruit in the authored Training encounter and a supported fitting in the
actual first boarding mission. Its private handoff records the outfit, quest, encounter and rig IDs.
Check the frozen battle loadout and legal capacity; art never substitutes another weapon's rules.

## Editable source and reproducible render

Use the [reusable mesh and rig foundation](../design/character-base-rig.md) (D78). Its bounded
MPFB/Rigify study passes technical feasibility. The owner now requests the
[full armor and visual-quality pass](../handoff/archive/CY59.md#current-checkpoint--complete-armor-and-visual-quality-d79)
(D79) on this same source, recruit and equipment. Review the complete helmet, torso, limbs, gloves,
boots, materials and contacts against the approved reference. Preserve earlier projects and exact
source approvals; the new model/render has its own review status.

Return the native project, preferably a Blender `.blend`, with its dependencies and an executable
batch render/export script or equivalent reproducible command. Record the application/version.
Keep body, helmet, hands, tail and equipment as identifiable objects or collections. Reuse a named
skeleton, family poses and material zones. Equipment stays independently replaceable in the source.
Name anatomical hand contacts and Back/shoulder sockets; document the coordinate system.

Render every direction from the **same model, rig and pose**. Preserve asymmetric details by rotating
the source, rather than reflecting its image. Keep the orthographic render camera, light, ground
root and scale fixed. Begin at the board's **35-degree downward elevation**, with no horizontal
board rotation. Check the result in campaign before freezing the exporter profile.

| Export facing | Battle direction | Required orientation |
|---|---|---|
| `front` | South | Whole body and equipped action point toward the viewer |
| `back` | North | Whole body and action point away; rear armor and tail read clearly |
| `left` | West | Whole body and action point image-left |
| `right` | East | Whole body and action point image-right |

The game continues to display 2D sprite frames. Source 3D geometry supplies repeatable views and
contacts. The game camera's height compensation preserves the rendered image's proportions.

## Model quality and clean cel rendering

Use [Hardline Anime](art-direction.md): confident contours, designed armor planes, broad controlled
cel shadows, clear local colors and restrained highlights. Model the helmet, visor, chest/abdomen,
hips, joints and boots to match the approved silhouette. Use appropriate smooth normals on curves
and deliberate hard edges on plates. Check stance, limb proportions and believable equipment
contacts. Keep the rifle distinct from the arms and torso in the front view.

First review the full-proportion model at a generous inspection size, including a body-only view
beside the approved reference and an equipped three-quarter view. These are source-quality views;
the four board facings still come from the same fixed camera. A larger image of the earlier blockout
does not establish model quality. Preserve prior prototypes as history and reuse rig/exporter work
where useful, updating bones, contacts and sockets to the new proportions.

Render smooth, antialiased transparent edges and controlled cel-shaded surfaces. Remove the previous
low-resolution pixel cleanup, global palette snapping, binary-alpha threshold and automatic native
one-pixel contour from this export path. Contour weight is art-directed at the intended display
size. Preserve the exact approved palette while simplifying detail for readability.

| Property | Initial review profile; CY57 checks the final runtime choice |
|---|---|
| Master frame | 512 × 512 RGBA PNG, rendered with antialiasing |
| Ground anchor | `(256, 480)` from top-left; normalized `(0.5, 0.9375)`; fixed through motion |
| Standing figure | Approximately 416 source pixels, preserving full adult proportions |
| Runtime candidates | Master-size or clean filtered 256 × 256 derivative; record scale and anchor for each |
| Appearance | Clean cel shading, smooth alpha coverage and consistent front-left lighting |
| Clear canvas | Full character, tail and equipped parts with padding; game supplies floor, shadow, ring and FX |

Texture resolution and in-game figure size are separate. CY57 reviews the same model around
80 and 100 CSS pixels tall at 844 × 390 before choosing a common display scale. Check helmet,
limbs, equipment, cover and adjacent units at both sizes. Preserve one-tile occupancy. Keep facing
scale consistent and extend the export bounds when necessary. Record the corresponding anchor
and filtered derivative dimensions; avoid clipping or per-facing body-size changes.

The existing importer and shared actor have pixel-oriented sizing/filter defaults. CY57 must check
or extend the adapter for source resolution, world scale, alpha and sampling. The proposed master
and derivative do not claim that those capabilities or the new atlas binding are implemented.

## Delivery sequence for this one character

1. **Model and standing review.** Return the polished full-proportion model/rig/equipment,
   repeatable exporter, source-quality views and four equipped standing renders. Show the same
   clean renders at proposed phone sizes and at inspection size. Development places this
   exact rig in the real campaign. Body-only views and object-ID/depth passes are generated QA
   aids when useful, rather than separate character paintings.
2. **First playable motion.** From the same source, export a short planted walk loop, rifle
   ready/fire/recovery, a readable hit/guard reaction and Rig Break/reboot. Use a small set of
   clear key poses. Art supplies frame IDs, durations and holds; CY57 records the checked action
   mapping before animation expands. The game drives the actual pulses, hits and results.
3. **Integrated acceptance.** Exercise Training, funded preparation and the next real boarding
   encounter. Check all directions, cover, selection, saved facing, interrupted playback, missing
   art and disabled-part behavior. Then prove a second loadout from the same reusable source.

Keep ordinary attack effects, warnings and numbers in game presentation. Character-specific
signature rules and splashes remain CY61/CY62. Further identities and opponents follow the first
equipped checkpoint and shared export profile.

## Export and integration handoff

Return the native project, scripts, packed/linked resources, source and equipment versions/hashes,
render settings, material/palette zones, frame sequences and a proposed atlas. A private manifest
maps body/look, exact rig IDs, facing, action, frame index, timing, ground anchor, bounds and
attachment/occlusion passes to source hashes and approval scope. CY57 supplies the executable
schema; proposed fields remain labeled until implemented. Include a short regeneration command.

The first supported rig may use a fully equipped atlas rendered offline. This proves the real
character with correct visibility before general modular composition is finished. Other rigs
retain accurate existing fallbacks; that atlas must never silently represent a different loadout.
Keep reusable 3D components. CY57 then selects and measures reusable render passes/composition or
supported pre-rendered variants, with a bounded encounter cache and explicit coverage. Export only
the combinations needed for reviewed campaign cohorts.

Store projects, images, named cast, prompts, approvals and screenshots in ignored private content.
Record design approval, model review, cel-render/export review, valid runtime import, Platform publication
and campaign integration separately. Preserve older source approvals and pinned handoffs.

## Production references

The [Dead Cells artist's workflow](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)
describes reusable rigged 3D sources and sprite export. [Factorio's graphics workflow](https://www.factorio.com/blog/post/fff-146)
describes reusable Blender render scenes and sprite post-production. These support the authoring
method; D77 selects full proportions and clean cel rendering for our actual character design and view.
