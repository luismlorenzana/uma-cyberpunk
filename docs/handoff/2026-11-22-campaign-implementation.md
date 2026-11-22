# Campaign implementation queue · 2026-11-22

The current campaign stays playable while the new Story pilot gets its own release and save.
Approved Art can move through the existing campaign wherever its exact scene and actor bindings
match. Build both paths on the current game and tactics engine.

The ignored `content/implementation-intake-2026-11-22/` folder holds the exact Art, Platform
and hosted snapshots, private source pins and coverage report. The hosted release contains
560 Story files, 2,949 art references and zero combat sprite bundles. The new pilot's 13 chapters
and 35 scenes pass the Story parser. They await campaign config, runtime gates and encounter
bindings. Use the audited release and Art receipts when starting a packet.

## Development packets

| Packet | Outcome | Start and dependencies |
| --- | --- | --- |
| [CY72](tasks/CY72.md) | An isolated playable Story pilot with journey routing and its own save, pointer and cache | Start now. Compiles the pinned Story draft and exposes the pilot opening and recruitment |
| [CY73](tasks/CY73.md) | A freed boss can recover, join the crew, share a cabin, date the Captain and join a trio evening | CY72 campaign identity and routes. Uses CY74's battle outcome and CY77/CY78 presentation |
| [CY74](tasks/CY74.md) | Pilot ship approaches, the Collar rescue and the home operation with sub-boss Talk | Start with the encounter contract in parallel with CY72. Complete after roster and outcome dependencies |
| [CY75](tasks/CY75.md) | Five tier fronts and core chapters, capture thresholds, resettled crew call-up | After the pilot. Deliver Tier 1 with Story and Art before the remaining tier cohorts |
| [CY76](tasks/CY76.md) | Routine approved sprite publication, two recruits together in the campaign | Start now. The two local drafts give fixtures for preflight and staging |
| [CY77](tasks/CY77.md) | Hosted outfit, expressions, portraits and armor routed by actor and role | Start now with verified replacements and new assets. CY73 supplies new pilot phase data |
| [CY78](tasks/CY78.md) | Approved Crew and boss scene splashes tied to exact scenes and branches | Start the intake and first existing-campaign cohort now. Needs reviewed Story mappings and CY77 identities |
| [CY79](tasks/CY79.md) | The first Boss Enemy, Boss Ally and sub-boss figures on the real board | Requires approved structured assets, CY76's bundle lane, CY77 role joins and CY74 cues |

## What the restructure changes

| Area | Reuse | Development impact |
| --- | --- | --- |
| Campaign and save | Current landscape app, content packs, offline cache and revision checks | A second campaign identity must reach the server, device store, cache and restore paths. The current client distinguishes legacy and campaign saves, with one campaign scope today |
| Recruitment and journey | Sign-on, roster scenes, ship and ground encounters | Chapter prerequisites must become executable campaign gates. The pilot uses the nine-beat journey, with recruitment, capture and release as different milestones |
| Combat | Existing ship engine, Hold, Jack-Out, ground maps and replay | The pilot's rescue references a defeat-leader scenario. Build a Collar/free-leader input and resolve Core break behavior with Story. Sub-boss Talk needs frozen action rules and outcomes. Three approaches need exact command bindings |
| Roster and relationships | Crew preparation, pair/recovery, cabin and Captain choice flows | String heroine IDs are already read for dialogue. Crew, pair, dates, squads, posts and save references are numeric today. Give those paths a stable mixed identity, shared residence and the new opt-in relationship gates |
| Progression and civic play | Supply, current ship screens, home support and investigation | Five and ten distinct captures drive each tier's signal and Core. Replace the pilot's temporary single-capture gate for full tiers. Add per-tier front state, core outcomes, call-up and recurrence |
| Art | Approved armor, wardrobe and reusable environment shapes | Compose crew sprites from the latest review. Route enemy, recovery and ally portraits by state and authored intent. Ship whole scenes or cue-level layers using approved, matching routes |

## Integration checkpoints

1. **Two independent local tracks.** Stage the approved-ready Art flows on the current campaign.
   Make the pilot opening playable on a separate profile. Compare rules/script hashes,
   release selection, save and rollback with the audit baseline.
2. **One full journey.** Play background, sign-on, ship approach, Collar rescue, reform, release,
   home battle and relocation in the real game. Exercise stay/leave and morning, character phase
   changes, and save/resume from the same profile. Record which art is verified and which exact
   scenes still use an approved fallback.
3. **One full tier.** Expand to the other Tier 1 pairs only against Story's ready roster and
   approved Art batches. Verify distinct capture gates, Core I and next-tier entry. Use the same
   release discipline tier by tier. [CY36](tasks/CY36.md) and [CY37](tasks/CY37.md) collect the
   integrated content, device and release decisions.

Use a single private revision register for code, Story source, Art source, tested release and
approval. Route script/encounter questions to Story and approval/appearance questions to Art.
Recheck IDs, asset hashes and the selected campaign immediately before applying a release.
