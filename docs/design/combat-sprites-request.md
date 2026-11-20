# Combat sprites: 3D-to-pixel first-character brief

**Current request · 2026-11-20 (D76).** Build one real recruit as an editable, equipped 3D authoring
asset and render pixel sprites for the existing campaign. [CY59](../handoff/tasks/CY59.md) owns
the character source, [CY58](../handoff/tasks/CY58.md) equipment and [CY57](../handoff/tasks/CY57.md)
game integration. [CY63](../handoff/tasks/CY63.md) keeps the actual cast and staging aligned.

## First character and campaign loadout

Use the recruit identified in the current private first-cohort handoff. Pin her approved helmeted
combat armor, identity references and palette. Preserve the armor design, chibi proportions,
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

## Pixel rendering profile to prove first

Adapt [Hardline Anime](art-direction.md) into pixel sprites: clear silhouettes, broad cel-shadow
groups, restrained highlights and the approved colors. Simplify small details for phone readability.
Use a deliberate low-resolution render and pixel cleanup; retain stable pixel clusters through
motion. Record cleanup steps so a revised source can regenerate the result.

| Property | First export profile, subject to the campaign review |
|---|---|
| Native frame | 128 × 128 RGBA PNG |
| Ground anchor | `(64, 120)` from the top-left; the ground root stays fixed through motion |
| Standing figure | Approximately 96 native pixels from highest helmet/ear point to soles |
| Runtime-frame candidate | Exact 2× nearest-neighbor export to 256 × 256; anchor `(128, 240)` |
| Appearance | Crisp pixel edges, controlled alpha and consistent front-left lighting |
| Clear canvas | Full character, tail and equipped parts with padding; game supplies floor, shadow, ring and FX |

The runtime candidate matches the existing shared cell/foot convention; it is not a claim that the
new atlas, actions or loadout binding are already implemented. CY57 validates the importer and
profile at 844 × 390, aiming for roughly 64–72 CSS-pixel figure height on the target phone. Check
other device ratios too. Extend bounds or revise the common profile if a real silhouette needs
space; keep facing scale consistent. A readable enlarged review is generated from native pixels.

## Delivery sequence for this one character

1. **Standing source review.** Return the editable model/rig/equipment, repeatable exporter, four
   equipped standing renders and phone-size/enlarged contact sheets. Development places this
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
Record design approval, model review, pixel-export review, valid runtime import, Platform publication
and campaign integration separately. Preserve older source approvals and pinned handoffs.

## Production references

The [Dead Cells artist's workflow](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)
describes rigged 3D sources exported as pixel frames. [Factorio's graphics workflow](https://www.factorio.com/blog/post/fff-146)
describes reusable Blender render scenes and sprite post-production. These support the authoring
method; our approved references and campaign board determine the actual character design and view.
