import type { SkyConditions } from "@/components/ui/live-sky-conditions"

/** A drop on the glass in CSS pixels; a splash is the brief crown of a drop landing. */
type GlassDrop = {
  x: number
  y: number
  radius: number
  /** Downward speed while running, in px/s; 0 for a bead that holds. */
  speed: number
  /** Seconds left before a running drop catches and pauses. */
  grip: number
  alpha: number
  splash: number
}

type GlassRain = {
  /** New drops per second per 100,000 px² of glass. */
  rate: number
  minRadius: number
  maxRadius: number
  /** A drop at least this big runs down the glass. */
  runRadius: number
  splashes: boolean
}

const glassRainByKind = {
  none: null,
  drizzle: { rate: 26, minRadius: 0.8, maxRadius: 2.2, runRadius: 6, splashes: false },
  rain: { rate: 12, minRadius: 1.6, maxRadius: 4.4, runRadius: 4.6, splashes: true },
  downpour: { rate: 22, minRadius: 2.2, maxRadius: 6.5, runRadius: 4.2, splashes: true },
} satisfies Record<SkyConditions["rainKind"], GlassRain | null>

const splashSeconds = 0.22
const evaporatePerSecond = { raining: 0.03, dry: 0.08 }
const trailEveryPx = 14

type Glass = {
  drops: GlassDrop[]
  step: (seconds: number) => void
  setRain: (conditions: SkyConditions, width: number, height: number, budget: number) => void
  clear: () => void
}

function absorb(into: GlassDrop, from: GlassDrop) {
  into.radius = Math.min(14, Math.sqrt(into.radius ** 2 + from.radius ** 2))
  from.alpha = 0
}

/** Drops landing on a pane of glass, growing as they merge and running down once heavy enough. Positions are in CSS px. */
function createGlass(random: () => number = Math.random): Glass {
  let drops: GlassDrop[] = []
  let rain: GlassRain | null = null
  let runRadius = glassRainByKind.rain.runRadius
  let width = 0
  let height = 0
  let capacity = 0
  let owed = 0
  const trails = new WeakMap<GlassDrop, number>()

  const land = () => {
    if (!rain) return
    const radius = rain.minRadius + (rain.maxRadius - rain.minRadius) * random() ** 2.2
    const drop: GlassDrop = {
      x: random() * width,
      y: random() * height,
      radius,
      speed: 0,
      grip: 0,
      alpha: 0.9,
      splash: 0,
    }
    const hit = drops.find(
      (other) =>
        other.splash === 0 && other.alpha > 0 && Math.hypot(other.x - drop.x, other.y - drop.y) < other.radius + radius,
    )
    if (hit) absorb(hit, drop)
    else drops.push(drop)
    if (rain.splashes && random() < 0.6) drops.push({ ...drop, radius: radius * 2.6, splash: splashSeconds })
  }

  const run = (drop: GlassDrop, seconds: number) => {
    if (drop.radius < runRadius) {
      drop.speed = 0
      return
    }
    if (drop.grip > 0) {
      drop.grip -= seconds
      if (drop.grip <= 0) drop.speed = 40 + drop.radius * 14 * random()
      return
    }
    drop.speed = Math.min(220, drop.speed + 260 * seconds)
    const moved = drop.speed * seconds
    drop.y += moved
    drop.x += (random() - 0.5) * moved * 0.25
    const travelled = (trails.get(drop) ?? 0) + moved
    trails.set(drop, travelled % trailEveryPx)
    if (travelled >= trailEveryPx) {
      drops.push({
        x: drop.x,
        y: drop.y - drop.radius * 1.4,
        radius: drop.radius * 0.34,
        speed: 0,
        grip: 0,
        alpha: 0.85,
        splash: 0,
      })
      drop.radius *= 0.985
    }
    for (const other of drops) {
      if (other === drop || other.splash > 0 || other.alpha === 0) continue
      if (Math.hypot(other.x - drop.x, other.y - drop.y) < other.radius + drop.radius * 0.8) absorb(drop, other)
    }
    if (random() < seconds * 1.2) {
      drop.grip = 0.15 + random() * 0.5
      drop.speed = 0
    }
  }

  return {
    get drops() {
      return drops
    },
    setRain(conditions, nextWidth, nextHeight, budget) {
      rain = glassRainByKind[conditions.rainKind]
      runRadius = rain?.runRadius ?? runRadius
      width = nextWidth
      height = nextHeight
      capacity = Math.round(260 * budget)
    },
    clear() {
      drops = []
    },
    step(seconds) {
      if (rain) {
        owed += ((rain.rate * width * height) / 100_000) * seconds
        while (owed >= 1 && drops.length < capacity) {
          land()
          owed -= 1
        }
        if (drops.length >= capacity) owed = 0
      }
      for (const drop of drops) {
        if (drop.splash > 0) {
          drop.splash -= seconds
          drop.alpha = Math.max(0, drop.splash / splashSeconds) * 0.7
          continue
        }
        run(drop, seconds)
        if (drop.speed === 0)
          drop.alpha -=
            (rain ? evaporatePerSecond.raining : evaporatePerSecond.dry) * seconds * (3 / Math.max(1, drop.radius))
      }
      drops = drops.filter((drop) => drop.alpha > 0.01 && drop.y - drop.radius < height + 4)
    },
  }
}

export { createGlass }
export type { Glass, GlassDrop }
