# Campaign content and preview releases

The campaign preview runs at `/campaign`. It uses the regular owner sign-in in a production build and its own save
under the same account. Local development serves the selected release from the ignored `content/campaign-release/`
directory. Set `CAMPAIGN_PACK_DIR` before starting the API to serve a different local output directory. For hosted
reads set `CAMPAIGN_PACK_BUCKET` to an existing private bucket readable by the Cyberpunk API service account and
set `CAMPAIGN_PACK_PREFIX` to the dedicated Cyberpunk path. Upload the verified hash files before switching the
preview pointer. Keep the old manifest and hash files for rollback. The API serves the same campaign allowlist
through its existing owner guard for either source.

Production uses the private `gs://uma-platform-content/campaign/cyberpunk/` prefix. Its Cloud Run service account has
an object read grant scoped to that prefix. The public app exposes the **Tier 1 campaign** entry in the ship menu.
It uses a separate save from the **Original campaign** entry, with independent local recovery and cloud sync.
The Home Screen app launches Tier 1. On a connection failure, a signed-in owner can reopen the last validated
release using the story files already on that device. The next online check reads the current selection.

## Source

Put `campaign.json`, `casting.json`, the story directories and `art/` in the same source directory. The default is
`content/campaign/`. World, chapter and scene files use the [existing story format](../game/story.md). The campaign
file identifies which quests the game can play and ties presentation to stable scene and asset IDs.

```json
{
  "schemaVersion": 1,
  "opening": "first-watch",
  "draft": true,
  "quests": [
    { "id": "first-watch", "title": "A place aboard", "scene": "first-watch-opening" },
    { "id": "dock-signal", "title": "Back at the dock", "scene": "dock-signal-return", "after": "first-watch" }
  ],
  "assets": [
    { "id": "observation-dock", "file": "dock.png" },
    { "id": "pilot-neutral", "file": "pilot.png" },
    { "id": "pilot-alert", "file": "pilot-alert.png" }
  ],
  "art": [
    {
      "scene": "first-watch-opening",
      "backdrop": "observation-dock",
      "portraits": [
        { "speaker": 9000101, "asset": "pilot-neutral" },
        { "speaker": 9000101, "emote": "alert", "asset": "pilot-alert" }
      ]
    }
  ]
}
```

`opening` is a quest ID. Each subsequent quest uses `after` with the preceding quest ID. Its `scene` points to a
chapter scene. A quest with an `encounter` ends in a `battle` step referencing that mission in the same chapter.
`art[].scene` points to a chapter scene. A portrait's speaker occurs in that scene's cast. An `emote` step selects the
matching portrait and the player can fall back to that speaker's default portrait. Asset filenames are lowercase PNG
or WebP names under `art/`. A preview displays the release ID and marks a pack with `draft: true` as **Draft**.

The opening's choice sets a story flag in the preview save. The scene applies its story changes and completion together
when it ends. Closing mid-scene resumes from that scene's start. A content update keeps the scene and asset IDs stable
so the completed scene and choices carry forward. Coordinate a save compatibility change before publishing a new ID
for a scene that already carries progress.

## Recruitment and personal stories

Add a `recruits` list to show a recruitment board after the shared opening. Set `supply.after` to `opening` so the
civilian routes open at the same time. A recruit has her casting `outfit`, a short `request`, a `signOn` quest ID,
and a `story` list of personal quest IDs in play order.

Each sign-on is a dialogue quest that depends directly on the opening. Its port must be reachable on the starting
drive and fuel. Give its scene a direct `join` step for that recruit. The first personal quest depends on her sign-on.
Each later quest depends on the previous quest in her story. The board uses crew membership to recognize sign-ons
already completed in an existing save. Preserve outfit, quest and scene IDs when revising a release.

## Training

Set `encounter` on the Training quest and use `scenario: "training"` in its chapter mission. Give it one trainee in
`fixedSquad` or in the chapter's `leads`. The scene hands off to the mission briefing, then the Hangar supplies either a
great blade or a rifle and either a Bulwark or a Med unit. The battle freezes the kit and its rules version at deployment.
Existing battle actions, Forecast and replay drive the exercise. A broken arm halves the two-handed blade's accuracy.
The Bulwark and Med unit remain available with broken arms when they have enough Charge.

For an optional exercise, put Training after the trainee's sign-on and leave it outside the personal quest chain.
Put a required exercise in the chain when it serves a specific story objective. A win clears Training once. A loss
can retry the same exercise. The exercise advances neither the day nor supplies.

## Quarters and morning

Add an `evening` block with an `after` quest ID and a `visits` list. Each visit has the companion's outfit ID in
`companion`, a `scene` for the visit, and an optional `morning` scene ID. Use separate chapter scenes for these beats.
The evening opens after its required quest and offers a companion once she is part of the saved crew.

```json
{
  "after": "recruitment",
  "visits": [{ "companion": 9000101, "scene": "pilot-evening", "morning": "pilot-morning" }]
}
```

Use `{ "illustration": "pilot-window-morning" }` in a scene to show a full-screen image. The ID must be listed in
`assets`. Dialogue stays over the image and the speaker portrait returns after `{ "illustration": null }`.
The scene prepares its portraits and illustrations before they appear.

The preview records the chosen visit before playing it. Reloading returns to that scene's start. Completing the visit
applies the scene effects and advances the day once, with the morning pending until its scene finishes.

## Ports and supply

The optional `supply` block opens after the quest in `after`. `start` and each port `id` name a story world. A port's
`name` labels it on the star map and its `scene` plays the first time the player lands. Set the world's `x` and `y`
to position the port. Each `stock`, `produces`, `upkeep` and `reserve` record gives amounts for `fuel`, `provisions`
and `alloy`. Set `routes` to two-way links with `from`, `to`, and a cost of 1–3 `fuel`. An optional ship capability
such as `needs: "drive-1"` gates a shortcut. Every port must have a route using the starting drive.

A port exports up to four units per shipment, after protecting its next upkeep and reserve. Fuel pays for jumps.
Provisions pay the ship's nightly bill. Alloy goes into the ship wallet, where the drive refit costs 300 credits,
20 Alloy and 10 Data. It takes two nights. Each night produces and pays local upkeep, spends up to two ship provisions,
and advances ship builds and duties. The tender restores up to three fuel and two provisions once per day when the ship
is short. Loading supplies and jumping both write the cargo and the source or destination together.

## Ship command

Use `port` on a quest to make it available at a supply port. For a ship battle, add an entry to `commands` whose `id`
matches the quest's chapter mission. Give it a `cost` in fuel and provisions, starting `transport` and `enemy` hull, and
an ordered `threats` list. Each wave gives a shield `section` (`fore` or `aft`), hostile `power` and a count of `fighters`.
Use `calls` to supply one short line per order (`evade`, `brace`, `fire`, `intercept`, `strike`, `reroute`). The bridge
uses the encounter scene's backdrop.

Launch charges the listed resources and freezes rules version 1, waves, reactor and officer skills. Each bridge order
records one allocation of reactor power and returns damage, shielding and fighter interception cues. A missing officer
has skill zero. An assigned officer can drill once per day in her station up to two drills. Reassigning her starts a
new station record. Win by screening the transport through all waves or by driving the raider off. Losing leaves the
frozen battle available to retry. Reloads restore committed orders. The win unlocks the authored debrief once.

## Occupied routes and ground missions

Chain an occupied route after its civilian defense debrief and bind the approach quest to the port. A command
encounter with `assault` gives the player a targetable `emitter`, an officer `call` and a `disabledFlag`. This uses
ship command rules version 2. Drive off the patrol before the window closes. Successfully disabling the emitter saves
the flag when the approach victory settles. Version 1 convoy replays retain their original win condition.

For a ground mission, put the default scenario on the chapter mission and add a `ground` entry with the same `id`,
a title and a `win` block. An `alternate` names a ship outcome flag, alternate `scenario` and Hangar `label`. A `boss`
binds a scenario's enemy leader `unit` to a `name` and a declared portrait asset. `expansion` forces a mounted back unit.
Set `back-deck` for a hack objective. The campaign freezes the selected map and loadout at deployment. Loss offers a
retry with that input and without another launch fee.

On victory, `win.flag`, `win.file` and `win.reward` grant a story flag, the referenced Log File and wallet amounts
once. Selden's boarding clear records custody. The station console opens the civilian exit and grants the manifest and
liberation separately. A port can use `liberation.flag` to add `liberation.alloy` to nightly production. Evidence stays
available on the campaign hub. Its saved lines remain readable after reload and do not require an optional earlier clue.

## Recovery and quarters

An optional `pairs` list describes recovery arcs. Each pair has an `id`, an `after` quest, a ground `capture` flag
and two `members`, each with an `outfit` and an authored `trust` milestone flag. `recovery` names two evening scenes
in order. The second visit records the Log File in `testimony`. The `release` scene completes recovery and joins the
former captive as a crew member. Both trust milestones are visible beside their names.

The post-release `bond` scene ends with a choice between its `romance` and `friendship` flags. The separate `residency`
scene uses `shared` and `separate` flags. Script each participant's decision in the branch. Each branch must end in
exactly one matching flag. The `rooms` block supplies a distinct `move`, `visit` and `morning` scene for each residency.
Completing the move opens the corresponding evening visit. Shared quarters and separate cabins work on either bond path.

Save v14 remembers a daytime pair scene, visit or morning before playing it. Scene effects and milestones commit once
when the scene finishes. Reloads return to its start. The visit advances the day once and queues its morning.
Keep pair IDs, milestone flags and scene IDs stable across revisions. The private `baseline-8` and `baseline-8-revised`
releases use the same progress IDs with a different shared-morning line and illustration.

## Shared evenings and home readiness

`pairs[].sharedEvenings` supplies a `friendship` route and a `romance` route based on the pair's own bond decision.
Each route has two ordered entries with a distinct `visit` and `morning`. The first visit includes the invitation and
each participant's agreement. The follow-up and its morning establish that both crew are ready to discuss their home.
Both residents must appear in all four scenes. Visits leave crew membership, quarters and individual Captain bonds intact.

After release and move-in, both crew must be available aboard to share an evening. Solo dates and the existing room
visit remain available alongside it. Completing the evening and its morning records one milestone. Both routes reach
the same readiness at two milestones. The existing saved pair-night identity supports these visits and both mornings.

If the pair has a `home`, also provide `home.stayScene`. It offers `stay` and a defer option. Once the pair reaches
readiness, `home.scene` offers `resettle`, `stay` and defer. End each committed branch in its existing outcome flag.
The defer branch sets neither flag and returns to the base without consuming the decision. Preserve previously filed
outcomes. An older save with a pending decision can return to the campaign and continue toward readiness or stay aboard.

The private `baseline-12-revised` draft includes both routes for all five pairs. The initial and revised packs use the
same scene IDs and test a new invitation line and lounge image while the first evening is pending. The
[shared evenings art handoff](../design/art-requests/shared-evenings.md) records the art slots and review beats.

## Homeworld return and defense

A pair can define `home` at a supply `port` with a liberation outcome. Its `base` is a local dialogue quest after the
pair's liberation quest. Its `defense` is a local ship-command quest after the base. The base opens once both crew
members can attend and have completed their first room or shared morning. Either residence outcome unlocks the defense.
Two pairs can have homes at the same port. Each home supplies its own base and defense quests and can name its own
ground victory flag in `liberation`. Omit that field to use the port's shared liberation flag.

Each residence outcome, `resettle` and `stay`, has a
`flag` and a `debrief`. The `jobs` list names one local assignment per pair member in casting order. After a resettled
debrief, `visit` is available whenever the ship docks there. A visit can be replayed. Its effects apply once.

The `support` object defines `alloy` added to local nightly production, `provisions` subtracted from the ship's daily
bill down to a minimum of one, and `relay` integrity added to the home defense at launch. Resettled members work
ashore. Their aboard stations and duty presets are cleared, and their saved records and quarters choices are kept.
Staying aboard retains stations and evening visits. Launch freezes the defense input including relay integrity and
officers. A retry uses that input and pays nothing further. Both paths should award the same required evidence.

CY27 continues in save v14 using the pair's existing pending scene and the story flag and scene IDs. Preserve those
IDs when replacing a release. The `baseline-9` and `baseline-9-revised` drafts test a changed line and base backdrop
while the home choice is pending. Keep local support available to later operations as a consequence of resettlement.

## Investigation and final operation

`finale.cases` lists one `port`, player-facing `title` and Log `file` per system. Set `pair` to the home pair that
owns the case when a port has several homes. Either of that pair's home debriefs files every line once. The
investigation lists the five cases and their evidence.
Completing all five debriefs is the only extra lock on the reveal. Dock at its port to read it. All travel and local
quests retain their own prerequisites.

`reveal`, `approach`, `breach` and `ending` name one chain of quests at the same port. The approach uses a ship assault.
A resettled home contributes one point of shuttle integrity, up to three. `preparation` prices an optional reinforcement
in `alloy` and adds its `integrity`. Cargo and alloy are charged at launch. The resulting input freezes the officer
skills, escort and reinforcement for reload and retry. Destroying the emitter opens the authored alternate ground map.
The main route remains available on a normal victory. The ending opens once the breach has been debriefed.

Ground missions can set `kit.weapons` and `kit.expansions` to one to four compatible parts. A mission with a required
`expansion` can list only that back unit. Squad slots fill in roster order from available members. Empty squad slots
retain the authored allies and their equipment. The final battle has two distinct terminals with shutter feedback.

The private `baseline-10` and `baseline-10-finale` releases cover all five local cases and the finale. Save v14 stores
the same story milestones and frozen mission input. Preserve those scene, file, quest and unit IDs when releasing new art.

## Captain relationships

Optional `dates` entries name a crew outfit in `companion` and the opening quest in `after`. Each entry has ordered
`milestones`, a repeatable `regular` visit and `awards` tied to completed quests. A visit names its `title`,
`scene` and optional `morning`. A milestone also sets its required `rank`, earned `rapport` and optional additional
quest in `after`. Use a distinct scene ID for every entry. The rank-one entry can give retroactive credit through a
`legacyFlag` carried by a previously released visit.

Write `captain` answers for tone and the existing `path` step at rank eight for the mutual choice. Its two branches
use `trust` and `heart`. The player chooses one evening plan. The visit records its scene and bond effects once,
ends the day and queues its morning. The morning completes on the following day. Regular visits remain replayable.
Quest awards use the companion and quest ID as their saved identity. Captain relationships use each crew member's
bond record alongside the separate pair story milestones. Several crew can choose Heart with the Captain. Author
each character's agreement in her own branch. A pair's own bond and cabin choices remain independent of that choice.

`baseline-11-revised` uses five milestone evenings and Selden's convoy debrief. It carries the original first visit
and morning forward at their released IDs. `baseline-12-revised` adds five-milestone arcs for the leads at the other
four ports. Their sign-ons open visits and their liberation debriefs open the follow-up and grant rapport.

## Planet-funded squad preparation

An optional `workshop` block names the local workshop introduction quest in `after` and lists the supported ground
`missions`. The quest's port hosts the campaign Hangar. Each `recipes` entry gives an existing rig `part`, its exact
`slot` such as `leftArm` or `back`, its `alloy` price and its `icon` asset ID.

The player directs a normal eligible Alloy shipment to the Hangar. The port deducts the cargo and the Hangar receives
its material stock in the same saved change. The ship wallet continues to receive the ordinary Alloy shipment.
Save v15 stores Hangar stock and owned parts. Crafting debits Hangar Alloy and grants one part. Fitting uses the crew's
saved rig and checks slot compatibility and capacity against the declared missions and their alternate entries.
Deployment can use a fitted rig or the issued kit. A mission-specific Back unit still applies where required.
The battle input freezes the equipped loadout through reload and retry.

The Selden draft prices the left Guard arm at three Alloy and the Missile pod at four. Both can be used in cargo
or maintenance boarding. Stable asset IDs for the handover and the two parts are in the
[Selden crew and gear art brief](../design/art-requests/selden-crew-prep.md).

## Tier 1 sectors, projects and fleet

The authored release uses `recruits` for its ten requests and a separate `sectors` entry for each officer. The sector
names her `officer`, bridge `qualification`, `port`, `liberation` quest and dialogue `appointment`. Preserve those IDs
when replacing the pack. Completing the appointment moves her to sector command and clears temporary ship posts.
Her rig, duties history, earned specialties and bonds remain in the save. Two sectors can contribute separately to
the same port. A retirement names a later quest and removes her from active deployment while retaining her record.

Optional `former` flags record continued local custody, supervised release, and independent aboard or ashore living
arrangements. Optional `shared` names a local `after` quest and two scenes, `visit` and `morning`. Both cast members
must appear. A shared visit appears when they can meet at the same berth or aboard, records the evening choice once
and resumes from the saved visit or morning. Captain bonds can continue when docked at the officer's sector.

Quests can add `requires` for additional completed quests and `flags` for story prerequisites. Keep `after` as the
main path. The parser checks the entire prerequisite graph for cycles. A joint watch can require both appointments.
Prefer stable commissioning and custody flags when adding outcomes to existing sequences.

`projects` name the owning `sector`, an Alloy price, days to build, and `production` and `upkeep` for each cargo type.
The port must be docked and the sector appointed to fund a project. A completed project changes the port ledger and
sets `project-ready-<id>` in the same night. Use that flag for the completion dialogue. Ship upkeep includes occupied
crew berths, custody and powered systems. Installed drive levels open their declared routes. Port reserves still
apply to both regular exports and shipments sent to the Hangar.

An authored `finale.cases` entry can name `fileQuest`, the debrief that verifies its complete evidence file. Required
files open `reveal`. `muster` additionally requires every sector appointment. Temporary fleet duty makes up to four
commanders available for boarding while their sector contributions remain visible. In version 3 command encounters,
`assault.fighterTarget: true` lets a fighter strike disable the named external system. The saved launch input records
the contributors and command power. Legacy versions preserve gun targeting. Ground battle rules v4 add close-range
Back mounts and area mortar splash while keeping old battle inputs replayable.

The fleet `ending` opens local handovers. Optional `lastWatch` names the concluding dialogue that requires the ending
and every sector handover. The player can finish individual handovers in any supported port order. The previous
pair-home gate, case readiness and aftermath stay available to packs that use the original fields.

Save v16 adds `campaignProjects` and `commandTraining`. Migration carries assigned drills into each officer's station
record. Sector outcomes, visit progress, fleet duty and case files use stable story flags and scene IDs.

## Check, pack and select

From the repo root, with the locked dependencies installed:

```text
pnpm campaign check
pnpm campaign pack baseline-1
pnpm campaign select baseline-1
pnpm campaign pack baseline-2 --dir content/campaign-drafts/baseline-2
pnpm campaign select baseline-2
```

Use a new release slug for new content. Packing validates the source and images, then writes hash-addressed JSON and
art plus an immutable release manifest. Selecting verifies every referenced file and atomically replaces the preview
index. Open the app or tap **Check release** to load it. The app verifies downloaded content against the manifest.
Run `pnpm campaign select baseline-1` again to return to the first release.

For the owner-only hosted build, upload the pack's `campaign/files/` and `campaign/releases/` objects to the
production prefix. Check that the selected pack and rollback manifests both have their referenced objects. Copy the
chosen immutable release manifest to `campaign/preview.json` with `Cache-Control: private, no-store`. Use the
current pointer's object generation as the write precondition when replacing it. Roll back by copying the prior
manifest to the same pointer. The original game and campaign save data have no role in selecting a release.

Start `pnpm api` and `pnpm web`, then open `http://127.0.0.1:5214/campaign`. For the baseline rehearsal, play
**A place aboard** in the first release, make a choice, and finish the scene. Select the second release, check for the
update in the app, and continue through **Back at the dock**. The revised line and alert portrait use the same IDs.
The first scene's choice and completion stay in the campaign save. Select the first release again to verify recovery.

Keep source, release files and art under ignored `content/`. This checkout's two original baseline drafts use an
invented recruit and original raster placeholders. Story and art can replace those assets through the same references.
The private `baseline-3` rehearsal adds a draft sign-on scene, a quarters visit and a morning with an illustration.
The private `baseline-4` rehearsal replaces sign-on with Training and its debrief, then opens the same quarters visit.
The private `baseline-5` rehearsal adds five landing scenes, cargo, upkeep and a drive shortcut. It carries the port
and scene IDs across art and dialogue revisions. The Training exercise is free.
The private `baseline-6` rehearsal adds the paid relay convoy defense and the second occurrence of the three-pulse clue.
The private `baseline-7` rehearsal adds the contested approach, boarding, custody and Selden liberation with temporary
art. Final asset requirements are in the [Selden art packet](../design/art-requests/selden-quarantine.md).
The private `baseline-8` rehearsal adds recovery, testimony, release and both room paths with reused placeholders.
Replacement assets are in the [recovery art packet](../design/art-requests/selden-recovery.md).
