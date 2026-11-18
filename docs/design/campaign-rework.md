# Uma Cyberpunk campaign rework

The new campaign uses the existing landscape iPhone app and HD-2D tactics engine with a fresh campaign save. First Watch opens the civilian routes and ten recruit requests. Sign-on adds the officer to the roster, where the Captain can start her operation separately. The [implementation queue](../handoff/README.md#four-pillar-implementation-queue) follows the authored Tier 1 campaign. The prototype remains a reference for earlier releases and saves.

## Campaign loop

The Homestretch is a refitted rescue tender. Ten officers join it on temporary assignment to free their home sectors. The Captain commands ship encounters and deploys squads for boarding and ground battles. Civilian ports cover their reserves and upkeep before exporting supplies for operations, equipment and refits. Each liberated sector and its civilian authority determine the conditions for appointing the officer to local command. Her assignment changes where she can serve and how her sector contributes.

The Captain chooses one evening plan per day. Individual friendships and romances can develop concurrently. Shared evenings and quarters remain separate choices. Former commanders account for their own orders, with local custody or supervised release according to the journey. An officer's civilian appointment and the pair's personal choices each have their own prerequisites and consequences.

Five systems each have an early civilian berth and two separately opened operations. Ground tactics retain the board, forecast and AI. Main weapons and limited armor expansions give each fighter her own style. Optional Training is a crew exercise in the real campaign after sign-on. The day ends by player choice, with one nightly visit and upkeep resolution.

The next presentation/authoring delivery is [the four-pillar plan](campaign-art-delivery.md) (D64).
It starts with meeting, confession, seated cabin chat and spending the night, then carries coordinated
development, Art and Story packets through management rooms, ship cinematics, composed equipment
sprites and signature attacks. These are planned extensions on the current campaign, with draft
content integrated alongside implementation and approved replacements using the same bindings.

## Story and art milestones

| Playable delivery | Story | Art |
|---|---|---|
| First Watch and sign-on | Stage the premise, ten sign-ons, first story objectives, first visits and optional familiarization. | Stage the bridge, civilian berths, recruitment props, expression cues and Training map. |
| Paired local operations | Give each sector a civilian stake, ship and ground objectives, a local resolution and a command handoff. One operation files the required case and the other offers corroboration. | Match port, bridge, ship and ground art to the protected service and actual mission outcome. Use existing approved looks and stage pending art in the same slots. |
| Custody and life aboard | Script each former commander's accountability and disposition, as well as the distinct relationship, room and appointment choices. | Stage custody, cabin and local command views to show where each person lives and serves. |
| Investigation, fleet and handover | Compare the five cases. Mobilize ten commands and give each one a visible role. Follow victory with a civilian crossing and each officer's personal handover. | Stage the evidence comparison, bridge calls, both breach routes, objective states and restored civilian services. |

## The enemy behind the occupations

The hidden enemy manipulates orders and redirects the systems' resources. Each local operation has its own civilian stakes. The five required cases establish **what was redirected, what it enables, and what the crew can stop**. The private case ledger and joint-operation script carry the enemy's identity, motive and details.

- **Seed.** Establish the significance of an altered order locally. Give the player a concrete prop or objective that works whichever operation comes first.
- **Corroborate.** File each verified required case at its liberation debrief. The other operation's testimony can add context about the same sector or system.
- **Reveal.** Compare the five cases and record the discovery. An outstanding operation can acknowledge the new information and continue to its purpose.
- **Confront.** Mobilize ten sector commands, including visible contributions from officers ashore. Play the approach and a bounded squad breach, then prove the restored civilian passage in the aftermath. Personal handovers follow fleet victory.

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
