# Campaign content and preview releases

The campaign preview runs at `/campaign`. It uses the regular owner sign-in in a production build and its own save
under the same account. Local development serves the selected release from the ignored `content/campaign-release/`
directory. Set `CAMPAIGN_PACK_DIR` before starting the API to serve a different local output directory. Publishing here
means selecting a release in the private preview directory served by that API.

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

## Recruitment Training

Set `encounter` on the Training quest and use `scenario: "training"` in its chapter mission. Give it one trainee in
`fixedSquad` or in the chapter's `leads`. The scene hands off to the mission briefing, then the Hangar supplies either a
great blade or a rifle and either a Bulwark or a Med unit. The battle freezes the kit and its rules version at deployment.
Existing battle actions, Forecast and replay drive the exercise. A broken arm halves the two-handed blade's accuracy.
The Bulwark and Med unit remain available with broken arms when they have enough Charge.

Put the recruitment dialogue and `join` step in a quest after Training. A win clears Training once and unlocks that
quest. A loss can retry the same exercise. The exercise advances neither the day nor supplies. Set `evening.after` to
the recruitment quest to make the visit available once the trainee signs on.

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

## Homeworld return and defense

A pair can define `home` at a supply `port` with a liberation outcome. Its `base` is a local dialogue quest after the
pair's liberation quest. Its `defense` is a local ship-command quest after the base. The base opens once both crew
members can attend and have completed their first morning. Both outcomes of `home.scene` unlock the defense.

The choice uses the same two-branch format as the bond and room scenes. Each branch, `resettle` and `stay`, has a
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

`finale.cases` lists one `port`, player-facing `title` and Log `file` per local arc. Each port needs a pair with a home
and defense. Either home debrief files every line once. The investigation lists the five cases and their evidence.
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
