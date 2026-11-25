import type { SkyRenderer } from "@/components/ui/live-sky-backdrop"
import { createCanvasRenderer } from "@/components/ui/live-sky-canvas"
import { createWebGLRenderer } from "@/components/ui/live-sky-webgl"

/** How a renderer runs here: a GPU draws everything at up to 2× and 60 fps; software GL or a 2D canvas less, slower. */
type RenderPlan = {
  renderer: SkyRenderer
  software: boolean
  maxRatio: number
  /** The share of particles and glass drops to draw, from 0 to 1. */
  budget: number
  /** The shortest time between frames, in ms. */
  frameMs: number
}

const softwareRenderers = /swiftshader|llvmpipe|softpipe|basic render|warp/i
const gpuFrameMs = 0
const slowFrameMs = 33

function rendererName(gl: WebGLRenderingContext) {
  const generic = String(gl.getParameter(gl.RENDERER))
  const debug = generic === "WebKit WebGL" ? gl.getExtension("WEBGL_debug_renderer_info") : null
  return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : generic
}

function webglPlan(canvas: HTMLCanvasElement): RenderPlan | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" })
  if (!gl) return null
  const software = softwareRenderers.test(rendererName(gl))
  try {
    return {
      renderer: createWebGLRenderer(canvas, gl),
      software,
      maxRatio: software ? 0.75 : 2,
      budget: software ? 0.35 : 1,
      frameMs: software ? slowFrameMs : gpuFrameMs,
    }
  } catch {
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return null
  }
}

function canvasPlan(canvas: HTMLCanvasElement): RenderPlan | null {
  const context = canvas.getContext("2d")
  if (!context) return null
  return {
    renderer: createCanvasRenderer(canvas, context),
    software: true,
    maxRatio: 1,
    budget: 0.3,
    frameMs: slowFrameMs,
  }
}

/** Picks WebGL, or a 2D canvas where WebGL is missing or its shaders fail; null where neither exists. */
function planRenderer(createCanvas: () => HTMLCanvasElement): { plan: RenderPlan; canvas: HTMLCanvasElement } | null {
  const glCanvas = createCanvas()
  const gl = webglPlan(glCanvas)
  if (gl) return { plan: gl, canvas: glCanvas }
  const flatCanvas = createCanvas()
  const flat = canvasPlan(flatCanvas)
  return flat ? { plan: flat, canvas: flatCanvas } : null
}

export { planRenderer }
export type { RenderPlan }
