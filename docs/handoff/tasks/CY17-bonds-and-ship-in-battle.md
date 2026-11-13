# CY17 — Bonds and the ship in battle (rules version 3)

**uma-cyberpunk · Claude · L · Needs: CY13, CY15, CY16 · Unblocks: CY18, CY19**

## Why

The owner asked that "better relationships can give better combat abilities", with "the power of friendship" and "the
power of love" (D20), and for the ship to matter in play. This packet makes the battle feel all of it: the bond perks,
Resonance, partners and their duo technique, the captain's Orders, the ship's powered systems and the cook's meal, as
**rules version 3**, with version 2 frozen, the simulator's balance pass and the golden replays.

## Context (read first)

- [Life aboard](../../design/life-aboard.md) §3.3 (TC58: perks, Resonance, partners), §3.4 (TC59: Orders), §5.3
  (TC64: ship support, duty boosts, readiness), §6.1 (meals).
- [The research](../../design/research-life-aboard.md): Persona's Follow Up and Endure, XCOM 2's bonds, Chrono
  Trigger's techs, Valkyria Chronicles 4's Ship Orders.
- What exists: `@cyber/battle` at rules version 2 (`packages/battle/src/`: `version.ts`, `types.ts`, `battle.ts`,
  `attack.ts`, `harm.ts` with Hold on, `support.ts` with the bench call, `ai.ts`, `forecast.ts`, the golden replays and
  `docs.test.ts`); the simulator (`scripts/sim/`); the battle screen (`apps/web/src/battle/`); battle inputs built by
  `fillSquad` and `missionInput` (`apps/web/src/mission/battleInput.ts`); after CY13–CY16: bonds, the powered systems,
  meals and camaraderie on the save.
- **BP4:** a battle is its frozen input plus its actions. Everything below enters the input; the rules never read the
  save.

## Decisions made

- **Rules version 3** (`RULES_VERSION = 3`, `SUPPORTED_VERSIONS` keeps 1 and 2 frozen; a v2 battle replays as before, a
  test). New optional input fields, each ignored below version 3:
  - on a unit: `bond: { rank, path }` (from the save; the rules read only the rank's perks) and `partner: { unit, level }`;
  - on the input: `orders: { slots, kinds }` (how many Orders this battle and which), `systems` (the powered battle
    systems with their levels and the post holder's band), `meal` (one of six).
- **Bond perks** (TC58), each in `TUNING`: rank 3 **Ready** +1 Charge at the start; rank 5 **Answer** +1 Charge when an
  adjacent ally suffers a Rig Break; rank 7 **Sure** chance skills +5%; rank 8 **Endure** once a battle a Core break
  leaves 1 (stacks with Guts' Hold on as a second use, not twice the same hit); rank 9 **Steadfast** one free Cover.
- **Orders** (TC59) are a new action, `{ kind: 'order', order, target? }`, taken on a squad unit's turn without using its
  action, from the battle's slots (2 at Bridge level 1, 3 at 2, 4 at 3):
  - **Sure shot:** the unit's next attack this turn can't miss.
  - **Hold the line** (Bridge 2): an enemy's clock frozen one turn.
  - **Reboot** (Med Bay 2): a broken rig rebooted anywhere at 25% Core.
  - **Call her name** (a rank-10 Uma, once a battle, one Uma only): **Resonance**: she acts next with full Charge, and
    her attack that turn draws a Crossfire from every Linked ally in reach. A cue for the cut-in (Resolve or Devotion by
    her path; same numbers).
  - **Ship support**, one per powered system: **orbital strike** (Battery; a 3 × 3 area marked this round, landing at
    the start of the next; damage by level and the gunner's band), **sweep** (Sensors; the next enemy turns and hidden
    units shown), **barrier** (Shield Projector; a one-round barrier on an area), **drone** (Drone Bay; a shield drone
    covers a unit for a turn, or mends a part), **reinforcement** (Hangar 3; a resting Uma drops in on a free squad
    spawn).
- **Passives from powered systems:** the Engines give the squad the first move in round 1; the Shield Projector a
  starting barrier on the squad's spawns; the Sensors show the enemy roster and first moves on the deploy screen
  (computed from the input, not a rule).
- **Meals:** six small one-battle effects (+5% hit, +1 Move on turn 1, +2 Core HP, and so on), one a battle.
- **Partners** (TC58): camaraderie from battles fought together (+10, +20 after a cover or a reboot between them) and
  from posts (CY16); at 100 the pair can be made partners (one each); level 2 at 250, level 3 at 500 and the Tactics
  research from CY15. Level 1: a free Crossfire join once a battle; level 2: a free Cover each once a battle; level 3:
  the **duo technique**, a new action both partners spend their turns on (the second partner's next turn is used up),
  its effect by their two roles from a table of fifteen pairs.
- **The AI and the forecast:** enemy AI unchanged; ally Auto learns Orders it may take (Sure shot on a likely miss, Reboot
  on a broken ally) and never spends Resonance; the forecast shows Sure shot, the strike's marked area and a partner's
  free join.
- **Balance:** the simulator gains a "life aboard" squad profile (bond ranks 3, 7 and 10, partners at level 2, three
  systems) beside the bare one; the targets: a bare squad wins about as before, a fully bonded squad about one battle in
  five more often, never every battle. Golden replays for each new action.
- **The battle screen:** an **Orders** button in the command arc with the remaining slots; the strike's mark on the
  board; Resonance's cut-in in her colour with her path's line; the deploy screen lists the bond perks, partners, meal
  and powered systems that apply.
- **Save v9:** `partners: [{ a, b, level }]` (camaraderie is CY16's). v8 migrates on the device with none.

## Do

1. `@cyber/battle`: rules version 3 with every rule above, `TUNING` additions, the cues, the forecast; tests per rule;
   golden replays; `docs.test.ts`'s live tables extended; version 2 frozen (a test replays a v2 battle unchanged).
2. The simulator: the life-aboard profile, the balance pass, the report's new columns.
3. `@cyber/domain` and the director: partners and their levels; the battle input built with bonds, partners, Orders,
   systems and the meal; save v9 and its migration; camaraderie from battles.
4. The screens: Orders, the strike's mark, Resonance's cut-in, partners on the profile and the deploy screen.
5. Update `docs/game/battle.md` (rules version 3: Orders, perks, partners, systems, meals) and `captain-and-bonds.md`;
   write the balance pass into battle.md's balance section.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; `pnpm sim` meets the targets above and the report is in `sim/out/`.
- A v2 battle replays unchanged under the v3 package; golden replays pass for each new action.
- Locally, in a mission: Ready's Charge shows at the start; Sure shot hits; the orbital strike marks then lands; Call her
  name plays Resonance with Lead A's path line; partners join for free; the meal applies; a reload mid-battle replays to
  the same state.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(battle): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
