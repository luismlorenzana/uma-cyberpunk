# Reusable character mesh and rig foundation

**D78 · 2026-11-20.** Start with an established human mesh, supplied skin weights and a reusable
control rig. Test MPFB with Rigify on the same first recruit before replacing the current source.
Keep D77's full adult proportions, approved armor, clean cel shading and offline 2D sprite exports.
The [first-character brief](combat-sprites-request.md) remains the campaign/export contract.

## Resources and selection

| Resource | Supplies | Role and license |
|---|---|---|
| [MPFB / MakeHuman for Blender](https://static.makehumancommunity.org/mpfb/docs/getting_started.html) | Parametric human mesh, body targets, supplied weights and supported rig workflows | First candidate for body and skinning. MPFB code is GPLv3; bundled core graphical assets, including meshes, targets, rigs and weights, are CC0. Check any additional assets separately. |
| [Rigify](https://docs.blender.org/manual/en/latest/addons/rigify/index.html) | Metarig and generated animation/control rig | Use MPFB's supported generation workflow with matching weights. Rigify alone does not supply a body mesh. Keep its software license with source dependencies. |
| [Blender Studio Human Base Meshes](https://www.blender.org/download/demo-files/) | Realistic and stylized body, head and hand meshes | CC0 alternative for mesh quality; requires rig fitting and skinning. It is not a verified turnkey weighted character. |

Pin MPFB **2.0.18**, upstream tag `v2.0.18`, commit
`d0a32e57a7f915cb2f2b95410e2117648c7bbb7e` in
[the upstream repository](https://github.com/makehumancommunity/mpfb2/tree/v2.0.18).
Its [release notes](https://static.makehumancommunity.org/mpfb/releases/release_2018.html) include
current Rigify-property handling and Blender 5.2 fixes. Local compatibility still requires the test
below. Use [MPFB's documented Rigify generation](https://static.makehumancommunity.org/mpfb/docs/rigging_posing/rigify.html),
which imports matching weights and performs asset handling beyond stock Rigify generation.
Retain the [pinned license](https://github.com/makehumancommunity/mpfb2/blob/v2.0.18/LICENSE.md),
download/source hashes and exported-asset provenance. Extra skins or community clothing are not
prerequisites for the helmeted body study. Native projects and dependency assets stay private.

The fallback mesh bundle is Human Base Meshes **1.4.1**, from the official
[Blender mirror](https://mirror.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip).
Record its actual archive hash if used. Do not silently switch foundations or mix in assets with
unrecorded licenses.

## First-source checkpoint

The Sprite Art session verified Blender **5.2.0 LTS**, build `fbe6228777e7`, with bundled Rigify
**0.6.10**. The private v009 study passes MPFB weighted-body creation, supported Rigify generation,
supplied weight integrity, static bend/contact checks and saved-project render reproduction.
The implementation intake verifies the delivery hashes and records visual findings. Final body,
armor and render approval remain pending. The owner now authorizes the
[complete single-character armor pass](../handoff/tasks/CY59.md#current-checkpoint--complete-armor-and-visual-quality-d79)
(D79), carrying source proportions and appearance review into that pass.

1. Load the pinned MPFB source in an isolated Blender profile/session. Preserve prior projects,
   their hashes, source approvals and normal Blender preferences. Save the body preset, native
   base, matching weights and generated rig, with reproducible commands and tool/source versions.
2. Fit an adult body to the approved full-body armor proportions. Review shoulders, torso, pelvis,
   limbs and hands in covered/undersuit front and three-quarter views. Then fit a representative
   shoulder/forearm piece and the actual rifle's primary/support grips. Preserve the existing
   helmet, character additions and independently replaceable equipment where suitable.
3. Check neutral, rifle-ready and static shoulder/elbow/knee bends, contact continuity, plate
   intrusion and grip closure. Record bone/socket mappings and compare with the previous source.
   Keep limitations explicit; successful rig generation does not approve anatomy or armor fitting.
4. Save/reload and reproduce the inspection renders. Return project/script paths, hashes,
   licenses, body/rig IDs, deformation/contact findings and a concise recommendation. This bounded
   study is technically complete. Continue with the owner-authorized full armor review; motion
   and roster expansion follow the accepted standing source and campaign checkpoint.

## Armor construction and adapters

Use a skinned body/undersuit with preserved external weights. Fit rigid armor shells separately;
attach plates to appropriate deform bones and use intentional articulation at joints. Skin flexible
sections deliberately. Avoid automatic smooth weighting of every rigid plate. The body foundation
does not supply the approved armor design, material treatment or final surface detail.

Keep rifle, Back unit and subsequent equipment independent. Define oriented primary/support grips,
mount transforms and clearances. Recompute contacts for the chosen hands and bone lengths. The
same transform names can form a project adapter, but existing poses and weights are not presumed
portable. Add the character's tail/ear structures through declared auxiliary bones or rigs.

Whitelist renderable body/equipment collections for bounds and exports. Rigify widgets, metarigs
and MPFB helpers must not affect framing. Replace fixed bone-count and single-armature assumptions
with an explicit authoritative body rig and declared auxiliary rigs. Preserve asymmetric details.
Record deform-bone, action and socket mappings rather than making game code depend on Rigify's
controller names.

After source review, follow CY59's four standing directions and CY57's exact-rig import into real
Training and boarding. The game consumes rendered frames; MPFB and Rigify are authoring dependencies.
Source/model review, render/export checks, runtime import, Platform publication and campaign/device
acceptance keep separate status. This foundation study changes no story, rules, saves or approvals.
