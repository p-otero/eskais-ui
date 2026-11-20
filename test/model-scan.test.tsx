import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { ModelScan, type ModelScanProps } from "@/components/ui/model-scan"
import { pointGroups, pointsAspect } from "@/components/ui/model-scan-points"
import { modelScan } from "@/components/ui/model-scan-primitive"
import { modelViewerLabels } from "@/components/ui/model-viewer-labels"
import { readAnnouncements } from "@/lib/test-utils"

import { axeViolations } from "./axe"
import {
  figureTargetNames,
  finalErrors,
  idleEngine,
  reduceEngine,
  runFakeEngine,
  scanErrors,
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
vi.mock("@/components/ui/model-scan-intro", () => import("./fixtures/model/fake-intro"))

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
  test("each action runs only in its stages, says why otherwise, and returns false to a press", () => {
    const callbacks = {
      onStart: vi.fn(),
      onCancel: vi.fn(),
      onRetry: vi.fn(),
      onStartOver: vi.fn(),
      onDownload: vi.fn(),
    }
    const offered = {
      start: ["photo"],
      cancel: ["detecting", "building", "refining"],
      retry: ["error"],
      restart: ["ready", "error"],
      download: ["ready"],
    } as const
    const during = {
      photo: "before a scan starts",
      detecting: "while the scan runs",
      building: "while the scan runs",
      refining: "while the scan runs",
      ready: "once the model is ready",
      error: "after an error",
    }
    for (const stage of ["photo", "detecting", "building", "refining", "ready", "error"] as const) {
      const view = mount(modelScan, { stage, ...callbacks }, markup)
      try {
        for (const [action, stages] of Object.entries(offered) as [keyof typeof offered, readonly string[]][]) {
          const runs = stages.includes(stage)
          expect(
            outcome(() => view.api[action]()),
            `${action} at ${stage}`,
          ).toBe(runs || `${action} isn't available ${during[stage]}. [unavailable:${action}]`)
          expect(view.api.offers(action)).toBe(runs)
          // A press the stage doesn't offer returns false instead of throwing.
          expect(runs || view.api[action](new MouseEvent("click"))).toBe(runs)
        }
      } finally {
        view.unmount()
      }
    }
    expect(callbacks.onStart).toHaveBeenCalledWith(null, expect.objectContaining({ reason: "imperative" }))
    const bare = mount(modelScan, { stage: "photo" }, markup)
    try {
      expect(outcome(() => bare.api.start())).toBe("start isn't offered by the app. [unavailable:start]")
      expect(bare.api.offers("start")).toBe(false)
    } finally {
      bare.unmount()
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
    expect(pointGroups([{ x: 0.5, y: 0.25 }])).toEqual([
      { source: "points", coords: new Float32Array([0.5, 0.25]), onPhoto: 1 },
    ])
    expect(pointGroups(new Float32Array([0.1, 0.2, 0.3, 0.4]))[0]?.coords).toEqual(
      new Float32Array([0.1, 0.2, 0.3, 0.4]),
    )
    expect(pointGroups([0.1, 0.2])[0]?.coords).toEqual(new Float32Array([0.1, 0.2]))
    expect(pointGroups(undefined)).toEqual([])
  })

  test("groups keep the order their sources arrived in, and a later group replaces its source's", () => {
    const groups = pointGroups([
      { source: "face", points: new Float32Array([0.5, 0.2]) },
      { source: "body", points: [{ x: 0.5, y: 0.6 }] },
      { source: "face", points: new Float32Array([0.4, 0.2]) },
    ])
    expect(groups.map((group) => [group.source, [...group.coords]])).toEqual([
      ["face", [expect.closeTo(0.4, 6), expect.closeTo(0.2, 6)]],
      ["body", [0.5, expect.closeTo(0.6, 6)]],
    ])
  })

  test("points are the photo's fractions as sent, whatever the aspect, and points off the photo are kept", () => {
    // MediaPipe reports every landmark, also those a crop cut off: past 0 or 1.
    const sent = new Float32Array([0.5, 0.5, 0, 1, -0.2, 0.5, 0.5, 1.3])
    const [group] = pointGroups([{ source: "body", aspect: 9 / 16, points: sent }])
    expect(group?.coords).toBe(sent)
    expect(group?.onPhoto).toBe(2)
    expect(pointsAspect([{ source: "body", aspect: 9 / 16, points: sent }])).toBe(9 / 16)
    expect(pointsAspect(sent)).toBeUndefined()
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
  // The photo's box is 750 by 1000 units at 3:4.
  expect(groups[1]?.firstElementChild?.getAttribute("cx")).toBe("300")
  expect(document.querySelector('[data-slot="model-scan-points"]')?.getAttribute("aria-hidden")).toBe("true")
  const bar = screen.getByRole("progressbar", { name: "Finding points on the photo" })
  expect(bar.getAttribute("aria-valuenow")).toBe("50")
  expect(fakeScene.renders).toBeGreaterThan(0)
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("points land on the photo as sent; points past its edges aren't drawn and don't count in the stagger", async () => {
  render(
    <Scan
      stage="detecting"
      points={[
        { source: "body", aspect: 0.75, points: new Float32Array([0.25, 0.5, -0.1, 0.5, 1, 1, 0.5, 1.2, 0.75, 0]) },
      ]}
    />,
  )
  await tick()
  const group = document.querySelector('[data-slot="model-scan-points"] [data-source="body"]')
  const dots = [...(group?.children ?? [])] as SVGElement[]
  expect(group?.getAttribute("data-count")).toBe("3")
  expect(dots.map((dot) => [dot.getAttribute("cx"), dot.getAttribute("cy")])).toEqual([
    ["187.5", "500"],
    ["750", "1000"],
    ["562.5", "0"],
  ])
  expect(dots.map((dot) => dot.style.getPropertyValue("--model-scan-point-index"))).toEqual(["0", "1", "2"])
})

const photo = () => document.querySelector<HTMLImageElement>('[data-slot="model-scan-photo"] img')
const pointsBox = () => document.querySelector('[data-slot="model-scan-points"]')?.parentElement
const scanGroup = () => screen.getByRole("group", { name: "A front photo of a figure" })

test("fit: the photo and its points' box follow contain or cover", async () => {
  const { rerender } = render(<Scan stage="detecting" points={points} aspectRatio={1} />)
  await tick()
  expect(photo()?.className).toContain("object-contain")
  expect(pointsBox()?.getAttribute("data-fit")).toBe("contain")
  rerender(<Scan stage="detecting" points={points} aspectRatio={1} fit="cover" />)
  expect(photo()?.className).toContain("object-cover")
  expect(pointsBox()?.getAttribute("data-fit")).toBe("cover")
  expect(pointsBox()?.className).toContain("data-[fit=cover]:h-[max(")
})

test("the stage takes the photo's ratio once it loads; until then its size's, or the points' aspect", async () => {
  const tall = [{ source: "face", aspect: 0.5625, points: new Float32Array([0.5, 0.2]) }]
  const { rerender } = render(<Scan stage="detecting" points={tall} />)
  await tick()
  expect(scanGroup().getAttribute("style")).toContain("--model-scan-ratio: 0.75")
  rerender(
    <main>
      <ModelScan src="photo.jpg" alt="A front photo of a figure" stage="detecting" points={tall} />
    </main>,
  )
  expect(scanGroup().getAttribute("style")).toContain("--model-scan-ratio: 0.5625")
  const img = photo()
  if (!img) throw new Error("no photo")
  Object.defineProperties(img, {
    complete: { value: true, configurable: true },
    naturalWidth: { value: 1080, configurable: true },
    naturalHeight: { value: 1920, configurable: true },
  })
  act(() => {
    img.dispatchEvent(new Event("load"))
  })
  expect(scanGroup().getAttribute("style")).toContain("--model-scan-ratio: 0.5625")
  Object.defineProperties(img, {
    naturalWidth: { value: 1200, configurable: true },
    naturalHeight: { value: 1600, configurable: true },
  })
  act(() => {
    img.dispatchEvent(new Event("load"))
  })
  expect(scanGroup().getAttribute("style")).toContain("--model-scan-ratio: 0.75")
})

function StartableScan() {
  const [stage, setStage] = useState<ModelScanProps["stage"]>("photo")
  return (
    <Scan
      stage={stage}
      onStart={() => setStage("detecting")}
      onCancel={() => setStage("photo")}
      onRetry={() => setStage("detecting")}
      // Before Make 3D in the controls: focus still goes to Make 3D, the stage's main control.
      styles={[{ value: "soft", label: "Soft" }]}
      onStyleChange={() => {}}
    />
  )
}

test("start: Make 3D goes while a run goes, focus moves to Cancel, and back to Make 3D after cancelling", async () => {
  const user = userEvent.setup()
  render(<StartableScan />)
  await tick()
  await user.click(screen.getByRole("button", { name: "Make 3D" }))
  expect(screen.queryByRole("button", { name: "Make 3D" })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }))
  await user.keyboard("{Enter}")
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Make 3D" }))
})

test("focus the person moved away stays there when the stage changes", async () => {
  const user = userEvent.setup()
  render(
    <>
      <StartableScan />
      <button type="button">Elsewhere</button>
    </>,
  )
  await tick()
  await user.click(screen.getByRole("button", { name: "Make 3D" }))
  await user.click(screen.getByRole("button", { name: "Elsewhere" }))
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }))
  act(() => {
    screen.getByRole("button", { name: "Cancel" }).click()
  })
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }))
})

test("building and refining hand the model and the weights to the viewer; ready shows the toolbar", async () => {
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
  // One bar: ModelScan's toolbar, with the viewer's drag and keys but not its own controls.
  expect(await screen.findByRole("toolbar", { name: "3D model controls" })).toBeTruthy()
  expect(screen.queryByRole("group", { name: "3D view controls" })).toBeNull()
  expect(screen.getByRole("img", { name: "A 3D figure" }).getAttribute("tabindex")).toBe("0")
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

test("a failed run ends with the engine's error event, mapped to the consumer's words per code", async () => {
  vi.useFakeTimers()
  let state = idleEngine
  const events: EngineEvent[] = []
  const stages: string[] = []
  const emit = (event: EngineEvent) => {
    events.push(event)
    state = reduceEngine(state, event)
    const stage = toModelScanProps(state).stage
    if (stages.at(-1) !== stage) stages.push(stage)
  }
  const run = runFakeEngine(emit, { model: "figure.glb", character: "final.glb", fail: "no-face" })
  await vi.runAllTimersAsync()
  await run
  expect(stages).toEqual(["detecting", "building", "error"])
  expect(events.at(-1)).toEqual({ type: "error", error: { code: "no-face", message: expect.any(String) as string } })
  expect(toModelScanProps(state).error).toBe(scanErrors["no-face"])
  expect(toModelScanProps(state, { "no-face": "Sin cara" }).error).toBe("Sin cara")
  // Without WebGL2 the words are ModelViewer's own for a browser without WebGL, and a new run can't help.
  state = idleEngine
  const noWebgl = runFakeEngine(emit, { model: "figure.glb", character: "final.glb", fail: "webgl2-unavailable" })
  await vi.runAllTimersAsync()
  await noWebgl
  expect(toModelScanProps(state).error).toBe(modelViewerLabels.unsupported)
  expect(finalErrors).toContain(state.error?.code)
  vi.useRealTimers()
})

test("cancelling through the signal rejects with an AbortError and emits nothing more, not an error", async () => {
  vi.useFakeTimers()
  const events: EngineEvent["type"][] = []
  const controller = new AbortController()
  const run = runFakeEngine((event) => events.push(event.type), {
    model: "figure.glb",
    character: "final.glb",
    signal: controller.signal,
  })
  const settled = run.catch((error: unknown) => error)
  await vi.advanceTimersByTimeAsync(500)
  controller.abort()
  expect(await settled).toMatchObject({ name: "AbortError" })
  await vi.runAllTimersAsync()
  expect(events).toEqual(["stage", "landmarks"])
  vi.useRealTimers()
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
  vi.useRealTimers()

  const onCancel = vi.fn()
  const onRetry = vi.fn()
  const { rerender, unmount } = render(<Scan stage="detecting" onCancel={onCancel} onRetry={onRetry} />)
  await tick()
  const entries = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries()) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const scan = entries().find((entry) => entry.component === "model-scan")
  expect(scan?.actions).toEqual(expect.arrayContaining(["start", "cancel", "retry", "restart", "download"]))
  const ref = "A front photo of a figure"
  expect((await agent.act({ steps: [{ ref, action: "cancel" }] })).ok).toBe(true)
  expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))
  const early = await agent.act({ steps: [{ ref, action: "retry" }] })
  expect(early.error?.message).toContain("retry isn't available while the scan runs.")
  rerender(<Scan stage="error" onCancel={onCancel} onRetry={onRetry} />)
  await tick()
  expect((await agent.act({ steps: [{ ref, action: "retry" }] })).ok).toBe(true)
  expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))
  unmount()
})
