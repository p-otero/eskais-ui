import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { ModelScan, type ModelScanProps } from "@/components/ui/model-scan"
import { landmarkHull, personCells, personMask, sampleMask, type ModelScanMask } from "@/components/ui/model-scan-mask"
import { pointGroups, poseEdges } from "@/components/ui/model-scan-points"
import { ModelViewer, useModelViewerControls, type ModelViewerHandle } from "@/components/ui/model-viewer"

import { axeViolations } from "./axe"
import { fakeIntro } from "./fixtures/model/fake-intro"

vi.mock("@/components/ui/model-viewer-scene", () => import("./fixtures/model/fake-scene"))
vi.mock("@/components/ui/model-scan-intro", () => import("./fixtures/model/fake-intro"))

const agent = createAgent()

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ getExtension: () => null })) as never
})

afterEach(() => {
  fakeIntro.props = undefined
})

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const styles = [
  { value: "soft", label: "Soft toon" },
  { value: "cel", label: "Cel outline" },
]

function Scan(props: Partial<ModelScanProps>) {
  return (
    <main>
      <ModelScan src="photo.svg" alt="A front photo of a figure" width={600} height={800} stage="photo" {...props} />
    </main>
  )
}

function standing() {
  const points = new Float32Array(66).fill(0.5)
  const set = (i: number, x: number, y: number) => points.set([x, y], i * 2)
  set(0, 0.5, 0.15)
  set(7, 0.46, 0.15)
  set(8, 0.54, 0.15)
  set(11, 0.42, 0.28)
  set(12, 0.58, 0.28)
  set(13, 0.38, 0.42)
  set(14, 0.62, 0.42)
  set(15, 0.36, 0.55)
  set(16, 0.64, 0.55)
  set(23, 0.45, 0.55)
  set(24, 0.55, 0.55)
  set(25, 0.45, 0.72)
  set(26, 0.55, 0.72)
  set(27, 0.45, 0.9)
  set(28, 0.55, 0.9)
  return points
}

function Run() {
  const [stage, setStage] = useState<ModelScanProps["stage"]>("photo")
  return (
    <Scan
      stage={stage}
      model={stage === "photo" ? undefined : "figure.glb"}
      onStart={() => setStage("ready")}
      onStartOver={() => setStage("photo")}
      onDownload={() => {}}
    />
  )
}

const mask = (width: number, height: number, source?: "face" | "body"): ModelScanMask => ({
  source,
  width,
  height,
  data: new Uint8Array(width * height).map((_, i) => (i % width < width / 2 ? 255 : 0)),
})

function Gestures({ onHandle }: { onHandle: (handle: ModelViewerHandle | null) => void }) {
  const [handle, setHandle] = useState<ModelViewerHandle | null>(null)
  const state = useModelViewerControls(handle)
  return (
    <>
      <ModelViewer
        model="figure.glb"
        alt="A figure"
        controls="gestures"
        handleRef={(next) => {
          setHandle(next)
          onHandle(next)
        }}
      />
      <output data-testid="view">{state ? `${state.status} ${String(state.view)}` : "none"}</output>
    </>
  )
}

const layer = () => document.querySelector('[data-slot="model-scan-points"]')

describe("controls", () => {
  test("photo: the style picker on top and Make 3D, both named, with no axe violations", async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    const onStyleChange = vi.fn()
    render(<Scan onStart={onStart} styles={styles} selectedStyle="soft" onStyleChange={onStyleChange} />)
    await tick()
    const picker = screen.getByRole("radiogroup", { name: "Style" })
    await user.click(within(picker).getByRole("radio", { name: "Cel outline" }))
    expect(onStyleChange).toHaveBeenCalledWith("cel", expect.objectContaining({ reason: expect.any(String) as string }))
    await user.click(screen.getByRole("button", { name: "Make 3D" }))
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
    expect(await axeViolations(document.body)).toEqual([])
  })

  test("working: the stage, step n of 4, the percent and Cancel; no style picker", async () => {
    render(<Scan stage="refining" progress={0.4} onCancel={() => {}} styles={styles} onStyleChange={() => {}} />)
    await tick()
    const bar = screen.getByRole("progressbar", { name: "Refining the shape" })
    expect(bar.getAttribute("aria-valuenow")).toBe("40")
    expect(screen.getByText(/^Step 3 of 4/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy()
    expect(screen.queryByRole("radiogroup", { name: "Style" })).toBeNull()
  })

  test("ready: the style picker and one toolbar of views, the clip, Download and Start over", async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    const onStartOver = vi.fn()
    render(
      <Scan
        stage="ready"
        model="figure.glb"
        modelAlt="A 3D figure"
        styles={styles}
        selectedStyle="soft"
        onStyleChange={() => {}}
        onDownload={onDownload}
        onStartOver={onStartOver}
      />,
    )
    await tick()
    const toolbar = await screen.findByRole("toolbar", { name: "3D model controls" })
    expect(
      within(toolbar)
        .getAllByRole("radio")
        .map((radio) => radio.textContent),
    ).toEqual(["Front", "¾", "Side"])
    expect(within(toolbar).getByRole("button", { name: "Play animation" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("radiogroup", { name: "Style" })).toBeTruthy()
    await user.click(within(toolbar).getByRole("button", { name: "Download 3D model" }))
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
    await user.click(within(toolbar).getByRole("button", { name: "Start over" }))
    expect(onStartOver).toHaveBeenCalledTimes(1)
    await user.click(within(toolbar).getByRole("radio", { name: "Side" }))
    expect(within(toolbar).getByRole("radio", { name: "Side" }).getAttribute("aria-checked")).toBe("true")
    expect(await axeViolations(document.body)).toEqual([])
  })

  test("ready: the views are one tab stop with their own arrows, then the toolbar's buttons", async () => {
    const user = userEvent.setup()
    render(<Scan stage="ready" model="figure.glb" onDownload={() => {}} onStartOver={() => {}} />)
    const toolbar = await screen.findByRole("toolbar", { name: "3D model controls" })
    const tabbable = () =>
      [...toolbar.querySelectorAll<HTMLElement>("button")]
        .filter((element) => element.tabIndex === 0)
        .map((element) => element.getAttribute("aria-label") ?? element.textContent)
    expect(tabbable()).toEqual(["Front", "Play animation"])
    within(toolbar).getByRole("radio", { name: "Front" }).focus()
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(within(toolbar).getByRole("radio", { name: "¾" }))
    expect(within(toolbar).getByRole("radio", { name: "¾" }).getAttribute("aria-checked")).toBe("true")
    within(toolbar).getByRole("button", { name: "Play animation" }).focus()
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "Download 3D model" }))
    await user.keyboard("{End}")
    expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "Start over" }))
  })

  test("error: the message over the stage, Try again and Start over", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onStartOver = vi.fn()
    render(<Scan stage="error" error="No full body in this photo" onRetry={onRetry} onStartOver={onStartOver} />)
    await tick()
    expect(screen.getByText("No full body in this photo")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await user.click(screen.getByRole("button", { name: "Start over" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onStartOver).toHaveBeenCalledTimes(1)
  })

  test("controls below: the same controls under the stage, not over it", async () => {
    render(<Scan controls="below" onStart={() => {}} />)
    await tick()
    const row = document.querySelector('[data-slot="model-scan-controls"]')
    expect(row?.className).not.toContain("absolute")
    expect(row?.previousElementSibling?.querySelector('[data-slot="model-viewer"]')).toBeTruthy()
    expect(within(row as HTMLElement).getByRole("button", { name: "Make 3D" })).toBeTruthy()
  })

  test("every copy comes from the labels", async () => {
    render(
      <Scan
        stage="refining"
        onCancel={() => {}}
        labels={{ cancel: "Cancelar", step: (step, steps) => `Paso ${String(step)} de ${String(steps)}` }}
      />,
    )
    await tick()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy()
    expect(screen.getByText(/^Paso 3 de 4/)).toBeTruthy()
  })
})

describe("agents", () => {
  test("an agent starts, downloads and starts over, every control is named, and a step outside its stage fails", async () => {
    render(<Run />)
    await tick()
    const ref = "A front photo of a figure"
    expect((await agent.act({ steps: [{ ref, action: "start" }] })).ok).toBe(true)
    await tick()
    for (const entry of agent.snapshot().filter((each) => !each.offPage && each.component !== "more")) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
    }
    const scan = () => screen.getByRole("group", { name: ref })
    expect(scan().getAttribute("data-stage")).toBe("ready")
    expect((await agent.act({ steps: [{ ref, action: "download" }] })).ok).toBe(true)
    const again = await agent.act({ steps: [{ ref, action: "start" }] })
    expect(again.error?.message).toContain("start isn't available once the model is ready.")
    expect((await agent.act({ steps: [{ ref, action: "restart" }] })).ok).toBe(true)
    await tick()
    expect(scan().getAttribute("data-stage")).toBe("photo")
  })
})

describe("person mask", () => {
  test("the body mask wins, else a mask of the photo's aspect, else the landmarks' hull, else none", () => {
    const body = mask(3, 4, "body")
    const face = mask(4, 4, "face")
    const groups = pointGroups([{ source: "body", points: standing() }])
    expect(personMask({ masks: [face, body], groups, ratio: 0.75 })).toEqual({ mask: body, from: "mask" })
    expect(personMask({ masks: [face], groups: [], ratio: 1 })).toEqual({ mask: face, from: "mask" })
    const hull = personMask({ masks: [face], groups, ratio: 0.75 })
    expect(hull.from).toBe("landmarks")
    expect(hull.mask?.width).toBe(96)
    expect(hull.mask?.height).toBe(128)
    expect(personMask({ groups: [], ratio: 0.75 })).toEqual({ mask: null, from: "none" })
  })

  test("a mask is sampled bilinearly from the top left; cells count rows from the bottom", () => {
    const half = mask(4, 2)
    expect(sampleMask(half, 0.1, 0.5)).toBe(1)
    expect(sampleMask(half, 0.9, 0.5)).toBe(0)
    expect(sampleMask(half, 0.5, 0.5)).toBeCloseTo(0.5)
    const top: ModelScanMask = { width: 1, height: 2, data: new Uint8Array([255, 0]) }
    expect([...personCells(1, 2, top)]).toEqual([0, 1])
    expect([...personCells(2, 1, null)]).toEqual([1, 1])
  })

  test("the hull covers the torso, the limbs and the head, and not the corners", () => {
    const [body] = pointGroups([{ source: "body", points: standing() }])
    const hull = body ? landmarkHull(body, 0.75) : null
    if (!hull) throw new Error("no hull")
    expect(hull(0.5 * 0.75, 0.4)).toBe(1)
    expect(hull(0.5 * 0.75, 0.12)).toBeGreaterThan(0.9)
    expect(hull(0.45 * 0.75, 0.8)).toBeGreaterThan(0.9)
    expect(hull(0.05 * 0.75, 0.05)).toBe(0)
    expect(landmarkHull({ source: "body", coords: new Float32Array(10), onPhoto: 5 }, 1)).toBeNull()
  })

  test("the scan tells where the person came from and hands the mask to the transition", async () => {
    const body = mask(3, 4, "body")
    const points = [{ source: "body", points: standing() }]
    const { rerender } = render(<Scan stage="detecting" points={points} />)
    await tick()
    expect(layer()?.getAttribute("data-person")).toBe("landmarks")
    rerender(<Scan stage="detecting" points={points} masks={[body]} />)
    expect(layer()?.getAttribute("data-person")).toBe("mask")
    rerender(<Scan stage="building" model="figure.glb" points={points} masks={[body]} />)
    await tick()
    expect(fakeIntro.props?.mask).toBe(body)
    expect(fakeIntro.props?.person).toBe("mask")
  })
})

describe("edges", () => {
  test("the 33 pose landmarks join into the pose skeleton by default; a group's own edges replace it", () => {
    const [body] = pointGroups([{ source: "body", points: standing() }])
    expect(body?.edges).toBe(poseEdges)
    const [face] = pointGroups([{ source: "face", points: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3], edges: [[0, 1]] }])
    expect(face?.edges).toEqual([[0, 1]])
    expect(pointGroups([{ source: "face", points: [0.1, 0.1] }])[0]?.edges).toBeUndefined()
  })

  test("lines join the edges, and a group with edges draws only the points they join", async () => {
    render(
      <Scan
        stage="detecting"
        points={[
          {
            source: "hand",
            points: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 1.2, 0.5],
            edges: [
              [0, 1],
              [1, 3],
            ],
          },
        ]}
      />,
    )
    await tick()
    const group = document.querySelector('[data-source="hand"]')
    expect(group?.querySelectorAll("line")).toHaveLength(1)
    expect([...(group?.querySelectorAll("circle") ?? [])].map((dot) => dot.getAttribute("cx"))).toEqual(["75", "150"])
  })
})

describe("viewer controls", () => {
  test('controls="gestures" keeps keys on the stage without the bar, and hands over the handle', async () => {
    const user = userEvent.setup()
    const handles: (ModelViewerHandle | null)[] = []
    render(<Gestures onHandle={(handle) => handles.push(handle)} />)
    await tick()
    expect(screen.queryByRole("group", { name: "3D view controls" })).toBeNull()
    const stage = screen.getByRole("img", { name: "A figure" })
    expect(stage.getAttribute("tabindex")).toBe("0")
    expect(screen.getByTestId("view").textContent).toBe("ready front")
    stage.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByTestId("view").textContent).toBe("ready null")
    act(() => {
      handles.at(-1)?.api.setView("side")
    })
    expect(screen.getByTestId("view").textContent).toBe("ready side")
  })
})
