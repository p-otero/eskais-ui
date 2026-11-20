import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"

import {
  ImageScan,
  type ImageScanChangeDetails,
  type ImageScanProps,
  type ImageScanRegion,
} from "@/components/ui/image-scan"
import { clampBox, imageScan, mapRegionBox } from "@/components/ui/image-scan-primitive"
import { readAnnouncements } from "@/lib/test-utils"

import { axeViolations } from "./axe"

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

const agent = createAgent()

afterEach(() => {
  vi.useRealTimers()
  announced.length = 0
})

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'/%3E"

const regions: ImageScanRegion[] = [
  { id: "leaf", label: "Leaf", box: { x: 0.6, y: 0.5, width: 0.3, height: 0.3 }, tone: "success", description: "92%" },
  { id: "stem", label: "Stem", box: { x: 0.1, y: 0.05, width: 0.2, height: 0.4 } },
  { id: "spot", label: "Spot", box: { x: 0.1, y: 0.5, width: 0.1, height: 0.1 }, tone: "warning" },
]

const markup = `<root><frame><image></image><layer><effect></effect><regions label="Regions"><region value="a" box='{"x":0,"y":0,"width":0.5,"height":0.5}'>A</region></regions></layer></frame></root>`

describe("mapRegionBox", () => {
  const box = { x: 0.25, y: 0.5, width: 0.5, height: 0.25 }

  test("is the identity scaled to the frame when the ratios match", () => {
    for (const fit of ["contain", "cover"] as const) {
      expect(
        mapRegionBox(box, { fit, image: { width: 800, height: 600 }, frame: { width: 400, height: 300 } }),
      ).toEqual({ x: 100, y: 150, width: 200, height: 75 })
    }
  })

  test("contain letterboxes a wide image in a square frame", () => {
    // 800×400 in 300×300: drawn 300×150, 75px bands above and below.
    expect(
      mapRegionBox(box, { fit: "contain", image: { width: 800, height: 400 }, frame: { width: 300, height: 300 } }),
    ).toEqual({ x: 75, y: 150, width: 150, height: 37.5 })
  })

  test("contain pillarboxes a tall image in a wide frame", () => {
    // 300×600 in 400×200: drawn 100×200, 150px bands at the sides.
    expect(
      mapRegionBox(box, { fit: "contain", image: { width: 300, height: 600 }, frame: { width: 400, height: 200 } }),
    ).toEqual({ x: 175, y: 100, width: 50, height: 50 })
  })

  test("cover crops a wide image to a square frame, reaching past its sides", () => {
    // 800×400 in 300×300: drawn 600×300, 150px cut from each side.
    const mapped = mapRegionBox(
      { x: 0, y: 0, width: 1, height: 1 },
      { fit: "cover", image: { width: 800, height: 400 }, frame: { width: 300, height: 300 } },
    )
    expect(mapped).toEqual({ x: -150, y: 0, width: 600, height: 300 })
    expect(
      mapRegionBox(box, { fit: "cover", image: { width: 800, height: 400 }, frame: { width: 300, height: 300 } }),
    ).toEqual({ x: 0, y: 150, width: 300, height: 75 })
  })

  test("clampBox keeps a box inside the image", () => {
    const clamped = clampBox({ x: -0.1, y: 0.9, width: 0.5, height: 0.5 })
    expect(clamped).toMatchObject({ x: 0, y: 0.9, width: 0.5 })
    expect(clamped.height).toBeCloseTo(0.1)
    expect(clampBox({ x: Number.NaN, y: 2, width: 1, height: 1 })).toEqual({ x: 0, y: 1, width: 1, height: 0 })
  })
})

function outcome(call: () => boolean) {
  try {
    return call()
  } catch (error) {
    return (error as Error).message
  }
}

describe("primitive", () => {
  test("cancel, retry and scan only run in their state, and report how", () => {
    const onCancel = vi.fn()
    const onRetry = vi.fn()
    const onScan = vi.fn()
    const handlers = { onCancel, onRetry, onScan }
    for (const status of ["uploaded", "scanning", "result", "error"] as const) {
      const view = mount(imageScan, { status, ...handlers }, markup)
      try {
        expect([
          outcome(() => view.api.scan()),
          outcome(() => view.api.cancel()),
          outcome(() => view.api.retry()),
        ]).toEqual([
          status === "uploaded" || `scan works only before a scan (status: ${status}). [unavailable:scan]`,
          status === "scanning" || `cancel works only while scanning (status: ${status}). [unavailable:cancel]`,
          status === "error" || `retry works only after an error (status: ${status}). [unavailable:retry]`,
        ])
      } finally {
        view.unmount()
      }
    }
    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledWith(null, expect.objectContaining({ reason: "imperative" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  test("a region press selects it, a second press clears it, and the box sits at its fractions", async () => {
    const view = mount(imageScan, { status: "result", regions: [{ value: "a", label: "A" }] }, markup)
    try {
      const region = view.part("region", "a") as HTMLElement
      expect(region.getAttribute("aria-pressed")).toBe("false")
      expect(region.getAttribute("style")).toContain("left: 0%")
      expect(region.getAttribute("style")).toContain("width: 50%")
      expect(region.getAttribute("data-edge")).toBe("top")
      await view.click(region)
      expect(view.state.selectedRegion).toBe("a")
      expect(region.getAttribute("aria-pressed")).toBe("true")
      await view.click(region)
      expect(view.state.selectedRegion).toBe(null)
      expect(view.changes.map((change) => change.reason)).toEqual(["item-press", "item-press"])
      expect(() => view.api.selectRegion("missing")).toThrow('No region "missing". Its regions: A.')
      expect(view.api.selectRegion("A")).toBe(true)
      expect(view.state.selectedRegion).toBe("a")
    } finally {
      view.unmount()
    }
  })

  test("the scan effect exists only while scanning, determinate once progress is known", () => {
    const idle = mount(imageScan, { status: "uploaded" }, markup)
    try {
      expect(idle.part("effect")?.isConnected).toBe(false)
      expect(idle.part("regions")?.isConnected).toBe(false)
    } finally {
      idle.unmount()
    }
    const indeterminate = mount(imageScan, { status: "scanning" }, markup)
    try {
      expect(indeterminate.part("effect")?.isConnected).toBe(true)
      expect(indeterminate.part("effect")?.hasAttribute("data-determinate")).toBe(false)
      expect(indeterminate.root.getAttribute("aria-busy")).toBe("true")
    } finally {
      indeterminate.unmount()
    }
    const determinate = mount(imageScan, { status: "scanning", progress: 0.4 }, markup)
    try {
      expect(determinate.part("effect")?.hasAttribute("data-determinate")).toBe(true)
      expect(determinate.root.getAttribute("style")).toContain("--image-scan-progress: 0.4")
    } finally {
      determinate.unmount()
    }
  })

  test("renders on the server", () => {
    checkServer(imageScan, { status: "result", regions: [{ value: "a", label: "A" }] }, markup)
    checkServer(imageScan, { status: "scanning", progress: 0.5 }, markup)
  })
})

function Scan(props: Partial<ImageScanProps>) {
  return (
    <main>
      <ImageScan src={src} alt="A potted plant" width={800} height={600} labels={{ cancel: "Stop" }} {...props} />
    </main>
  )
}

test("uploaded: a preview with Scan, which calls onScan", async () => {
  const user = userEvent.setup()
  const onScan = vi.fn()
  render(<Scan onScan={onScan} />)
  const group = screen.getByRole("group", { name: "A potted plant" })
  expect(group.getAttribute("data-status")).toBe("uploaded")
  expect(group.getAttribute("aria-busy")).toBeNull()
  expect(screen.getByRole("img", { name: "A potted plant" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Scan image" }))
  expect(onScan).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
  expect(screen.queryByRole("progressbar")).toBeNull()
  expect(await axeViolations(document.body)).toEqual([])
})

test("scanning: an indeterminate bar, then a determinate one with steps, and Cancel", async () => {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  const steps = [
    { id: "load", label: "Load" },
    { id: "detect", label: "Detect" },
    { id: "label", label: "Label" },
  ]
  const { rerender } = render(<Scan status="scanning" onCancel={onCancel} />)
  const bar = screen.getByRole("progressbar", { name: "Scanning image" })
  expect(bar.getAttribute("aria-valuenow")).toBeNull()
  expect(screen.getByRole("group", { name: "A potted plant" }).getAttribute("aria-busy")).toBe("true")

  rerender(
    <Scan
      status="scanning"
      progress={0.6}
      statusText="Finding leaves"
      steps={steps}
      step="detect"
      onCancel={onCancel}
    />,
  )
  const determinate = screen.getByRole("progressbar", { name: "Finding leaves" })
  expect(determinate.getAttribute("aria-valuenow")).toBe("60")
  const list = screen.getByRole("list", { name: "Scan steps" })
  expect([...list.querySelectorAll("li")].map((item) => item.getAttribute("data-state"))).toEqual([
    "done",
    "current",
    "pending",
  ])
  expect(screen.getByText("Detect").closest("li")?.getAttribute("aria-current")).toBe("step")

  await user.click(screen.getByRole("button", { name: "Stop" }))
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(await axeViolations(document.body)).toEqual([])
})

test("result: regions are named toggle buttons in reading order, and the legend mirrors the selection", async () => {
  const user = userEvent.setup()
  const onSelectedRegionChange = vi.fn()
  render(<Scan status="result" regions={regions} onSelectedRegionChange={onSelectedRegionChange} />)
  const list = screen.getByRole("list", { name: "Detected regions" })
  const buttons = [...list.querySelectorAll("button")]
  expect(buttons.map((button) => button.textContent)).toEqual(["Stem", "Spot", "Leaf 92%"])
  expect(screen.getByText("3 items found")).toBeTruthy()

  await user.tab()
  expect(document.activeElement).toBe(buttons[0])
  await user.keyboard("{Enter}")
  expect(onSelectedRegionChange).toHaveBeenLastCalledWith("stem", expect.objectContaining({ reason: "item-press" }))
  expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true")
  const legendItems = document.querySelectorAll('[data-slot="image-scan-legend-item"]')
  expect(legendItems[0]?.hasAttribute("data-selected")).toBe(true)
  expect(document.querySelector('[data-slot="image-scan-legend"]')?.getAttribute("aria-hidden")).toBe("true")

  await user.tab()
  await user.keyboard(" ")
  expect(onSelectedRegionChange).toHaveBeenLastCalledWith("spot", expect.anything())

  // A pointer on a legend row highlights its box, and a press there selects it.
  fireEvent.pointerEnter(legendItems[2] as Element)
  expect(buttons[2]?.hasAttribute("data-highlighted")).toBe(true)
  await user.click(legendItems[2] as Element)
  expect(onSelectedRegionChange).toHaveBeenLastCalledWith("leaf", expect.anything())
  expect(await axeViolations(document.body)).toEqual([])
})

function Controlled() {
  const [selected, setSelected] = useState<string | null>("leaf")
  return (
    <Scan
      status="result"
      regions={regions}
      selectedRegion={selected}
      onSelectedRegionChange={(next, details) => (next === "spot" ? details.cancel() : setSelected(next))}
    />
  )
}

test("a controlled selection follows the prop and can be refused", async () => {
  const user = userEvent.setup()
  render(<Controlled />)
  const leaf = screen.getByRole("button", { name: "Leaf 92%" })
  expect(leaf.getAttribute("aria-pressed")).toBe("true")
  await user.click(screen.getByRole("button", { name: "Spot" }))
  expect(screen.getByRole("button", { name: "Spot" }).getAttribute("aria-pressed")).toBe("false")
  await user.click(screen.getByRole("button", { name: "Stem" }))
  expect(screen.getByRole("button", { name: "Stem" }).getAttribute("aria-pressed")).toBe("true")
  expect(leaf.getAttribute("aria-pressed")).toBe("false")
})

test("error: the message, Retry, and an assertive announcement", async () => {
  const user = userEvent.setup()
  const onRetry = vi.fn()
  const { rerender } = render(<Scan status="scanning" onRetry={onRetry} />)
  rerender(<Scan status="error" error="The model could not read this image" onRetry={onRetry} />)
  await waitFor(() => expect(readAnnouncements().assertive).toBe("The model could not read this image"))
  expect(screen.getAllByText("The model could not read this image").length).toBeGreaterThan(0)
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull()
  await user.click(screen.getByRole("button", { name: "Retry scan" }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test("status changes are read in the labels' words, progress at most every tenth and two seconds", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(0)
  const labels = { scanning: "Analysing", progress: (percent: number) => `${String(percent)} percent` }
  const { rerender } = render(<Scan labels={labels} />)
  const at = (time: number, props: Partial<ImageScanProps>) => {
    vi.setSystemTime(time)
    rerender(<Scan labels={labels} {...props} />)
  }
  at(0, { status: "scanning" })
  at(100, { status: "scanning", progress: 0.05 })
  at(200, { status: "scanning", progress: 0.12 })
  at(300, { status: "scanning", progress: 0.25 })
  at(2500, { status: "scanning", progress: 0.27 })
  at(2600, { status: "scanning", progress: 0.28 })
  at(5000, { status: "scanning", progress: 0.61 })
  // Long enough after, but still the same tenth.
  at(7500, { status: "scanning", progress: 0.67 })
  at(7600, { status: "result", regions: regions.slice(0, 1) })
  at(7700, { status: "scanning" })
  at(7800, { status: "error" })
  expect(announced).toEqual([
    "polite: Analysing",
    "polite: 5 percent",
    "polite: 27 percent",
    "polite: 61 percent",
    "polite: 1 item found",
    "polite: Analysing",
    "assertive: The scan failed",
  ])
  vi.useRealTimers()
  await waitFor(() => expect(readAnnouncements().assertive).toBe("The scan failed"))
})

test("the frame takes the image's ratio, or its own with the fit the regions follow", () => {
  const { rerender } = render(<Scan />)
  const group = screen.getByRole("group", { name: "A potted plant" })
  expect(group.style.getPropertyValue("--image-scan-ratio")).toBe(String(800 / 600))
  expect(group.style.getPropertyValue("--image-scan-frame-ratio")).toBe(String(800 / 600))
  rerender(<Scan aspectRatio={1} fit="cover" />)
  expect(group.style.getPropertyValue("--image-scan-frame-ratio")).toBe("1")
  expect(document.querySelector('[data-slot="image-scan-layer"]')?.getAttribute("data-fit")).toBe("cover")
  expect(screen.getByRole("img").getAttribute("data-fit")).toBe("cover")
})

test("an agent can scan, cancel, select a region and retry", async () => {
  const onScan = vi.fn()
  const onCancel = vi.fn()
  const onRetry = vi.fn()
  const onSelectedRegionChange = vi.fn()
  const handlers = { onScan, onCancel, onRetry, onSelectedRegionChange }
  const { rerender, unmount } = render(<Scan {...handlers} />)
  await tick()

  const entries = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries()) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const scan = entries().find((entry) => entry.component === "image-scan")
  expect(scan?.label).toBe("A potted plant")
  expect(scan?.actions).toEqual(expect.arrayContaining(["cancel", "retry", "scan", "selectRegion"]))

  expect((await agent.act({ steps: [{ ref: "A potted plant", action: "scan" }] })).ok).toBe(true)
  expect(onScan).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))

  rerender(<Scan status="scanning" {...handlers} />)
  await tick()
  expect((await agent.act({ steps: [{ ref: "A potted plant", action: "cancel" }] })).ok).toBe(true)
  expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))

  rerender(<Scan status="result" regions={regions} {...handlers} />)
  await tick()
  const items = entries().find((entry) => entry.component === "image-scan")?.items
  expect(items?.map((item) => item.label)).toEqual(["Stem", "Spot", "Leaf"])
  const select = await agent.act({ steps: [{ ref: "A potted plant", action: "selectRegion", args: ["Leaf"] }] })
  expect(select.ok, select.error?.message).toBe(true)
  expect(onSelectedRegionChange).toHaveBeenLastCalledWith("leaf", expect.objectContaining({ source: "agent" }))

  rerender(<Scan status="error" {...handlers} />)
  await tick()
  expect(entries().find((entry) => entry.component === "image-scan")?.status).toBe("error")
  const early = await agent.act({ steps: [{ ref: "A potted plant", action: "cancel" }] })
  expect(early.ok).toBe(false)
  expect(early.error?.message).toContain("cancel works only while scanning (status: error).")
  expect((await agent.act({ steps: [{ ref: "A potted plant", action: "retry" }] })).ok).toBe(true)
  expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ source: "agent" }))
  unmount()
})

const refuse = (details: { source: string; cancel: () => void }) => {
  if (details.source === "agent") details.cancel()
}
const step = (action: string, args?: unknown[]) => agent.act({ steps: [{ ref: "A potted plant", action, args }] })
const status = () => screen.getByRole("group", { name: "A potted plant" }).dataset.status

test("agent: a scan, cancel, retry or selection the app refuses fails the step and changes nothing", async () => {
  const onScan = vi.fn(refuse)
  const onCancel = vi.fn(refuse)
  const onRetry = vi.fn(refuse)
  const onSelectedRegionChange = vi.fn((_region: string | null, details: ImageScanChangeDetails) => refuse(details))
  const handlers = { onScan, onCancel, onRetry, onSelectedRegionChange }
  const { rerender } = render(<Scan {...handlers} />)
  await tick()

  for (const [state, action] of [
    ["uploaded", "scan"],
    ["scanning", "cancel"],
    ["error", "retry"],
  ] as const) {
    rerender(<Scan status={state} {...handlers} />)
    await tick()
    const result = await step(action)
    expect(result.ok, action).toBe(false)
    expect(result.error?.message).toContain(`${action} was refused by the app.`)
    expect(status()).toBe(state)
  }
  expect(onScan).toHaveBeenCalledOnce()
  expect(onCancel).toHaveBeenCalledOnce()
  expect(onRetry).toHaveBeenCalledOnce()

  rerender(<Scan status="result" regions={regions} {...handlers} />)
  await tick()
  const select = await step("selectRegion", ["Leaf"])
  expect(select.ok).toBe(false)
  expect(select.error?.message).toContain("selectRegion was refused by the app.")
  expect(screen.getByRole("button", { name: "Leaf 92%" }).getAttribute("aria-pressed")).toBe("false")

  const early = await step("scan")
  expect(early.error?.message).toContain("scan works only before a scan (status: result).")
})
