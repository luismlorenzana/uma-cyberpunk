# The board

> **Status: 2026-11-13, CY7 (D11), the post layer tuned (D18).** The battle board as `apps/web/src/board/` draws it, on
> uma-stage 0.5.0's parts, and its test bench at `/board`. The sandbox (CY8) plays battles on it. The kit is uma-stage's stand-in forest under a night
> grade until the first world's kit (Phase 4).

## The short answer

- **The map's heights become terrain** exactly as written: digit rows 0–3 are uma-stage's own format, passed straight to
  `roomGeometry` (never through `parseRoomDesign`, which stops at level 2). Solid tiles are walls.
- **Umas are sprites, enemies and guests are standees,** each on a **base ring** in her side's colour with a **facing
  wedge** pointing the way she faces.
- **The overlays** paint tile tops in TC29's colours. A tap picks a tile; a drag pans; the camera never turns or zooms.
- **It draws only when something changes,** and the battery saver drops it to 30 fps with no post effects.

```mermaid
flowchart LR
  map[BattleMap: heights, tiles] --> design[toRoomDesign] --> geo[roomGeometry, stand-in kit] --> world[buildWorldParts: high ground kept apart]
  world --> scene[BoardScene]
  figures[Figures: sprites, standees, rings, wedges] --> scene
  overlays[Overlays and the cursor] --> scene
  scene --> loop[Render on change, FramePacer, Effects unless saver]
  taps[Taps and drags, through toStage] --> scene
```

## What it shows

The camera is orthographic, fixed at a 35-degree downward pitch with no horizontal rotation.
Battle directions map to sprite drawings as South/front, North/back, West/left and East/right.
The renderer stands each sprite on a vertical flat surface and compensates its height by
`1 / cos(35°)`, preserving the painted image's on-screen proportions. That transform does not
create a painted viewpoint. The [current baseline art review](../design/combat-sprites-request.md)
is planned under CY57/CY59; existing sets and fallbacks remain the implemented path until integration.

| Piece | How it looks |
|---|---|
| **Terrain** | The map's tiles at their heights (0–3), risers between levels, walls for solid tiles, from the stand-in biome kit |
| **The light** | A night grade: a blue-violet sky light, a cool key light from the top front-left, the sprites tinted toward it, a dark navy behind the board; the four live lights go to the kit's lamps nearest the view's middle |
| **An Uma** | Her **sprite set from master data** (`outfit-sprites`, the authored chibis) when the release has one, walking with her four facings; else a standee with **her face** (`outfit-faces`); a stand-in sprite only when the release can't be read (D19, `apps/web/src/board/looks.ts`) |
| **A stand-in squad unit** | A stand-in sprite set (the first four), as on the bench |
| **An enemy, a guest** | A standee: a face card on a base (stand-in faces until the heroines, Phase 4) |
| **The base ring** | A flat ring under each unit: **cyan** the squad, **green** a guest, **red** an enemy |
| **The facing wedge** | A small arrowhead on the ring, pointing the way she faces (N to the back, S toward the camera) |

## The overlays

One merged mesh over the tile tops, rebuilt when the set changes:

| Colour | Means |
|---|---|
| **Blue** | She can reach it, and no enemy can strike it next turn |
| **Magenta** | She can reach it, inside an enemy's reach |
| **Red** | An enemy she could strike from a tile she can reach |
| **Yellow** | An area (a mortar, a smoke charge), from CY8 |
| **A white outline** | The cursor: the tile last tapped |

## Taps and the pan

- **A tap** picks the tile under the finger: a unit's tile when the tap lands on her (her card is about a thumb wide),
  else the nearest tile top. A tap on a raised tile's front face picks the tile it belongs to only if its top is under
  the finger, as the stage's picking does everywhere.
- **A drag** pans on both axes, clamped to the board's edges; the camera snaps to the pixel grid, so the art stays crisp.
- **No rotation and no zoom:** the camera is uma-stage's, pitched 35°, 128 texels a tile. A tile is about 24 pt deep on
  a 3× phone held sideways, just under the 44 pt rule, which is why the sandbox moves in two taps (TC29).
- **On an upright phone** the stage is turned (uma-stage's `TurnedStage`), and touches go through `toStage`.

## The fade

High ground (level 2 and up) is built apart from the rest. While a tile of it stands in front of the unit in focus (the
one selected, acting or targeted), it eases to 35% opacity over 150 ms, at once with reduced motion; a unit's own tile
never fades for her.

## The loop and the saver

- **Render on change:** a tap, a pan, a walk, a fade or a resize wakes the loop; it sleeps three frames after the last
  change. A hidden page draws nothing.
- **The battery saver** (on by default on phones, `initialSaver()`): 30 fps through `FramePacer`, and no tilt-shift or
  bloom. With it off, uma-stage's `Effects` draws both with the board's own values (`BOARD_EFFECTS`, D18), which the
  first stage request made possible:

  | Pass | Value | uma-stage's default | Why |
  |---|---|---|---|
  | Bloom threshold | **0.22** | 0.86 | Measured on the rendered night frame: the cyan ring reads about 0.49 luminance, the red and magenta rings and the danger overlay about 0.28–0.30, the lamps about 0.24, and 96% of the board under 0.1. At 0.22 all the neon blooms and the terrain stays dark |
  | Bloom strength | **0.5** | 0.35 | The figures' cards (about 0.45) glow a little at any useful threshold, so the glow stays modest |
  | Bloom radius | **0.5** | 0.4 | A slightly wider halo for the rings |
  | Tilt-shift strength | **0.8** | 1.6 | A 14 × 14 board fills the screen; at 1.6 the front and back rows, where units stand, blurred |
  | Tilt-shift focus | 0.5 | 0.5 | The middle of the screen |

  Bloom never touches the blue reach overlay (about 0.08 as drawn): only what should glow does. With the layer on, the
  bench draws in 108 calls.

## The test bench

`/board` (behind sign-in, loaded on demand with three.js and the stage) puts thirteen stand-ins on a 14 × 14 map with
heights 0–3 (`?map=flat-14` for the flat one): four Umas as sprites, a guest and eight enemies as standees. Tap a unit
for her reach, tap a blue or magenta tile to walk her there, drag to pan. **Back** returns Home; **Saver** toggles it.

`?debug` adds a readout (figures, sprites and live sets, draw calls, fps, the saver, the device size, faded tiles) and
`window.__board`: `step(ms)`, `pick(x, y)`, `figures`, `drawCalls`, `fps`, `saver`, `debug`, `setSaver(on)`, `tap(x, z)`
and `record(ms)`, which pans for `ms` while recording frames. The preview pane draws WebGL but runs no animation frames
while hidden, so checks call `step()` and read these.

## The five checks (CY7)

| # | Check | Result |
|---|---|---|
| 1 | A level-3 tile builds | **Passes:** `roomGeometry` builds risers to level 3 from a design made directly (a test). Heights 0–3 need no request |
| 2 | Picking with heights | **Passes:** on the 14 × 14 heights map, all 159 visible tile tops (of 177 on screen) pick back to themselves; a tile is about 24 pt deep at DPR 3 (a test) |
| 3 | Thirteen figures | **Passes:** 13 figures, 4 sprite sets live (the cap is 8); 41 draw calls with the saver on, about 101 with tilt-shift and bloom |
| 4 | Frame rate | **Desktop, labelled so** (a Mac's 120 Hz display, the preview pane, 1688 × 1188 device px at DPR 2), ten seconds panning: saver off 120 fps mean, 107.5 the 1% low; saver on 29.9 fps mean, 29.1 the 1% low. The owner's phone gives the real numbers |
| 5 | What heights hide | Tile tops more than half covered by nearer terrain, fade off: 9.2% on the heights map, 8.3% on the underlevels, 0% on flat maps (a test). The fade shows whatever is in focus |

## Requests to uma-stage

Filed one at a time, each only once the checks prove it ([BP3](../design/build-plan.md#3-the-hd-2d-board-on-uma-stage-bp3)):

| # | Request | State |
|---|---|---|
| 1 | [Tunable bloom and tilt-shift](../design/stage-requests/tunable-effects.md): bloom's threshold of 0.86 means no neon colour ever blooms (the squad's cyan is 0.587) | **Shipped** in uma-stage 0.5.0 (ST5, P156); pinned, with the values above (D18) |
| 2 | Glowing kit frames | Queued: filed when the first world's kit (Phase 4) needs lit signs and windows |
| 3 | A tactics kit kind cached by kit id | Queued |
| 4 | A lighter saver tier | Queued |
| — | Heights 0–3 | **Not needed:** check 1 passes |
| — | A zoom for 2× phones | Only if the phone check asks |
