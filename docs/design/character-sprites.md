# Character sprites: current direction

**Current direction · 2026-11-20 (D73, D75).** Use the [baseline image brief](combat-sprites-request.md)
for the next authoring delivery. [CY59](../handoff/tasks/CY59.md) covers playable figures,
[CY60](../handoff/tasks/CY60.md) the actual opponents, [CY58](../handoff/tasks/CY58.md) reusable
equipment and [CY57](../handoff/tasks/CY57.md) the executable composition contract.

## Where sprites appear

Combat uses small chibi figures in approved helmeted armor. Character identity stays visible through
the armor silhouette, ears/housings, tail, emblem, palette and asymmetric details. Dialogue, roster,
cabin and ship-station presentation use their own approved illustrations, portraits and expressions.
The [wardrobe contract](../technical/campaign-wardrobe.md) defines the current six playable look
roles and scene routing. The [shared art contract](campaign-art-delivery.md) covers the four pillars.

## Camera and baseline

The current board uses a fixed orthographic camera looking down at 35 degrees. Its grid is
axis-aligned, with four logical facings: South/front, North/back, West/left and East/right.
The baseline reviews one character drawn from slightly above in those four directions. It returns
four matched clean-body/equipped-rifle pairs, as detailed in the image brief.

The engine's sprite height compensation preserves the painted image's proportions. It does not
determine the artist's painted elevation. Review the baseline on the real campaign board before
recording the final drawing angle. A three-quarter identity reference has a different purpose
from the four required gameplay drawings.

## Reuse and implementation

Begin with helmeted armor, reusable body/family poses and separate fictional energy equipment.
The mid-range Laser rifle uses both hands; Long weapons remain Back-mounted. Derive clean bodies,
equipment fits and occlusion layers from aligned masters. Use masks and shared geometry where
appropriate rather than commissioning a complete animation set per item or outfit.

CY57 fixes numerical anchors, depth, packing, frame/timing requirements and cache behavior against
actual legal loadouts. The existing shared renderer remains usable as a fallback while that work
is open. Source-art approval, valid runtime export, Platform publication and campaign integration
are recorded separately. Helmet-off variants and special attack art follow their authored needs.

Review in the real campaign's Training and boarding encounters, including cover, damaged parts,
missing art and saved-battle recovery. Expand after the first equipped cohort works. Keep native
images, cast, prompts and approval evidence in ignored content and private publication paths.
