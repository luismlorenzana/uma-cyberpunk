# Approved art and visual world direction

The owner approved the cel-shaded general-art set and its visual direction on 2026-11-19 (D66).
Use this guide for campaign environments, ships, props and visual states, together with the current
approved character references. The [delivery contract](campaign-art-delivery.md) supplies the scene,
ownership and integration requirements.

## Drawing language

The shared standard is **Hardline Anime**. Characters and their surroundings should read as part of
one illustrated world.

**Battle figures (D77).** Use full adult proportions and clean cel shading, rendered from editable
rigged 3D sources into 2D sprites. Match the approved full-body armor and identity references.
Prioritize modeled silhouette, designed armor planes, controlled shadows, restrained highlights,
antialiased alpha edges and deliberate contour weight. The [first-character brief](combat-sprites-request.md)
defines model-quality review, source resolution, display-scale candidates and the campaign checkpoint.
Illustrations, portraits, splashes and environment
plates retain their approved rendering. Reconstructing armor as a sprite source has its own model
and export review; it preserves the approved character design.

- Confident dark contours with controlled line weight.
- Clear local colors and broad, angular cel-shadow shapes.
- Small, deliberate material highlights and readable silhouettes.
- Simplified metal, fabric and paper surfaces whose construction reads through drawn shapes.
- Detail concentrated around useful objects and scene landmarks, with quiet areas for characters
  and the interface.

The approved character art is a direct style reference when authoring an environment. Supply it
alongside the layout reference and identify each input's role in the prompt. The approved cel-style
environment set establishes the current treatment of room surfaces, lighting and props. Earlier
textured environment studies remain in their source history.

## Visual world and mood

The universe is colorful, inhabited sci-fi with room for warmth, personality and lightheartedness.
Ship rooms and civilian facilities should feel like places where people live, work and spend time
together. Practical technology, personal belongings and playful decoration share the space.

The approved palette uses blue-violet and charcoal structures, cyan and magenta accents, warm amber
practicals, and brighter personal colors. Location briefs can develop their own palette within the
same drawing language. Character-specific colors follow their approved references.

Posters, mugs, books, headphones, plants, stickers, keepsakes and colorful textiles are approved
examples of this inhabited quality. Choose decoration for the room's function, residents and scene.
Group props so their silhouettes remain readable and working surfaces retain usable space. The
particular poster designs and prop arrangements in the approved set are reusable examples.

A bridge can show crew life around functional stations. A welcome area can feel hospitable while
keeping its briefing desk useful. A civilian berth can show local life around a clear cargo route.
Cabins can carry more personal objects and comfortable textiles. Each scene's story and location
brief determine its lighting and immediate mood within this visual world.

## Continuity and composition

Preserve the identity and function of existing places and objects when replacing their art. Use the
active campaign scene, encounter and logical asset IDs from the shared record.

For related room views, keep the furniture, door, viewport, bed, pillow, lighting fixtures and
personal belongings spatially consistent. A camera or lighting variant should remain recognizable
as the same room. Carry those anchors into seated conversation, confession, overnight and morning
compositions. Record intentional changes in the scene handoff.

The Captain is the viewpoint and stays undrawn. Prepare clean environment plates and separate
character layers, with separate props where useful. Dialogue, readable labels, portraits, meters
and controls use the game's presentation layers. The [campaign format](../technical/campaign-content.md)
defines the currently supported composition and portrait policy.

Review at 844 × 390 CSS pixels with representative safe areas and the actual dialogue and choice
dimensions. Keep faces and important hand, furniture and objective contacts readable. Review ship
objectives beside their integrity display at the intended size. Tactics assets follow the current
[board camera and geometry](../game/board.md), with readable cover, exits and consoles.

## References, review and ownership

Start a batch by checking the latest approved source version and hash. Compare the environment with
an approved character reference early. An unchanged source-character layer is useful for judging
the match. Label temporary poses and record the intended final pose and wardrobe.

The game owns campaign-specific rooms, locations, craft, props and visual states. The sibling art
authoring collection owns character, boss and lieutenant poses, outfits, portraits, expressions,
splashes and sprites, canonical reusable equipment, and shared general-art collections. Follow the
current collection's approved likeness and wardrobe guidance when composing its character layers.

Keep images, exact prompts, reference provenance, named cast, approval evidence and screenshots in
ignored private content. The approved general-art source manifest is
`content/campaign-general-art/cel-style-v001/manifest.json`; its approval record names all ten exact
source hashes. The private `content/campaign-art-plan/plan.json` register carries current versions,
scene bindings and integration status. Future approved revisions extend that source history.

Each source approval records the owner's verdict, version and SHA-256. Each integration record names
the private campaign release and its review evidence. Use the [art publishing workflow](../technical/campaign-art-publishing.md)
for release delivery and retain physical iPhone findings in CY37.
