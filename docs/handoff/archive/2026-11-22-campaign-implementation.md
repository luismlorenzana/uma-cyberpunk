# Campaign implementation queue · 2026-11-22

> **Historical release record.** Current sequencing and acceptance live in the [four-act roadmap](../four-act-roadmap.md).

The current campaign stays playable while the new Story pilot gets its own release and save.
Approved Art can move through the existing campaign wherever its exact scene and actor bindings
match. Build both paths on the current game and tactics engine.

The ignored `content/implementation-intake-2026-11-22/` folder holds the exact Art, Platform
and hosted snapshots, private source pins and coverage report. The first hosted snapshot predates
the [50-crew batch](CY76.md#hosted-crew-batch). The November 23 Story intake builds
all ten Tier 1 journeys, the Signal and the five Core I scenes. The first Core uses the existing
escort and boarding engines on the same pilot profile. Exact script and artwork pins live
with the private pilot pack.

## Development packets

| Packet | Outcome | Start and dependencies |
| --- | --- | --- |
| [CY72](CY72.md) | Separate playable Story pilot, save, pointer and cache | Local opening and recruitment delivered. Hosted acceptance remains in CY36–CY37 |
| [CY73](CY73.md) | A freed boss can recover, join the crew, share a cabin, date the Captain and join a trio evening | Lifecycle in the pilot. Use CY77/CY78 for remaining approved art |
| [CY74](CY74.md) | Ship approaches, Collar rescue, sub-boss Talk and J8 Duo techniques | In use across the Tier 1 cohort. Continue encounter acceptance in CY36 |
| [CY75](CY75.md) | Tier 2–5 fronts, Core III recapture and final settlement | Admit later Story cohorts through the existing tier gates |
| [CY80](CY80.md) | Ten Tier 1 journeys, two independent home outcomes per port | Complete in the local pilot |
| [CY81](CY81.md) | Core I and Tier 2 entry | Exercise the ten-capture gate, approach, breach and settlement. Connect the first Tier 2 sign-ons when they arrive |
| [CY82](CY82.md) | Temporary call-up for released pairs | Complete for the Core I approach and breach. Saved crew and station snapshots are scoped to each mission |
| [CY61](CY61.md) | Selectable individual crew signatures and warned boss actions | First executable draft at White Spire. Coordinate actor-specific art and lines in CY62/CY63 |
| [CY76](CY76.md) | Approved crew sprite publication | All 50 live in the hosted campaign |
| [CY77](CY77.md) | Hosted outfit, expressions, portraits and armor routed by actor and role | Start now with verified replacements and new assets. CY73 supplies new pilot phase data |
| [CY78](CY78.md) | Approved Crew and boss scene splashes tied to exact scenes and branches | Start the intake and first existing-campaign cohort now. Needs reviewed Story mappings and CY77 identities |
| [CY79](CY79.md) | Boss Enemy, Boss Ally and sub-boss figures on the real board | Local review proves the role and outcome paths. Production bundles and exact approval hashes are pending |

## What the restructure changes

| Area | Reuse | Development impact |
| --- | --- | --- |
| Campaign and save | Current landscape app, content packs, offline cache and revision checks | A second campaign identity must reach the server, device store, cache and restore paths. The current client distinguishes legacy and campaign saves, with one campaign scope today |
| Recruitment and journey | Sign-on, roster scenes, ship and ground encounters | Chapter prerequisites must become executable campaign gates. The pilot uses the nine-beat journey, with recruitment, capture and release as different milestones |
| Combat | Existing ship engine, Hold, Jack-Out, ground maps and replay | The pilot's rescue reuses the current map with a Collar/free-leader input. Story confirmed the Core break outcome, separate rescue scenes, actor-specific Talk and three escort bindings |
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
3. **Tier 1 Signal.** Five distinct settled captures unlock The Signal. Recruits can sign on
   and finish independently. Keep the same save when advancing to Core I.
4. **Core I.** Ten captures, The Signal and the ten testimonies open the receiver operation.
   The command outcome chooses the lock. The relay outcome and aftermath unlock Tier 2
   when its first cohort is added to the release.
   [CY36](CY36.md) and [CY37](CY37.md) collect the integrated content, device and
   release decisions.

Use a single private revision register for code, Story source, Art source, tested release and
approval. Route script/encounter questions to Story and approval/appearance questions to Art.
Recheck IDs, asset hashes and the selected campaign immediately before applying a release.
