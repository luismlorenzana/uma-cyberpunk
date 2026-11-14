# Art: the cabins' furniture, keepsakes and gifts as pixel art (a request)

> **Delivered (2026-11-13):** uma-art 2.29.0 (uma-platform #86, P164) ships `cabin-icons` (all 48 items, 64 px) and
> `cabin-room` (the 30 furniture pieces with `mount` and `foot`). uma-cyberpunk pins it and draws both (D32). The
> weakest pieces, if they're ever revised: Spare Earbuds, Training Cot, Gear Bench.

> **From uma-cyberpunk's CY14 (2026-11-13, D25)** to uma-platform, under the
> [change protocol](https://github.com/luismlorenzana/uma-platform/blob/main/docs/change-protocol.md)'s art row: the game
> writes the packet, a uma-platform Claude session draws the pixel art in `scripts/pixel-art` and ships it in uma-art.
> It's original prop art (no Uma, no master data), so it's in git. The game draws code-made stand-ins until the release
> lands (`apps/web/src/cabins/art.tsx`); the packet that receives it pins the uma-art version.

## What uma-cyberpunk has

- **Cabins** ([cabins.md](../../game/cabins.md)): every Uma's cabin is a landscape diorama (640 × 360 in the game's
  units) with six slots (Bed, Desk, Wall, Floor, Light, Keepsake), a window, and her standing in the middle.
- **48 items** in a table in `@cyber/domain` (`packages/domain/src/cabins/items.ts`):
  - **30 pieces of furniture:** six styles (Neon, Classic, Cozy, Sporty, Tech, Wild), one piece for each of five
    slots;
  - **6 keepsakes** for the keepsake slot;
  - **12 gifts:** two of each of six kinds (snacks, music, gear, plants, books, keepsakes).

  Each style has two colours (`DECOR_COLORS`); the stand-ins draw each piece as a flat shape in them.

## What we ask for

1. **One icon per item**, keyed by its id (`neon-bed`, `keepsake-photo`, `gift-buns`…), in the night-and-neon look of
   the game's other pixel marks:
   - a 64 × 64 cell, transparent;
   - drawn three-quarter from the front and slightly above, light from the top left;
   - a dark outline;
   - each style recognisable by its pair of colours, so a full line of five reads as a set.
2. **The same pieces at room size**, so a placed piece stands in the diorama:
   - Bed, Desk and Floor at about 150 × 150 and Wall and Light at about 96, on a transparent cell;
   - a footprint where the piece meets the floor (the Floor rug lies flat).
3. **An atlas and an index** in uma-art, the way its other icon atlases ship (`AtlasSprite`-ready), with the item ids
   as frame keys.

## The list

| Style | Bed | Desk | Wall | Floor | Light |
|---|---|---|---|---|---|
| **Neon** (`#2a1640`, `#ff3dc8`) | Glow Pod Bed | Holo Desk | Neon Sign | Light-Grid Mat | Strip Lights |
| **Classic** (`#4a3626`, `#e0b070`) | Oak Bunk | Writing Desk | Framed Print | Woven Rug | Brass Lamp |
| **Cozy** (`#5a3a46`, `#ffb3c1`) | Quilted Bed | Tea Table | Plush Shelf | Fluffy Rug | Paper Lantern |
| **Sporty** (`#173a5a`, `#4fd1ff`) | Training Cot | Gear Bench | Race Poster | Stretch Mat | Track Light |
| **Tech** (`#1b2a33`, `#7cf2c8`) | Capsule Bunk | Console Desk | Wall Screen | Grid Floor Panel | Smart Lamp |
| **Wild** (`#26402a`, `#a6e36a`) | Rope Hammock | Driftwood Desk | Vine Wall | Moss Rug | Firefly Jar |

**Keepsakes:** First Trophy, Crew Photo, Captain's Charm, Hand-Drawn Star Map, Old Race Ribbon, Pocket Radio.

**Gifts:**

| Kind | Gifts |
|---|---|
| Snacks | Steamed Buns, Fizz Candy |
| Music | Mix Tape, Spare Earbuds |
| Gear | Grip Gloves, Tune-Up Kit |
| Plants | Tiny Succulent, Seed Packet |
| Books | Paperback Novel, Pocket Atlas |
| Keepsakes | Enamel Pin, Postcard |

## What must not change

- No other game's art or atlases.
- The ids stay the game's: a renamed piece keeps its id.

## When

Before Phase 4's exit (CY19's play-through), so the owner's play shows real furniture; the stand-ins work until then.
