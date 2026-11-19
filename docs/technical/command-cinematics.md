# Campaign ship cinematics (CY54)

A cinematic presents an already committed ship order. The numeric command reducer and its v1/v2/v3
win conditions are unchanged. This lives in the real combined campaign, including both occupied
entries, local defenses, fleet contributions, the works ferry and the hired tender.

## Commit, playback and resume

Launch pays the existing cost once and freezes numeric input plus optional `presentation` metadata:

```json
{
  "crew": { "gunnery": { "speaker": 9000001, "name": "Officer" } },
  "present": [{ "speaker": 9000001, "name": "Officer" }],
  "objective": "Relief transport",
  "commander": { "speaker": "patrol-commander", "name": "Patrol commander" }
}
```

Crew identities are derived from actual eligible assignments at launch; ashore and away members are
excluded. Actor labels and the protected objective travel with the input. The enemy is an explicit
encounter binding, never inferred from an officer's future boss or a character being in the roster.
The existing input parser accepts this metadata additively and rejects duplicate station holders.
Older inputs without identities retain their original rules and use **Watch officer**; the app never
guesses who acted from a later assignment.

Each valid **Execute order** appends the command and commits its result before playback. Save v19 adds:

```json
{ "commandCinema": { "fast": false, "retries": 0,
  "pending": { "encounter": "escort", "turn": 1, "beat": 0 } } }
```

Beats 0–3 are Captain order, station acknowledgement, confirmed action and result. The cursor must
reference the latest committed action of the pending ship mission. Advancement uses expected
encounter/turn/beat checks, so repeated callbacks do nothing. Reload restores the saved beat.
Advancing, skipping, checking content and replaying never add actions, spend cargo or settle a day.

**Skip to result** moves to beat 3. **Fast orders** starts future orders there and can shorten an active
sequence. The result remains until **Continue**. The same factual log records actor, action, target,
allocation, shielding, interception, damage, remaining objective integrity, next power and outcome.
The overlay preserves the underlying allocation and keeps resolved integrity counts visible.
Result replay is read-only. Retry clears the cursor/actions, increments the retry counter and keeps
the exact original input and paid launch. Leaving/settling a mission clears the cursor.

## Private presentation contract

Optional `campaign.json.commandCinematics` contains `stations`, `actors`, `encounters` and optional
`effects`. Packs without it still show factual cinematics and readable results. Missing image
downloads leave text and controls usable. No roster-wide picture preload is needed.

| Binding | Fields and behavior |
|---|---|
| Station | `station`: pilot/shields/gunnery/engineering; `backdrop`: declared asset ID |
| Actor | `speaker`, `role`: crew/enemy/ally, `base`, stable `poseSlot`; optional `profile`, `pose`, `poseFallback`, `composition`, `orders`, `states` |
| Voice | `orders` has all six command keys, each with `captain`, `acknowledgement`, `result` text; optional states are victory/loss/disabled/damage/noDamage |
| Encounter | `encounter`, `objective`; optional exact `commander`, context scene IDs and enemy-channel lines |
| Context | Optional `preparation`, `victory`, `withdrawal`, `retry`, `disabled` refer to read-only scenes |
| Enemy channel | `contact`, `disabled`, `withdrawal`; requires that encounter's exact enemy-role actor |
| Effect | `kind`, stable authoring `slot`, optional shared `composition`; at most two image layers per effect |

Actors can declare the existing CY48 `composition`: native width/height, explicit show/hide portrait
policy and up to twelve positioned layers. This supports full CG or a pose over a reusable station.
The portrait stays a separate overlay. Expressions use the existing face-crop renderer against their
exact neutral base, with neutral fallback. Face crops are never projected onto a different pose.
Mechanical dialogue/profile derivation also updates cinematic bases/profiles and keeps the unmodified
master as `poseFallback`, translating face placements through the same crop pipeline.

The current fixture uses the same 1844 × 853 composition convention, a neutral master layer at
x1040/y50 with size 660 × 803, and separate profile/text/controls. These are declared neutral standing
placeholders. CY55 supplies final operating poses, station variants and reviewed bounds.

Context scripts allow ordinary dialogue, expressions, illustrations, waits, slots and narrative
choices. They cannot grant flags, roster, rewards, rapport or battles, including inside branches.
Optional contexts require the real phase and frozen participants. An absent speaker is not summoned
to the bridge. Ashore fleet support remains frozen contribution text. Boss-ally art/voices alone do
not add lawful guest recruitment or a playable station record.

Enemy calls require the frozen commander identity to match the current binding. Removing/replacing a
binding cannot attribute an old action to a new person. Enemy hull zero is described as withdrawal,
not destruction. Winning the ship operation never implies capture, release, boarding success or arrival.

## Effects and truth conditions

The renderer derives effect keys from `ResolvedCommand`; authoring cannot choose their predicates.

| Key | Required resolved fact |
|---|---|
| `shields` | Actual blocking; the approved absorption arc cannot claim protection from allocation alone |
| `guns` | A fire order with allocated guns contributes confirmed ship or emitter damage |
| `fighter-strike` | A strike order actually damages its selected target |
| `intercept` | An intercept order actually intercepts at least one incoming fighter |
| `hit` | Confirmed opposing-ship damage |
| `emitter-hit` | Partial emitter damage with the emitter still live |
| `emitter-disabled` | Transition from positive emitter integrity to zero |
| `friendly-damage` | Confirmed hull or protected-objective damage |
| `power` | A reroute order confirms an increase in next-order reactor power |

The fixture has nine named FX slots. Five approved general-art sources supply absorption, gunfire,
target contact, fighter interception and power rerouting. A contact spark also supports actual emitter
and friendly-damage keys; a fighter strike retains its factual code-native mark. The newly approved
neutral command station and two later protected craft are integrated from the scoped CY52/CY55 handoff.
Approved exports provide positioned image layers under these keys; missing exports retain the factual fallback.
Layers load only for active effects and are released on event/release changes. General FX art and
actor art never change the committed result.

Partial emitter damage cannot announce disablement. Disablement alone does not secure an approach.
The alternate-entry report requires actual approach victory and a disabled emitter; the existing
debrief then records its route flag. Ordinary victory preserves the ordinary entry. Protected-craft
integrity is independent of enemy damage and remains visible after skip or reload.

## Integrated authoring and verification

The private fixture covers all 56 command encounters with 50 playable officer voice sets from the
scoped Story draft at editorial revision 3, 102 exact-identity art bindings and nine FX slots. Existing approved pilot
and station sources are reused. Fifty boss slots and the two opening hostile communications retain
their own identities; the opening lieutenants are not replaced by later campaign bosses.

The original encounter quests, scenes, numeric data and subsequent boarding gates are preserved.
Read-only prep/result/retry drafts use their actual campaign world/place. Non-emitter escorts omit
unsupported emitter contexts/references. Two short hostile-channel baselines are explicitly returned
to CY56 because its boss station voices describe allied service. Other unlocked enemy communications
use factual fallback rather than an invented commander. Final poses, reviewed station variants and
Story integration acceptance remain CY55/CY56; source and game-release approval are distinct.

Unit and private campaign checks cover frozen identities, stale callbacks, cursor migration, old
inputs, partial/disabled emitter results, exact allocations, absent officers, fast/skip, loss/free
retry and both boarding entries. Actual later works-ferry and hired-tender encounters retain their
protected-objective names. Browser checks use 844 × 390 with 47 px side and 21 px bottom safe areas:
normal automatic playback, skip, fast results, reload, missing bindings/images, content swap, enemy
communication, partial emitter damage and confirmed disablement before victory.

The browser fixture records image/Blob URL counts, heap and frame intervals across consecutive orders.
This is a local headless Chrome observation, not an installed-iPhone performance claim. Physical touch,
animation, thermal/memory and interrupted-content observations remain CY37.
