# Campaign locations and management receipts (CY51)

The combined campaign exposes **Ship and port** after its existing supply/opening quest. A location
inspects the same save and opens the existing supply, project, duty or Hangar controls. It never
creates another resource ledger. Packs without `management` retain the earlier campaign interface.

## Reachable inventory

All entries require the configured quest, a known current port and no mission, evening or pair scene.
These IDs belong to the private presentation contract; named art, scripts and approvals stay private.

| Location ID | Existing saved predicate / interaction |
|---|---|
| `bridge` | Placed Bridge; existing navigation/supply controls |
| `welcome-briefing` | Opening quest complete; read-only location context, recruitment stays on the roster |
| `private-cabin`, `corridor-entrance`, `lounge` | Placed Quarters; unoccupied location context, no extra visit or rapport |
| `shared-cabin` | Established shared pair residence with both aboard, or a played sector shared visit with the former commander resident aboard and the officer aboard; away members excluded |
| `galley`, `observation`, `medbay` | The corresponding placed module; location context only. The current campaign offers no installer for these modules. They remain conditional bindings for compatible saves and scene backdrops |
| `brig-interview` | Actual capture/local custody or awaiting review at this dock; no release, romance or command appointment inferred |
| `hangar-workshop` | Existing workshop quest complete at its configured port; export, recipes and actual crew rigs |
| `engineering-reactor` | Placed Engineering; existing refits, power and crew duties. Any current ship build marks work in progress, including a level-zero drive installation |
| `cargo-hold`, `airlock` | Existing supply quest complete; ship cargo, protected local exports, relief and drive installation |
| `civilian-berth` | Known current port; actual liberation flag selects occupied/civilian-control context |
| `base-office` | A local sector appointment; existing command/project controls |
| `facility-<project>` | That project's actual local appointment; funding, nights remaining or operating production. The combined pack has three projects |

The lounge is visual staging in existing Quarters, not a new economy system. Care, social and living
plates do not summon an officer or change consent. No module damage/repair state or project
cancellation exists in this campaign; CY51 adds neither.

## Additive private pack format

`campaign.json.management` contains `after`, `locations` (up to 64) and `reports` (up to 128).

```json
{
  "after": "opening",
  "locations": [{
    "id": "engineering-reactor", "title": "Engineering", "family": "operations",
    "entry": { "kind": "module", "module": "engineering" },
    "scene": "engineering-context",
    "visual": { "slot": "engineering-room", "fallback": "approved-room" },
    "states": { "building": { "slot": "engineering-work", "fallback": "approved-room" } }
  }],
  "reports": [{
    "kind": "refit-complete", "subject": "engines", "destination": "ship",
    "location": "engineering-reactor", "scene": "drive-handover", "fallback": "steward-handover"
  }]
}
```

- Families: `command`, `living`, `social`, `care`, `operations`, `planet`.
- Entry gates: `module` + `module`, `quest` + `quest`, `project` + `project`, or `workshop`,
  `port`, `command`, `custody`, `shared` without extra targets. References are checked against the pack.
- Visuals have a stable authoring `slot`, required asset-ID `fallback` and optional final `asset`.
  Omitting `asset` explicitly declares a draft/reuse slot. Asset presence does not establish approval;
  hash-bound source approvals and release integration are recorded separately.
- State variants: `ready`, `unfunded`, `building`, `complete`, `stocked`, `fitted`, `occupied`,
  `restored`, `powered`. Unsupported health/repair variants are refused. Undefined variants use the
  base visual. Download failures try the named fallback; unavailable art leaves the controls usable.
- Optional `props` (at most three) or legacy single `prop`: asset ID, `when` and integer
  `x`, `y`, `width`, `height` within the 1844 × 853 composition. `hangar-alloy` reads Hangar stock;
  `ship-alloy` reads the wallet. `ship-stock` requires `resource` (`fuel`, `provisions`, `alloy`).
  `port-surplus` defaults to Alloy or names the same resource, and reads the real loadable shipment:
  reserve and next upkeep stay protected; full ship capacity hides that resource's offer. Stock
  props disappear independently at zero. Transfers, spending, nightly production/upkeep and reload
  use the same saved ledgers as the controls. Duplicate resources, conflicting lists, bad predicates
  and out-of-bounds placements are refused. Viewing a prop never changes inventory.
- Optional `contexts`: unique `{ state, scene, fallback }` rows select read-only context for that
  saved state. Numeric speakers require actual physical availability; otherwise the fallback plays.
- Reports bind actual receipt kinds, optional subject/destination, location, scene and fallback.
  A fitting's named speaker must also be the actual fitted officer. Ashore/away officers use the
  universal fallback. Port reports require the real project port; ship reports travel with the ship.

Context/report scripts may use ordinary dialogue, expressions, illustrations, waits and narrative
choices. Effects, calls, Captain/path rewards and battles are rejected even inside choice branches.
Universal room/fallback scripts use Steward or narration, so no absent actor is assumed. No narrative choice transfers
resources; only the live ledger controls do that. Amounts, costs and remaining nights come from saves.

## Saved state and ordering

Save v18 adds `management: { sequence, receipts, acknowledged }`. Earlier versions migrate without
altering story, rigs, cabin plans, projects, day or `account.updatedAt`. Old app readers refuse v18;
old content packs work with the new reader.

Real commits record `shipment`, `relief`, `project-start`, `project-complete`, `refit-start`,
`refit-complete`, `crafted` and `fitted`. A receipt contains sequence, day, kind, subject, port,
destination, positive amount and optional fitted officer. The newest 32 receipts form a dated history,
not a second inventory. Remote project completion records its project port, not the ship's dock.

`acknowledged` stores up to 2048 distinct context/report keys independently of image loading.
Report keys include kind, destination, subject and any fitted officer. Finishing an optional report
acknowledges it once; leaving it permits a later retry. It changes no costs, day or inventory.
Obsolete construction/fitting reports are withheld. History eviction can remove an unread optional
report; the completed project/refit and its live ledger remain available.

The original nightly order remains: advance projects and completion flags; derive completed local
production/upkeep; settle local reserves, exports/support and ship upkeep; pass the ship watch and
finish builds/duties. Observation records the resulting commits once. Completion art uses the actual
zero project counter or installed module level, never just a flag or a resource reservation.

Ship-wallet Alloy funds projects/refits. Hangar Alloy funds recipes. Owned parts are not fitted until
the real crew rig contains them, and that rig is used by supported campaign boarding encounters.

## Delivery and remaining authoring

The first integration uses the three owner-approved operations exports, existing approved command,
cabin and berth plates, the scoped second Story draft and short Steward fallbacks. Nineteen location
slots and twenty-three report bindings are in the private fixture. The existing Hangar introduction
gets its own plate; shared placeholder assets used by unrelated scenes are preserved.

CY67 integrates all 46 approved completion/social sources across nineteen locations and forty-six
visual slots, with separate Fuel/Provisions props in cargo and offered local surplus. Seventy-four
reviewed scene backdrops change without altering character layers. Conditional module/custody/shared
locations retain their actual gates. The nine reusable cutouts have a separate Platform-family
extension request; their campaign-local publication is complete. CY53 retains owner review and
the recorded staging adaptations; unsupported role/alliance proposals are
not imported. The current optional room contexts omit an authoring placeholder narration, and three
project reports keep their established campaign place/trigger while using the latest dialogue.

Tests cover paid/insufficient/exact resources, reserves, recipe ownership versus fitting, boarding,
nightly and remote completion, old packs, migration, absent officers and independent acknowledgements.
The private replay covers an actual service, funded facility, export, fitting, boarding and paid drive
refit. Chrome at 844 × 390 with 47 px side and 21 px bottom safe areas covers transfers, construction,
shortage recovery, reload and old/new content switching. Physical installed-iPhone checks remain CY37.
