// Paints the light: the white beam, the glass, the dispersed fan and the picked ray, additively on two canvases, a
// sharp one at device resolution and a glow one at half the CSS size that the stage blurs with a CSS filter.

import { sceneTilt, type Reading } from "./prism-dial"
import {
  colourAtHue,
  hueAtWavelength,
  luminousEfficiency,
  maxWavelength,
  minWavelength,
  prismRadius,
  prismVertices,
  slitDirection,
  trace,
  type Rgb,
  type Vec,
} from "./prism-optics"

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
// The ends of the spectrum are dim to the eye; a floor keeps them visible on the dial.
const fan = Array.from({ length: (maxWavelength - minWavelength) / fanStep + 1 }, (_, index) => {
  const wavelength = minWavelength + index * fanStep
  return {
    wavelength,
    colour: colourAtHue(hueAtWavelength(wavelength)).srgb,
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
  const corners = prismVertices(rotation).map((vertex) => toScreen(layout, vertex))
  const [apex, left, right] = corners as [Vec, Vec, Vec]
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

function paintScene(sharp: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, layout: Layout, reading: Reading) {
  const painter: Painter = { sharp, glow, layout }
  for (const context of [sharp, glow]) {
    context.globalCompositeOperation = "source-over"
    context.clearRect(0, 0, layout.width, layout.height)
    context.globalCompositeOperation = "lighter"
    context.lineCap = "round"
    context.lineJoin = "round"
  }
  const rays = fan.map((ray) => ({ ...ray, traced: trace(reading.rotation, ray.wavelength) }))
  const picked = reading.wavelength === undefined ? undefined : trace(reading.rotation, reading.wavelength)
  const firstTrace = rays.find((ray) => ray.traced)?.traced ?? picked
  if (!firstTrace) return
  const entry = toScreen(layout, firstTrace.entry)
  paintBeam(painter, entry)

  const glint = turn(firstTrace.glint)
  const glintEnd = along(entry, glint, layout.ring * 0.6)
  line(sharp, entry, glintEnd, 1, fade(sharp, entry, glintEnd, white, 0.14, 0))

  const fanLevel = reading.wavelength === undefined ? 0.45 : 0.85
  const screenRays = rays.map((ray) => {
    if (!ray.traced) return undefined
    const exit = toScreen(layout, ray.traced.exit)
    const direction = turn(ray.traced.direction)
    return { ...ray, exit, direction, far: along(exit, direction, toEdge(layout, exit, direction)) }
  })

  for (let index = 0; index < screenRays.length - 1; index++) {
    const ray = screenRays[index]
    const next = screenRays[index + 1]
    if (!ray || !next || ray.traced?.reflected || next.traced?.reflected) continue
    const weight = ((ray.weight + next.weight) / 2) * fanLevel
    // The glow is blurred, so it takes one wedge for every few of the sharp fan's.
    const glowNext = screenRays[Math.min(screenRays.length - 1, index + glowStride)]
    const contexts: [CanvasRenderingContext2D, number, typeof next][] = [[sharp, 0.5, next]]
    if (index % glowStride === 0 && glowNext && !glowNext.traced?.reflected) contexts.push([glow, 0.85, glowNext])
    for (const [context, level, edge] of contexts) {
      context.beginPath()
      context.moveTo(ray.exit.x, ray.exit.y)
      context.lineTo(edge.exit.x, edge.exit.y)
      context.lineTo(edge.far.x, edge.far.y)
      context.lineTo(ray.far.x, ray.far.y)
      context.closePath()
      context.fillStyle = fade(context, ray.exit, ray.far, ray.colour, weight * level, weight * level * 0.16)
      context.fill()
    }
  }

  for (const ray of screenRays) {
    if (!ray?.traced) continue
    const path = ray.traced.path.map((point) => toScreen(layout, point))
    sharp.beginPath()
    path.forEach((point, index) => (index === 0 ? sharp.moveTo(point.x, point.y) : sharp.lineTo(point.x, point.y)))
    sharp.lineWidth = 1
    sharp.strokeStyle = rgba(ray.colour, (ray.traced.reflected ? 0.025 : 0.07) * ray.weight)
    sharp.stroke()
    if (ray.traced.reflected)
      line(sharp, ray.exit, ray.far, 1, fade(sharp, ray.exit, ray.far, ray.colour, 0.035 * ray.weight, 0))
  }
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

  const colour = reading.colour.srgb
  const slit = turn({ x: Math.cos((slitDirection * Math.PI) / 180), y: Math.sin((slitDirection * Math.PI) / 180) })
  if (picked) {
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
    return
  }
  // A purple has no ray of its own: the slit receives the two ends of the spectrum together.
  const exitPoint = toScreen(layout, firstTrace.exit)
  const end = along(exitPoint, slit, toEdge(layout, exitPoint, slit))
  const dot = along(end, slit, -16)
  const ends = [
    screenRays.find((ray) => ray && !ray.traced?.reflected),
    screenRays.findLast((ray) => ray && !ray.traced?.reflected),
  ]
  const mix = reading.mix ?? 0
  ends.forEach((ray, index) => {
    if (!ray) return
    const strength = index === 0 ? mix : 1 - mix
    const reach = along(ray.exit, ray.direction, toEdge(layout, ray.exit, ray.direction) * 0.55)
    line(glow, ray.exit, reach, 4, fade(glow, ray.exit, reach, ray.colour, 0.9 * strength + 0.15, 0))
    line(sharp, reach, dot, 1, fade(sharp, reach, dot, ray.colour, 0, 0.55 * strength + 0.1))
  })
  sharp.setLineDash([2, 5])
  line(sharp, exitPoint, dot, 1, rgba(colour, 0.6))
  sharp.setLineDash([])
  paintSlit(painter, dot, slit)
  paintDot(painter, dot, colour)
}

export { layoutFor, paintScene, ringRadius, stageCentre }
export type { Layout }
