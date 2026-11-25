# The uma-cyberpunk manual

The manual records mechanics as built. For the next release, the [four-act player guide](campaign.md) describes the planned experience and links to its roadmap. Update the manual in the packet that ships each rule.

| Page | What | Visual page |
|---|---|---|
| [Four-act campaign guide](campaign.md) | Planned player flow from recruitment through the finale | [campaign.html](previews/campaign.html) |
| [The app as built](architecture.md) | The pages, the save and how it syncs, sign-in, updates, deploys and local setup (CY3) | [architecture.html](previews/architecture.html) |
| [The battle](battle.md) | The map format, the rig, the timeline and Charge, movement, attacks, Cover, Crossfire, counters, Rig Break; the roles' Back units, Tech, chance skills, items, Stride, the bench call; objectives, the forecast, and the tuning tables, live (CY4, CY5) | [battle.html](previews/battle.html) |
| [The ship and the worlds](ship.md) | The rooms and their keys, rooms opening with leads, the star map, a world's map, the Continue card, save v3 (CY10, CY12) | [ship.html](previews/ship.html) |
| [The ship as a build](ship-build.md) | Decks and modules, levels, building over watches, unlocks, the wallet, the reactor's pips and power per sortie, the Lab, the map by capability, the refit, save v7; the module and project tables, live (CY15) | [ship-build.html](previews/ship-build.html) |
| [Duties, the ship log and jump events](duties.md) | Posts, aptitude by thresholds, tenure by running style, mastery, chiefs, outputs and the ship-log card, auto-assign and presets, camaraderie, the meal, jump event cards, save v8; the post table, live (CY16) | [duties.html](previews/duties.html) |
| [Squads, operations, standing and readiness](squads.md) | Squads and cohesion, the deploy screen's squads, operations on Comms with their deterministic outcomes, recall and reports, faction standing, the readiness meter, a finale's needs and harsh conditions, the stand-in's pieces, save v10; the numbers, live (CY18) | [squads.html](previews/squads.html) |
| [The mission flow](missions.md) | Briefing, deploy, battle, results and aboard; resume at every step (CY10) | [missions.html](previews/missions.html) |
| [The crew](crew.md) | Bands from 5★ stats, roles, Stride, level and Strain; the Quarters; save v4 (CY11) | [crew.html](previews/crew.html) |
| [The Hangar](hangar.md) | Slots, Capacity and Load, the swap preview, saved loadouts, best for her role, the starter parts (CY11) | [hangar.html](previews/hangar.html) |
| [The captain and bonds](captain-and-bonds.md) | The captain, the watch, bonds 1–10, rapport, bond scenes, Trust or Heart, messages, save v5 (CY13) | [captain-and-bonds.html](previews/captain-and-bonds.html) |
| [Cabins, decor and visits](cabins.md) | The Quarters deck, cabins and their six slots, items and styles, Comfort, visits (talk, gifts, decorating together, invitations), tastes, requests, the cabin's look, save v6 (CY14) | [cabins.html](previews/cabins.html) |
| [The story](story.md) | The story's files and steps, `pnpm story:check` and `pnpm story:pack`, delivery and the stand-in, the scene player, the story state in save v2 (CY9); the Chapter 1 loop: pickups, interjection slots, debriefs (CY12); the life-aboard loop: every system of ship life on the stand-in, Phase 4's exit (CY19) | [story.html](previews/story.html) |
| [The sandbox](sandbox.md) | Setting up and playing any skirmish, autosave and Resume, the results, the test scenario (CY8) | [sandbox.html](previews/sandbox.html) |
| [The board](board.md) | The battle board on uma-stage: terrain, figures with their rings and wedges, the overlays, taps, the pan, the fade, the loop, the test bench at `/board`, and the five checks (CY7) | [board.html](previews/board.html) |
| [How enemies choose](enemy-ai.md) | The enemy AI and ally Auto: where she stands, what she does, never idling (CY6) | [enemy-ai.html](previews/enemy-ai.html) |
| [Terrain, props and terminals](terrain.md) | The five tile states and how they spread, props, cover and grating, terminals, the terrain card (CY5) | [terrain.html](previews/terrain.html) |
| [The Holds and the factions](factions.md) | How heroines are freed, and the Steel Muster's reload, volley and pinning fire (CY5) | [factions.html](previews/factions.html) |

Specs and intent live in [docs/design/](../design/). Where they differ from this manual, the manual and the code win.

## How these docs stay true

- **Lists are generated from the code,** as in uma-rpg's manual: a renderer writes each block between
  `<!-- live:<key> -->` and `<!-- /live -->`, a test fails on a stale page, and `pnpm docs:update` rewrites them.
- **Each page has a desktop page** in [previews/](previews/), rendered from its Markdown by `scripts/manual-pages.mjs`
  (Mermaid diagrams included); a test fails when one is stale, and `pnpm docs:update` rewrites them too. A page marked
  `<!-- hand-made -->` is kept as written.
- **Hand-written parts** change in the same commit as the code they describe.
- **Original-game content stays out:** no outfit, character or scenario names from master data, no guest-franchise
  names, and no franchise cast.
