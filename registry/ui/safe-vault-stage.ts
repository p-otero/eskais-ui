import type { VaultState } from "@/components/ui/safe-vault-scene"
import {
  dialRect,
  framingFor,
  planeMatrix,
  plaqueCorners,
  plaqueHeightFor,
  plaqueLayoutWidth,
  plaqueWidth,
  polygonArea,
  projection,
  visibleOpening,
  type StagePoint,
} from "@/components/ui/safe-vault-view"
import { lockedPose, motionDone, poseAt, type SafeVaultMotion } from "@/components/ui/safe-vault-timeline"
import { createThreeStage, supportsThreeStage } from "@/lib/three-stage"
import type { StageSize } from "@/lib/three-studio"

/** What the page tells the safe: its motion and how many numbers its dial carries. */
type VaultInput = { motion: SafeVaultMotion; numbers: number }

type SafeVaultStageParts = {
  /** The layer over the stage that holds the plaque, clipped to what the camera sees of the opening. */
  layer: HTMLElement
  onRenderer: (webgl: boolean) => void
}

type SafeVaultStage = {
  update: (input: VaultInput) => void
  dispose: () => void
}

const minPlaqueArea = 1600
const turnProperty = "--safe-dial-turn"

const epochNow = () => performance.timeOrigin + performance.now()

const pixels = (value: number) => `${value.toFixed(2)}px`
const polygon = (points: StagePoint[]) =>
  points.length < 3
    ? "inset(50%)"
    : `polygon(${points.map((point) => `${pixels(point.x)} ${pixels(point.y)}`).join(",")})`

function turnOfDrawnRotor(rotor: Element | null) {
  if (!(rotor instanceof HTMLElement)) return 0
  const turn = Number.parseFloat(rotor.style.getPropertyValue(turnProperty))
  return Number.isFinite(turn) ? turn : 0
}

/**
 * The 3D safe behind the dial in `host`, with the plaque in `parts.layer` mapped onto its back wall. The canvas draws
 * in a worker where it can; the plaque is placed on the page from the same camera and the same motion start, so the
 * two stay in step. Between motions nothing runs.
 */
function createSafeVaultStage(host: HTMLElement, parts: SafeVaultStageParts): SafeVaultStage {
  let input: VaultInput = {
    motion: { kind: "locked", since: 0 },
    numbers: 100,
  }
  let size: StageSize | null = null
  let layoutWidth = 0
  let plaqueHeight = 0
  let dialDegrees = 0
  let webgl = false
  let frame = 0
  let content: HTMLElement | null = null

  const state = ({ inView, reducedMotion }: { inView: boolean; reducedMotion: boolean }): VaultState => ({
    motion: input.motion,
    dialDegrees,
    numbers: input.numbers,
    plaqueHeight,
    moving: inView && !reducedMotion,
  })

  const plaque = () => parts.layer.querySelector<HTMLElement>('[data-slot="safe-vault-plaque"]')

  const clearPlaque = () => {
    parts.layer.style.clipPath = ""
    const element = plaque()
    if (!element) return
    element.style.transform = ""
    element.style.filter = ""
    element.style.visibility = ""
  }

  const place = (now: number) => {
    const element = plaque()
    if (!webgl || !size || !element || plaqueHeight === 0) return
    const stage = { width: size.width, height: size.height }
    const aspect = stage.width / stage.height
    const pose = poseAt(input.motion, now)
    const project = projection(framingFor(pose, aspect, stage.width), aspect)
    const corners = plaqueCorners(plaqueHeight).map(project)
    const points = corners.map((corner) => ({
      x: corner.x * stage.width,
      y: corner.y * stage.height,
    }))
    const boxHeight = (layoutWidth * plaqueHeight) / plaqueWidth
    const matrix =
      corners.every((corner) => corner.depth > 0) && polygonArea(points) >= minPlaqueArea
        ? planeMatrix(points, layoutWidth, boxHeight)
        : null
    element.style.visibility = matrix ? "" : "hidden"
    if (matrix) element.style.transform = `matrix3d(${matrix.map((value) => value.toFixed(9)).join(",")})`
    element.style.filter = pose.light < 1 ? `brightness(${(0.2 + 0.8 * pose.light).toFixed(3)})` : ""
    parts.layer.style.clipPath = polygon(visibleOpening(project, pose.doorDegrees, stage))
  }

  const animate = () => {
    cancelAnimationFrame(frame)
    const step = () => {
      const now = epochNow()
      place(now)
      if (!motionDone(input.motion, now)) frame = requestAnimationFrame(step)
    }
    step()
  }

  const stage = createThreeStage<VaultState>(host, {
    slot: "safe-vault-canvas",
    worker: () =>
      new Worker(new URL("./safe-vault-worker.js", import.meta.url), {
        type: "module",
      }),
    runner: () => import("@/components/ui/safe-vault-runner").then((module) => module.createSafeVaultRunner),
    state,
    onSize(next) {
      size = next
      const aspect = next.width / next.height
      const closed = projection(framingFor(lockedPose, aspect, next.width), aspect)
      const dial = dialRect(closed, next)
      const side = Math.max(dial.width, dial.height)
      host.style.setProperty("--safe-vault-dial-left", pixels(dial.left + dial.width / 2 - side / 2))
      host.style.setProperty("--safe-vault-dial-top", pixels(dial.top + dial.height / 2 - side / 2))
      host.style.setProperty("--safe-vault-dial-size", pixels(side))
      parts.layer.style.setProperty("--safe-vault-stage-height", pixels(next.height))
      layoutWidth = plaqueLayoutWidth(next)
      parts.layer.style.setProperty("--safe-vault-plaque-width", pixels(layoutWidth))
      measure()
    },
    onRenderer(next) {
      webgl = next
      parts.onRenderer(next)
      if (next) animate()
      else clearPlaque()
    },
  })

  const setPlaqueHeight = (heightCm: number) => {
    if (heightCm === plaqueHeight) return
    plaqueHeight = heightCm
    parts.layer.style.setProperty("--safe-vault-plaque-height", pixels((layoutWidth * heightCm) / plaqueWidth))
    stage.refresh()
    animate()
  }

  const contentSize = new ResizeObserver(([entry]) => {
    const contentHeight = entry?.borderBoxSize[0]?.blockSize ?? 0
    setPlaqueHeight(layoutWidth > 0 ? plaqueHeightFor(contentHeight, layoutWidth / plaqueWidth) : plaqueHeight)
  })

  function measure() {
    const next = parts.layer.querySelector<HTMLElement>('[data-slot="safe-vault-plaque-content"]')
    if (next !== content) {
      if (content) contentSize.unobserve(content)
      content = next
      if (content) contentSize.observe(content)
      else setPlaqueHeight(0)
    } else if (content) {
      contentSize.unobserve(content)
      contentSize.observe(content)
    }
  }

  const rotor = host.querySelector('[data-slot="safe-dial-rotor"]')
  const turns = new MutationObserver(() => {
    const next = turnOfDrawnRotor(rotor)
    if (next === dialDegrees) return
    dialDegrees = next
    stage.refresh()
  })
  if (rotor) turns.observe(rotor, { attributes: true, attributeFilter: ["style"] })

  return {
    update(next) {
      input = next
      measure()
      stage.refresh()
      animate()
    },
    dispose() {
      cancelAnimationFrame(frame)
      turns.disconnect()
      contentSize.disconnect()
      stage.dispose()
      clearPlaque()
    },
  }
}

export { createSafeVaultStage, supportsThreeStage as supportsSafeVaultStage }
export type { SafeVaultStage, VaultInput }
