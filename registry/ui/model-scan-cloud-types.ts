import type { Color, Object3D, Vector3 } from "three"

type Cloud = {
  objects: Object3D[]
  particles: number
  people: number
  /** The photo at `center`, `width` × `height`; `pixels` per world unit at distance 1; `focus` the camera's distance. */
  place: (center: Vector3, width: number, height: number, pixels: number, focus: number) => void
  /** How far the flight is, from 0 (the photo) to 1 (landed on the model). */
  set: (progress: number) => void
  /** The theme's accent, and glowing sprites on a dark stage. */
  theme: (next: Color, onDark: boolean) => void
  /** The whole photo at `opacity` and no particles: the reduced-motion crossfade. */
  fade: (opacity: number) => void
  hide: () => void
  dispose: () => void
}

export type { Cloud }
