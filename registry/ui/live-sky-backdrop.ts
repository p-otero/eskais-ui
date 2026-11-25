import { cameraFor, type SkyCamera } from "@/components/ui/live-sky-camera"
import { cloudDeckFor, type CloudDeck } from "@/components/ui/live-sky-clouds"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { facadeLightingFor, type FacadeLighting, type Skyline } from "@/components/ui/live-sky-facade-light"
import type { GBuffer } from "@/components/ui/live-sky-gbuffer"
import type { GlassDrop } from "@/components/ui/live-sky-glass"
import { lightFor, type SkyLight } from "@/components/ui/live-sky-light"
import type { SkyPalette } from "@/components/ui/live-sky-palette"
import { atmosphereFor, fallsFor, type Atmosphere, type Fall } from "@/components/ui/live-sky-precipitation"
import { paintSky } from "@/components/ui/live-sky-sky"

/** Everything one weather state draws: the sky behind the street, the light on it, and what moves each frame. */
type SkyScene = {
  /** The stage's size, in CSS px. */
  width: number
  height: number
  /** Device pixels per CSS pixel the sky and the frames are drawn at. */
  ratio: number
  camera: SkyCamera
  conditions: SkyConditions
  light: SkyLight
  palette: SkyPalette
  sky: HTMLCanvasElement
  lighting: FacadeLighting
  deck: CloudDeck
  falls: Fall[]
  atmosphere: Atmosphere
}

/** The street itself, which only a new size or place changes: its traced G-buffer and both rooflines. */
type StreetFacades = { gbuffer: GBuffer; skyline: Skyline; halfWidth: number }

/** Draws a scene: the WebGL renderer, or the 2D canvas one where WebGL is missing. */
type SkyRenderer = {
  kind: "webgl" | "canvas"
  /** Takes a new weather state; the street is lit again once, on the next frame. */
  setScene: (scene: SkyScene) => void
  /** Takes a newly traced street; it is lit again once, on the next frame. */
  setFacades: (facades: StreetFacades) => void
  /** Draws the frame at `seconds` since the scene started, with the glass drops and a lightning flash from 0 to 1. */
  draw: (seconds: number, drops: readonly GlassDrop[], flash: number) => void
  dispose: () => void
}

type SceneInput = {
  width: number
  height: number
  ratio: number
  conditions: SkyConditions
  palette: SkyPalette
  /** The share of particles a slow renderer can afford, from 0 to 1. */
  budget: number
}

function canvasOf(width: number, height: number, ratio: number) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * ratio))
  canvas.height = Math.max(1, Math.round(height * ratio))
  const context = canvas.getContext("2d")
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return { canvas, context }
}

/** Paints the sky for a weather state at a size and works out its light; null where the browser has no 2D canvas. */
function composeScene({ width, height, ratio, conditions, palette, budget }: SceneInput): SkyScene | null {
  const camera = cameraFor(width, height)
  const light = lightFor(conditions, palette)
  const sky = canvasOf(width, height, ratio)
  if (!sky.context) return null
  paintSky(sky.context, camera, light, conditions, palette)
  return {
    width,
    height,
    ratio,
    camera,
    conditions,
    light,
    palette,
    sky: sky.canvas,
    lighting: facadeLightingFor(conditions, light, palette),
    deck: cloudDeckFor(conditions, light),
    falls: fallsFor(camera, conditions, light, palette, budget),
    atmosphere: atmosphereFor(conditions, light),
  }
}

export { composeScene }
export type { SceneInput, SkyRenderer, SkyScene, StreetFacades }
