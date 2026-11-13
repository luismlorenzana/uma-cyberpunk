# Both apps: tunable bloom and tilt-shift in uma-stage (the first stage request)

> **Shipped (2026-11-13):** uma-stage 0.5.0 carries it as ST5 (uma-platform P156): `Effects` options, `effects.set(…)`
> and `effects.settings`, the defaults unchanged for uma-quest and uma-farm. uma-cyberpunk pins 0.5.0 and passes values
> measured on its rendered night frame rather than the starting values below: bloom `{ threshold: 0.22, strength: 0.5,
> radius: 0.5 }`, tilt-shift `{ strength: 0.8 }` (D18, [board.md](../../game/board.md#the-loop-and-the-saver)). The
> uma-platform session's finding held: at 0.45, magenta and the danger overlay never bloom.

> **A "Both apps" request from uma-cyberpunk's CY7 (2026-11-12, D11)** to uma-platform, under the
> [change protocol](https://github.com/luismlorenzana/uma-platform/blob/main/docs/change-protocol.md). It's the first of
> the build plan's stage requests ([BP3](../build-plan.md#3-the-hd-2d-board-on-uma-stage-bp3), TC48), filed one at a time,
> each only once the board's checks prove it. An **opt-in** option on `Effects`: uma-quest's `StageEngine` and uma-farm's
> `BandStage` pass nothing and must draw exactly as on 0.3.0.

## What uma-cyberpunk has

- **The battle board** ([board.md](../../game/board.md)): a game-owned scene built from uma-stage 0.3.0's parts in
  `BandStage`'s shape (`roomGeometry` and `buildWorldParts` from the stand-in biome kit, `SpriteActor`, `Standee`,
  `pickAt` over `tileQuad`, the fade's pure half, `FramePacer`), under a **night grade** (sky `#5a6cc8` at 1.1, key light
  `#b8c8ff` at 0.8, sprite tint `#c9d2ff`).
- **Its look is neon on dark** (the concept's TC6 and TC41): cyan and magenta base rings, lamps and signs, the overlays
  in TC29's colours. It draws the post layer through uma-stage's `Effects` unchanged, off under the battery saver.

## What broke, found building CY7

`Effects` takes no options: `BLOOM` (strength 0.35, radius 0.4, **threshold 0.86**) and `TILT_SHIFT` (strength 1.6,
focus 0.5) are constants. `UnrealBloomPass` keeps texels whose luminance (0.299 R + 0.587 G + 0.114 B, linear) is above
the threshold, so **saturated neon never blooms**, even drawn at full strength and before the night grade dims it:

| Colour | Luminance | Blooms at 0.86? |
|---|---|---|
| The squad's cyan ring `#2ee6ff` | 0.587 | No |
| Pure cyan `#00ffff` | 0.701 | No |
| A warm lamp `#ffb84d` | 0.589 | No |
| Magenta `#ff3dc8` | 0.392 | No |
| The danger overlay `#e040c8` | 0.319 | No |
| White `#ffffff` | 1.000 | Yes |

Only near-white crosses it, so on the board the bloom pass costs its draws and shows nothing. The fixed tilt-shift is a
second, smaller issue: a 14 × 14 board fills more of the screen than uma-quest's rooms, and the blur at 1.6 softens the
board's front and back rows, where units stand.

## What we ask for

1. **Options on `Effects`:** `new Effects(renderer, scene, camera, { bloom?: { strength?, radius?, threshold? },
   tiltShift?: { strength?, focus? } | false })`, each falling back to today's constant; `tiltShift: false` drops its
   two passes.
2. **A setter** for live changes (a cut-in's flash, a menu dimming the board): `effects.set({ bloom: { strength } })`.
3. **The constants stay exported** as the defaults, so a game that passes nothing draws byte for byte as on 0.3.0.
4. **Its review page** showing both, and a check that uma-quest's and uma-farm's stages are unchanged.

What uma-cyberpunk would pass to start: bloom `{ threshold: 0.45, strength: 0.6, radius: 0.5 }`, tilt-shift
`{ strength: 0.8 }`. The values are its own to tune.

## What must not change

- uma-quest's `StageEngine` and uma-farm's `BandStage` construct `Effects` with no options: same passes, same uniforms,
  same output.
- The battery saver still turns the whole layer off (DN27).
- No new peer dependency; `Effects` stays in the main entry.

## Not asked

- `StageEngine` or `BandStage` options for it: uma-cyberpunk owns its scene and constructs `Effects` itself.
- The queue's later requests, each filed when this one ships: glowing kit frames, a tactics kit kind cached by kit id, a
  lighter saver tier; heights 0–3 only if needed (CY7's check 1 shows level 3 already builds from a design made
  directly, so it isn't); a zoom only for 2× phones.

## When

Before the board's first real kit (Phase 4). CY8's sandbox plays on 0.3.0's look until then; the uma-cyberpunk packet
after the release pins it and passes the values above.
