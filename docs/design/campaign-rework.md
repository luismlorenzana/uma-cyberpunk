# Uma Cyberpunk campaign rework

The new campaign uses the existing landscape iPhone app and HD-2D tactics engine with a fresh campaign save. Its first playable delivery is an authored recruitment quest that takes the Captain through Training, debrief, the recruit's quarters, and the first morning. The [CY packets](../handoff/README.md#current-packets) define how the game grows from there.

## Campaign loop

A recruit joins to liberate her home. The Captain builds trust with her aboard and trains the crew for the next sortie. Friendly and liberated planets supply the ship after covering their own upkeep. The ship spends supplies to operate, upgrade and prepare missions. Its captain commands ship encounters and deploys a squad for boarding and planet-station battles. The campaign tracks an occupying boss through capture, recovery from alien control, release, and an optional shared life with the recruit. Once the home is liberated and the pair is ready, they may return to develop it and continue supporting the crew.

The Captain chooses one evening plan per day, beginning with teammate visits. Individuals decide whether to become romantic partners, share quarters, or return home. Polyamory is accepted in the setting. Recovery and trust can develop during captivity. Romance and cohabitation with the former boss become available after release and her own decision.

Five systems each have an early accessible landing point and an occupied route that takes an offensive mission to open. Ground tactics retain the current board, forecast and AI. Main weapons and limited armor expansions give each fighter her own style. The opening exercise uses targetable rig damage as the starting design. The day ends by player choice, with one nightly visit and upkeep resolution. Treat both as starting calls to validate in the opening playtest.

## Story and art milestones

| Playable delivery | Story | Art |
|---|---|---|
| Opening and Training | Select the first recruit and counterpart privately. Write her home goal, the authored exercise, debrief, first visit and morning. Establish one observable detail that can be explained later. | Integrate the recruit's ship and combat looks, expressions, quarters, briefing view and Training map. Check asset legibility at phone size. |
| Landing and defense | Outline five faction stories and the hidden enemy. Script the first landing and defense objective, plus officer calls for the actual decisions. | Land the port and bridge views, officer portraits, ship and fighter silhouettes, and threat, shield and disabled-system feedback. Sketch a few candidate motifs for the hidden enemy. |
| Liberation and recovery | Give the first faction and boss their own reasons and mistakes. Connect an operational clue from ship or ground combat to evidence recovered during the former boss's arc. Script capture, recovery, release and the first shared-quarters scenes. | Deliver the boss's faction, combat, brig and post-release looks, a boarding kit and a station kit. Reuse a reviewed hidden-enemy motif where it supports a clue in play. |
| Return and later factions | Write both residential outcomes and the ongoing support the pair can offer. Deliver each faction plot with a local resolution and one distinct piece of the later threat. Write the final operation and aftermath against the evidence already established. | Show liberated bases and what changes as their people return. Build the hidden enemy's reveal assets and final encounter kit once the reveal and playable objectives are agreed. |

## The enemy behind the occupations

The hidden enemy is the alien power manipulating the occupying factions and exploiting the systems' resources. The five faction campaigns give the player reasons to fight locally. Together, they explain **what the aliens are taking, what they are building or enabling with it, and what the crew can stop**. Treat the aliens as the campaign antagonist with a playable final objective. Story owns their identity, method, and motive. The existing Blackout, Tithe and Gate Heart are available as material. Their roles in the new campaign remain open until the story brief is agreed.

- **Seed.** The opening may contain a single clue that works in its own scene. Give it a plausible local explanation so Training can stay focused on the recruit. Art can carry a recognizable pattern in a prop, readout or damaged component.
- **Corroborate.** Each faction supplies a distinct clue through something the player does. Possible evidence includes a resource manifest recovered on a station, a repeating command signal during ship combat, or a former boss recognizing the same coercion mechanism in another system. The player can assemble the key evidence in different faction orders, with a reliable campaign route to each required clue.
- **Reveal.** Show the link between manipulation, extraction and the aliens' objective in terms the player can act on. Preserve the factions' and bosses' agency, with room for resistance, complicity and divergent choices. The story brief names the latest point by which the player needs to understand the stakes. Art gives the threat a readable identity with consistent signals across ship and tactics encounters.
- **Confront.** Write what the Captain must stop, what happens if the operation is delayed or fails, and what victory changes for the worlds. Use the established command and tactics systems. Planetary supplies, station skills, and help from allies or resettled characters can affect preparation and available support. Core progress has a route for players who kept their crew aboard or pursued friendship. Art details the objective and its changing states, including a visible aftermath.

Before scripting all five arcs, outline the alien objective, the evidence that makes it discoverable, and one plausible final operation. Before commissioning bespoke final art, agree on the objective, scene beats, enemy silhouettes, phases and states that must be readable during play. Record the actual names, pairings, dialogue and spoilers in the private story files.

## Playable baseline and content releases

Each delivery includes enough original draft writing and placeholder art to exercise the real feature. The opening baseline is a short playable conversation with invented characters, a choice with a saved consequence, named speakers and expression cues, plus placeholder portraits and a backdrop. CY22 extends it through a Training briefing, encounter and debrief. Later packets add baseline calls, scenes and assets as their rules need them. The coding contributor can author these directly while story and art develop the approved versions.

Run the baseline through the same versioned contract, checker, packer, private preview publication and app loader used for approved content. Publish a second preview release with a rewritten line and a replacement image under the same story and asset IDs. Verify that the app discovers the update, renders the new files, and can still continue or resume a save that used the first release. Document how to return to a known-good pack if a release fails.

Label the baseline as draft in preview. Keep source files and assets in ignored private content. CI uses small invented fixtures for automated checks. When the approved script and art land, use the same IDs and publish them through the verified path. If an approved revision changes quest state or an ID, define how existing saves continue before publishing it.

## Shared quest brief and review

At the start of each delivery, code, story and art agree on a quest brief with the player entry point, scenes and choices, mission objectives and fail/retry rules, consequences saved and shown, and required assets. Use the same IDs in the game, script and art brief. For a clue, specify where it appears, what it means on first encounter, and where it pays off. Story can change an encounter outcome or require a new rule. Art can change the staging when intent or ownership reads poorly on the phone. Update the brief and affected packets together.

Review every delivery through the campaign on the iPhone. Verify the intended outcome, retry and resume, the visible consequences, and the authored lines and art in context. Use the same encounter definition for automated and simulator checks. Keep source story, casting, art and screenshots in private content. CI can run invented fixtures that exercise the same schema and mission entry.

## How the pillar packets ship

The [four-pillar queue](../handoff/README.md#four-pillar-implementation-queue) extends the playable campaign. CY29 starts with the Captain's relationships. CY30 shows planetary exports changing the squad's gear and a real boarding fight. Their planning can overlap. Integrate their save changes in order and verify each against the deployed campaign save version.

For each packet, keep a shared brief that names the campaign entry, objectives and player choices, saved consequences, dialogue beats, asset slots and how to check them in the live scene. Use those IDs in code, draft scripts and the art handoff. A new story beat or art requirement that changes a rule updates the brief and the implementation together.

Supply playable draft scenes, dialogue and compatible placeholder assets with each code delivery. The story and art sessions can review and replace them through the same private release format. Carry both a fresh save and a save from the preceding release through the checkpoint. Keep the real quest as the place to review the result. Use scripted runs for repeated balance and save checks.

Record each delivered rule and its review result in the handoff. When a packet closes, point its dependents to the delivered design or manual before removing the packet.

CY36 reviews approved content and tuning across all four pillars. CY37 verifies the owner-only release path, phone play and save recovery. The existing CY22–CY24 and CY28 reviews carry into those checkpoints.
