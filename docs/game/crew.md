# The crew

> **Status: 2026-11-12, CY11 (D15).** Who is aboard and what each Uma is in a fight: her bands from master data's 5★
> stats (TC4), her role (TC5), her Stride (TC46), her level, and Strain (TC27). Her rig is on [hangar.md](hangar.md).
> Shown in the **Quarters**: a deck of cabin doors, her cabin with her profile, and who rests next mission (CY14: [cabins.md](cabins.md)).

## The short answer

- **The crew is the save's:** each Uma aboard has a record (her outfit id, XP, role, rig, three saved loadouts, Strain),
  in join order. The story brings her aboard (`join`, `aboard`).
- **Her numbers come from master data** at run time, through one adapter: her 5★ stats become five bands, her best
  running style her Stride and, untagged, her role. An Uma master data doesn't hold shows as a **stand-in card**, at band
  3 everywhere with no Stride; nothing breaks.
- **Her role** is the story's authored tag, else her running style's job; she changes it aboard.
- **Strain:** a mission adds 1 to everyone who fought; at 3 she sits the next one out.

```mermaid
flowchart LR
  md[Master data: 5★ stats, running-style grades] --> bands[Five bands, TC4]
  md --> style[Her best running style]
  style --> stride[Stride, TC46]
  tag[The story's role tag] --> role[Her role, TC5]
  style -.->|untagged| role
  aboard[Set aboard] -->|overrides| role
  role --> rig[Best for her role, or her own rig]
  bands --> rig
```

## The bands (TC4)

Every outfit's 5★ stats sum to 550, so only the spread differs. Each stat becomes a band from 1 to 5 (70–89, 90–109,
110–129, 130–149, 150 and up; below 70 is still band 1), and each band does one job in combat and one on the rig. The
numbers are the battle package's ([battle.md's tuning table](battle.md#the-tuning-table)):

| Stat | In combat | On the rig |
|---|---|---|
| **Speed** | How fast her clock fills; Move 3–5 | Evasion +2% a band |
| **Stamina** | — | Part HP: the Core, each arm and the Legs grow with each band |
| **Power** | Melee damage +2 a band | Capacity 10 + 2 a band, before the Core's and the Back unit's bonus |
| **Guts** | Hacks on her lose 10% a band; at band 4+, **Hold on** once a battle | — |
| **Wit** | Accuracy +3% a band; chance skills and her hacks +5% a band | Visor slots 2 + band (skills come with parts, Phase 5) |

Her profile shows each band as a bar with her own numbers beside it.

## Her role (TC5)

| Role | Plays like | Back unit | Default from running style |
|---|---|---|---|
| **Vanguard** | Holds the line, shields, Cover | Bulwark | Pace Chaser |
| **Striker** | Fast melee, flanks, starts Crossfire | Thruster | Front Runner |
| **Gunner** | Long range, height, Aim | Launcher | Late Surger |
| **Netrunner** | Hacks heroines, hardware and terminals | Deck | End Closer |
| **Medic** | Mends and reboots | Med unit | Only by tag, or chosen aboard |

**Which applies:** a role set aboard, else the story's tag (`casting.json`'s `roles`, by outfit id), else her best
running style's (ties to the earlier style: Front, Pace, Late, End), else Striker. Her profile says which.

**A change aboard:** tap a role in her profile. Her rig keeps every part but the Back unit, which becomes the new role's
starter unless she already wears one of its kind; a rig still on "best for her role" simply follows the new role.

## Stride (TC46)

| Stride | From | Effect |
|---|---|---|
| **Break** | Front Runner | +1 Move on her first turn |
| **Draft** | Pace Chaser | +1 Move when she ends next to an ally |
| **Surge** | Late Surger | +1 Move on the turn after she Waits |
| **Kick** | End Closer | +2 Move while her Core is at half or less |

## Level and XP

A mission pays XP as a plain number ([missions.md](missions.md#the-steps)): the squad takes it in full, the crew aboard
half, and a loss keeps its XP (TC25). **A newcomer joins at the squad's level** (CY12): the crew's average XP, or the XP
of the battle she just fought, whichever is higher, so a lead never comes aboard at level 1 after her Chapter 1's fight
([the loop](story.md#the-chapter-1-loop-cy12)). Her level is 1 plus one for each 100 XP, up to 50: a placeholder curve until Phase
5's economy, and levels change no numbers yet.

## Strain (TC27)

| When | Strain |
|---|---|
| She fights a mission (won or lost) | +1, to 3 at most |
| She's at 3 | She sits the next mission out: the deploy screen won't take her, and the Quarters list her as resting |
| She sits a mission out at 3 | Back to 0 |
| A chapter's lead locked into a mission | Deploys even at 3 (the story needs her), and stays at 3 |

Resting, she still takes half the XP, and the squad can call one **bench support** a battle from a resting Uma's role:
every Uma aboard and not deployed is the battle's bench ([battle.md](battle.md#the-bench-support-call-rules-version-2)).

## The Quarters

Since CY14 the Quarters are a **deck of cabin doors** ([cabins.md](cabins.md)): her face tile with her bond rank and
Strain in the corners, dimmed while resting, and her cabin's Comfort lights below it. A door opens her cabin, whose
**Profile** tab holds what the roster's profile did:
- her bust, level and XP;
- her role and where it comes from, the role buttons, her Back unit;
- her Stride, her Strain, the band table;
- **Her rig in the Hangar**.

Below the doors: who rests next mission, and everyone's Strain. A rest in a comfortable cabin sheds more Strain
([cabins.md](cabins.md#comfort-tc61)).

## The save (v4)

`crew` holds one record each, in join order:

| Field | Holds |
|---|---|
| `outfit` | Her outfit id (a sister shares her base Uma's character id, so the crew is keyed by outfit) |
| `xp` | Her XP |
| `role` | The role set aboard, or `null` for her default |
| `rig` | Her rig, a starter part id a slot ([hangar.md](hangar.md#the-save)), or `null` for "best for her role" |
| `presets` | Up to three named loadouts |
| `strain` | 0–3 |

A v3 save opens as v4 on the device: each outfit id aboard becomes her record with no XP, her default role, "best for
her role", no loadouts and no Strain; everything else as it was, `account.updatedAt` untouched.
