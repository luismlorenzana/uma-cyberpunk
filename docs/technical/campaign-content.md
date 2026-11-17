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
