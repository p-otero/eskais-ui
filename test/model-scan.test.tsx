import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { ModelScan, type ModelScanProps } from "@/components/ui/model-scan"
import { pointGroups } from "@/components/ui/model-scan-points"
import { modelScan } from "@/components/ui/model-scan-primitive"
import { readAnnouncements } from "@/lib/test-utils"

import { axeViolations } from "./axe"
import {
  figureTargetNames,
  idleEngine,
  reduceEngine,
  runFakeEngine,
  toModelScanProps,
  type EngineEvent,
} from "./fixtures/model/fake-engine"
import { fakeScene } from "./fixtures/model/fake-scene"

const announced = vi.hoisted(() => [] as string[])

vi.mock("@ui-sdk/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ui-sdk/core")>()
  return {
    ...actual,
    announce: (text: string, options?: Parameters<typeof actual.announce>[1]) => {
      announced.push(`${options?.priority ?? "polite"}: ${text}`)
      actual.announce(text, options)
    },
  }
})
vi.mock("@/components/ui/model-viewer-scene", () => import("./fixtures/model/fake-scene"))

const agent = createAgent()

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ getExtension: () => null })) as never
})

afterEach(() => {
  vi.useRealTimers()
  announced.length = 0
  fakeScene.renders = 0
})

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const markup = `<root><photo></photo><effect></effect><points></points></root>`

function outcome(call: () => unknown) {
  try {
    return call()
  } catch (error) {
    return (error as Error).message
  }
}

describe("primitive", () => {
  test("cancel works before ready, retry only after an error, and both say why otherwise", () => {
    const onCancel = vi.fn()
    const onRetry = vi.fn()
    for (const stage of ["photo", "detecting", "building", "refining", "ready", "error"] as const) {
      const view = mount(modelScan, { stage, onCancel, onRetry }, markup)
      try {
        const early = ["ready", "error"].includes(stage)
        expect(outcome(() => view.api.cancel())).toBe(
          early ? `Cancel works only in photo, detecting, building, refining (stage: ${stage}).` : true,
        )
        expect(outcome(() => view.api.retry())).toBe(
          stage === "error" || `Retry works only in error (stage: ${stage}).`,
        )
      } finally {
        view.unmount()
      }
    }
  })

  test("the effect and the points show only while detecting, and work is busy", () => {
    const detecting = mount(modelScan, { stage: "detecting", progress: 0.4 }, markup)
    try {
      expect(detecting.part("effect")?.isConnected).toBe(true)
      expect(detecting.part("effect")?.hasAttribute("data-determinate")).toBe(true)
      expect(detecting.part("points")?.getAttribute("aria-hidden")).toBe("true")
      expect(detecting.root.getAttribute("aria-busy")).toBe("true")
      expect(detecting.root.getAttribute("style")).toContain("--model-scan-progress: 0.4")
    } finally {
      detecting.unmount()
    }
    const ready = mount(modelScan, { stage: "ready" }, markup)
    try {
      expect(ready.part("effect")?.isConnected).toBe(false)
      expect(ready.part("points")?.isConnected).toBe(false)
      expect(ready.root.getAttribute("aria-busy")).toBeNull()
    } finally {
      ready.unmount()
    }
  })

  test("renders on the server", () => {
    checkServer(modelScan, { stage: "detecting", progress: 0.5 }, markup)
    checkServer(modelScan, { stage: "ready" }, markup)
  })
})

describe("points", () => {
  test("one list, as objects or interleaved, is one group", () => {
    expect(pointGroups([{ x: 0.5, y: 0.25 }], 0.75)).toEqual([
      { source: "points", coords: new Float32Array([0.5, 0.25]) },
    ])
    expect(pointGroups(new Float32Array([0.1, 0.2, 0.3, 0.4]), 0.75)[0]?.coords).toEqual(
      new Float32Array([0.1, 0.2, 0.3, 0.4]),
    )
    expect(pointGroups([0.1, 0.2], 0.75)[0]?.coords).toEqual(new Float32Array([0.1, 0.2]))
    expect(pointGroups(undefined, 1)).toEqual([])
  })

  test("groups keep the order their sources arrived in, and a later group replaces its source's", () => {
    const groups = pointGroups(
      [
        { source: "face", points: new Float32Array([0.5, 0.2]) },
        { source: "body", points: [{ x: 0.5, y: 0.6 }] },
        { source: "face", points: new Float32Array([0.4, 0.2]) },
      ],
      0.75,
    )
    expect(groups.map((group) => [group.source, [...group.coords]])).toEqual([
      ["face", [expect.closeTo(0.4, 6), expect.closeTo(0.2, 6)]],
      ["body", [0.5, expect.closeTo(0.6, 6)]],
    ])
  })

  test("points from a frame of another aspect land on the photo, and points off it are dropped", () => {
    // A 3:4 photo padded into a square frame: it fills the height and the middle three quarters of the width.
    const [group] = pointGroups(
      [{ source: "body", aspect: 1, points: new Float32Array([0.5, 0.5, 0.125, 0, 0.05, 0.5]) }],
      0.75,
    )
    expect([...(group?.coords ?? [])]).toEqual([0.5, 0.5, 0, 0])
    // A wide photo in a square frame fills the width and the middle of the height.
    const [wide] = pointGroups([{ source: "face", aspect: 1, points: [0.5, 0.25, 0.5, 0.5] }], 2)
    expect([...(wide?.coords ?? [])]).toEqual([0.5, 0, 0.5, 0.5])
  })
})

const points = [
  { source: "face", points: new Float32Array([0.5, 0.2, 0.45, 0.18]), aspect: 0.75 },
  { source: "body", points: [{ x: 0.4, y: 0.6 }] },
]

function Scan(props: Partial<ModelScanProps>) {
  return (
    <main>
      <ModelScan src="photo.svg" alt="A front photo of a figure" width={600} height={800} stage="photo" {...props} />
    </main>
  )
}

test("photo: the photo, named by its alt, with no scene loaded and no progress", async () => {
  render(<Scan />)
  await tick()
  const group = screen.getByRole("group", { name: "A front photo of a figure" })
  expect(group.getAttribute("data-stage")).toBe("photo")
  expect(screen.queryByRole("progressbar")).toBeNull()
  expect(fakeScene.renders).toBe(0)
  expect(screen.queryByRole("group", { name: "3D view controls" })).toBeNull()
  expect(await axeViolations(document.body)).toEqual([])
})

test("detecting: points light up, a determinate bar, Cancel, and the scene starts loading", async () => {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  render(<Scan stage="detecting" points={points} progress={0.5} onCancel={onCancel} />)
  await tick()
  const groups = document.querySelectorAll('[data-slot="model-scan-points"] [data-source]')
  expect([...groups].map((group) => [group.getAttribute("data-source"), group.childElementCount])).toEqual([
    ["face", 2],
    ["body", 1],
  ])
  expect((groups[1]?.firstElementChild as HTMLElement | null)?.style.left).toBe("40%")
  expect(document.querySelector('[data-slot="model-scan-points"]')?.getAttribute("aria-hidden")).toBe("true")
  const bar = screen.getByRole("progressbar", { name: "Finding points on the photo" })
  expect(bar.getAttribute("aria-valuenow")).toBe("50")
  expect(fakeScene.renders).toBeGreaterThan(0)
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("building and refining hand the model and the weights to the viewer; ready shows its controls", async () => {
  const { rerender } = render(<Scan stage="building" model={{ glb: "figure.glb", targetNames: ["body.pc00"] }} />)
  await tick()
  expect(fakeScene.props?.model).toBe("figure.glb")
  expect(fakeScene.props?.targetNames).toEqual(["body.pc00"])
  expect(screen.getByRole("progressbar", { name: "Building the 3D model" }).getAttribute("aria-valuenow")).toBeNull()
  rerender(<Scan stage="refining" model="figure.glb" weights={{ Smile: 0.5 }} progress={0.25} statusText="Fitting" />)
  expect(fakeScene.props?.weights).toEqual({ Smile: 0.5 })
  expect(screen.getByRole("progressbar", { name: "Fitting" }).getAttribute("aria-valuenow")).toBe("25")
  // Until ready the viewer can't be turned, and clips wait.
  expect(screen.queryByRole("group", { name: "3D view controls" })).toBeNull()
  rerender(<Scan stage="ready" model="figure.glb" weights={{ Smile: 1 }} modelAlt="A 3D figure" />)
  await tick()
  expect(screen.queryByRole("progressbar")).toBeNull()
  expect(screen.getByRole("group", { name: "3D view controls" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
})

test("error: the message, Retry, and an assertive announcement", async () => {
  const user = userEvent.setup()
  const onRetry = vi.fn()
  const { rerender } = render(<Scan stage="building" model="figure.glb" onRetry={onRetry} onCancel={() => {}} />)
  rerender(<Scan stage="error" error="No face in this photo" onRetry={onRetry} onCancel={() => {}} />)
  await waitFor(() => expect(readAnnouncements().assertive).toBe("No face in this photo"))
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
  await user.click(screen.getByRole("button", { name: "Try again" }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test("each stage is announced in the labels' words, progress at most every tenth and two seconds", () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(0)
  const labels = { stage: { detecting: "Looking", building: "Building", refining: "Shaping", ready: "Done" } }
  const { rerender } = render(<Scan labels={labels} />)
  const at = (time: number, props: Partial<ModelScanProps>) => {
    vi.setSystemTime(time)
    rerender(<Scan labels={labels} {...props} />)
  }
  at(0, { stage: "detecting", progress: 0 })
  at(100, { stage: "detecting", progress: 0.05 })
  at(2500, { stage: "detecting", progress: 0.5 })
  at(2600, { stage: "building" })
  at(2700, { stage: "refining", progress: 0.1 })
  at(5000, { stage: "refining", progress: 0.35 })
  at(5100, { stage: "ready" })
  at(5200, { stage: "error" })
  expect(announced).toEqual([
    "polite: Looking",
    "polite: 5%",
    "polite: 50%",
    "polite: Building",
    "polite: Shaping",
    "polite: 35%",
    "polite: Done",
    "assertive: The 3D model could not be made",
  ])
})

test("the server renders the photo and no scene", () => {
  const html = renderToString(<Scan stage="detecting" points={points} />)
  expect(html).toContain('aria-label="A front photo of a figure"')
  expect(html).toContain("photo.svg")
  expect(html).not.toContain("fake-scene")
})

test("the fake engine emits the engine's events, and toModelScanProps maps them; an agent can cancel and retry", async () => {
  vi.useFakeTimers()
  let state = idleEngine
  const events: EngineEvent["type"][] = []
  const stages: string[] = []
  const emit = (event: EngineEvent) => {
    events.push(event.type)
    state = reduceEngine(state, event)
    const stage = toModelScanProps(state).stage
    if (stages.at(-1) !== stage) stages.push(stage)
  }
  runFakeEngine(emit, { model: "figure.glb", character: "final.glb" })
  await vi.runAllTimersAsync()
  expect(stages).toEqual(["detecting", "building", "refining", "ready"])
  expect(events.filter((type) => type !== "progress")).toEqual([
    "stage",
    "landmarks",
    "landmarks",
    "stage",
    "model",
    "stage",
    "done",
    "stage",
  ])
  const props = toModelScanProps(state)
  expect(state.landmarks.map((group) => group.source)).toEqual(["face", "body"])
  expect(state.landmarks[0]?.points).toBeInstanceOf(Float32Array)
  expect(props.model).toMatchObject({ glb: "final.glb", targetNames: figureTargetNames })
  expect(props.weights).toBeInstanceOf(Float32Array)
  expect(props.weights).toHaveLength(figureTargetNames.length)
  expect(props.expressions).toEqual({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8 })
  stages.length = 0
  state = idleEngine
  runFakeEngine(emit, { model: "figure.glb", character: "final.glb", fail: true })
  await vi.runAllTimersAsync()
  expect(stages).toEqual(["detecting", "building", "error"])
  vi.useRealTimers()

  const onCancel = vi.fn()
  const onRetry = vi.fn()
  const { rerender, unmount } = render(<Scan stage="detecting" onCancel={onCancel} onRetry={onRetry} />)
  await tick()
  const entries = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries()) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const scan = entries().find((entry) => entry.component === "model-scan")
  expect(scan?.actions).toEqual(expect.arrayContaining(["cancel", "retry"]))
  const ref = "A front photo of a figure"
  expect((await agent.act({ steps: [{ ref, action: "cancel" }] })).ok).toBe(true)
  expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))
  const early = await agent.act({ steps: [{ ref, action: "retry" }] })
  expect(early.error?.message).toContain("Retry works only in error (stage: detecting).")
  rerender(<Scan stage="error" onCancel={onCancel} onRetry={onRetry} />)
  await tick()
  expect((await agent.act({ steps: [{ ref, action: "retry" }] })).ok).toBe(true)
  expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))
  unmount()
})
