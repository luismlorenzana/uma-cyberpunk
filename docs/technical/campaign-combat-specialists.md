# Campaign combat specialists

Rules version 5 and save version 20 add two ground formations. Play **Laser specialist practice**
from the campaign Training Hangar. The Sandbox also includes **Specialist Practice** and
**Combined Strike**, with issued rigs and stand-in cast. Older campaign encounters retain their
authored kits. Their frozen battles replay on the version they started with.

## Early formation

Each participating officer starts at Laser rank 1. The deploy screen saves an optional subclass.
A first clear advances each deployed Laser specialist one rank, up to rank 5 before the shift.
Each subclass is part of the early kit through rank 5.

| Subclass | Early fitting |
| --- | --- |
| Melee | Optional two-handed blade with 12 Pierce and 83% base accuracy |
| Heal | Restore up to 6 Core to self or an adjacent ally before moving, for 1 Charge and once per battle |
| Shield | Half-strength Bulwark barrier. Optional one-hand blade and Buckler |
| Long | Back-mounted Pierce weapon, range 4–6, 13 power and two rounds |
| Support | Jam and terminal access |

## Laser modes

| Unlock rank | Mode | Range | Effect |
| --- | --- | --- | --- |
| 1 | Focused | 1–3 | Three Pierce pulses, 6 power each at rank 1, 7 by rank 5, and 8 at rank 8 |
| 2 | Thermal | 1–3 | Two Fire pulses, 6 early or 7 after the shift. Hits can ignite an enemy tile or barrel |
| 3 | Impact | 1–3 | Two Impact pulses, 6 early or 7 after the shift. A hit drains one Charge from the actual recipient |
| 5 | Area | 2–3 | One Pierce pulse, 12 early or 14 after the shift. Half strike damage to orthogonally adjacent enemies |

Alternates cost 1 Charge. Only committed alt fire plays its extra effect. Normal counters and
Crossfire use fitted weapons. The forecast shows the charge spend and any splash recipients.
Thermal and Impact can use Aim. Area uses the target as the center of its splash.

## Combined formation

At the authored story flag, Laser specialists enter at rank 6 or their higher attained rank,
and their active subclass is removed. Further unique clears advance them to rank 10. The
formation has two Laser specialists, two winged Boss Allies, two blade-and-shield fighters,
two Snipers and two Medics. The normal board supports all ten, with cut-ins off and automatic
facing initially enabled. Auto turn is available for individual units. Inspect a unit or
switch automatic facing off to review positioning.

Wings use Thruster movement and the two-handed blade and impact fittings. The Sniper uses
a 4–7 tile Back launcher. Suppress spends two Charge and a round when fired, and on a hit blocks
Counter, Crossfire and Cover for the recipient and nearby enemies until their next own
activation. It interrupts a prepared shot in that area. A tagged enemy can once spend a turn
preparing an attack, revealing its target. The next shot from that mount at that target does
50% more base power while the preparation remains active. The Medic carries a repair pack and
a two-shot compact pistol. Shields use the usual Guard and Cover windows.

## Story and art binding

The optional top-level `combatShift` on `campaign.json` names the authored story flag.
Add `"combat": { "kind": "uma" }` to an early ground entry. The combined entry uses
`"combat": { "kind": "combined", "members": [...], "windups": [...] }`. A combined mission
binds to a version 5 scenario with ten squad spawns, two templates for each role and a leader
objective. The packer checks the scenario and enemy ids. The included Combined Strike
scenario is a reusable stand-in layout. A release with a different identity or objective
can author its own scenario.

Each member specifies a role (`laser`, `wing`, `shield`, `sniper` or `medic`) and
exactly one cast identity. Use `outfit` with a numeric crew outfit, or `heroine` with
a board id and a `requires` story flag granting deployment. Laser uses crew outfits and
Wing uses heroine identities. There must be two distinct members per role. The quest
checks the shift flag, each member's prerequisites and the readiness of crew members.
The same transaction freezes the roles, identities, ranks, rigs and issued statistics.

Sprite work uses the exact issued rig and the committed mount and pulse count. Focused,
Thermal, Impact and Area can share the two-grip Laser pose. Suppress uses the Back firing
pose, with a separate effect for the impacted area and any canceled windup. Emergency patch
uses the existing repair result with a distinct Charge source. Approved enemy and ally art
can replace the board's fallback without changing the mechanics.

## Verification

Play both Sandbox exercises and run `pnpm sim specialist-practice --seeds 200` and
`pnpm sim combined-strike --seeds 200`. The version 5 tests cover forecast, whole-turn
selection, interruption, save migration, settlement and replay. Time the combined leader
fight on the installed iPhone and record taps, activations and elapsed time in CY37.
