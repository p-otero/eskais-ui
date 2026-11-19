/** A point on the photo, each value a fraction of its width or height from its top left corner. */
type ModelScanPoint = { x: number; y: number }

/** Points as an engine sends them: interleaved x, y pairs, or objects. */
type ModelScanPointList = Float32Array | readonly number[] | readonly ModelScanPoint[]

/**
 * One detector's points, like the face or the body, which light up on their own. They are fractions of the original
 * photo; `aspect` is the photo's own width over its height, which lays them out before the photo has loaded.
 */
type ModelScanPointGroup = { source: string; points: ModelScanPointList; aspect?: number }

/** One list of points, or groups of them; a later group with the same `source` replaces the earlier one. */
type ModelScanPoints = ModelScanPointList | readonly ModelScanPointGroup[]

/**
 * A group ready to draw: every point as interleaved x, y fractions of the photo, kept as sent, and how many of them
 * fall on the photo. Detectors report every landmark, also the ones a crop cut off, past 0 or 1.
 */
type ModelScanDrawnGroup = { source: string; coords: Float32Array; onPhoto: number }

const isGroupList = (points: ModelScanPoints): points is readonly ModelScanPointGroup[] =>
  Array.isArray(points) && points.length > 0 && typeof points[0] === "object" && "source" in (points[0] as object)

function interleaved(list: ModelScanPointList) {
  if (ArrayBuffer.isView(list)) return list
  if (list.length > 0 && typeof list[0] === "number") return Float32Array.from(list as readonly number[])
  const coords = new Float32Array(list.length * 2)
  ;(list as readonly ModelScanPoint[]).forEach((point, i) => {
    coords[i * 2] = point.x
    coords[i * 2 + 1] = point.y
  })
  return coords
}

/** Whether a point lies on the photo; one past an edge names a landmark the photo doesn't show. */
const isOnPhoto = (x: number, y: number) => x >= 0 && x <= 1 && y >= 0 && y <= 1

/** Points grouped by source, in the order the sources first arrived. */
function pointGroups(points: ModelScanPoints | undefined): ModelScanDrawnGroup[] {
  if (!points || points.length === 0) return []
  const groups = isGroupList(points) ? points : [{ source: "points", points }]
  const bySource = new Map<string, ModelScanPointGroup>()
  for (const group of groups) bySource.set(group.source, group)
  return [...bySource.values()].map((group) => {
    const coords = interleaved(group.points)
    let onPhoto = 0
    for (let i = 0; i + 1 < coords.length; i += 2) if (isOnPhoto(coords[i] ?? -1, coords[i + 1] ?? -1)) onPhoto += 1
    return { source: group.source, coords, onPhoto }
  })
}

/** The photo's width over its height as the engine reported it, from the first group that has it. */
function pointsAspect(points: ModelScanPoints | undefined) {
  if (!points || !isGroupList(points)) return undefined
  return points.find((group) => group.aspect && Number.isFinite(group.aspect) && group.aspect > 0)?.aspect
}

export { isOnPhoto, pointGroups, pointsAspect }
export type { ModelScanDrawnGroup, ModelScanPoint, ModelScanPointGroup, ModelScanPointList, ModelScanPoints }
