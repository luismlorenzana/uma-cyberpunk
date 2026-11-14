# uma-cyberpunk: looks, a Tactics adult sprite profile and look-keyed sets (a request)

> **From uma-cyberpunk (2026-11-13, D23)** to uma-platform, under the
> [change protocol](https://github.com/luismlorenzana/uma-platform/blob/main/docs/change-protocol.md). The game side is
> [character-sprites.md](../character-sprites.md) (LK1–LK14). **Opt-in:** uma-quest's and uma-farm's sets, profiles and
> keys stay exactly as they are. Not filed yet: it waits for the owner's review of the spec.

## What uma-cyberpunk has

- **Ten approved looks** in Uma Character Art's Cyberpunk universe (CA4): five per pilot Uma (outfits 106801 and
  112901): `street`, `quarters`, `pilot`, `armor`, `armor-helmet`, each 1024 × 1536, sharing one template per look.
- **A battle board on uma-stage 0.5.0** (orthographic, 35°, fixed, 128 texels a tile), playing master data's chibi
  `outfit-sprites` sets in four facings today (D19), with a face card where a set is missing.
- **A cut-in** that wants a few large side-view keys, as uma-quest's adult travelers have.

## What we ask for

1. **The Studio's Uma Cyberpunk categories** (P143): beside Combat Adult Character, one category per look (Street,
   Quarters, Pilot suit, Combat armor, Helmeted armor) and one for the cut-in keys, so each Uma's looks are drawn,
   approved and published the way the pilots' were, with the pilots' looks as the reference sheets.
2. **A Tactics adult sprite profile** in format.md: the 256 cell and foot point unchanged; about four heads, a standing
   height about 212 texels; the four field facings, each drawn; per look, the actions of LK9 (combat about 64 frames,
   pilot suit 34, quarters 32, street 68); the palette check (her three roles exact on every frame).
3. **The helmet head patch:** format.md §5's head box used as a patch (the whole head, not only the face box), placed
   by each locked frame's head offset, one per facing, plus drawn helmet heads on the free frames (`hurt`, `kneel`).
4. **Sets and keys keyed by outfit and look** in master data's private release: for example `outfit-sprites` keys
   `<outfitId>` (as today) and `<outfitId>.<look>` (new), and a `cutin-keys` family keyed the same way, so a game asks
   for one outfit's combat set or her pilot-suit set. Older parsers skip what they don't know.
5. **The universe looks readable by uma-cyberpunk's API** (portraits and bust crops by outfit and look), as the app's
   API reads them today, or a copy in the private release; whichever the platform prefers.

## What must not change

- uma-quest's and uma-farm's sprite sets, profiles, keys and published releases.
- master data stays neutral: no names in keys, outfit ids only.
- Character art is drawn by ChatGPT (P126, P147); this request asks for the formats and the categories, not the drawing.

## When

The pilots' combat set first, before the board's first real kit (Phase 5); the other looks as the packets that show them
arrive (CY14's cabins, CY16's posts, Phase 5's world dioramas).
