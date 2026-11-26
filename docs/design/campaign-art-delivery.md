# Four-act authoring and art delivery contract

**Current, D87.** Use the [four-act design](campaign-rework.md), [roadmap](../handoff/four-act-roadmap.md), [approved art direction](art-direction.md), and the existing [Cyberpunk publishing workflow](../technical/campaign-art-publishing.md). Story, General Art, Character Art, Sprite Art and Engineering work against the same private scene, encounter and asset IDs.

## Ownership

| Lane | Deliverables | Handoff |
| --- | --- | --- |
| Story | Casting and role states, fixed duos, each scene and beat, places, location states, objectives, character variants, outcome triggers, continuity and directives for intended artwork | Story Authoring's Cyberpunk workspace. Approved script and routing export to game intake. [CY92](../handoff/tasks/CY92.md) |
| General Art | Locations, backgrounds, scenery, shared props, ship hulls and interiors, maps and tiles, civic changes, battle FX, and UI art where required | Game general-art review lane and the existing shared or Platform scope where appropriate. Pin source and destination for each asset before promotion. [CY93](../handoff/tasks/CY93.md) |
| Character Art | Canonical character sources, outfit and role variants, dialogue portraits and crops, required expressions, dedicated poses and scene or attack splashes | Cyberpunk in Art Authoring. Verify approved sources and exact compositions through Platform and the game. [CY94](../handoff/tasks/CY94.md) |
| Sprite Art | Compact game figures, reusable body and equipment layers, fitting, authored motion, clips and battle visual effects tied to a unit or item | Combat Sprites album, exact bundle lock and approval, guarded publishing into the campaign. [CY95](../handoff/tasks/CY95.md) |
| Engineering | Playable route and state contracts, UI, input/outputs, approved fallbacks, validation, assembly, staged campaign, playthrough and publishing | Game repo, ignored release receipts and preview. [CY96](../handoff/tasks/CY96.md) |

A weapon's identity and common silhouette have one approved source. Character Art can use it in illustrations and Sprite Art applies actual gear layers. General Art owns standalone prop and shared effect exports. Art volumes count distinct deliverables and approved reuse, including when a single layout serves many scenes. The existing Cyberpunk wardrobe, expression and captured-role contracts apply to approved reusable sources.

## Shared delivery record

Maintain a private register per milestone and per playable route with these fields.

- Delivery ID, packet, act, system, duo, originating story export revision, scene or encounter ID, branch and outcome step.
- Cast with stable actor IDs, role, state, outfit, per-speaker expression cues, specific position, move, camera and who must physically be present.
- Encounter input, role and fitting IDs, legal weapon mounts, objective, enemy/spawn roles, battle events, technical constraints and expected result.
- Individual element ID, family, lane, source path and hash, source approval, whether it is new, reused or temporary, and any approved fallback.
- Destination path, asset slot, role and output type with export spec, composed layers, release scope, release pin, results and rollback reference.
- Status per row. Requested, ready to author, draft, source approved, export validated, destination approved, staged, verified in game, selected. Note the reason and next action for held rows.

Story drafts can first use a neutral fallback when the approved reference matches. Keep expression, background and pose slots stable between a working chapter and final delivery. The release register reports coverage by story route, cast, scene family, environment, ship, loadout and battle cue. If Story replaces a branch, revalidate all its asset and combat bindings. If an art treatment changes a mission silhouette or physical action, update the shared beat and executable input together.

## Art coverage by act and pillar

| Act | General art | Character art | Combat sprites |
| --- | --- | --- | --- |
| I | Homestretch welcome and rooms, civilian port/route plates, origins, operational props, general ships, enemy flagships, boarding and ground arenas, approach and capture FX | Origin, meeting, quarters, confession, sitting, bed and morning per actual scene. Uma operational outfits and pilot/armor variants. General hostile, Collar and captured presentation. Three hostile lieutenants per route where staged. | Reuse approved Uma armor bundles and fitting families. General and lieutenant enemy roles where deployed, Rig Break, Collar, withdrawal and captured outcome. |
| II | Medbay and care staging, shared quarters, investigations, workplaces, base before/open/working/liberated, capital approaches, teams' common base and operations, Seraine evidence props and visuals | General in care, allied resident, romance and prepared clearance looks. Elf lieutenants in hostile and returned appearances. Planned joint compositions for both Umas, both Boss Allies and six lieutenants as the script needs them. | Active Umas and actual opposition in operations. Produce cleared Boss Ally and lieutenant fittings for Act III while the narrative-based role gate is verified. |
| III | Homestretch launch bay, reusable small-ship exterior and interiors, return states, Seraine routes, arena layers, props, attack/movement telegraphs, prison or release effects | Mission-specific command, combat, and debrief staging. Named Heralds and Echoes with court palette and silhouette, joined and liberated looks. Keep the Queens for Act IV story appearance. | Ten friendly sprites together, all specified hand and Back families, real Seraine opponent profiles and visuals, targeted nonlethal release and withdrawal. |
| IV | Final approach, capital or court geography as approved, Queen encounter environments, shared outcome states and civilian epilogue | Five Queens from their approved designs, actual role and outcome cues, finale reactions, optional paths and soft-ending scenes | Size and movement for actual Queen encounters, telegraphs and results. Extra phases apply when the final rules provide their own cues and selections. |

## Pillar 1 scene and composition contract

Cover the four key families and morning where authored. Meeting has its defined location or approved variation. Confession gets the relevant stance and selectable branch. Seated cabin chat uses seated composition. Staying the night shows the actual occupants lying down with correct framing. Morning previews the settled stay or leave outcome. Use an approved room plate with reusable character layers when it supports the blocking. For intimate or shared scenes, define physical positions, orientation, hand/contact points, and stop or exit variants from the actual script. An approved general cabin can serve across many variants.

An actor role determines the eligible outfit and default dialogue base. Keep general capture, rehab, resident, cleared ally, and returned lieutenant roles explicit. Use the [wardrobe contract](../technical/campaign-wardrobe.md) for native art and separate dialogue/profile crop paths. Use one required expression inventory per outfit based on scene cues. The approved neutral serves as a fallback. Each needed expression can reuse the same crop in compatible scenes. Confirm native framing, eyes, alpha, hair/ear placement and pixel alignment before accepting. Large group scenes use actual composition and speaker order, with fewer alternate assets when profiles and shared positions express the scene.

## Pillars 2 and 3 contracts

The [D94 General Art packet](../handoff/tasks/CY127.md) covers reusable station geometry, module exteriors and the cutter family. Use the [CY126 Story placement rows](../handoff/tasks/CY126.md) and [CY128 actor/sprite delta audit](../handoff/tasks/CY128.md) to tie all new views to actual campaign state and exact authored scenes.

General art follows reachable location and gameplay state. Author place keys, day/night where required, interactive prop states and upgrade/outcome visuals. Each capital, base and launch destination needs readable approach, interactable, mission and resolution staging. Use approved assets for unchanged ship room families. When a project completes or a yard is restored, visibly change the part of the scene the mission affected. Ground boards need terrain height, target selection and cover compatibility independent from decorative plates.

For ship combat, define operator, order, target, affected side, current ship, pre-order pose and actual outcome. Use the frozen officer and committed result to pick a suitable pilot-suit composition with a profile. Bind emitter enabled/disabled, defended hull, impact, withdrawal, retry and result. Reusable bridge and ship assets can serve multiple charts. Script and Art record when a named actor requires an exact authored image. Fast playback and available fallbacks follow the same result.

## Pillar 4 contracts

Retain the approved [combat sprite format](../technical/combat-sprite-bundles.md), [ground cue matrix](../technical/ground-combat-visual-matrix.md), and shared [equipment coverage](../handoff/combat-sprite-coverage.json). Use approved compact helmeted 2D sources for humanoid deployments where called for. Use actual Seraine silhouettes, body features and equipment for their forms. Validate all four cardinal facings and relative scale, feet, shadow, sockets, occlusion, palette, mounts and draw order. Review each family with all game cues supported by the associated fitting, including damaged states, battle result and exit. Mark any new clip as an explicit dependency of its committed cue.

Keep Seraine court colors, silhouette, markings, glyph and individual rhythm independently authored where required. Shared forms and palettes can cover exact approved groups, including Echo variants where the art matches the Story registry. Motion families can be reused across compatible individuals. An appearance change or larger creature must preserve tile anchors, readable selecting and state markers. The first ten-member deployment must show the real mix of armor, humanoid and Seraine figures at its intended phone board size.

Only commission a named special attack splash for a confirmed action. Tie the overhead warning, pose or name to the actual trigger and forecast. Keep normal fire, guard, movement, failed or canceled actions, and hero/lieutenant release readable with shared effects.

## Publication and acceptance

Validate draft paths locally and approve exact source and derived bytes. Platform registers canonical character Art and sprite payloads where used by the pipeline. The game integration receipt records the Story route, released image hashes, scope and approved bindings for the selected pack. Keep general-source references in the agreed ownership lane, with exact game destinations. Use stage, readback, private visual review, conditional selection and rollback. Campaign gameplay and saves use their own release mechanism.

Review scripted and combat evidence in the real campaign at each [roadmap milestone](../handoff/four-act-roadmap.md#milestone-sequence). Include landscape viewport, touch interaction, reduced motion, cleanup, loss/retry, actual consequence and resumed playback. Preserve Story and Art source pins across results. Batch equivalents use shared automated checks. Open specialized visual issues by family or in the exact authored encounter.
