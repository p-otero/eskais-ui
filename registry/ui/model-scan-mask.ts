import type { ModelScanDrawnGroup } from "@/components/ui/model-scan-points"

/**
 * An engine's person mask: 0–255 confidence that a pixel is the person, row-major from the top left, `width` ×
 * `height`, with its photo's aspect. `source` names the photo it was made from.
 */
type ModelScanMask = { source?: "face" | "body"; width: number; height: number; data: Uint8Array }

/** Where the person came from: the engine's mask, a hull around the body's landmarks, or neither yet. */
type ModelScanPersonSource = "mask" | "landmarks" | "none"

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** The mask's confidence (0 to 1) at a point given as fractions of the photo from its top left, bilinear. */
function sampleMask(mask: ModelScanMask, x: number, y: number) {
  const fx = Math.min(mask.width - 1, Math.max(0, x * mask.width - 0.5))
  const fy = Math.min(mask.height - 1, Math.max(0, y * mask.height - 0.5))
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(mask.width - 1, x0 + 1)
  const y1 = Math.min(mask.height - 1, y0 + 1)
  const at = (px: number, py: number) => (mask.data[py * mask.width + px] ?? 0) / 255
  const top = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * (fx - x0)
  const bottom = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * (fx - x0)
  return top + (bottom - top) * (fy - y0)
}

type Capsule = { ax: number; ay: number; bx: number; by: number; r: number }

// The 33 pose landmarks' limbs, each with a radius in shoulder widths: how wide a body is around its skeleton.
const limbs: readonly (readonly [number, number, number])[] = [
  [11, 13, 0.14],
  [12, 14, 0.14],
  [13, 15, 0.11],
  [14, 16, 0.11],
  [15, 19, 0.09],
  [16, 20, 0.09],
  [23, 25, 0.2],
  [24, 26, 0.2],
  [25, 27, 0.14],
  [26, 28, 0.14],
  [27, 31, 0.09],
  [28, 32, 0.09],
  [11, 23, 0.12],
  [12, 24, 0.12],
  [11, 12, 0.12],
  [23, 24, 0.16],
]

const segmentDistance = (px: number, py: number, { ax, ay, bx, by }: Capsule) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - dx * t, py - ay - dy * t)
}

/**
 * A rough silhouette from the 33 pose landmarks when no mask came: capsules around the limbs, the torso filled between
 * shoulders and hips, and the head as a disc over the nose. Coordinates where the photo is `ratio` wide and 1 tall.
 */
function landmarkHull(body: ModelScanDrawnGroup, ratio: number) {
  if (body.coords.length < 66) return null
  const point = (i: number) => ({
    x: (body.coords[i * 2] ?? Number.NaN) * ratio,
    y: body.coords[i * 2 + 1] ?? Number.NaN,
  })
  const known = (i: number) => Number.isFinite(point(i).x) && Number.isFinite(point(i).y)
  if (![11, 12, 23, 24].every(known)) return null
  const [ls, rs] = [point(11), point(12)]
  const shoulders = Math.hypot(ls.x - rs.x, ls.y - rs.y)
  if (shoulders === 0) return null
  const capsules: Capsule[] = limbs
    .filter(([a, b]) => known(a) && known(b))
    .map(([a, b, r]) => ({ ax: point(a).x, ay: point(a).y, bx: point(b).x, by: point(b).y, r: r * shoulders }))
  const torso = [point(11), point(12), point(24), point(23)]
  const nose = known(0) ? point(0) : { x: (ls.x + rs.x) / 2, y: ls.y - shoulders * 0.6 }
  const neck = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
  capsules.push({ ax: neck.x, ay: neck.y, bx: nose.x, by: nose.y, r: shoulders * 0.13 })
  const ears = known(7) && known(8) ? Math.hypot(point(7).x - point(8).x, point(7).y - point(8).y) : 0
  const head = { x: nose.x, y: nose.y - shoulders * 0.08, r: Math.max(ears * 0.8, shoulders * 0.32) }
  const inTorso = (x: number, y: number) => {
    let inside = false
    for (let i = 0, j = torso.length - 1; i < torso.length; j = i, i += 1) {
      const [p, q] = [torso[i], torso[j]]
      if (!p || !q) continue
      if (p.y > y !== q.y > y && x < ((q.x - p.x) * (y - p.y)) / (q.y - p.y) + p.x) inside = !inside
    }
    return inside
  }
  const feather = shoulders * 0.04
  return (x: number, y: number) => {
    if (inTorso(x, y)) return 1
    let best = Math.hypot(x - head.x, y - head.y) - head.r
    for (const capsule of capsules) best = Math.min(best, segmentDistance(x, y, capsule) - capsule.r)
    return smoothstep(feather, -feather, best)
  }
}

// The hull's own mask, on the long side: enough for the cloud's grid and a soft edge in 2D.
const hullSize = 128

/** The hull as a mask of the photo's aspect, so it dims the photo and picks the cloud's cells as a mask would. */
function hullMask(body: ModelScanDrawnGroup, ratio: number): ModelScanMask | null {
  const hull = landmarkHull(body, ratio)
  if (!hull) return null
  const width = Math.max(1, Math.round(ratio >= 1 ? hullSize : hullSize * ratio))
  const height = Math.max(1, Math.round(ratio >= 1 ? hullSize / ratio : hullSize))
  const data = new Uint8Array(width * height)
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      data[row * width + column] = Math.round(hull(((column + 0.5) / width) * ratio, (row + 0.5) / height) * 255)
    }
  }
  return { source: "body", width, height, data }
}

/**
 * The person in the photo: the engine's body mask, or any mask of the photo's aspect (a face mask over the face
 * photo), else a hull around the body's 33 pose landmarks, else none.
 */
function personMask({
  masks,
  groups,
  ratio,
}: {
  masks?: readonly ModelScanMask[]
  groups: readonly ModelScanDrawnGroup[]
  ratio: number
}): { mask: ModelScanMask | null; from: ModelScanPersonSource } {
  const usable = masks?.filter(
    (mask) => mask.width > 0 && mask.height > 0 && mask.data.length >= mask.width * mask.height,
  )
  const mask =
    usable?.find((item) => item.source === "body") ??
    usable?.find((item) => Math.abs(item.width / item.height / ratio - 1) < 0.02)
  if (mask) return { mask, from: "mask" }
  const body = groups.find((group) => group.source === "body")
  const hull = body ? hullMask(body, ratio) : null
  return hull ? { mask: hull, from: "landmarks" } : { mask: null, from: "none" }
}

/**
 * How much each cell of a `columns` × `rows` grid over the photo is the person, 0 to 1, rows from the bottom as the
 * cloud lays them out; every cell without a mask.
 */
function personCells(columns: number, rows: number, mask: ModelScanMask | null) {
  const cells = new Float32Array(columns * rows)
  for (let row = 0; row < rows; row += 1) {
    const y = 1 - (row + 0.5) / rows
    for (let column = 0; column < columns; column += 1) {
      cells[row * columns + column] = mask ? sampleMask(mask, (column + 0.5) / columns, y) : 1
    }
  }
  return cells
}

/**
 * The mask as two CSS `mask-image` values, the person and the background around them, or null without a 2D canvas
 * (on the server, in a test).
 */
function maskImages(mask: ModelScanMask | null) {
  if (!mask || typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = mask.width
  canvas.height = mask.height
  const context = canvas.getContext("2d")
  if (!context || typeof context.createImageData !== "function") return null
  const draw = (invert: boolean) => {
    const image = context.createImageData(mask.width, mask.height)
    for (let i = 0; i < mask.width * mask.height; i += 1) {
      const value = mask.data[i] ?? 0
      image.data[i * 4 + 3] = invert ? 255 - value : value
    }
    context.putImageData(image, 0, 0)
    return `url(${canvas.toDataURL()})`
  }
  return { person: draw(false), background: draw(true) }
}

export { landmarkHull, maskImages, personCells, personMask, sampleMask }
export type { ModelScanMask, ModelScanPersonSource }
