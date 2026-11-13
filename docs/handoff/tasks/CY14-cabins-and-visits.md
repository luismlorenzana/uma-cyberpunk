# CY14 — Cabins, decor and visits

**uma-cyberpunk · Claude · L · Needs: CY13 · Unblocks: CY15, CY19**

## Why

The owner asked for "living quarters in the Ship that can be decorated", which the captain visits "and build their
relationships" (D20). This packet gives every Uma a cabin with six decor slots, furniture in six styles, a Comfort that
helps her shed Strain, her tastes discovered over time, and the **visit**: talk, a gift, decorating together, an
invitation out. It's the main way rapport rises between battles.

## Context (read first)

- [Life aboard](../../design/life-aboard.md) §4 (TC60, TC61: cabins, decor, Comfort, a visit, tastes and tags) and §3.1
  (rapport and the catch-up).
- [The research](../../design/research-life-aboard.md) §3: Blue Archive's café, Arknights' dorms, Genshin's teapot,
  Spiritfarer's houses and requests, Animal Crossing's sets, NIKKE's advise.
- What exists after CY13: save v5 with the captain, the watch and bonds; the Quarters (`apps/web/src/crew/Quarters.tsx`)
  with the roster and profile; the crew view and adapter (`apps/web/src/crew/view.ts`, `packages/domain/src/crew/`);
  Strain and `afterMission` (`packages/domain/src/crew/crew.ts`); the uma-kit album art (`apps/web/src/crew/art.tsx`).
- **Art by kind** (CLAUDE.md, uma-platform P126, P147): furniture is ours, so Claude draws it in code.

## Decisions made

- **Cabins** (TC60): the Quarters page becomes the Quarters deck: a row of cabin doors (her face, her bond ring, her
  Comfort lights, a badge when she has something), and a door opens her **cabin**: a landscape diorama, drawn as one SVG
  scene, with six slots (Bed, Desk, Wall, Floor, Light, Keepsake) and a window showing the current world's colours. Her
  bust (uma-kit's `UmaBust`) stands in it. Berths and private cabins are CY15's (the Quarters module's level); until
  then, everyone has a cabin.
- **Items** (TC61): a table in the domain (`cabins/items.ts`), about thirty-six stand-in items, six a style (**Neon,
  Classic, Cozy, Sporty, Tech, Wild**), each with a slot, a comfort of 1–3 and an original name; plus six keepsakes. A
  **set** is six items of one line. They're ours, so they're in git.
- **The art:** stand-in icons drawn in code here (`apps/web/src/cabins/art.tsx`, flat SVG shapes in each style's colours,
  one per item), and **a request to uma-platform** for the real pixel set (`scripts/pixel-art`, uma-art): file it
  under the change protocol with the item list; the packet that receives the release pins it.
- **Her tastes** (TC61): a favourite style, a disliked style, a favourite gift kind (one of six: snacks, music, gear,
  plants, books, keepsakes), two loved topics (from twelve: racing, music, food, fashion, tech, stars, home, training,
  games, nature, history, the crew) and a liked duty (CY16). From the casting's new `tastes` (by outfit id) when the story
  gives them; **else derived** in the domain from her running style, role and bands by a fixed table, so every Uma has
  them (a test: the same Uma always derives the same tastes).
- **Discovered, not listed:** her profile shows a taste once revealed: the first gift reveals the gift kind, the first
  decorate reveals the styles, each loved topic shows once talked about.
- **Comfort** = the six items' comfort, +2 for each in her favourite style, −1 for each in the one she dislikes, +2 for
  a full set; shown as five lights (thresholds 6, 10, 14, 18, 22, tuned in one table). **Comfort 3+:** when she rests
  through a mission she sheds 1 Strain even below 3; **Comfort 5:** resting clears all her Strain. A visit at Comfort 4+
  earns half again as much rapport.
- **A visit** (TC61): three visits a watch (the watch from CY13), sixty to ninety seconds each. Choices:
  - **Talk:** three topics; one she loves gives full rapport (+30), any other half; a few lines (her written small talk,
    else systemic lines from her cabin, Strain, last battle and last gift; a stand-in pool of generic lines in git).
  - **Gift:** one item a visit from the stock; her favourite kind +40, any other +15.
  - **Decorate:** she picks an item for a slot from the stock (her favourite style first) and says why.
  - **Invite** (rank 4+): an outing to a spot (the Observation Deck, the Galley, the Garden, the Sim Pod, a world's
    market); a short scene, +40. Spots that aren't built yet (CY15) show the Observation Deck only.
  - **Her bond scene** opens the visit when one is ready.
  - A **result card**: rapport gained, Strain shed, a request if she has one.
- **Requests:** about one visit in five ends with a request for an item kind; granting it later pays +30 and fills the
  slot. **Theme kits:** one tap furnishes a cabin from the stock in her favourite style. Decorating never gates a rank.
- **The stock:** owned items and how many. A new game owns a starter kit (two of each slot in Classic and Cozy). Items
  come from mission rewards (one item a win, by a table) until the Store and the Workshop (CY15, CY16) sell and make
  them.
- **Save v6:** each crew record gains `cabin: { slots, revealed, request }`; the save gains `items: Record<itemId,
  count>` and `visits: { watch, used }`. v5 migrates on the device: empty cabins, the starter kit, nothing revealed,
  `account.updatedAt` untouched.

## Do

1. `@cyber/domain`: items and sets, tastes (from the casting or derived), Comfort, the visit's rapport, requests, theme
   kits, Comfort's Strain rules in `afterMission`; save v6 and its migration; tests for each.
2. The story format: `tastes` in the casting, written small talk per Uma (`bonds/<outfit>.json` gains `talk: { topic:
   lines }`); the parser and the check; the brief says what's live.
3. The art: stand-in item icons in code; the cabin diorama; file the uma-platform request for the real furniture set.
4. The screens: the Quarters deck of doors, the cabin, the visit and its result card, the stock, theme kits; her
   tastes on her profile as they're revealed.
5. The stand-in: tastes for the four invented Umas, written talk for Lead A, a request pool.
6. Write `docs/game/cabins.md` (cabins, items, styles, Comfort, visits, tastes, the save, the item list generated from
   the code as hangar.md's parts are) with its page.

## Done when

- `pnpm lint && pnpm test && pnpm build` pass; the size check stays under 180 KB.
- The domain tests cover: Comfort with favourite, disliked and a set; derived tastes are stable; resting at Comfort 3
  and 5 sheds Strain; a talk on a loved topic gives full rapport and any other half; visits reset each watch.
- Locally: a cabin is decorated slot by slot and with a theme kit; Comfort changes on the spot; three visits a watch, the
  fourth refused until the next watch; a gift reveals her gift kind; an invitation plays; a reload keeps it all.
- The uma-platform request is filed and named in the handoff. `git status` shows no `content/`.

## Deliver

Commit to `main` (Conventional Commits, `feat(cabins): …`). Then delete this packet, add a Done row in
[the handoff](../README.md), and log a D-decision for anything you decided (fetch `main` first).
