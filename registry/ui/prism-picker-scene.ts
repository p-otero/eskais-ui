// Paints the light: the white beam, the glass, the dispersed fan and the picked ray, additively. Thin lines go to
// the canvas at device resolution; the fan, a soft field of colour, to a buffer at half the CSS size; the bloom to
// one at a quarter, which the hook blurs. Rasterized on a CPU, the fan at full size was most of a frame.

import { colourAt, sceneTilt, type Reading } from "@/components/ui/prism-picker-dial"
import {
  luminousEfficiency,
  maxWavelength,
  minWavelength,
  prismRadius,
  prismVertices,
  trace,
  type Rgb,
  type Vec,
} from "@/components/ui/prism-picker-optics"

/** The stage's layout, shared with the dial's CSS: the prism's centre and the ring's radius, in CSS px. */
const stageCentre = { x: 0.5, y: 0.58 }
const ringRadius = (width: number, height: number) => Math.min(height * 0.31, width * 0.3)
const prismScale = 0.56

type Layout = { cx: number; cy: number; ring: number; scale: number; width: number; height: number }

function layoutFor(width: number, height: number): Layout {
  const ring = ringRadius(width, height)
  return {
    cx: width * stageCentre.x,
    cy: height * stageCentre.y,
    ring,
    scale: (ring * prismScale) / prismRadius,
    width,
    height,
  }
}

const tiltRadians = (sceneTilt * Math.PI) / 180
const tiltCos = Math.cos(tiltRadians)
const tiltSin = Math.sin(tiltRadians)
const turn = (v: Vec): Vec => ({ x: v.x * tiltCos - v.y * tiltSin, y: v.x * tiltSin + v.y * tiltCos })

const toScreen = (layout: Layout, p: Vec): Vec => {
  const turned = turn(p)
  return { x: layout.cx + turned.x * layout.scale, y: layout.cy + turned.y * layout.scale }
}

/** How far a ray from `p` along unit `d` travels before it leaves the stage. */
function toEdge(layout: Layout, p: Vec, d: Vec) {
  let t = Infinity
  if (d.x > 1e-9) t = Math.min(t, (layout.width - p.x) / d.x)
  if (d.x < -1e-9) t = Math.min(t, -p.x / d.x)
  if (d.y > 1e-9) t = Math.min(t, (layout.height - p.y) / d.y)
  if (d.y < -1e-9) t = Math.min(t, -p.y / d.y)
  return Number.isFinite(t) ? Math.max(0, t) : 0
}

const along = (p: Vec, d: Vec, t: number): Vec => ({ x: p.x + d.x * t, y: p.y + d.y * t })

const rgba = ([red, green, blue]: Rgb, alpha: number) =>
  `rgba(${String(Math.round(red * 255))},${String(Math.round(green * 255))},${String(Math.round(blue * 255))},${String(Math.max(0, Math.min(1, alpha)))})`

const towardWhite = ([red, green, blue]: Rgb, amount: number): Rgb => [
  red + (1 - red) * amount,
  green + (1 - green) * amount,
  blue + (1 - blue) * amount,
]

const fanStep = 4
const glowStride = 8
const reflectedStride = 4
// The ends of the spectrum are dim to the eye; a floor keeps them visible on the dial.
const fan = Array.from({ length: (maxWavelength - minWavelength) / fanStep + 1 }, (_, index) => {
  const wavelength = minWavelength + index * fanStep
  return {
    wavelength,
    colour: colourAt(wavelength).srgb,
    weight: 0.45 + 0.55 * Math.sqrt(luminousEfficiency(wavelength)),
  }
})

const white: Rgb = [1, 1, 1]

type Painter = { sharp: CanvasRenderingContext2D; glow: CanvasRenderingContext2D; layout: Layout }

function line(context: CanvasRenderingContext2D, from: Vec, to: Vec, width: number, style: string | CanvasGradient) {
  context.beginPath()
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.lineWidth = width
  context.strokeStyle = style
  context.stroke()
}

function fade(context: CanvasRenderingContext2D, from: Vec, to: Vec, colour: Rgb, start: number, end: number) {
  const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y)
  gradient.addColorStop(0, rgba(colour, start))
  gradient.addColorStop(0.55, rgba(colour, start * 0.5 + end * 0.5))
  gradient.addColorStop(1, rgba(colour, end))
  return gradient
}

function paintBeam({ sharp, glow, layout }: Painter, entry: Vec) {
  const direction = turn({ x: 1, y: 0 })
  const start = along(entry, direction, -toEdge(layout, entry, { x: -direction.x, y: -direction.y }))
  const normal = { x: -direction.y, y: direction.x }
  line(glow, start, entry, 7, "rgba(255,255,255,0.55)")
  line(sharp, start, entry, 3, "rgba(255,255,255,0.22)")
  // Faint chromatic fringes on either side of the core, as a lens would leave them.
  line(sharp, along(start, normal, 1.1), along(entry, normal, 1.1), 0.8, "rgba(255,90,70,0.32)")
  line(sharp, along(start, normal, -1.1), along(entry, normal, -1.1), 0.8, "rgba(80,140,255,0.36)")
  line(sharp, start, entry, 1.1, "rgba(255,255,255,0.95)")
}

function paintGlass({ sharp, glow, layout }: Painter, rotation: number, entry: Vec) {
  const [apexVertex, leftVertex, rightVertex] = prismVertices(rotation)
  const apex = toScreen(layout, apexVertex)
  const left = toScreen(layout, leftVertex)
  const right = toScreen(layout, rightVertex)
  const corners = [apex, left, right]
  const outline = (context: CanvasRenderingContext2D, inset = 0) => {
    const centre = { x: (apex.x + left.x + right.x) / 3, y: (apex.y + left.y + right.y) / 3 }
    context.beginPath()
    corners.forEach((corner, index) => {
      const distance = Math.hypot(corner.x - centre.x, corner.y - centre.y)
      const k = (distance - inset) / distance
      const point = { x: centre.x + (corner.x - centre.x) * k, y: centre.y + (corner.y - centre.y) * k }
      if (index === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.closePath()
  }
  const body = sharp.createLinearGradient(left.x, left.y, apex.x, apex.y)
  body.addColorStop(0, "rgba(255,255,255,0.09)")
  body.addColorStop(0.5, "rgba(170,190,255,0.035)")
  body.addColorStop(1, "rgba(255,255,255,0.06)")
  outline(sharp)
  sharp.fillStyle = body
  sharp.fill()
  outline(sharp, 3.5)
  sharp.lineWidth = 1
  sharp.strokeStyle = "rgba(255,255,255,0.07)"
  sharp.stroke()
  outline(sharp)
  sharp.lineWidth = 1
  sharp.strokeStyle = "rgba(255,255,255,0.3)"
  sharp.stroke()
  // The top face catches the light along its middle; the exit face carries a faint red and blue edge.
  const highlight = sharp.createLinearGradient(left.x, left.y, right.x, right.y)
  highlight.addColorStop(0, "rgba(255,255,255,0)")
  highlight.addColorStop(0.45, "rgba(255,255,255,0.75)")
  highlight.addColorStop(1, "rgba(255,255,255,0)")
  line(sharp, left, right, 1.4, highlight)
  const edge = { x: apex.x - right.x, y: apex.y - right.y }
  const length = Math.hypot(edge.x, edge.y)
  const outward = { x: edge.y / length, y: -edge.x / length }
  line(sharp, along(right, outward, -0.9), along(apex, outward, -0.9), 0.9, "rgba(255,80,90,0.28)")
  line(sharp, along(right, outward, 0.9), along(apex, outward, 0.9), 0.9, "rgba(90,150,255,0.28)")
  for (const corner of corners) {
    const flare = glow.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, 5)
    flare.addColorStop(0, "rgba(255,255,255,0.35)")
    flare.addColorStop(1, "rgba(255,255,255,0)")
    glow.fillStyle = flare
    glow.fillRect(corner.x - 5, corner.y - 5, 10, 10)
  }
  const spark = sharp.createRadialGradient(entry.x, entry.y, 0, entry.x, entry.y, 9)
  spark.addColorStop(0, "rgba(255,255,255,0.9)")
  spark.addColorStop(1, "rgba(255,255,255,0)")
  sharp.fillStyle = spark
  sharp.fillRect(entry.x - 9, entry.y - 9, 18, 18)
}

function paintDot({ sharp, glow }: Painter, at: Vec, colour: Rgb) {
  const halo = glow.createRadialGradient(at.x, at.y, 0, at.x, at.y, 26)
  halo.addColorStop(0, rgba(towardWhite(colour, 0.3), 1))
  halo.addColorStop(0.4, rgba(colour, 0.7))
  halo.addColorStop(1, rgba(colour, 0))
  glow.fillStyle = halo
  glow.fillRect(at.x - 26, at.y - 26, 52, 52)
  const core = sharp.createRadialGradient(at.x, at.y, 0, at.x, at.y, 11)
  core.addColorStop(0, "rgba(255,255,255,1)")
  core.addColorStop(0.28, rgba(towardWhite(colour, 0.5), 1))
  core.addColorStop(0.6, rgba(colour, 0.55))
  core.addColorStop(1, rgba(colour, 0))
  sharp.fillStyle = core
  sharp.fillRect(at.x - 11, at.y - 11, 22, 22)
}

/** The slit's mount: a ring and two jaws across the picked ray where it meets the stage's edge. */
function paintSlit({ sharp }: Painter, at: Vec, direction: Vec) {
  const normal = { x: -direction.y, y: direction.x }
  sharp.globalCompositeOperation = "source-over"
  for (const side of [1, -1]) {
    const from = along(at, normal, side * 15)
    line(sharp, from, along(from, normal, side * 9), 1, "rgba(255,255,255,0.42)")
  }
  sharp.beginPath()
  sharp.arc(at.x, at.y, 15, 0, Math.PI * 2)
  sharp.lineWidth = 1
  sharp.strokeStyle = "rgba(255,255,255,0.14)"
  sharp.stroke()
  sharp.globalCompositeOperation = "lighter"
}

type FanRay = {
  wavelength: number
  colour: Rgb
  weight: number
  traced: NonNullable<ReturnType<typeof trace>>
  exit: Vec
  direction: Vec
  far: Vec
}

// One fill for the whole fan: a conic gradient from the rays' common exit, a stop per ray in its colour, then one
// radial fade with distance. Eighty wedges, each its own gradient, were most of a frame on a CPU.
function paintFan(context: CanvasRenderingContext2D, rays: FanRay[], level: number) {
  const first = rays[0]
  const last = rays.at(-1)
  if (!first || !last || rays.length < 2) return
  const origin = {
    x: rays.reduce((sum, ray) => sum + ray.exit.x, 0) / rays.length,
    y: rays.reduce((sum, ray) => sum + ray.exit.y, 0) / rays.length,
  }
  const angleOf = (ray: FanRay) => Math.atan2(ray.far.y - origin.y, ray.far.x - origin.x)
  const sorted = rays.toSorted((a, b) => angleOf(a) - angleOf(b))
  const start = angleOf(sorted[0]!) - 0.05
  const conic = context.createConicGradient(start, origin.x, origin.y)
  for (const ray of sorted) {
    const turned = (((angleOf(ray) - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    conic.addColorStop(turned / (Math.PI * 2), rgba(ray.colour, ray.weight * level))
  }
  context.beginPath()
  context.moveTo(first.exit.x, first.exit.y)
  for (const ray of rays) context.lineTo(ray.exit.x, ray.exit.y)
  for (const ray of rays.toReversed()) context.lineTo(ray.far.x, ray.far.y)
  context.closePath()
  context.fillStyle = conic
  context.fill()
  // The shortest ray sets the fade, so the rays that leave through the top dim at the edge as the long ones do.
  const reach = Math.min(...rays.map((ray) => Math.hypot(ray.far.x - origin.x, ray.far.y - origin.y)))
  const falloff = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, reach)
  falloff.addColorStop(0, "rgba(0,0,0,1)")
  falloff.addColorStop(0.55, "rgba(0,0,0,0.58)")
  falloff.addColorStop(1, "rgba(0,0,0,0.16)")
  context.globalCompositeOperation = "destination-in"
  context.fillStyle = falloff
  context.fillRect(0, 0, context.canvas.width * 4, context.canvas.height * 4)
  context.globalCompositeOperation = "lighter"
}

// The rays inside the glass, from the entry to where each leaves: one thin triangle with their colours across it.
function paintSheen(context: CanvasRenderingContext2D, entry: Vec, rays: FanRay[]) {
  const first = rays[0]
  const last = rays.at(-1)
  if (!first || !last || rays.length < 2) return
  const across = context.createLinearGradient(first.exit.x, first.exit.y, last.exit.x, last.exit.y)
  rays.forEach((ray, index) => {
    if (index % 4 === 0 || ray === last)
      across.addColorStop(index / (rays.length - 1), rgba(ray.colour, 0.22 * ray.weight))
  })
  context.beginPath()
  context.moveTo(entry.x, entry.y)
  context.lineTo(first.exit.x, first.exit.y)
  context.lineTo(last.exit.x, last.exit.y)
  context.closePath()
  context.fillStyle = across
  context.fill()
}

/** The three contexts a scene paints into: thin lines at full resolution, the fan at half, the glow at a quarter. */
type SceneTargets = { sharp: CanvasRenderingContext2D; field: CanvasRenderingContext2D; glow: CanvasRenderingContext2D }

function paintScene({ sharp, field, glow }: SceneTargets, layout: Layout, reading: Reading) {
  const painter: Painter = { sharp, glow, layout }
  for (const context of [sharp, field, glow]) {
    context.globalCompositeOperation = "source-over"
    context.clearRect(0, 0, layout.width, layout.height)
    context.globalCompositeOperation = "lighter"
    context.lineCap = "round"
    context.lineJoin = "round"
  }
  const rays = fan.map((ray) => ({ ...ray, traced: trace(reading.rotation, ray.wavelength) }))
  const picked = trace(reading.rotation, reading.wavelength)
  const firstTrace = rays.find((ray) => ray.traced)?.traced ?? picked
  if (!firstTrace) return
  const entry = toScreen(layout, firstTrace.entry)
  paintBeam(painter, entry)

  const glint = turn(firstTrace.glint)
  const glintEnd = along(entry, glint, layout.ring * 0.6)
  line(sharp, entry, glintEnd, 1, fade(sharp, entry, glintEnd, white, 0.14, 0))

  const fanLevel = 0.85
  const screenRays = rays.map((ray): FanRay | undefined => {
    const { traced } = ray
    if (!traced) return undefined
    const exit = toScreen(layout, traced.exit)
    const direction = turn(traced.direction)
    return { ...ray, traced, exit, direction, far: along(exit, direction, toEdge(layout, exit, direction)) }
  })

  const lit = screenRays.filter((ray): ray is FanRay => ray !== undefined && !ray.traced.reflected)
  paintFan(field, lit, 0.5 * fanLevel)

  // The glow is blurred, so a wedge every few rays is enough.
  for (let index = 0; index + glowStride < screenRays.length; index += glowStride) {
    const ray = screenRays[index]
    const edge = screenRays[index + glowStride]
    if (!ray || !edge || ray.traced.reflected || edge.traced.reflected) continue
    const level = ((ray.weight + edge.weight) / 2) * fanLevel * 0.85
    glow.beginPath()
    glow.moveTo(ray.exit.x, ray.exit.y)
    glow.lineTo(edge.exit.x, edge.exit.y)
    glow.lineTo(edge.far.x, edge.far.y)
    glow.lineTo(ray.far.x, ray.far.y)
    glow.closePath()
    glow.fillStyle = fade(glow, ray.exit, ray.far, ray.colour, level, level * 0.16)
    glow.fill()
  }

  paintSheen(sharp, toScreen(layout, firstTrace.entry), lit)
  // Rays the far face reflects leave faintly through another face; a few of them draw that.
  screenRays.forEach((ray, index) => {
    if (!ray?.traced.reflected || index % reflectedStride !== 0) return
    const level = 0.035 * reflectedStride * ray.weight
    line(sharp, ray.exit, ray.far, 1, fade(sharp, ray.exit, ray.far, ray.colour, level, 0))
  })
  glow.beginPath()
  firstTrace.path.forEach((point, index) => {
    const screen = toScreen(layout, point)
    if (index === 0) glow.moveTo(screen.x, screen.y)
    else glow.lineTo(screen.x, screen.y)
  })
  glow.lineWidth = 6
  glow.strokeStyle = "rgba(255,255,255,0.28)"
  glow.stroke()

  paintGlass(painter, reading.rotation, entry)

  if (!picked) return
  const colour = reading.colour.srgb
  const path = picked.path.map((point) => toScreen(layout, point))
  const exit = path.at(-1) ?? entry
  const direction = turn(picked.direction)
  const end = along(exit, direction, toEdge(layout, exit, direction))
  const dot = along(end, direction, -16)
  sharp.beginPath()
  path.forEach((point, index) => (index === 0 ? sharp.moveTo(point.x, point.y) : sharp.lineTo(point.x, point.y)))
  sharp.lineWidth = 1.2
  sharp.strokeStyle = rgba(towardWhite(colour, 0.3), 0.6)
  sharp.stroke()
  line(glow, exit, dot, 6, rgba(colour, 0.95))
  line(sharp, exit, dot, 2.6, rgba(colour, 0.75))
  line(sharp, exit, dot, 1, rgba(towardWhite(colour, 0.6), 1))
  paintSlit(painter, dot, direction)
  paintDot(painter, dot, colour)
}

export { layoutFor, paintScene, ringRadius, stageCentre }
export type { Layout, SceneTargets }
