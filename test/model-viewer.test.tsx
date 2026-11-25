import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest"

import { ModelViewer, type ModelViewerProps } from "@/components/ui/model-viewer"
import { modelViewer } from "@/components/ui/model-viewer-primitive"

import { axeViolations } from "./axe"
import { fakeScene } from "./fixtures/model/fake-scene"

vi.mock("@/components/ui/model-viewer-scene", () => import("./fixtures/model/fake-scene"))

const agent = createAgent()

// Workaround: jsdom has no WebGL: report a context so the viewer takes its WebGL path, with the scene stubbed out.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ getExtension: () => null })) as never
})

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("reduce"),
    addEventListener() {},
    removeEventListener() {},
  })) as never
}

afterEach(() => {
  setReducedMotion(false)
  fakeScene.renders = 0
})

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const markup = `<root><stage label="Figure"></stage><poster></poster><canvas></canvas><message></message><controls label="Controls"></controls></root>`

function outcome(call: () => unknown) {
  try {
    return call()
  } catch (error) {
    return (error as Error).message
  }
}

describe("primitive", () => {
  test("nothing moves before the model loads, and says why", () => {
    const view = mount(modelViewer, {}, markup)
    try {
      expect(outcome(() => view.api.rotate(15))).toBe("rotate works once the model has loaded (status: idle).")
      expect(outcome(() => view.api.play())).toBe("play works once the model has loaded (status: idle).")
      view.api.loaded([])
      expect(outcome(() => view.api.play())).toBe("play needs an animation clip, and this model has none.")
      expect(outcome(() => view.api.setView("top" as never))).toBe(
        'No view "top". Views: front, three-quarter, side, back.',
      )
    } finally {
      view.unmount()
    }
  })

  test("arrows turn, + and - zoom, Home resets, and a turn frees the view", async () => {
    const onViewChange = vi.fn()
    const view = mount(modelViewer, { onViewChange }, markup)
    try {
      view.api.loaded(["Idle"])
      await view.settle()
      const stage = view.part("stage") as HTMLElement
      expect(stage.getAttribute("role")).toBe("img")
      expect(stage.getAttribute("aria-label")).toBe("Figure")
      expect(stage.getAttribute("tabindex")).toBe("0")
      stage.focus()
      await view.keys("ArrowRight", "ArrowDown")
      expect(view.state).toMatchObject({ yaw: -15, pitch: 15, view: null, motion: "tween" })
      expect(onViewChange).toHaveBeenCalledWith(null, expect.objectContaining({ reason: "keyboard" }))
      await view.keys("=", "=")
      expect(view.state.zoom).toBeCloseTo(1.5625)
      await view.keys("-")
      expect(view.state.zoom).toBeCloseTo(1.25)
      await view.keys("Home")
      expect(view.state).toMatchObject({ yaw: 0, pitch: 0, zoom: 1, view: "front" })
    } finally {
      view.unmount()
    }
  })

  test("a view turns the camera the short way, and pitch and zoom stay in range", () => {
    const view = mount(modelViewer, { defaultView: "back" }, markup)
    try {
      view.api.loaded([])
      expect(view.state).toMatchObject({ yaw: 180, view: "back" })
      view.api.setView("three-quarter")
      expect(view.state).toMatchObject({ yaw: 35, pitch: 8, view: "three-quarter" })
      view.api.rotate(0, 500)
      expect(view.state.pitch).toBe(75)
      view.api.zoom(20)
      expect(view.state.zoom).toBe(3)
      view.api.rotate(200)
      view.api.setView("back")
      expect(view.state.yaw).toBe(-180)
    } finally {
      view.unmount()
    }
  })

  test("a drag turns with the pointer at once, two pointers pinch to zoom", () => {
    const view = mount(modelViewer, {}, markup)
    try {
      view.api.loaded([])
      const stage = view.part("stage") as HTMLElement
      const pointer = (type: string, id: number, x: number, y = 0) =>
        stage.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, button: 0, bubbles: true }))
      pointer("pointerdown", 1, 100)
      expect(view.state.dragging).toBe(true)
      pointer("pointermove", 1, 150, 10)
      expect(view.state).toMatchObject({ yaw: -20, pitch: 4, motion: "jump" })
      pointer("pointerdown", 2, 250, 10)
      pointer("pointermove", 2, 350, 10)
      expect(view.state.zoom).toBeCloseTo(2)
      pointer("pointerup", 2, 350)
      pointer("pointerup", 1, 150)
      expect(view.state.dragging).toBe(false)
    } finally {
      view.unmount()
    }
  })

  test("clips play by default, a choice sticks, and reduced motion starts them paused with jumps", () => {
    const view = mount(modelViewer, {}, markup)
    try {
      view.api.loaded(["Idle", "Wave"])
      expect([view.api.isPlaying(), view.api.currentClip()]).toEqual([true, "Idle"])
      view.api.selectClip("wave")
      view.api.pause()
      expect([view.api.isPlaying(), view.api.currentClip()]).toEqual([false, "Wave"])
      expect(outcome(() => view.api.selectClip("Run"))).toBe('No clip "Run". Clips: Idle, Wave.')
    } finally {
      view.unmount()
    }
    setReducedMotion(true)
    const still = mount(modelViewer, {}, markup)
    try {
      still.api.loaded(["Idle"])
      expect(still.api.isPlaying()).toBe(false)
      still.api.setView("side")
      expect(still.state.motion).toBe("jump")
    } finally {
      still.unmount()
    }
  })

  test("renders on the server", () => {
    checkServer(modelViewer, {}, markup)
    checkServer(modelViewer, { view: "side", interactive: false }, markup)
  })
})

function Viewer(props: Partial<ModelViewerProps>) {
  return (
    <main>
      <ModelViewer
        model="figure.glb"
        alt="A stylised figure"
        poster="poster.png"
        summary="A figure in a teal shirt."
        {...props}
      />
    </main>
  )
}

test("the server renders the poster and no scene", () => {
  const html = renderToString(<Viewer />)
  expect(html).toContain('role="img"')
  expect(html).toContain('aria-label="A stylised figure"')
  expect(html).toContain("poster.png")
  expect(html).not.toContain("fake-scene")
})

test("the stage is a named image, described by the hint and the summary, with named controls", async () => {
  render(<Viewer />)
  await tick()
  const stage = screen.getByRole("img", { name: "A stylised figure" })
  const described = (stage.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id))
  expect(described.map((element) => element?.textContent)).toEqual([
    "Drag or use the arrow keys to turn, + and - to zoom, Home to reset.",
    "A figure in a teal shirt.",
  ])
  expect(screen.getByRole("group", { name: "3D view controls" })).toBeTruthy()
  for (const name of ["Zoom in", "Zoom out", "Reset view", "Play animation"]) {
    expect(screen.getByRole("button", { name })).toBeTruthy()
  }
  expect(screen.getByRole("radiogroup", { name: "View" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "Animation" })).toBeTruthy()
  expect(document.querySelector('[data-slot="model-viewer-poster"]')?.getAttribute("data-status")).toBe("ready")
  expect(await axeViolations(document.body)).toEqual([])
})

test("controls call the viewer: views, play, the clip and reset", async () => {
  const user = userEvent.setup()
  const onViewChange = vi.fn()
  const onPlayingChange = vi.fn()
  const onClipChange = vi.fn()
  render(<Viewer onViewChange={onViewChange} onPlayingChange={onPlayingChange} onClipChange={onClipChange} />)
  await tick()
  await user.click(screen.getByRole("radio", { name: "Side" }))
  expect(onViewChange).toHaveBeenLastCalledWith("side", expect.objectContaining({ reason: "trigger-press" }))
  expect(screen.getByRole("radio", { name: "Side" }).getAttribute("aria-checked")).toBe("true")
  await user.click(screen.getByRole("button", { name: "Play animation" }))
  expect(onPlayingChange).toHaveBeenLastCalledWith(false, expect.anything())
  expect(screen.getByRole("button", { name: "Play animation" }).getAttribute("aria-pressed")).toBe("false")
  await user.selectOptions(screen.getByRole("combobox", { name: "Animation" }), "Wave")
  expect(onClipChange).toHaveBeenLastCalledWith("Wave", expect.anything())
  await user.click(screen.getByRole("button", { name: "Reset view" }))
  expect(onViewChange).toHaveBeenLastCalledWith("front", expect.anything())
})

test("new weights reach the scene in one render, and turning the camera renders nothing", async () => {
  const { rerender } = render(<Viewer weights={{ Smile: 0 }} />)
  await tick()
  const before = fakeScene.renders
  rerender(<Viewer weights={{ Smile: 1 }} />)
  expect(fakeScene.props?.weights).toEqual({ Smile: 1 })
  expect(fakeScene.renders - before).toBe(1)
  const stage = screen.getByRole("img", { name: "A stylised figure" })
  fireEvent.keyDown(stage, { key: "ArrowLeft" })
  fireEvent.keyDown(stage, { key: "+" })
  fireEvent.pointerDown(stage, { pointerId: 1, clientX: 0, button: 0 })
  fireEvent.pointerMove(stage, { pointerId: 1, clientX: 40 })
  fireEvent.pointerUp(stage, { pointerId: 1, clientX: 40 })
  expect(fakeScene.renders - before).toBe(1)
})

test("without controls the stage isn't focusable and has no controls", async () => {
  render(<Viewer controls={false} />)
  await tick()
  const stage = screen.getByRole("img", { name: "A stylised figure" })
  expect(stage.hasAttribute("tabindex")).toBe(false)
  expect(screen.queryByRole("group", { name: "3D view controls" })).toBeNull()
  expect(document.getElementById(stage.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
    "A figure in a teal shirt.",
  )
})

test("load={false} holds the scene back", async () => {
  render(<Viewer load={false} />)
  await tick()
  expect(screen.queryByTestId("fake-scene")).toBeNull()
  expect(fakeScene.renders).toBe(0)
})

test("an agent can turn, zoom, choose a view and a clip, pause and reset", async () => {
  const onViewChange = vi.fn()
  const { unmount } = render(<Viewer onViewChange={onViewChange} />)
  await tick()
  const entries = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries()) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const viewer = entries().find((entry) => entry.component === "model-viewer")
  expect(viewer?.label).toBe("A stylised figure")
  expect(viewer?.actions).toEqual(
    expect.arrayContaining(["rotate", "zoom", "reset", "setView", "play", "pause", "selectClip"]),
  )
  expect(viewer?.items?.map((item) => item.label)).toEqual(["Idle", "Wave"])
  const ref = "A stylised figure"
  const result = await agent.act({
    steps: [
      { ref, action: "setView", args: ["three-quarter"] },
      { ref, action: "rotate", args: [30] },
      { ref, action: "zoom", args: [1] },
      { ref, action: "selectClip", args: ["Wave"] },
      { ref, action: "pause" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onViewChange).toHaveBeenCalledWith("three-quarter", expect.objectContaining({ source: "agent" }))
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Animation" })).toHaveProperty("value", "Wave"))
  expect(screen.getByRole("button", { name: "Play animation" }).getAttribute("aria-pressed")).toBe("false")
  const wrong = await agent.act({ steps: [{ ref, action: "selectClip", args: ["Run"] }] })
  expect(wrong.error?.message).toContain('No clip "Run". Clips: Idle, Wave.')
  expect((await agent.act({ steps: [{ ref, action: "reset" }] })).ok).toBe(true)
  await waitFor(() => expect(screen.getByRole("radio", { name: "Front" }).getAttribute("aria-checked")).toBe("true"))
  unmount()
})

test("aligned weights, target names and expressions reach the scene; a new model replaces the old without a reload", async () => {
  const weights = new Float32Array([0.5, 1])
  const { rerender } = render(<Viewer weights={weights} targetNames={["body.pc00", "expr.mouthSmileLeft"]} />)
  await tick()
  expect(fakeScene.props?.weights).toBe(weights)
  expect(fakeScene.props?.targetNames).toEqual(["body.pc00", "expr.mouthSmileLeft"])
  rerender(<Viewer weights={weights} expressions={{ mouthSmileLeft: 1 }} model="final.glb" />)
  await tick()
  expect(fakeScene.props?.model).toBe("final.glb")
  expect(fakeScene.props?.expressions).toEqual({ mouthSmileLeft: 1 })
  expect(document.querySelector('[data-slot="model-viewer"]')?.getAttribute("data-status")).toBe("ready")
})
