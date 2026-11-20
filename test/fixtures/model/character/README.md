# Demo character

A synthetic person (no real person's photo or likeness) scanned by an open-source photo-to-3D engine,
[eskais-character](https://github.com/p-otero/eskais-character) (MIT). The files here are its demo assets, CC0 1.0: see
`LICENSE.md` for what they are made from. The ModelViewer and ModelScan demos on the site and in the showcase use them.

| File                        | What it is                                                                   |
| --------------------------- | ---------------------------------------------------------------------------- |
| `character-soft-toon.glb`   | The scanned character, its materials tagged with the soft toon style         |
| `character-cel-outline.glb` | The same character tagged with the cel style with an outline                 |
| `photo-body.png`            | The synthetic body photo the scan used (540 × 960)                           |
| `photo-body-mask.png`       | The body photo's person mask, 0–255 confidence, 144 × 256                    |
| `photo-face.png`            | The synthetic face photo the scan used (640 × 640)                           |
| `scan-replay.json`          | The scan's recorded event stream, each event with `at`, in ms from the start |

The GLBs need only `KHR_mesh_quantization`, which three.js's `GLTFLoader` reads. One skinned mesh has 23 morph targets
named in `extras.targetNames` and scaled to fill their quantized range, with the multipliers in `extras.targetScales`:
ModelViewer multiplies each weight by its target's. The clips are `idle` and `wave`. Each material names its style in
`extras.eskais`; `style.ts` here builds toon materials and outlines from it, in a model's `onModelLoad`.

`scan-replay.ts` replays `scan-replay.json` by its `at` times, slowed down so a person can follow it: the engine ran the
whole scan in 340 ms. Its weights are already multiplied by `targetScales`, so the replay divides them back before
ModelViewer multiplies them again.

`photo-body-mask.png` stands in for the engine's `mask` event until the recording carries one: `use-scan-replay.ts`
passes it to ModelScan's `masks` when the body's landmarks arrive (`mask: false` leaves it out, to show the fallback
from the landmarks). `tooling/demo-photo-mask.py` makes it from the render's background gradient. The face group's
`edges` (`faceContourEdges` in `scan-replay.ts`) join the contour sample the replay draws.
