import type { DeckState } from "@/components/ui/vinyl-scrubber-runner"
import { createThreeStage, supportsThreeStage } from "@/lib/three-stage"

/** What the turntable shows: the position and length in seconds, and whether the record turns on its own. */
type DeckInput = { time: number; duration: number; playing: boolean }

type VinylStage = {
  update: (input: DeckInput) => void
  label: (title: string | undefined, subtitle: string | undefined) => void
  dispose: () => void
}

const labelPixels = 512
const speedMark = "33⅓ RPM"

const epochNow = () => performance.timeOrigin + performance.now()

function fitFont(context: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string) {
  let fitted = size
  context.font = `${String(weight)} ${String(fitted)}px ${family}`
  while (context.measureText(text).width > labelPixels * 0.8 && fitted > size / 3) {
    fitted -= 2
    context.font = `${String(weight)} ${String(fitted)}px ${family}`
  }
}

function drawLabel(title: string, subtitle: string, family: string) {
  const canvas = document.createElement("canvas")
  canvas.width = labelPixels
  canvas.height = labelPixels
  const context = canvas.getContext("2d")
  if (!context) return canvas
  const center = labelPixels / 2
  context.translate(0, labelPixels)
  context.scale(1, -1)
  const fill = context.createRadialGradient(center * 0.8, center * 0.7, 5, center, center, center)
  fill.addColorStop(0, "#ff3b22")
  fill.addColorStop(0.7, "#d91f10")
  fill.addColorStop(1, "#9e1206")
  context.fillStyle = fill
  context.beginPath()
  context.arc(center, center, center, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = "rgb(255 220 200 / 0.55)"
  context.lineWidth = 2
  context.beginPath()
  context.arc(center, center, center * 0.92, 0, Math.PI * 2)
  context.stroke()
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "#fff6ee"
  if (title) {
    fitFont(context, title.toUpperCase(), 800, 60, family)
    context.fillText(title.toUpperCase(), center, center * 0.55)
  }
  context.fillStyle = "#ffd8cb"
  if (subtitle) {
    fitFont(context, subtitle.toUpperCase(), 600, 27, family)
    context.fillText(subtitle.toUpperCase(), center, center * 1.38)
  }
  context.font = `600 15px ${family}`
  context.fillText(speedMark, center, center * 1.62)
  context.fillStyle = "rgb(0 0 0 / 0.35)"
  context.beginPath()
  context.arc(center, center, 15, 0, Math.PI * 2)
  context.fill()
  return canvas
}

async function fontsFor(family: string) {
  const fonts = typeof document.fonts === "object" ? document.fonts : null
  if (!fonts) return
  await Promise.all([fonts.load(`800 60px ${family}`), fonts.load(`600 27px ${family}`)]).catch(() => [])
  await fonts.ready
}

/**
 * The photographic turntable over the drawn one in `host`: a WebGL scene drawn in a worker where the browser can (an
 * OffscreenCanvas), on the page otherwise, loaded after the controls paint. `host` gets `data-renderer="webgl"` once
 * the first frame is drawn, and loses it when WebGL fails or its context is lost, so the drawing shows again.
 */
function createVinylStage(host: HTMLElement): VinylStage {
  const family = getComputedStyle(host).fontFamily || "sans-serif"
  let input: DeckInput = { time: 0, duration: 0, playing: false }
  let inputAt = epochNow()
  let labelText: { title: string; subtitle: string } | null = null
  let ended = false

  const stage = createThreeStage<DeckState>(host, {
    slot: "vinyl-canvas",
    worker: () =>
      new Worker(new URL("./vinyl-scrubber-worker.js", import.meta.url), {
        type: "module",
      }),
    runner: () => import("@/components/ui/vinyl-scrubber-runner").then((module) => module.createVinylRunner),
    state: ({ inView, reducedMotion }) => ({
      time: input.time,
      at: inputAt,
      duration: input.duration,
      moving: input.playing && inView && !reducedMotion,
    }),
  })

  return {
    update(next) {
      input = next
      inputAt = epochNow()
      stage.refresh()
    },
    label(title = "", subtitle = "") {
      if (title === labelText?.title && subtitle === labelText.subtitle) return
      labelText = { title, subtitle }
      void fontsFor(family).then(() => {
        if (ended || labelText?.title !== title || labelText.subtitle !== subtitle) return
        stage.asset("label", drawLabel(title, subtitle, family))
      })
    },
    dispose() {
      ended = true
      stage.dispose()
    },
  }
}

export { createVinylStage, supportsThreeStage as supportsVinylStage }
export type { DeckInput, VinylStage }
