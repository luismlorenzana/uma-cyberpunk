# Combat sprites: baseline art requirements

**Current request · 2026-11-20 (D75).** Author one helmeted armored character for a visual review
in the real campaign. This is the current image brief for [CY59](../handoff/tasks/CY59.md), shared
with [CY58 equipment](../handoff/tasks/CY58.md) and [CY57 integration](../handoff/tasks/CY57.md).
The approved baseline will establish the drawing perspective before animation and roster expansion.

## Character and references

Use one real recruit with approved Cyberpunk combat armor and helmet references, preferably the
first recruit. Record the exact character/outfit ID, look ID and reference versions in the private
handoff. Keep her approved chibi proportions, approximately 2.6–3 heads tall excluding the ears.

Preserve her armor silhouette, helmet and ear housings, tail, emblem, palette and anatomical
asymmetry. Recognizability comes from those features even with the face covered. Every direction
is drawn independently; one-sided details remain on the same anatomical side.

Follow [Hardline Anime](art-direction.md): confident dark contours, broad angular cel shadows,
clear local colors and restrained highlights. Simplify seams and small markings for a figure about
70 CSS pixels tall. Use consistent top/front-left light and retain readable accents on dark armor.

## Viewpoint and four directions

Draw the baseline **from slightly above**, with visible top planes of the helmet, shoulders and
boots. Use approximately **35 degrees downward** as the first viewpoint study, matching the fixed
board camera's elevation. Keep a consistent elevation and proportions across all four directions.
The final painted angle is established by the in-campaign review, rather than by the number alone.

The board has an axis-aligned grid and four logical directions. Draw the whole body facing the
listed direction; head, torso, hips, feet and weapon agree. The elevated side drawings can show
top surfaces while their facing remains left or right. A three-quarter identity illustration can
be supplied as an existing reference; the four gameplay drawings are the required baseline.

| File facing | Battle direction | Required read |
|---|---|---|
| `front` | South, toward the bottom of the screen | Helmet visor and chest/front armor visible; body and rifle point toward the viewer |
| `back` | North, toward the top of the screen | Helmet rear, back plate and tail attachment clearly distinguish the rear; rifle points away |
| `left` | West, image-left | Whole figure and rifle point image-left, seen from the same elevated viewpoint |
| `right` | East, image-right | Whole figure and rifle point image-right, preserving anatomical equipment sides |

The renderer displays painted pixels on upright flat surfaces. Its height compensation preserves
their on-screen proportions; it does not add a painted viewpoint. Perspective must therefore be
consistent in both the character drawing and fitted equipment. Existing eye-level studies can be
returned as comparison references with their original review status.

## First delivery: four matched body/fitting pairs

Return **eight PNGs: four clean body images and four equipped previews**, one pair per direction.
Use a stable standing **rifle-ready pose** with both hands in believable contact positions. Within
each pair the body pixels, pose, scale and placement must match; derive the fitting from the same
body source/layers. Both feet remain planted and the body weight supports the equipment.

| Set | Files | Required content |
|---|---|---|
| Clean body | `body-front`, `body-back`, `body-left`, `body-right` | Helmeted armor, tail and hands in the agreed rifle-ready pose; equipment kept separate |
| Equipped fitting | `rifle-front`, `rifle-back`, `rifle-left`, `rifle-right` | The matching body with the current two-handed mid-range Laser rifle, correct grips and occlusion |

Use CY58's latest approved rifle design where available. Otherwise identify the exact draft used
as a fitting placeholder. The rifle has an anatomical **right primary grip and left support grip**;
hands, fingers and forearms overlap it naturally in each direction. Its silhouette is fictional
energy equipment, consistent with the current equipment brief. Long weapons remain Back-mounted.

If the working master contains separate rifle, hand/forearm occlusion or mount layers, include
those native layers or aligned transparent exports. Record missing separations. The fitting preview
is sufficient to judge the baseline but reusable runtime attachment acceptance remains CY57/CY58.
An existing Back-pack fitting may accompany the baseline if available; it has its own review status.

## Image format and alignment

| Property | Baseline requirement |
|---|---|
| File | PNG with true transparent alpha; preserve native masters |
| Review canvas | 512 × 512 pixels for each still |
| Ground anchor | Center of the stance on the ground at `(256, 480)`, measured from the top-left |
| Figure height | Approximately 416 pixels from the highest ear/helmet point to the soles |
| Alignment | Same scale and ground anchor across all four directions and paired fittings |
| Clearance | Keep the full character, tail and equipment inside the canvas, with a clear border |
| Presentation | Clean character/equipment only; the game supplies ground, shadows, rings, effects and UI |

If a legitimate silhouette exceeds the canvas, return the native image and describe the needed
extent instead of clipping the equipment or shrinking only that facing. Keep labels and contact
markers on a separate review copy. A labeled contact sheet may accompany the eight individual files.

These are **source-art review dimensions**. CY57 establishes the executable layout, packing,
runtime scale, numerical attachment metadata, frame counts and timing after the baseline review.

## Handoff

Save the source images in the existing private Combat Sprites collection or return an exact local
folder path. Include a short `README.md` with the character/outfit and look IDs, source references,
file-to-facing mapping, intended viewpoint, canvas size and foot anchor. Identify the equipment
source and version, anatomical grip positions, any supplied layers, and known deviations or gaps.
Provide exact generation/edit prompts and native masters through the existing authoring workflow.
Keep draft, owner-approved source and integrated-game status distinct; development can record hashes
and extract precise anchors during intake. Images, named cast and approvals stay in ignored content.

## Review and next delivery

Development places the four directions in the actual campaign's Training encounter and next real
boarding review. Check at 844 × 390 landscape, near 70-pixel figure height, on light and dark ground
and behind cover. Review grounding, front/back recognition, identity, weapon alignment, selection
and clearance beside another unit. Compare the original and equipped source at the same scale.

Record the selected painted viewpoint and any source corrections. Then CY57/CY58/CY59 establish
the reusable attachment fixture and the first required movement/action samples. Animation,
additional loadouts, opponents and roster expansion follow that shared result through the same
campaign. CY37 retains the physical iPhone check.
