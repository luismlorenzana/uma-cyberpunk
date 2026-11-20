# Character sprites: 3D sources and pixel frames

**Current direction · 2026-11-20 (D76).** Author editable 3D characters and equipment, then render
pixel sprites for the existing 2D board renderer. Start with the [first-character brief](combat-sprites-request.md).
[CY59](../handoff/tasks/CY59.md) owns crew sources, [CY58](../handoff/tasks/CY58.md) equipment,
[CY60](../handoff/tasks/CY60.md) opponents and [CY57](../handoff/tasks/CY57.md) game integration.

## Design and presentation

The approved helmeted armor remains the character design. Preserve her chibi silhouette, palette,
emblem, ears/housings, tail and asymmetry in an editable rigged model. Render broad cel-shaded pixel
groups at board size. Illustrations, portraits, expressions, splashes and campaign environments keep
their approved rendering. The [wardrobe contract](../technical/campaign-wardrobe.md) still defines
the six playable look roles and scene routing.

## First campaign checkpoint

Use one real recruit with the current two-handed Laser rifle and Bulwark Training rig. Model and
rig once, then render front, back, left and right with one fixed orthographic setup at the board's
35-degree elevation. The initial profile is a 128-pixel native cell, ground anchor `(64, 120)`,
about 96-pixel figure height and a 2× nearest-neighbor runtime candidate. CY57 reviews this in the
actual Training and boarding encounters before freezing the profile or expanding animation.

The first exact loadout can use a fully equipped atlas from the source project. Reusable models,
poses and equipment remain separate at authoring time. Correct hand contact and occlusion come
from the same source scene. CY57 resolves supported variants or reusable render passes for changing
equipment and prevents stale weapon art from representing an unsupported rig.

## Work and acceptance

Return the native project, batch renderer, source hashes and frame/timing/anchor metadata. Standing
comes first, followed by short walk/action/reaction and Rig Break/reboot samples from the same rig.
The frame profile is shared across identities and equipment families after review. Source design,
model, pixel-export, runtime import, publication and game acceptance retain separate status.

Review cover, selection, actual effects, disabled parts, replay, loadout replacement and phone
performance in campaign. Art never changes the frozen battle rules. Expansion follows this first
cohort, with the approved compact normal-shoulder equipment baseline and exact shield references
retained in CY58. Keep native assets, cast and source approvals private.
