/** A canvas the sky draws on: an `OffscreenCanvas` where the browser has one, so the same code runs in a worker. */
type Surface = HTMLCanvasElement | OffscreenCanvas

/** A 2D context of either kind of surface. */
type Surface2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const isOffscreen = (surface: Surface): surface is OffscreenCanvas =>
  typeof OffscreenCanvas === "function" && surface instanceof OffscreenCanvas

/** A blank surface to draw on off screen, at least 1 × 1 pixel. */
function createSurface(width: number, height: number): Surface {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  return canvas
}

/** The surface's 2D context; null where the browser can't make one. */
function context2d(surface: Surface, settings?: CanvasRenderingContext2DSettings): Surface2D | null {
  return isOffscreen(surface) ? surface.getContext("2d", settings) : surface.getContext("2d", settings)
}

/** The surface's WebGL 1 context; null where the browser can't make one. */
function webglContext(surface: Surface, attributes: WebGLContextAttributes): WebGLRenderingContext | null {
  return isOffscreen(surface) ? surface.getContext("webgl", attributes) : surface.getContext("webgl", attributes)
}

export { context2d, createSurface, webglContext }
export type { Surface, Surface2D }
