# Ground combat mechanic-to-visual matrix

Use this contract for campaign Training, boarding and ground missions on battle rules versions 1–4.
The [39-part equipment matrix](../handoff/combat-sprite-coverage.json) specifies which shapes are needed.
This matrix specifies when those shapes move or change. A single pose or effect can cover several rows.
[Battle rules](../game/battle.md), [terrain](../game/terrain.md), and the reducer's [cue types](../../packages/battle/src/types.ts) are the gameplay references.
The campaign player currently renders outfit figures or standees, walk and facing, generic attack
cut-ins and numbers, down/removal states and board updates. The local album supplies the fitted
preview. Cue-driven compact bundle playback is a CY57 deliverable.

## What the renderer reads

- Resolve the frozen nine-slot rig and registered four-facing body at battle entry. Read live HP and
  status separately. Commit each visual change at its cue and reconcile with the final state. Start
  from the current snapshot on load, restart or skip, including the down pose and missing operable grips.
- Aim the firing silhouette using the unit and target tiles at that point in the action. `attack.facing`
  describes the angle of the hit on the **defender**. `faced` gives the unit's committed compass direction
  at the end of its turn. Temporary aim, Cover and reaction poses must settle back to the correct state.
- `with` selects the equipped mount. A two-handed weapon stays on the right equipment mount when
  fired with only the surviving left arm. Read anatomical arm HP to choose the grip. Left and right
  are anatomy, even when flipped on screen by facing. Never substitute a two-grip pose in that state.
- Read the ordered cues for resolved timing and outcomes. A firing clip can expose reusable pulse,
  contact and recovery points. Rifle bursts, reduced Crossfire, Double, Switch and early termination
  use the resolved sequence. Splash hits on neighbours consume no extra pulses. A landed shield soak,
  deflection, miss and damage to a body part have separate meanings. Use resulting part HP for the doll.
- Use the cue context to choose the source of shared outcomes. `charge.why`, `order`, `bench` and
  `item` distinguish fitted gear from ship/bench support and consumables. `guard` identifies the
  defender and cut percentage. Choose the strongest whole shield arm and use a stable tie-break for
  equivalent shields. `cover` redirects the attack to the adjacent ally without moving their tile.
- Use one planted foot registration across facings and feet on the actual board height. Keep the
  readable common stances and modular overlays at 100 CSS px. Effects and status labels must work
  at iPhone scale with cut-ins off, enemy fast playback and reduced motion. Missing pose art falls
  back to the existing figure or standee plus the listed signal. Ship combat cinematics and splash art
  have their own contracts.

## Resolved cues

Visual treatments below are integration requirements. Fallbacks are the minimum presentation if a
dedicated pose or effect is unavailable. Some are already on the battle screen and others need CY57 wiring.

| Cue | Subject and visual treatment | Fallback |
| --- | --- | --- |
| `turnStarted` | Unit ring and timeline focus. Expire its turn-scoped statuses from state. | Active chip and ring |
| `charge` | Update the unit's Charge pips. `why` can identify the associated action or perk. | Current Charge count |
| `moved` | Walk/settle along the exact tile path with corner facings and height changes. Preserve HP/fitting-aware posture. | Move existing figure to each tile or final tile |
| `faced` | Set the four-way facing after the action, keeping the same foot. | Snap facing/arrow |
| `waited` | Settle into idle and show Charge/clock changes. Surge applies later where eligible. | Wait label and timeline |
| `linked` | Toggle link badge/inspection state. | Link on/off label |
| `attack` | Use exact hand or Back mount, legal grip and weapon family. Address actor or board target and play main/counter/Crossfire in cue order. | Target cue and existing cut-in when enabled |
| `cover` | Defender's ally braces with its equipped shield and receives the strike. Its short lean/step stays on its tile. | Mark protected unit and actual recipient |
| `crossfire` | Indicate pincer or link helper and reuse the attack clip on the helper's resolved mount. | Crossfire label |
| `counter` | Indicate defender's reaction and play the ensuing attack at the emitted point, including First. | Counter label |
| `guard` | Defender raises or braces the live hand shield for the exchange. A miss can follow a guard cue. | Shield icon and Guard percentage |
| `hit` | On the recipient's part, play contact and a short reaction. Show Critical and break cues distinctly. | Damage number, Critical mark and part doll |
| `miss` | Let the shot or swing go through without contact, HP change or a damage flinch. | Miss label |
| `partBroke` | Update the named part, disabled grip/guard or broken-Legs carry. Core routes to Rig Break. | Broken marker on named part |
| `holdOn` | Standing unit catches itself at 1 Core and keeps its current damage. | Hold on label and Core HP |
| `rigBreak` | Collapse in place and stay kneeling at the existing tile/facing. Remove active action affordances. | Existing downed figure treatment |
| `extracted` | Remove the downed actor upon expiry of its recovery window. | Remove figure and timeline chip |
| `objective` | Update actual objective count or destination marker. | Progress count/label |
| `ended` | Freeze final actors and show outcome/reason and the result flow. | Existing result panel |
| `terrain` | Apply or clear affected tile overlays for Wet, Oil, Fire or Smoke. Derive Live from the board. | Tile colors/icons and terrain inspection |
| `burn` | React on the damaged part. Use tile Fire, Live, Volley, Strike or Mortar source art as appropriate. | Part doll and hazard damage number |
| `burst` | Remove spent barrel/pipe, then show the terrain change. | Remove prop and update tile state |
| `hacked` | Deck signal to the named terminal with a success marker; reflect its effect on the board. | Terminal used indicator |
| `door` | Change open/blocked tile geometry and door state. | Snap geometry and tile legality |
| `heights` | Raise/lower lift tiles and align standing figures to surface. | Snap height and redraw occupancy |
| `turned` | Keep turret asset and switch its allegiance, ring and timeline color. | Side color and label |
| `lights` | Apply/clear darkness treatment with readable units and idle turret indication. | Dim scene or show Lights out indicator |
| `tech` | Deck pulse for Stun, Jam or Jack-Out. Resolve effect only when `landed` and follow downstream cues. | Named Tech result on target |
| `stunned` | Mark temporary disabled status. Source can be impact, skill, Deck, duo or Order. | Stun badge |
| `skipped` | Timeline skips a Stun, idle turret or duo-spent turn. Clear temporary marks per state. | Skip reason on timeline |
| `holdHit` | Place effect at Anchor/Collar and show Hold HP independently of the four rig parts. | Hold damage label and meter |
| `freed` | End the Hold or Jack-Out presentation and remove the freed unit. | Freed label and figure/timeline removal |
| `barrier` | Spawn the world barrier at `at`; play Back deployment only for actual Bulwark use. | Board barrier and tile outline |
| `barrierHit` | Impact on the barrier prop and remove it at break. | Barrier HP and prop removal |
| `dash` | Ignite at the Thruster's Back socket before movement and trail along the emitted path. | Dash label with ordinary path motion |
| `mended` | Show repair at target part. Restore its operational layer if HP crosses zero. Med emitter only for Med-origin action. | Part HP increase and cleared break badge |
| `rebooted` | Target rises from kneel into its post-Reboot grip/carry and part state. Med and Order have different sources. | Switch target to active figure and update Core HP |
| `item` | Use shared item signal for Repair, Patch, Smoke or Cell, including when both arms are broken. | Item label plus follow-up HP, terrain or Charge change |
| `skill` | Named activation uses the existing grip and attack family. The cue chain determines what plays next. | Skill label |
| `bench` | Show remote support from the named role at the tile. Follow barrier, damage, scan or repair cues. | Role label and result |
| `scan` | Reveal enemy kit and next turn info for this support call. | Inspection and timeline information |
| `reload` | Mark Steel Muster ranged reaction lockout until its next turn. Optional shared reload beat. | Reload badge |
| `pinned` | Mark arm-hit accuracy debuff until the next own turn. | Pinned badge and forecast |
| `volleySignal` | Mark exact threatened tiles and deadline. | Warning tiles and countdown |
| `volley` | Play area impacts at marked tiles; apply actor reactions only from downstream damage cues. No individual shooter cue. | Flash tiles, clear marks and show actual damage |
| `order` | Show named ship Order with its target/tile and uses left. Follow specific outcome cue or state. | Order banner and uses left |
| `resonance` | Resolve/Devotion banner by bond path, or neutral path, with next-turn and Charge changes. | Banner and timeline |
| `strikeMarked` | Mark ship strike area and deadline separately from Muster Volley. Actual damage is `burn` by Strike. | Warning tiles and countdown |
| `endure` | Standing unit catches itself at 1 Core on the separate bond survival trigger. | Endure label and Core HP |
| `freeJoin` | Indicate partner/Resonance Crossfire with no Charge cost and reuse the resolved attack. | Reason in Crossfire label |
| `freeCover` | Indicate Steadfast, partner or cohesion Cover with no Charge cost and reuse the shield brace. | Reason in Cover label |
| `duo` | Identify both partners and technique, reuse their actual attack mounts and show the emitted effects. | Technique banner, normal attacks and partner turn skip |
| `sweep` | Show the enemy's next moves from ship Sensors support. | Existing intent/forecast overlay |
| `drone` | Ship repair effect at target part or shared drone prop. Read target HP after repair. | Drone label and part HP gain |
| `shielded` | Shield Projector energy absorption around the recipient. Fade at zero remaining capacity. | Soak amount and Shield Projector meter |

## Shared cues and persistent states

| Mechanic or state | Assignment and acceptance |
| --- | --- |
| Initial rig, armor slots and coat | Character art owns silhouette and exact fitted part layers, including coat treatment. The four HP parts remain independently inspectable. Coat, visor and stats can change forecasts without bespoke poses. Support empty hands, empty Back and mixed left/right equipment. |
| Regular movement and height | Common idle, walk and settle in each cardinal direction. Traverse flat, corner, uphill and downhill paths with stable foot registration. Light Load, Break, Draft, Surge, Kick and Thruster passive change available movement UI. Reuse the walk unless Dash or damaged Legs applies. |
| Legs broken | Persistent limited walk and standing support. Preserve the rig and arm damage. Use a damaged-Legs loop or a reduced-motion stepped figure plus part marker. The engine limits the route and removes evasion. |
| Hand attack families | One-hand melee and ranged use the correct left or right mount/contact. Two-hand melee and rifle have intact two-grip and both surviving-arm variants. No hand weapon fires from a disabled single-handed mount. Both arms disabled blocks ordinary weapon attacks, including Back. Use visible empty/disabled carry plus UI for legal support. |
| Aim, multiple hits, blast and damage type | Aim at four rig parts or the Hold uses the same compatible grip with the right target marker. Render each actual shot result. P/I/F use shared impact effects, with downstream Stun or Fire from the engine. Version 4 blast uses one detonation and secondary impacts on actual adjacent targets. Fixed hardware and map props have their own target anchors. |
| Shield and Cover | Idle shield is fitted equipment, Guard is the defender's reaction to front/side attacks with a whole shield arm, and Cover redirects to a different unit. Rear, disabled shield arm and a piercing duo with zero Guard suppress Guard. Projector shield gives HP soak, while a Barrier is a prop. End the raised shield at its reaction boundary. |
| Back launcher | Select actual weapon and clip family under `with: back`. Some fitted Back weapons are close Melee or Short, as well as Long. Use the Back tip/muzzle and give the attack silhouette clearance from the carrying weapon/gloves. Dry ammo suppresses firing. Preserve the idle housing when spent. |
| Bulwark / Thruster | Bulwark deploys the barrier into a legal adjacent tile via its Back socket. Dash fires the Thruster before the exact move path. Its passive climbing reuses walk. Supply stowed and active Back layers for the shared body. |
| Deck | Reuse housing activation for Stun, Jam and Jack-Out and terminal hacking, with effect variants. Jam is a Charge change, with no lasting Jam stance. Door, lift, turret and lights results belong to board/FX. |
| Med | Use one pose/emitter family for Mend and Reboot where readable. Mend can target self or adjacent standing ally, and can restore a broken limb. Adjacent Reboot restores Core and standing status on the target while retaining its arm and Legs damage. Ship Reboot uses the same target recovery without a Med emitter on the caller. |
| Act none / illegal action / prediction | Facing and Done can finish a turn with no action. Range, height, line of fire, zone of control, cover tiles, ammo, grip eligibility, Charge, Tech/skill probabilities and projected outcomes are UI. Preview/Undo may walk a ghost or provisional figure. Use committed cues for impact, support and permanent damage. |
| Skills, bonds and duo | Burst can add pulses, Double repeats the attack, Switch changes hands, First reorders the counter, and Stun uses its status. Ready/Answer/Sure and meal/system bonuses alter numbers or timeline with no new pose. Endure is a survival beat. Duo's Power, Pierce, Stun, Mend and Charge effects reuse the two legal attacks, support effects and UI. |
| Consumables and off-board support | Repair, Patch, Smoke and Cell use shared effects. Vanguard bench drops a barrier, Striker a single-tile strike, Gunner an area mortar, Netrunner a scan and Medic an area repair. Reinforce reuses the bench visuals. Show only the resulting `mended`/`burn` etc. on affected units. |
| Ship Orders and systems | Sure shot marks one guaranteed attack, Hold the line stuns, Reboot stands the target up, Resonance advances the empowered unit, Orbital strike marks tiles, Sweep reveals intent, Barrier places a prop, Drone repairs, and Reinforce calls remote support. Powered engines change the timeline and Sensors reveal roster info. Starting Projector shields come from snapshot state. Orders initiation uses shared UI. |
| Down, out, freed and standing | Rig Break is a transition into persistent down on the same occupied tile. Restore current facing, damage and loadout on Reboot. Extracted and Freed are distinct removals. Fixed turrets/hardware can use a disabled silhouette instead of an anatomical kneel. Hold on and Endure stay active. |
| World, previews and objectives | Floors, cover, solid walls, height, Wet/Oil/Fire/Smoke, Live grating, props, darkness, and hazard telegraphs use board layers and inspection. Finale readiness conditions expose fog and hazards in board state and unavailable reinforcements in the HUD. Defeat All, Defeat Leader, Reach, Hold, Escort, Hack and Free Leader are objective UI and target/tile marks. Use the normal campaign battle summary for salvage/freed/broken/standing, and keep legality and battle outcomes independent of art availability. |

## First bundle acceptance

Run the four cases in the character's actual legal fittings at 100 CSS px in all four facings. Record
the source version, fitting IDs, cue trace, anchors and a board-size capture. Use Training and campaign
boarding for in-game acceptance. Keep the cue/pose contract and local review ahead of Platform publishing.

| Case | Required proof |
| --- | --- |
| One-arm rifle | Intact → left broken/right grip, right broken/left grip, both broken/no attack. Show disabled-arm carry and the muzzle/aim through fire and recovery, then normal grips only after applicable limb repair. |
| Shield guard | Legal one-handed weapon plus shield in the other hand. Show stowed carry, front/side Guard and return to carry. Include rear and shield-arm-broken negatives, plus the separate Cover redirect. A two-handed rifle and hand shield cannot share this fitting. |
| Back activation | Bulwark stowed → deployed at a marked adjacent tile, and Med stowed → Mend/Reboot emitter. Compare against ship or bench barrier and other repair sources with no Back activation. Later cover actual launcher, Thruster and Deck variants under the same matrix. |
| Rig Break → Reboot | Damage → Core break → down hold on the same tile → ally Med Reboot → standing in the same fitting with broken limbs still disabled. Check Order Reboot shares the recipient rise, and expiry extracts a unit that never reboots. Check resume while down and reduced motion. |

Bundle v1 can store additional named clips and sockets for album review. `when` currently filters
on fitted part identity only. Keep damage/art state and emitter source explicit in the handoff. CY57
must wire their runtime selection, including victim-versus-actor assignment and after-state fallback,
before a draft with those clips is considered campaign-ready.
