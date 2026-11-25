import type { ReactNode } from "react"

import { isOnPhoto, type ModelScanDrawnGroup } from "@/components/ui/model-scan-points"
import { cssVars } from "@/lib/utils"

/* oxlint-disable shadcn/no-arbitrary-values -- the mesh draws in from each line's and point's place in its group */
const groupClassName =
  "[--model-scan-point:var(--info)] drop-shadow-[0_0_3px_var(--model-scan-point)] data-[order=1]:[--model-scan-point:var(--violet)] data-[order=2]:[--model-scan-point:var(--success)]"
const lineClassName =
  "fill-none stroke-(--model-scan-point) stroke-[2.6] [stroke-linecap:round] [stroke-dasharray:1] [stroke-dashoffset:0] [stroke-opacity:0.85] transition-[stroke-dashoffset] delay-[calc(min(var(--model-scan-point-index)*22ms,700ms)+160ms)] duration-dialog ease-standard starting:[stroke-dashoffset:1]"
const pointClassName =
  "origin-center fill-(--model-scan-point) stroke-background stroke-2 transition-[scale,opacity] delay-[min(calc(var(--model-scan-point-index)*8ms),400ms)] duration-micro ease-standard [transform-box:fill-box] starting:scale-0 starting:opacity-0"
/* oxlint-enable shadcn/no-arbitrary-values */

const tenth = (value: number) => Math.round(value * 10) / 10

const order = (index: number) => cssVars({ "--model-scan-point-index": String(index) })

function LandmarkGroup({ group, index, width }: { group: ModelScanDrawnGroup; index: number; width: number }) {
  const x = (i: number) => tenth((group.coords[i * 2] ?? -1) * width)
  const y = (i: number) => tenth((group.coords[i * 2 + 1] ?? -1) * 1000)
  const onPhoto = (i: number) => isOnPhoto(group.coords[i * 2] ?? -1, group.coords[i * 2 + 1] ?? -1)
  const lines: ReactNode[] = []
  const joined = new Set<number>()
  for (const [a, b] of group.edges ?? []) {
    joined.add(a)
    joined.add(b)
    if (!onPhoto(a) || !onPhoto(b)) continue
    lines.push(
      <line
        key={`${String(a)}-${String(b)}`}
        x1={x(a)}
        y1={y(a)}
        x2={x(b)}
        y2={y(b)}
        pathLength={1}
        className={lineClassName}
        style={order(lines.length)}
      />,
    )
  }
  const dots: ReactNode[] = []
  for (let i = 0; i * 2 + 1 < group.coords.length; i += 1) {
    if (!onPhoto(i) || (group.edges && !joined.has(i))) continue
    dots.push(
      <circle
        key={i}
        cx={x(i)}
        cy={y(i)}
        r={group.source === "face" ? 3.2 : 5}
        className={pointClassName}
        style={order(dots.length)}
      />,
    )
  }
  return (
    <g data-source={group.source} data-order={index % 3} data-count={group.onPhoto} className={groupClassName}>
      {lines}
      {dots}
    </g>
  )
}

/** The engine's points over the photo's box, `ratio` wide for 1 tall: decorative, inside the hidden points layer. */
function ModelScanLandmarks({ groups, ratio }: { groups: readonly ModelScanDrawnGroup[]; ratio: number }) {
  const width = ratio * 1000
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- the landmark mesh, drawn from the engine's points
    <svg
      aria-hidden
      viewBox={`0 0 ${String(width)} 1000`}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
    >
      {groups.map((group, index) => (
        <LandmarkGroup key={group.source} group={group} index={index} width={width} />
      ))}
    </svg>
  )
}

export { ModelScanLandmarks }
