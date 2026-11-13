# CY16 — Duties, the ship log and travel events

**uma-cyberpunk · Claude · M · Needs: CY15 · Unblocks: CY17, CY18**

## Why

The owner asked for the Umas to "have responsibilities in the ship" and be "assigned to perform tasks" (D20). This
packet puts posts in every room, matches the crew to them by their bands and their running style, makes each post
produce once a watch onto one ship-log card, and gives a jump its occasional event card. It's built to take seconds a
stop, never to become a chore.

## Context (read first)

- [Life aboard](../../design/life-aboard.md) §6 (TC67, TC68: posts, aptitude, running style, mastery, station chiefs,
  no chores) and §5.5 (TC66: event cards).
- [The research](../../design/research-life-aboard.md) §2: Fallout Shelter, Arknights, Metal Gear Solid V, FTL, Uma
  Musume's training facilities, and the pitfalls.
- What exists after CY15: modules with their posts per level (`packages/domain/src/ship/modules.ts`), the watch, the
  wallet, the deploy screen, cabins and Comfort (CY14), bonds and rapport (CY13), Strain (`crew.ts`), the crew view.

## Decisions made

- **Posts** (TC67): each module level lists its posts (the table in life-aboard §6.1); an Uma holds one post at a time,
  and duties **persist** until changed.
- **Aptitude by thresholds:** each post names one band (or two, the better counts). **Band 3** does the job, **4–5**
  adds the post's extra effect, **2 or less** works at half. A matching **role** adds the post's named perk. Shown before
  she's assigned, as a three-step mark.
- **Running style as tenure:** Front Runner full from the first watch; Pace Chaser full and never halved when deployed;
  Late Surger +50% after two watches in a row at the post; End Closer +10% a watch at the post to +50%.
- **Mastery:** each watch at a post adds a point; at 3, 8 and 15 watches a star, each +10% there.
- **Station chiefs:** the casting's new `chiefs` (`{ "<outfit>": "<module>" }`) give that Uma a named extra at that
  room's post; none named, nobody is a chief.
- **Output a watch** (TC67): each post's output by a domain table (Data, credits, Alloy, a furniture piece, plants,
  Strain shed, a meal for the next battle, intel on a location, faster builds, more pips, better jump events); a liked
  duty (CY14's tastes) adds +5 rapport a watch. All of it lands on **one ship-log card** when the watch passes, applied
  at once. Deterministic: no failure rolls.
- **The soft cost:** an Uma deployed in the battle that ends the watch works at half (a Pace Chaser at full). An Uma
  resting at Strain 3 can stand duty.
- **No chores** (TC68): **Auto-assign** fills every post with the best fit among those not deployed (aptitude, then
  mastery, then liked duty), and offers Umas at Strain 3 for the Med Bay and the Observation Deck; **two presets**;
  nothing decays; no duty fatigue.
- **Duty partners:** two Umas on posts in the same room build camaraderie a watch (stored now, used for partners in
  CY17).
- **Meals:** the cook's dish (by her bands, a table of six) is stored on the save and goes into the next battle's input
  as `meal` (played in CY17).
- **Event cards** (TC66): a jump draws an event with a fixed chance (1 in 3), at most one a jump: a short card with two
  or three choices, each resolved by who holds a named post (a pilot's Speed band, a navigator's Wit), paying from the
  wallet, items, a Lead or rapport. A generic pool of about twelve in git; the story's pools as `events/<region>.json`
  (live in the format) where a world names its region. Skippable.
- **Save v8:** each crew record gains `post: { module, index, since, mastery }` or null; the save gains `presets`,
  `meal`, `camaraderie: Record<pair, number>` and `log` (the last ship-log card). v7 migrates on the device with no posts
  held, `account.updatedAt` untouched.

## Do

1. `@cyber/domain`: posts, aptitude, tenure, mastery, chiefs, outputs, the soft cost, auto-assign, presets, camaraderie
   from posts, meals, event cards; save v8 and its migration; tests for each (thresholds, each running style's curve,
   auto-assign's picks, deterministic outputs).
2. The director: the watch applies every post's output and writes the ship-log card; a jump may draw an event.
3. The screens: posts in each room's page with the aptitude mark and the assign sheet; the Duties overview (every post,
   auto-assign, presets); the ship-log card on arrival; the event card on a jump.
4. The story format: `chiefs`, `events/<region>.json`, a world's `region`; the parser, the check, the stand-in (two
   chiefs, a region pool of three events).
5. Write `docs/game/duties.md` (posts, aptitude, tenure, mastery, chiefs, outputs, the ship log, event cards, the save;
   the post table generated from the code) with its page.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; the size check stays under 180 KB.
- The migration test passes with `account.updatedAt` unchanged.
- Locally: auto-assign fills the posts; a mission's end shows one ship-log card with every post's output; a deployed
  Uma's post shows half; a Late Surger's bonus lands on her third watch; a jump draws an event card resolved by the
  pilot; a stop that needs no input takes none.
- `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(duties): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
