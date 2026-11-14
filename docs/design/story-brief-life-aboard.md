# The story brief, part two: the captain, the squads, the factions and life aboard

> **Status: 2026-11-13 (D20).** From the game session to the story session, after the owner's new direction for the
> game. This part is **light and open on purpose**: the owner asked for worldbuilding and base story elements first,
> "do not restrict that session". It adds to [the story brief](story-brief.md) (SB1–SB11), which still holds where this
> doesn't change it. The game's side of the change is [life-aboard.md](life-aboard.md) (TC55–TC74); when your base
> elements land, the game session revises that design from them before writing its packets. Calls **SB12–SB16**, each a
> suggestion you can change. Visual page: [previews/story-brief-life-aboard.html](previews/story-brief-life-aboard.html).
>
> **D28: the first base elements are in,** as [the world v2](world.md) (WD25–WD48): the plot, the eight worlds, the factions in depth,
> the ship, the captain, the squads, life aboard and the relationships. Next: the owner's read, then the private casting.

## The short answer

- **The owner's new direction** (SB12): the player is **the captain** of the ship, the point of view; the game leans
  toward **squads, factions and one big overall plot** more than individual stories; the captain can grow **light
  dating-sim relationships with every character**; the ship becomes a home and a large part of play, with **cabins**
  the Umas live in and **duties** they hold.
- **Start with worldbuilding** (SB13): the big plot, the factions in depth, the ship and the captain, the squads, life
  aboard and the shape of the relationships. Write it as **base elements** (bibles), not scripts.
- **Nothing here is a requirement yet** (SB14). The table of what the game will eventually read is for later, and every
  row has a default, so you can skip any of it.
- **A few things stay fixed** (SB15), from the first brief and from the owner's new tone.
- **Deliver bibles first** (SB16); the owner reads them, and then the game takes them as input.

## 1. The new direction (SB12)

In the owner's words (2026-11-13):

> "a PoV character that would be the captain of the Ship supporting every individual Uma on their journeys, this game
> may not have that much of a focus on individual stories but instead on Squads and Factions and so on and a big overall
> plot, but I still want the PoV character to be able to develop some light dating sim relationship with all
> characters."

and: the ship as "a huge part of the gameplay"; "living quarters in the Ship that can be decorated", which the captain
visits to build relationships, with "the 'power of friendship' and also the 'power of love'" as plot elements; and the
Umas holding "responsibilities in the ship".

What it changes for the story:

| Before (D4) | Now (D20) |
|---|---|
| No point-of-view character; the squad and its leads carry the story | **The captain** is the player's point of view and the one person every Uma talks to |
| The spine is the leads' chapters, *Octopath Traveler*'s way, with a main thread between | **One big plot** through the factions and the ship's journey is the spine; a lead's Chapter 1 stays as her recruitment arc, as long or short as you like |
| Personal stories in each lead's later chapters | Personal stories in **bond scenes**: short scenes with the captain, in her cabin or around the ship |
| The squad as one team | **Squads**: a few named teams aboard, with leaders, identities and rivalries |
| The factions as the enemies of each world | The factions as **powers with standing**: they can be fought, bargained with, split, allied, turned |

## 2. Where to start: base elements (SB13)

Prompts, not a checklist. Take them in any order, skip what doesn't spark, add what's missing:

- **The big plot.** What's at stake across the worlds, and for whom? Who or what drives the conflict? How does it build
  across acts, and how could it end? Does the first pass's Blackout and Authority ([world.md](world.md)) survive, change
  or go?
- **The factions, in depth.** For each of the eight (and any power you add): who they are in your world, what they
  want, how they live, who leads them and who dissents, what they think of each other and of the ship, what would move
  them from hostile to wary to allied, and what freeing one of their heroines means to them. The first pass's table
  ([world.md](world.md), §5) is a starting point, not a frame.
- **The ship.** Its name, where it came from, why it travels, whose it was, whether it has a voice of its own (an AI,
  a ghost in the reactor, the companion drones), and what its rooms mean: the Bridge, the Hangar, the Galley, the
  Observation Deck, the Garden, the Guest Wing for freed heroines.
- **The captain.** Why this person commands this ship, what they lost or want, how the crew sees them at first and how
  that changes. Keep room for the player: the captain's face is never shown and their pronouns are the player's choice.
- **The squads.** Which teams the crew forms, who leads them, what each stands for, how they rival or support each
  other; whether the rival squad (TC40) becomes one of them.
- **Life aboard.** What a day on this ship is like: rituals, meals, music, shore leave, what each Uma does when she
  isn't fighting, what she keeps in her cabin.
- **The relationships.** The flavour of the captain's bonds; which Umas have a story worth five bond scenes and which
  are lighter; friendships and rivalries between Umas (canonical partners); how the *power of friendship* and the
  *power of love* show up in the plot, not only in battle.

## 3. What the game will read, later (SB14)

**Not needed now.** When the base elements settle, these are the hooks the design in
[life-aboard.md](life-aboard.md) can use. Each has the game's default, so any can stay empty.

| Hook | What the game does with it | The game's default without it |
|---|---|---|
| **The captain's lines** | **Live since CY13:** the `captain` step, two or three answers in three tones (warm, steady, wry), and `{captain}` and pronoun placeholders in any line | Generic choices |
| **Bond scenes** (TC57) | **Live since CY13:** `bonds/<outfit>.json`, the `path` step, `bondGates`, an `epilogue` card. Five per lead at ranks 2, 4, 6, 8, 10; three for featured crew (2, 8, 10); at rank 8 she speaks first, then the player chooses Trust or Heart | Small talk from her tastes, and lines drawn from her cabin, Strain and last battle |
| **Her tastes** (TC61) | **Live since CY14:** `casting.json`'s `tastes` by outfit id: favourite and disliked decor style (Neon, Classic, Cozy, Sporty, Tech, Wild), favourite gift kind (snacks, music, gear, plants, books, keepsakes), two loved topics (of twelve: racing, music, food, fashion, tech, stars, home, training, games, nature, history, crew); her small talk as `talk` in her bond file, by topic. A liked duty comes with CY16 | Derived from her running style, role and stats; the game's pool of lines |
| **Partners** (TC58) | Canonical pairs who start with camaraderie | None; the player pairs anyone |
| **Squads** (TC69) | Named squads with leaders and banners | Four numbered squads |
| **Faction standing** (TC71) | Story beats that move a faction's standing; what each level opens | Standing moved by battles and operations only |
| **Operations** (TC70) | Flavour lines per world for squads' side missions | Generic reports |
| **Jump events** (TC66) | Short events with a choice, per region of space | A small generic pool |
| **The ship's rooms** | What each room is in the world, and which lead or story beat opens it (TC49, TC62) | The game's room plan |
| **Recruitment arcs** | A lead's Chapter 1, as the first brief describes (SB4, SB8) | The stand-in |

The content contract (SB8) grows to carry these as the game builds them; the check (`pnpm story:check`) will say what
it reads, as it does today.

## 4. Still fixed (SB15)

From the first brief (SB3), unchanged: the crew is Umas only, by outfit; every enemy character is a heroine from the
eight franchises, **freed, never killed**; the battle's rules are the game's; names are ours; casting and dialogue never
go in git.

New with this part:
- **The captain is never drawn or described in the face,** and their pronouns are the player's (she, he or they).
- **The dating layer is light:** adults (every Uma in this game is drawn as an adult), warm and teasing, never explicit,
  mutual, no jealousy, and **every Uma open to every captain**, never exclusive.
- **Friendship and romance are equal in power.** A Trust bond and a Heart bond give the same strength in battle, so the
  story can make either one meaningful without making romance the "better" choice.
- **She makes the first move.** At rank 8 the Uma says what she hopes for before the captain chooses, so nobody is
  courted from above; a player can also set the game to Friends only.

## 5. How to deliver (SB16)

- **Bibles first**, in Uma Story's layers (skeleton, then bible, then scripted): world, plot and factions as nameless
  docs in git (rewrite [world.md](world.md) as you see fit, or add pages beside it, each with a desktop page), and
  anything with names or casting in `content/stories/bibles/` (private).
- **Tell the owner when a layer is ready.** After the owner reads it, the game session revises
  [life-aboard.md](life-aboard.md) from it and writes Phase 4's and 5's packets.
- **Ask for what the game lacks** with a story request in [the handoff](../handoff/README.md#story-requests): a
  mechanic, a room, a kind of scene. The game answers in its next packet.
- **Start line** for a new story session:

```text
Read CLAUDE.md, docs/design/story-brief.md and docs/design/story-brief-life-aboard.md in ~/workspace/uma-cyberpunk, then take the story brief, starting with part two's base elements.
```

## 6. The calls

| # | Call | Section |
|---|---|---|
| SB12 | The owner's new direction: the captain as the point of view; squads, factions and one big plot over individual stories; light dating-sim bonds with everyone; cabins and duties aboard | [1](#1-the-new-direction-sb12) |
| SB13 | Start with worldbuilding: the plot, the factions in depth, the ship, the captain, the squads, life aboard, the relationships, as base elements | [2](#2-where-to-start-base-elements-sb13) |
| SB14 | What the game will read later, each with a default; none needed now | [3](#3-what-the-game-will-read-later-sb14) |
| SB15 | Still fixed: SB3, plus a never-drawn captain with the player's pronouns, a light and equal dating layer open to all | [4](#4-still-fixed-sb15) |
| SB16 | Bibles first; the owner reads each layer; the game revises its design from them; story requests in the handoff | [5](#5-how-to-deliver-sb16) |
