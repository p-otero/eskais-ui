/** A point on the photo, each value a fraction of its width or height from its top left corner. */
type ModelScanPoint = { x: number; y: number }

/** Points as an engine sends them: interleaved x, y pairs, or objects. */
type ModelScanPointList = Float32Array | readonly number[] | readonly ModelScanPoint[]

/**
 * One detector's points, like the face or the body, which light up on their own. `aspect` is the width over the
 * height of the frame the points are fractions of, when that isn't the photo's: the photo is taken as drawn inside
 * it with `object-fit: contain`, centred, as detectors that pad their input to a fixed shape report.
 */
type ModelScanPointGroup = { source: string; points: ModelScanPointList; aspect?: number }

/** One list of points, or groups of them; a later group with the same `source` replaces the earlier one. */
type ModelScanPoints = ModelScanPointList | readonly ModelScanPointGroup[]

/** A group ready to draw: its points as interleaved x, y fractions of the photo. */
type ModelScanDrawnGroup = { source: string; coords: Float32Array }

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

/**
 * Points in fractions of the photo, grouped by source in the order the sources first arrived. Points from a frame of
 * another `aspect` are moved onto the photo; points off the photo are dropped.
 */
function pointGroups(points: ModelScanPoints | undefined, ratio: number): ModelScanDrawnGroup[] {
  if (!points || points.length === 0) return []
  const groups = isGroupList(points) ? points : [{ source: "points", points }]
  const bySource = new Map<string, ModelScanPointGroup>()
  for (const group of groups) bySource.set(group.source, group)
  return [...bySource.values()].map((group) => {
    const coords = interleaved(group.points)
    const aspect = group.aspect
    if (!aspect || Math.abs(aspect / ratio - 1) < 0.01) return { source: group.source, coords }
    // The photo's share of the frame along the axis it doesn't fill, and the band before it.
    const wide = ratio > aspect
    const share = wide ? aspect / ratio : ratio / aspect
    const offset = (1 - share) / 2
    const mapped: number[] = []
    for (let i = 0; i + 1 < coords.length; i += 2) {
      const x = wide ? (coords[i] ?? 0) : ((coords[i] ?? 0) - offset) / share
      const y = wide ? ((coords[i + 1] ?? 0) - offset) / share : (coords[i + 1] ?? 0)
      if (x < 0 || x > 1 || y < 0 || y > 1) continue
      mapped.push(x, y)
    }
    return { source: group.source, coords: Float32Array.from(mapped) }
  })
}

export { pointGroups }
export type { ModelScanDrawnGroup, ModelScanPoint, ModelScanPointGroup, ModelScanPointList, ModelScanPoints }
