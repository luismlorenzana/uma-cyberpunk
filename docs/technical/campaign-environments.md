# Complete campaign environments (CY69)

> **Reusable foundation.** This page documents the approved environment coverage for the earlier release. The [four-act systems plan](four-act-campaign.md) sets new campaign requirements. Use the [current authoring contract](../design/campaign-art-delivery.md) for new bindings.

CY69 integrates the approved complete environment delivery on the existing Tier 1–5 campaign.
Sixty-four approved source images cover 889 reviewed scene mappings: nine were already current,
880 backdrop fields change and 47 image references are added. All 868 remaining four-review-plate
bindings are replaced. Native bytes, dimensions and approval hashes stay intact. The private
integration record contains exact sources, scene IDs, current-base checks and publication receipts.

The 559 non-config Story files and all 1,421 prior image references remain exact. Keep all 300
wardrobe bindings, 600 crops, 1,979 scene contexts, foreground compositions, dialogue/profile
expressions, management states, ship cinematics and the two-handed rifle delivery. There is no
save-shape change or progress reset. Character pose/wardrobe approval and CY37's physical iPhone
review retain their separate scope.

## Precise shore milestones

A date milestone may declare `port`, referencing an existing supply-network port. Only that
milestone is offered when the ship is there. Away from shore, the Captain can still choose the
regular aboard conversation. Earlier milestones, other relationships, service prerequisites,
existing ashore restrictions and reserved evenings retain their behavior. The relationship panel
names the required port beside a pending shore milestone.

Four existing shore scenes use this admission field. One closes a fleet-duty interval that could
temporarily bypass an otherwise existing home-port restriction. This is a scoped availability
correction, not a new restriction on all dates. Already reserved evenings may finish on their saved
scene without a second night or charge. All dialogue, flags, rewards and relationship outcomes remain.

## Script-driven background cuts

An art entry may declare optional `backdropCues` alongside its initial `backdrop`:

```json
{
  "scene": "civilian-trip",
  "backdrop": "public-ferry",
  "portraits": [],
  "backdropCues": [
    { "at": "steps[2].choice[1].then[0]", "asset": "ship-radio-room", "location": "Ship bridge" }
  ]
}
```

The optional `location` updates the visible caption with the cut. Paths use the story checker's
existing `walkSteps` grammar and must resolve to an actual step in
that scene. Images must be declared assets; duplicate paths are refused. Each scene permits up to
32 cues. The CampaignScene loader resolves the paths to the same Step objects the runner executes.
The runner's optional presentation hook runs only for visited steps, including fast-forwarding.
The ScenePlayer changes the backdrop at that step without changing dialogue, choices or effects.
An unchosen branch cannot display its image. Earlier packs omit this field and keep static art.

The two current uses return an operation's view to the bridge at its explicit narration and return
to the ship only when the ferry scene's waiting branch is chosen. Taking the ferry retains the
passenger-deck art. The meal-packing conversation remains at its counter: a proposed garden visit
does not move the scene. These seven setting questions are resolved by scoped Development staging;
this does not claim final Story or Character approval of every pose and public-room outfit.

Cue images preload with that scene, sharing image requests and normal blob cleanup. If a cue image
is unavailable, its step clears the previous plate and retains the readable scene and controls.
Normal, skipped and replayed dialogue use the same presentation path. Publication does not award
effects or resume a different quest.

## Release and verification

Deploy the compatible reader before selecting the new content. Rebase only approved backdrop
fields against the freshly selected book; the authoring review's copied runtime/config does not
replace current gameplay. The migration adds the four explicit milestone ports and two cue lists.
Its structural comparison permits no other gameplay/config changes. Scripts, old asset references,
portraits and wardrobe are checked independently, and every source/mapping is hash-approved.

Stage and read back immutable files, then select using the original pointer generation. Preserve
the predecessor for a guarded rollback. The ordinary [general-art publisher](campaign-art-publishing.md)
handles later registered-image replacements; repeating identical sources must be a no-op. These
opaque scenery plates stay in the private campaign pack. No shared Platform atlas or Character/Farm
publication is required by this delivery.

Actual campaign replays cover recruitment/Training, both fleet entries, custody/handovers, funded
equipment and later services. The current CampaignScene is checked at 844 × 390 with safe areas,
including approved image hashes, branch-specific cuts and missing-cue behavior. Keep physical
installed-iPhone findings in CY37 rather than treating browser emulation as device acceptance.
