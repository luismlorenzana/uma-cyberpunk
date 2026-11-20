# Character sprites: full-proportion cel-shaded renders

**Current direction · 2026-11-20 (D77).** Author full-proportion editable 3D characters and equipment,
then render clean cel-shaded 2D sprites. Start with the [first-character brief](combat-sprites-request.md).
[CY59](../handoff/tasks/CY59.md) owns crew sources, [CY58](../handoff/tasks/CY58.md) equipment,
[CY60](../handoff/tasks/CY60.md) opponents and [CY57](../handoff/tasks/CY57.md) game integration.

## Design and presentation

The approved full-body helmeted armor supplies the character's full adult proportions and design.
Preserve her silhouette, palette, emblem, ears/housings, tail and asymmetry in a polished rigged
model. Use designed armor shapes, controlled cel shadows, antialiased edges and deliberate contours.
Review the actual model quality before motion or roster expansion. Illustrations, portraits,
expressions, splashes and campaign environments keep
their approved rendering. The [wardrobe contract](../technical/campaign-wardrobe.md) still defines
the six playable look roles and scene routing.

## First campaign checkpoint

Use one real recruit with the current two-handed Laser rifle and Bulwark Training rig. Model and
rig once, then render front, back, left and right with one fixed orthographic setup at the board's
35-degree elevation. The initial master is 512 × 512 with anchor `(256, 480)` and about 416-pixel
figure height. CY57 compares master-size and clean filtered runtime derivatives at the same
display size, then reviews approximately 80/100 CSS-pixel figures in actual Training and boarding.
Texture resolution, world/display scale and sampling are separate adapter concerns. The earlier
pixel/chibi prototype retains its source history; the new profile needs model/render acceptance.

The first exact loadout can use a fully equipped atlas from the source project. Reusable models,
poses and equipment remain separate at authoring time. Correct hand contact and occlusion come
from the same source scene. CY57 resolves supported variants or reusable render passes for changing
equipment and prevents stale weapon art from representing an unsupported rig.

## Work and acceptance

Return the native project, batch renderer, source hashes and frame/timing/anchor metadata. Standing
comes first, followed by short walk/action/reaction and Rig Break/reboot samples from the same rig.
The frame profile is shared across identities and equipment families after review. Source design,
model, cel-render/export, runtime import, publication and game acceptance retain separate status.

Review cover, selection, actual effects, disabled parts, replay, loadout replacement and phone
performance in campaign. Art never changes the frozen battle rules. Expansion follows this first
cohort, with the approved compact normal-shoulder equipment baseline and exact shield references
retained in CY58. Keep native assets, cast and source approvals private.
