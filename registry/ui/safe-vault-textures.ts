import { seededRandom, type Context2D } from "@/lib/three-textures"

/** The side of each canvas texture in pixels, and how many the scene draws, for its texture memory. */
const safeTextureSizes = {
  peel: { width: 256, height: 256, count: 2 },
  peelRoughness: { width: 128, height: 128, count: 1 },
  dialFace: { width: 512, height: 512, count: 1 },
  radialBrush: { width: 256, height: 256, count: 1 },
  brushedLines: { width: 256, height: 256, count: 1 },
  knurl: { width: 256, height: 8, count: 1 },
  contactShadow: { width: 128, height: 128, count: 1 },
} as const

function orangePeel(seed: number) {
  return (context: Context2D, size: number) => {
    const random = seededRandom(seed)
    context.fillStyle = "#808080"
    context.fillRect(0, 0, size, size)
    for (let index = 0; index < size * size * 0.06; index++) {
      const x = random() * size
      const y = random() * size
      const radius = 1.5 + random() * 3.5
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, random() > 0.5 ? "rgb(255 255 255 / 0.22)" : "rgb(0 0 0 / 0.22)")
      gradient.addColorStop(1, "rgb(128 128 128 / 0)")
      context.fillStyle = gradient
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }
  }
}

const numberedEvery = (numbers: number) => (numbers > 60 ? 10 : 5)

/** A dial face engraved with `numbers` ticks, numbered like the drawn dial, counting up anticlockwise from the top. */
function dialFace(numbers: number) {
  return (context: Context2D, size: number) => engrave(context, size, numbers)
}

function engrave(context: Context2D, size: number, numbers: number) {
  const every = numberedEvery(numbers)
  const center = size / 2
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, size, size)
  context.translate(center, center)
  context.strokeStyle = "#141414"
  context.fillStyle = "#141414"
  for (let tick = 0; tick < numbers; tick++) {
    const major = tick % every === 0
    const middle = !major && tick % (every / 2) === 0
    context.save()
    context.rotate((-tick * Math.PI * 2) / numbers)
    context.lineWidth = major ? size * 0.008 : size * 0.0045
    context.beginPath()
    context.moveTo(0, -center * 0.97)
    context.lineTo(0, -center * (major ? 0.84 : middle ? 0.87 : 0.9))
    context.stroke()
    if (major) {
      context.font = `700 ${String(Math.round(size * 0.075))}px Arial, sans-serif`
      context.textAlign = "center"
      context.textBaseline = "middle"
      context.fillText(String(tick), 0, -center * 0.72)
    }
    context.restore()
  }
  context.lineWidth = size * 0.004
  context.beginPath()
  context.arc(0, 0, center * 0.6, 0, Math.PI * 2)
  context.stroke()
}

function radialBrush(context: Context2D, size: number) {
  const random = seededRandom(5)
  const center = size / 2
  context.fillStyle = "#7a7a7a"
  context.fillRect(0, 0, size, size)
  context.translate(center, center)
  for (let ring = 0; ring < 600; ring++) {
    const shade = String(Math.round(100 + random() * 50))
    context.strokeStyle = `rgb(${shade} ${shade} ${shade} / 0.5)`
    context.lineWidth = 0.6
    context.beginPath()
    context.arc(0, 0, random() * center, 0, Math.PI * 2)
    context.stroke()
  }
}

function brushedLines(context: Context2D, width: number, height: number) {
  const random = seededRandom(21)
  context.fillStyle = "#808080"
  context.fillRect(0, 0, width, height)
  for (let line = 0; line < height * 3; line++) {
    const shade = String(Math.round(90 + random() * 80))
    context.fillStyle = `rgb(${shade} ${shade} ${shade} / 0.35)`
    context.fillRect(random() * width * 0.3 - width * 0.3, random() * height, width * (0.4 + random()), 0.6 + random())
  }
}

function knurl(context: Context2D, width: number, height: number) {
  const ridges = 60
  const step = width / ridges
  for (let ridge = 0; ridge < ridges; ridge++) {
    const gradient = context.createLinearGradient(ridge * step, 0, (ridge + 1) * step, 0)
    gradient.addColorStop(0, "#202020")
    gradient.addColorStop(0.5, "#f0f0f0")
    gradient.addColorStop(1, "#202020")
    context.fillStyle = gradient
    context.fillRect(ridge * step, 0, step, height)
  }
}

function contactShadow(context: Context2D, size: number) {
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, "rgb(150 150 150)")
  gradient.addColorStop(0.55, "rgb(60 60 60)")
  gradient.addColorStop(1, "rgb(0 0 0)")
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
}

export { brushedLines, contactShadow, dialFace, knurl, orangePeel, radialBrush, safeTextureSizes }
