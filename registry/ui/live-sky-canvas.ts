import type { SkyRenderer, SkyScene } from "@/components/ui/live-sky-backdrop"
import { paintClouds } from "@/components/ui/live-sky-clouds"
import type { GlassDrop } from "@/components/ui/live-sky-glass"
import { cssColour } from "@/components/ui/live-sky-palette"
import type { Fall } from "@/components/ui/live-sky-precipitation"
import { seededRandom } from "@/components/ui/live-sky-street"

const cloudDownscale = 10
const maxCanvasParticles = 700

type Seed = [number, number, number, number]

const fract = (value: number) => value - Math.floor(value)

function cycleRandom(seed: Seed, cycle: number) {
  return seededRandom(
    Math.floor((seed[0] * 7919 + seed[1] * 104_729 + seed[2] * 1_299_709 + cycle * 15_485_863) * 1000),
  )
}

function drawFall(context: CanvasRenderingContext2D, scene: SkyScene, layer: Fall, seeds: Seed[], seconds: number) {
  const { camera } = scene
  const tanX = camera.width / 2 / camera.focal
  const tanY = camera.height / 2 / camera.focal
  const project = (x: number, y: number, z: number) =>
    [camera.width / 2 + (camera.focal * x) / z, camera.height / 2 - (camera.focal * y) / z] as const
  const count = Math.min(layer.count, seeds.length)
  context.lineCap = "round"
  for (let index = 0; index < count; index++) {
    const seed = seeds[index]!
    const clock = seconds / layer.period + seed[3]
    const phase = fract(clock)
    const random = cycleRandom(seed, Math.floor(clock))
    const z0 = 0.5 + layer.depth * random() ** 1.35
    const speed = 0.8 + 0.4 * seed[0]
    const travel = (phase - 0.5) * layer.period * speed
    const x =
      (random() * 2 - 1) * z0 * tanX * 1.2 +
      layer.velocity.x * travel +
      layer.sway * Math.sin(seconds * 1.3 + seed[1] * 40)
    const y = (random() * 2 - 1) * z0 * tanY * 1.2 + layer.velocity.y * travel
    const z = z0 + layer.velocity.z * travel
    const tailZ = z - layer.velocity.z * speed * layer.exposure
    if (z < 0.35 || tailZ < 0.35) continue
    const [headX, headY] = project(x, y, z)
    const [tailX, tailY] = project(
      x - layer.velocity.x * speed * layer.exposure,
      y - layer.velocity.y * speed * layer.exposure,
      tailZ,
    )
    const width = Math.max(0.8, (layer.diameter * camera.focal) / z)
    const fade = Math.min(1, phase / 0.12, (1 - phase) / 0.12) * Math.min(1, (layer.depth - z) / (layer.depth * 0.4))
    context.strokeStyle = cssColour(layer.colour, Math.max(0, layer.alpha * fade))
    context.lineWidth = layer.kind === "snow" ? width * 1.6 : width
    context.beginPath()
    context.moveTo(tailX, tailY)
    context.lineTo(headX, headY)
    context.stroke()
  }
}

function drawDrop(context: CanvasRenderingContext2D, scene: SkyScene, drop: GlassDrop) {
  const highlight = 0.35 + scene.light.ambient * 0.65
  if (drop.splash > 0) {
    context.strokeStyle = cssColour([highlight, highlight, highlight], drop.alpha * 0.5)
    context.lineWidth = 1
    context.beginPath()
    context.arc(drop.x, drop.y, drop.radius * 0.8, 0, Math.PI * 2)
    context.stroke()
    return
  }
  const gradient = context.createRadialGradient(
    drop.x - drop.radius * 0.3,
    drop.y - drop.radius * 0.35,
    0,
    drop.x,
    drop.y,
    drop.radius,
  )
  gradient.addColorStop(0, cssColour([highlight, highlight, highlight], drop.alpha * 0.55))
  gradient.addColorStop(0.55, cssColour(scene.light.horizon, drop.alpha * 0.25))
  gradient.addColorStop(1, cssColour([0, 0, 0], drop.alpha * 0.45))
  context.fillStyle = gradient
  context.beginPath()
  context.ellipse(drop.x, drop.y, drop.radius, drop.radius * 1.08, 0, 0, Math.PI * 2)
  context.fill()
}

/** Draws the scene on a 2D canvas where WebGL is missing: coarser clouds, fewer streaks, shaded drops without refraction. */
function createCanvasRenderer(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): SkyRenderer {
  const random = seededRandom(0xc1a55)
  const seeds: Seed[] = Array.from({ length: maxCanvasParticles }, () => [random(), random(), random(), random()])
  const clouds = document.createElement("canvas")
  const cloudContext = clouds.getContext("2d")
  let cloudPixels: ImageData | null = null
  let scene: SkyScene | null = null

  return {
    kind: "canvas",
    setScene(next) {
      scene = next
      if (canvas.width !== next.sky.width) canvas.width = next.sky.width
      if (canvas.height !== next.sky.height) canvas.height = next.sky.height
      clouds.width = Math.max(2, Math.ceil(next.width / cloudDownscale))
      clouds.height = Math.max(2, Math.ceil(next.height / cloudDownscale))
      cloudPixels = cloudContext?.createImageData(clouds.width, clouds.height) ?? null
    },
    draw(seconds, drops, flash) {
      if (!scene) return
      const { width, height, ratio, deck, atmosphere } = scene
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.globalCompositeOperation = "source-over"
      context.drawImage(scene.sky, 0, 0)
      if (cloudContext && cloudPixels) {
        paintClouds(cloudPixels, scene.camera, deck, {
          x: (deck.drift.x * seconds) % 1,
          y: (deck.drift.y * seconds) % 1,
        })
        cloudContext.putImageData(cloudPixels, 0, 0)
        context.imageSmoothingEnabled = true
        context.drawImage(clouds, 0, 0, canvas.width, canvas.height)
      }
      context.drawImage(scene.facades, 0, 0)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      if (atmosphere.veil > 0) {
        context.fillStyle = cssColour(atmosphere.colour, Math.min(0.85, atmosphere.veil * 0.8))
        context.fillRect(0, 0, width, height)
      }
      for (const layer of scene.falls) drawFall(context, scene, layer, seeds, seconds)
      for (const drop of drops) drawDrop(context, scene, drop)
      if (flash > 0) {
        context.fillStyle = cssColour([0.82, 0.86, 1], flash * 0.2)
        context.fillRect(0, 0, width, height)
      }
    },
    dispose() {
      scene = null
    },
  }
}

export { createCanvasRenderer }
