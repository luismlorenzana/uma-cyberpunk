# CY13 — The captain and bonds

**uma-cyberpunk · Claude · L · Needs: CY12 · Unblocks: CY14, CY17**

## Why

The owner made the player the ship's captain and asked for "light dating sim" relationships with every Uma whose
friendship and love feed the battles (D20). This packet builds the spine of it: the captain at a new game, a bond with
every Uma from rank 1 to 10, rapport from battles and messages, bond scenes with the captain's choices and the Trust or
Heart path, and the **watch** counter every later life-aboard packet counts by. Cabins and visits follow in CY14, the
bonds' effects in battle in CY17.

## Context (read first)

- [Life aboard](../../design/life-aboard.md): §2 (TC55, the captain), §3.1–§3.2 (TC56, TC57), §3.3's perk table (shown
  here, played in CY17), §8 (TC72's tone, TC73's save), §6.1 (a watch).
- [The research](../../design/research-life-aboard.md) §3: Persona, Fire Emblem, Blue Archive, NIKKE, Dragon Age II.
- [The story brief, part two](../../design/story-brief-life-aboard.md) SB14 and SB15: the hooks this packet makes live.
- What exists: save v4 (`packages/domain/src/save/save.ts`, the crew records of CY11), the director
  (`apps/web/src/mission/director.ts`: `applyStep`, `closeResults`, `travel`, `joiningXp`), the story format, parser
  and check (`packages/domain/src/story/`), the scene runner and player (`apps/web/src/story/`), the Quarters and the
  profile (`apps/web/src/crew/`), the account screen (`apps/web/src/home/Account.tsx`).
- **The production-save rules** (CLAUDE.md): the migration runs on the device, never moves `account.updatedAt`, and the
  server never writes a save.

## Decisions made

- **The captain** (TC55): a new game asks for a name (default "Captain", 24 characters at most) and pronouns (they, she
  or he, default they) on one screen before the opening scene; Account shows and changes both. The captain is never
  drawn. Scene text can say `{captain}` and `{they}`, `{them}`, `{their}`, `{they're}`, filled from the save (a pronoun
  table in the domain, tested for all three).
- **The Romance setting:** Ask (default) or Friends only, on the same screen and in Account.
- **The watch** (TC67): a counter in the save, +1 when a mission's results close (won or lost) and +1 on a jump. It's
  the "stop" every budget counts by. No real time anywhere.
- **Bonds** (TC56): each crew member's record gains `bond: { rank, rapport, path, seen }`: rank 1–10, rapport toward
  the next rank, `path` null, `trust` or `heart`, and the bond scenes seen. New crew start at rank 1.
  - **Rapport needed** per rank in one tuning table in the domain (`bonds/tuning.ts`), first pass: 100, 150, 200, 250,
    300, 350, 400, 450, 500 for ranks 2–10.
  - **Sources in this packet:** a battle she fought (+20), covered an ally or joined a Crossfire in it (+10 each, once a
    battle each), a reply to her message (+15, one a watch), a captain's choice in her bond scene (+0 to +30 by the
    choice). Visits, gifts and duties add theirs in CY14 and CY16.
  - **Catch-up:** an Uma below the crew's median rank earns double.
  - **Gates:** ranks 4, 6, 8 and 10 wait on keys the story names (`casting.json`'s new `bondGates`, keys in the
    `needs` syntax); none named means open. Rapport keeps filling past a gate and the rank lands when it opens.
  - **No decay, nothing missable:** a ready bond scene waits; the rank lands with the rapport, and the scene plays when
    the player opens it.
- **Bond scenes** (TC57) are a new story file, `bonds/<outfit>.json`: `{ schemaVersion: 1, outfit, scenes: [{ rank,
  place, steps }] }`, ranks from 2, 4, 6, 8 and 10. Two new step kinds:
  - **`captain`**: the captain's choice, two or three options, each `{ tone: 'warm' | 'steady' | 'wry', text, rapport,
    then }`. The runner shows the tone as an icon.
  - **`path`**: only in a rank-8 scene, after her line saying what she hopes for: `{ trust: steps, heart: steps }`. With
    Romance on Friends only, the runner takes `trust` without asking. The choice is saved; a later bond scene can offer
    a change (`path` again at rank 10, Trust to Heart; Heart back to Trust once).
  - **The check** (`pnpm story:check`): a rank-8 scene has exactly one `path`; `captain` options are two or three; no
    `path` outside rank 8 or 10; each outfit's file names its own outfit; a warning for a lead without scenes.
- **Her message after a battle:** each Uma who fought sends one line on the ship (a stand-in pool of generic lines by
  result and role now; the story can add hers later), shown on the ship as a badge; one tap replies.
- **Where the bond shows:** a ten-segment ring on her profile (the Quarters) and her roster tile; her path's mark from
  rank 8; her perks listed with the rank each needs (played in CY17); her scenes, replayable from the Log.
- **The epilogue card** is data now: each rank-10 Uma's card is a field in her bond file (`epilogue`), shown in the Log
  once she reaches rank 10. The "who stands beside you" question waits for the story's ending.
- **Save v5:** `captain: { name, pronouns, romance }`, `watch`, and `bond` on each crew record. v4 migrates on the
  device: a default captain (name "Captain", they, Ask), watch 0, every Uma at rank 1, and `account.updatedAt` untouched.

## Do

1. `@cyber/domain`: the captain and pronoun table; bonds (`crew/bonds.ts`: rapport, ranks, gates, catch-up, the path,
   scenes seen) with tests; save v5 and its migration, with tests (a v4 save in, the same account and a valid v5 out).
2. The story format: `bonds/<outfit>.json`, the `captain` and `path` steps, `bondGates` in the casting; the parser, the
   check, `story:pack`; the brief's §8 and part two's SB14 say what's live.
3. The stand-in: bond scenes for Lead A (ranks 2, 4, 6, 8, 10) and Lead B (2 and 8), each using the new steps, a
   `bondGates` entry, two epilogue cards; `pnpm story:check` passes.
4. The director: rapport after a battle (from the battle's cues), the watch on results and on a jump, the catch-up,
   gates, the message and its reply; headless tests.
5. The screens: the new game's captain screen; Account's captain section; the bond ring and perks on the profile; a
   ready scene's badge and the player (the runner with the two new steps); the messages badge and reply on the ship.
6. Write `docs/game/captain-and-bonds.md` (the captain, the watch, bonds, scenes, messages, the save) with its page.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; the size check stays under 180 KB (the new screens are lazy).
- The migration test passes: a v4 save comes out as v5 with `account.updatedAt` unchanged.
- Locally, on the stand-in: a new game asks for the captain, then plays the opening; a battle raises the squad's
  rapport; a message is answered; Lead A reaches rank 2 and her scene plays with a captain's choice; with rapport given
  by hand in a test, her rank-8 scene offers Trust or Heart (and only Trust under Friends only); a reload keeps it all.
- `docs/game/captain-and-bonds.md` names no outfit or character; `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(bonds): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
