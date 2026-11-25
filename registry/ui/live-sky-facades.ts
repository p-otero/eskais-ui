import { projectPolygon, type ScreenPoint, type SkyCamera, type Vec3 } from "@/components/ui/live-sky-camera"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { skyColourAt, smoothstep, type SkyLight } from "@/components/ui/live-sky-light"
import { add, cssColour, luminance, mix, scale, type Rgb, type SkyPalette } from "@/components/ui/live-sky-palette"
import { toward } from "@/components/ui/live-sky-sky"
import { seededRandom, type Building, type Street } from "@/components/ui/live-sky-street"

type Context = CanvasRenderingContext2D
type Shade = { colour: Rgb; alpha?: number; composite?: GlobalCompositeOperation }
type Layer = { polygon: Vec3[]; shade: Shade }
type Band = { depth: number; layers: Layer[] }

type FacadeLight = {
  camera: SkyCamera
  light: SkyLight
  conditions: SkyConditions
  palette: SkyPalette
  haze: number
  daylight: number
  shadowLine: number
}

const hazeByRain = { none: 0, drizzle: 0.007, rain: 0.009, downpour: 0.022 }

function trace(context: Context, points: ScreenPoint[]) {
  context.beginPath()
  points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)))
  context.closePath()
}

const distanceFrom = (camera: SkyCamera, point: Vec3) =>
  Math.hypot(point.x - camera.eye.x, point.y - camera.eye.y, point.z - camera.eye.z)

const centreOf = (polygon: Vec3[]): Vec3 => {
  const sum = polygon.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y, z: total.z + point.z }), {
    x: 0,
    y: 0,
    z: 0,
  })
  return { x: sum.x / polygon.length, y: sum.y / polygon.length, z: sum.z / polygon.length }
}

function hazed(setting: FacadeLight, colour: Rgb, at: Vec3) {
  const amount = 1 - Math.exp(-distanceFrom(setting.camera, at) * setting.haze)
  return mix(colour, setting.light.haze, amount)
}

function wallLight(setting: FacadeLight, building: Building, height: number, normalX: number) {
  const { light, palette, conditions } = setting
  const facing = light.sunUp ? Math.max(0, normalX * light.sun.x) : 0
  const sunReach = smoothstep(setting.shadowLine - 2, setting.shadowLine + 2, height)
  const direct = facing * sunReach * (1 - conditions.cover * 0.85) * (1 - conditions.fog)
  const sunColour = mix(light.glow, palette.sun, smoothstep(0.05, 0.35, conditions.sun.altitude))
  const street = scale(palette["street-light"], (1 - setting.daylight) * 0.3 * Math.exp(-height / 6))
  const tint = mix([1, 1, 1], scale(light.horizon, 1 / Math.max(0.05, luminance(light.horizon))), 0.2)
  const skyFill = scale(tint, 0.04 + 0.95 * Math.pow(light.ambient, 0.6))
  return add(add(skyFill, scale(sunColour, direct * 0.9)), street)
}

const multiply = (a: Rgb, b: Rgb): Rgb => [a[0] * b[0], a[1] * b[1], a[2] * b[2]]

function quad(x: number, y0: number, y1: number, z0: number, z1: number): Vec3[] {
  return [
    { x, y: y0, z: z0 },
    { x, y: y0, z: z1 },
    { x, y: y1, z: z1 },
    { x, y: y1, z: z0 },
  ]
}

function glassColour(setting: FacadeLight, centre: Vec3, lit: boolean, warm: boolean, glow: number): Rgb {
  const { palette, light } = setting
  if (lit) return scale(warm ? palette["window-warm"] : palette["window-cool"], 0.38 + glow * 0.5)
  const view = toward(setting.camera.eye, centre)
  const reflected = skyColourAt(light, { x: -view.x, y: view.y, z: view.z })
  const grazing = 0.35 + 0.5 * Math.pow(1 - Math.abs(view.x), 3)
  const interior = scale(mix(palette["facade-concrete"], palette["city-glow"], 0.5), 0.12 + light.ambient * 0.1)
  return mix(interior, reflected, grazing)
}

function windowsOf(
  setting: FacadeLight,
  building: Building,
  x: number,
  y0: number,
  floor: number,
  random: () => number,
) {
  const layers: Layer[] = []
  const width = building.end - building.start
  const { palette, conditions } = setting
  const frame = mix(palette[building.material], palette["facade-gallery"], building.style === "gallery" ? 0.9 : 0.35)
  const litChance = (1 - setting.daylight) * (0.1 + building.seed * 0.22)
  const panes: [number, number, number, number][] = []
  if (building.style === "gallery") {
    for (let z = building.start + 0.3; z < building.end - 0.9; z += 0.95)
      panes.push([z, z + 0.82, y0 + 0.55, y0 + building.floorHeight - 0.3])
  } else {
    const bays = Math.max(1, Math.floor(width / building.bayWidth))
    const bay = width / bays
    const glazed = building.style === "ribbon" ? 0.82 : 0.48
    for (let index = 0; index < bays; index++) {
      const middle = building.start + bay * (index + 0.5)
      panes.push([
        middle - (bay * glazed) / 2,
        middle + (bay * glazed) / 2,
        y0 + 0.95,
        y0 + building.floorHeight - 0.55,
      ])
    }
  }
  for (const [z0, z1, bottom, top] of panes) {
    const lit = floor > 0 && random() < litChance
    const warm = random() < 0.8
    const glow = random()
    const pane = quad(x, bottom, top, z0, z1)
    const centre = centreOf(pane)
    layers.push({
      polygon: quad(x, bottom - 0.12, top + 0.1, z0 - 0.1, z1 + 0.1),
      shade: { colour: hazed(setting, multiply(frame, wallLight(setting, building, top, -building.side)), centre) },
    })
    layers.push({
      polygon: pane,
      shade: { colour: hazed(setting, glassColour(setting, centre, lit, warm, glow), centre) },
    })
    if (lit) {
      const curtain = random()
      const covered = curtain < 0.4 ? 0.3 : curtain < 0.7 ? 0.55 : 0
      if (covered > 0)
        layers.push({
          polygon: quad(x, top - (top - bottom) * covered, top, z0, z1),
          shade: { colour: [0.1, 0.07, 0.05], alpha: 0.45 },
        })
    }
    if (lit && (conditions.wetness > 0 || conditions.fog > 0.2)) {
      const bloom = Math.min(0.18, 0.05 + conditions.wetness * 0.06 + conditions.fog * 0.12)
      layers.push({
        polygon: quad(x, bottom - 0.25, top + 0.2, z0 - 0.18, z1 + 0.18),
        shade: { colour: palette["window-warm"], alpha: bloom, composite: "lighter" },
      })
    }
    if (conditions.wetness > 0.15) {
      const streak = 0.6 + random() * 1.8
      const middle = (z0 + z1) / 2 + (random() - 0.5) * (z1 - z0) * 0.6
      layers.push({
        polygon: quad(x, bottom - 0.12 - streak, bottom - 0.12, middle - 0.05, middle + 0.05),
        shade: { colour: [0, 0, 0], alpha: 0.2 * conditions.wetness },
      })
    }
  }
  return layers
}

function wallBands(
  setting: FacadeLight,
  street: Street,
  building: Building,
  neighbours: readonly [Building | undefined, Building | undefined],
): Band[] {
  const { camera, palette, conditions, light } = setting
  const random = seededRandom(Math.floor(building.seed * 1e9))
  const x = building.side * (street.halfWidth + building.setback)
  const floors = Math.floor((building.height - 1.2) / building.floorHeight)
  const albedo = scale(palette[building.material], (0.92 + building.seed * 0.14) * (1 - conditions.wetness * 0.38))
  const bands: Band[] = []
  for (let floor = 0; floor <= floors; floor++) {
    const y0 = floor * building.floorHeight
    const y1 = floor === floors ? building.height : y0 + building.floorHeight
    const polygon = quad(x, y0, y1, building.start, building.end)
    const centre = centreOf(polygon)
    const view = toward(camera.eye, centre)
    const fresnel = conditions.wetness * 0.55 * Math.pow(1 - Math.abs(view.x), 4)
    const weathered = scale(albedo, floor === floors ? 0.78 : 0.97 + random() * 0.06)
    const lit = multiply(weathered, wallLight(setting, building, (y0 + y1) / 2, -building.side))
    const wet = mix(lit, skyColourAt(light, { x: -view.x, y: view.y, z: view.z }), Math.min(0.6, fresnel))
    const layers: Layer[] = [{ polygon, shade: { colour: hazed(setting, wet, centre) } }]
    if (floor > 0)
      layers.push({
        polygon: quad(x, y0, y0 + 0.22, building.start, building.end),
        shade: { colour: hazed(setting, scale(wet, 1.12), centre) },
      })
    if (floor < floors) layers.push(...windowsOf(setting, building, x, y0, floor, random))
    bands.push({ depth: distanceFrom(camera, centre), layers })
  }
  for (const [edge, neighbour] of [
    [building.start, neighbours[0]],
    [building.end, neighbours[1]],
  ] as const) {
    const lower = neighbour ? neighbour.height : 0
    if (lower >= building.height - 0.5) continue
    const polygon: Vec3[] = [
      { x, y: lower, z: edge },
      { x: x + building.side * 14, y: lower, z: edge },
      { x: x + building.side * 14, y: building.height, z: edge },
      { x, y: building.height, z: edge },
    ]
    const centre = centreOf(polygon)
    const gable = multiply(
      scale(albedo, 0.86),
      wallLight(setting, building, building.height, edge === building.start ? -1 : 1),
    )
    bands.push({
      depth: distanceFrom(camera, centre) + 0.5,
      layers: [{ polygon, shade: { colour: hazed(setting, gable, centre) } }],
    })
  }
  return bands
}

function shadowLineOf(light: SkyLight, street: Street) {
  if (!light.sunUp) return Number.POSITIVE_INFINITY
  const across = Math.abs(light.sun.x) / Math.max(0.05, Math.hypot(light.sun.x, light.sun.z))
  const tangent = light.sun.y / Math.max(0.02, Math.hypot(light.sun.x, light.sun.z))
  return 24 - (2 * street.halfWidth * tangent) / Math.max(0.1, across)
}

/** Paints both rows of buildings in perspective, farthest first: wet walls, lit windows at night, haze with distance. */
function paintFacades(
  context: Context,
  camera: SkyCamera,
  street: Street,
  light: SkyLight,
  conditions: SkyConditions,
  palette: SkyPalette,
) {
  const setting: FacadeLight = {
    camera,
    light,
    conditions,
    palette,
    haze: conditions.fog * 0.045 + hazeByRain[conditions.rainKind] + conditions.snowRate * 0.01 + 0.0015,
    daylight: smoothstep(0.03, 0.2, light.ambient),
    shadowLine: shadowLineOf(light, street),
  }
  const bands: Band[] = []
  for (const side of [-1, 1] as const) {
    const row = street.buildings.filter((building) => building.side === side)
    row.forEach((building, index) =>
      bands.push(...wallBands(setting, street, building, [row[index - 1], row[index + 1]])),
    )
  }
  bands.sort((a, b) => b.depth - a.depth)
  for (const band of bands) {
    for (const { polygon, shade } of band.layers) {
      const points = projectPolygon(camera, polygon)
      if (points.length < 3) continue
      trace(context, points)
      context.globalCompositeOperation = shade.composite ?? "source-over"
      context.fillStyle = cssColour(shade.colour, shade.alpha ?? 1)
      context.fill()
    }
  }
  context.globalCompositeOperation = "source-over"
}

export { paintFacades }
