# Combat sprites: the image request

> **Next delivery (D64, 2026-11-18):** [CY59](../handoff/tasks/CY59.md) coordinates new playable
> sheets with [CY57's composition contract](../handoff/tasks/CY57.md) and
> [CY58's equipment](../handoff/tasks/CY58.md). Before expanding this earlier empty-hand request,
> reconcile the actual frame/pose and attachment fixture, including two-handed grips and weapon-family
> actions. Keep approved existing sheets and the owner's identity/walk review sequence. The next
> acceptance checkpoint is an equipped squad in its real campaign boarding mission.

> **For ChatGPT, image generation only (2026-11-13, D24).** This page asks for one thing: **chibi battle sprites of the
> two pilot Umas in their combat armor**, helmet off and then helmet on, drawn as pose sheets. Cutting the sheets into
> frames, alignment, the atlas, checks, publishing and how the game plays them come later, and aren't ChatGPT's. It's
> nameless (Umas are outfit ids); each Uma's identity, her paste-ready prompts and her reference board are private, in
> `content/design/character-looks/` (`combat-sprites-prompts.md`, `sprite-refs/`). The design behind it is
> [character-sprites.md](character-sprites.md). Visual page: [previews/combat-sprites-request.html](previews/combat-sprites-request.html).

## What to draw

| | |
|---|---|
| **Who** | The two pilot Umas: outfit **106801** and outfit **112901** |
| **What** | Each Uma's **approved chibi**, re-dressed in her **approved combat armor look** (Modular Frame 01), as battle-board sprites |
| **Helmet** | First helmet off; then the same sheets with her **Helmet 01** |
| **Sheets** | Seven per Uma helmet off, seven helmet on: **28 sheets, 146 poses an Uma** |
| **Not asked** | Sprites of the Street, Quarters or Pilot-suit looks; cut-in keys; portraits; any other Uma |

## Why only combat

The battle board is the one place an Uma is a small figure that walks and acts. Everywhere else the game shows the
look ChatGPT already drew, as a full-body image or a bust:

| Look | Where it shows | Shown as | Sprites? |
|---|---|---|---|
| **Combat armor** | The battle board | Small chibi figures walking in four facings | **Yes: this request** |
| **Helmet on** | Sealed maps (vacuum, smoke, a boarding in space) | The same figures with the helmet | **Yes: this request** |
| **Street** | A world's node map and its scenes | The approved full-body image and a bust in the text box | No |
| **Quarters** | Her cabin: she stands over the cabin's diorama, as in a visual novel | The approved full-body image | No |
| **Pilot suit** | Her post aboard, the Bridge's scenes | The approved image, and a bust on her post's card | No |

## The figure: her chibi, in armor

- **Her head and body are her approved chibi's:** the platform's traveler sprite set of her outfit, revision 5. That
  means the same face, head size, eyes, hair, ears, accessory sides, tail and proportions (about 2.6 to 3 heads below
  the ears). The rendering stays the same too: shaped lids and lashes, distinct whites, gradient irises, dark pupils and
  their highlights, a clear small mouth, coloured outlines, clean antialiased edges, and restrained light from the top
  front-left.
- **Only her clothes change,** to her approved combat armor look, simplified to chibi scale:
  - **Keep:** the chest plate with her emblem, the big shoulder pads, the segmented abdomen, the forearm gauntlets
    (each forearm as her look draws it), the thigh, knee and shin plates, the armored boots, the fingerless gloves, her
    one-sided motif, and her three colours (base, accent, trim) where her look puts them.
  - **Drop:** thin seams, tiny slots, text and any detail under about four pixels at the final size.
  - **Make the plates chunky,** so her outline is clearly different from her chibi's dress: wider shoulders, heavier
    boots.
- **Her tail is always out.** With the helmet off her ears are bare. With the helmet on they sit in the helmet's armored
  ear housings.
- **Never mirrored.** Every asymmetric detail stays on the side of her body it belongs to, in every facing. Her identity
  sheet in the private notes names each detail's side.

## Inspiration: what to take, what not

| Reference | Take | Leave |
|---|---|---|
| **Triangle Strategy** (HD-2D) | Small deformed figures standing in a lit diorama, read at a glance from a high camera. Its director's "right line": draw deformed figures and add believable light on top, rather than shrinking an illustration | Its rotating camera and diagonal views |
| **Octopath Traveler** | Sprites redrawn by hand from the illustrations, colours a touch more saturated than the illustration; motion held back to a few stepped frames | Its pixel blocking: these are clean, full-colour anime sprites |
| **Fire Emblem's map sprites** | A standing read and a moving read at a tiny size: silhouette first, then colour | Its battle animations (this game's cut-in has its own art) |
| **Front Mission** | Armor that reads as equipment: plates, joints, mechanical weight, boots planted | Mecha scale: she's an Uma in armor, not a robot |
| **This game's boards** | Night and neon: dark ground, cyan and magenta light, the squad's cyan ring under her. Dark armor keeps its accent colour bright and a slightly lighter edge on the top-left of dark plates, painted into the figure | Any glow, aura or floor in the image (the game adds light) |

No frame, character or design is copied from any game. These are references for scale, readability and finish only.

## The camera and the facings

- **Drawn at eye level, straight on,** like her existing chibi. The board's camera looks down from 35°, but the game
  stands each sprite upright and undoes the tilt, so the sprites must not be drawn from above.
- **Her back must read as her back at a glance:** a hit from behind does +50% in this game. Her hair, her tail and the
  armor's back plate make it plain.
- **Five views.** The profiles are real side views, as the owner asked for her existing chibi sets:

| View | Drawn as |
|---|---|
| **Key** | Three-quarter, turned to image-left, both eyes visible: the identity reference |
| **Front** | Straight toward the viewer |
| **Back** | Straight away from the viewer |
| **Left** | A true profile facing image-left: nose, chest, hips and shoes all point left; the far eye hidden |
| **Right** | A true profile facing image-right |

## Every sheet

- **Transparent background** (true alpha 0), and nothing else in the image: no text, labels, grid lines, floor, shadow,
  glow, effects, weapons or props.
- **512 × 512 cells,** read row-major (left to right, top to bottom); unused cells stay empty.
- **The figure about 416 px** from ear tips to soles, feet on y 480 of the cell, centred on x 256, at the same scale in
  every cell of every sheet. At least 14 px of padding around ears, hair, tail, hands and boots.
- **One figure a cell,** each drawn on its own, never a flipped copy.
- **Empty hands:** where a pose needs one, her anatomical right hand is a closed, empty grip (the game adds weapons
  later).

## The sheets

**Batch 1, helmet off: standing and walking.** This is what the board plays today; it comes first.

| # | Sheet | Canvas, grid | Cells |
|---|---|---|---|
| S1 | **Identity** | 1536 × 1024, 3 × 2 | 0 key · 1 front · 2 back · 3 left · 4 right · 5 empty |
| S2 | **Walk front and back** | 2048 × 1536, 4 × 3 | 0–5 walk toward the viewer · 6–11 walk away |
| S3 | **Walk left and right** | 2048 × 1536, 4 × 3 | 0–5 walk in left profile · 6–11 walk in right profile |

**Batch 2, helmet off: reactions,** one sheet a facing.

| # | Sheet | Canvas, grid | Cells |
|---|---|---|---|
| S4 | **Front** | 2048 × 2048, 4 × 4 | 0–2 act · 3–4 hurt · 5–6 guard · 7–9 kneel · 10–13 victory · 14–15 empty |
| S5 | **Back** | 2048 × 1536, 4 × 3 | 0–2 act · 3–4 hurt · 5–6 guard · 7–9 kneel · 10–11 empty |
| S6 | **Left** | 2048 × 1536, 4 × 3 | The same as S5, in left profile |
| S7 | **Right** | 2048 × 1536, 4 × 3 | The same as S5, in right profile |

**Batch 3, helmet on: S1h–S7h.** Each approved helmet-off sheet is **edited, not redrawn**:
- **Replace only her head** with her Helmet 01, with the ears in its armored housings, the visor band and the emblem on
  the forehead, turned to match each pose's head.
- **Keep everything else identical:** poses, scale, positions, armor and tail.
- **Hidden under the helmet:** her hair and head accessory.

| Sheet | Frames |
|---|---|
| S1 | 5 |
| S2 | 12 |
| S3 | 12 |
| S4 | 14 |
| S5 | 10 |
| S6 | 10 |
| S7 | 10 |
| **Helmet off** | **73** |
| **Helmet on** | **73** |
| **Per Uma** | **146** |

## The poses

| Action | Frames | Each frame |
|---|---|---|
| **Walk** | 6 | Contact, down, passing, contact on the other leg, down, passing. Restrained, with armored weight. The arms swing a little and the head stays level. She walks in place, never travelling across the cell |
| **Act** | 3 | 0 ready: weight forward, her right hand a closed grip drawn back at the waist. 1 the strike: that arm thrust the way she faces at chest height, the moment a blow or shot lands (no weapon, no flash). 2 recover toward her stance |
| **Hurt** | 2 | 0 a flinch away from the way she faces, eyes squeezed, a small open mouth (with the helmet, the head snaps back). 1 recover |
| **Guard** | 2 | 0 her left forearm raised across her chest, knees bent, braced. 1 the brace held. A forearm shield shows as her look draws it, and the game adds its light |
| **Kneel** (her rig breaks) | 3 | 0 a stagger. 1 down on one knee. 2 kneeling, head bowed, one hand on the ground: worn out, not wounded. This frame is held, and played backwards she gets up |
| **Victory** | 4, front only | 0 a relaxed stance. 1 she turns to the viewer and smiles. 2 a fist raised. 3 a confident pose, held |

In the back and profile sheets, the act and guard point the way she faces (away, left, right). In the front sheet they
come toward the viewer, foreshortened.

## Before saving a sheet

- **Her head** matches her approved chibi: face, head size, every accessory on its side. **Her armor** matches her
  approved look's colours, emblem and one-sided details.
- **Scale:** every standing figure is the same height, with the feet on one line.
- **Facings:** the profiles are true profiles, never a front body with a turned head. Nothing is flipped.
- **Clean:** a transparent background, with no grey board, halo or floor copied from the references.
- **Small:** at about 70 px tall she's still recognisable, and her armor's outline differs from her chibi's dress.

## Order and the owner's gates

1. **S1 for both Umas.** The owner looks before anything else is drawn; this is the identity gate.
2. **S2 and S3.** The owner looks.
3. **S4 to S7.**
4. **S1h to S7h,** from the approved helmet-off sheets.

Any change the owner asks for at a gate is redrawn before the next step.

## Deliver

- **PNG sheets,** named `<outfitId>-combat-<sheet>-v<take>.png`:
  - the sheets are `identity`, `walk-fb`, `walk-lr`, `front`, `back`, `left` and `right`;
  - helmet sheets add `-helmet`, for example `106801-combat-walk-fb-helmet-v1.png`.
- **Saved to** `content/design/character-looks/combat-masters/<outfitId>/` in uma-cyberpunk. That folder is private and
  git-ignored: never git, never uma-art.
- **With a `prompts.md`** beside them: each sheet's prompt, the references given, and which take was kept.
- **Nothing else:** no cutting, no atlas, no checks, no publishing, no code.
