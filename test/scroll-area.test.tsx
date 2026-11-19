import { act, render, screen } from "@testing-library/react"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import {
  createScrollAreaController,
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollAreaScrollbar,
  ScrollAreaViewport,
} from "@/components/ui/scroll-area"
import { scrollArea } from "@/components/ui/scroll-area-primitive"

import { axeViolations } from "./axe"

const markup = `<root><viewport aria-label="Notes"><content><p>Text</p></content></viewport><scrollbar orientation="vertical"><thumb orientation="vertical"></thumb></scrollbar><corner></corner></root>`

// jsdom lays nothing out, so a test gives the viewport its sizes and scroll position.
function layOut(el: HTMLElement, sizes: { client: number; scroll: number; top?: number }) {
  let top = sizes.top ?? 0
  Object.defineProperties(el, {
    clientHeight: { configurable: true, get: () => sizes.client },
    scrollHeight: { configurable: true, get: () => sizes.scroll },
    clientWidth: { configurable: true, get: () => 100 },
    scrollWidth: { configurable: true, get: () => 100 },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    },
  })
  el.scrollTo = ((options: ScrollToOptions) => {
    if (options.top !== undefined) top = options.top
    el.dispatchEvent(new Event("scroll"))
  }) as typeof el.scrollTo
  return {
    scrollTo(value: number) {
      top = value
      el.dispatchEvent(new Event("scroll"))
    },
  }
}

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

let views: { unmount: () => void }[] = []
afterEach(() => {
  for (const view of views) view.unmount()
  views = []
})

function mountArea(content = "<p>Text</p>") {
  const view = mount(scrollArea, {}, markup.replace("<p>Text</p>", content))
  views.push(view)
  const viewport = view.part("viewport")!
  return { view, viewport }
}

test("primitive: renders on the server", () => {
  checkServer(scrollArea, { type: "auto" }, markup)
})

test("primitive: a scroll updates the edges and the thumb in the scroll event, without waiting for a frame", () => {
  const frame = vi.spyOn(window, "requestAnimationFrame")
  const { view, viewport } = mountArea()
  const { scrollTo } = layOut(viewport, { client: 100, scroll: 400 })
  scrollTo(0)
  expect(view.root.hasAttribute("data-at-y-start")).toBe(true)
  scrollTo(150)
  expect(view.state.overflowY).toBe(true)
  expect(view.root.hasAttribute("data-at-start")).toBe(false)
  expect(view.root.hasAttribute("data-scrolling")).toBe(true)
  expect(view.root.style.getPropertyValue("--scroll-area-overflow-y-start")).toBe("150px")
  expect(view.root.style.getPropertyValue("--scroll-area-overflow-y-end")).toBe("150px")
  expect(view.root.style.getPropertyValue("--scroll-area-progress-y")).toBe("0.5")
  scrollTo(300)
  expect(view.root.hasAttribute("data-at-end")).toBe(true)
  expect(frame).not.toHaveBeenCalled()
  frame.mockRestore()
})

test("primitive: a scroller inside the viewport doesn't make it measure again", () => {
  const { view, viewport } = mountArea(`<div data-inner="">Inner</div>`)
  const { scrollTo } = layOut(viewport, { client: 100, scroll: 400 })
  scrollTo(0)
  const reads = vi.fn(() => 0)
  Object.defineProperty(viewport, "scrollTop", { configurable: true, get: reads })
  viewport.querySelector("[data-inner]")!.dispatchEvent(new Event("scroll"))
  expect(reads).not.toHaveBeenCalled()
  expect(view.root.hasAttribute("data-scrolling")).toBe(false)
})

test("primitive: an overflowing viewport with nothing focusable is a tab stop, until something focusable arrives", async () => {
  const { viewport } = mountArea()
  const { scrollTo } = layOut(viewport, { client: 100, scroll: 400 })
  expect(viewport.hasAttribute("tabindex")).toBe(false)
  scrollTo(0)
  expect(viewport.getAttribute("tabindex")).toBe("0")
  const button = document.createElement("button")
  viewport.firstElementChild!.append(button)
  await tick()
  expect(viewport.hasAttribute("tabindex")).toBe(false)
  button.disabled = true
  await tick()
  expect(viewport.getAttribute("tabindex")).toBe("0")
  button.disabled = false
  await tick()
  expect(viewport.hasAttribute("tabindex")).toBe(false)
  button.remove()
  await tick()
  expect(viewport.getAttribute("tabindex")).toBe("0")
})

test("primitive: a roving tabindex moving between rows never rescans the content", async () => {
  const rows = Array.from(
    { length: 50 },
    (_, index) => `<div tabindex="${index === 0 ? 0 : -1}">Row ${String(index)}</div>`,
  )
  const { viewport } = mountArea(rows.join(""))
  layOut(viewport, { client: 100, scroll: 4000 }).scrollTo(0)
  expect(viewport.hasAttribute("tabindex")).toBe(false)
  const scans = vi.spyOn(viewport, "querySelectorAll")
  const items = [...viewport.querySelectorAll<HTMLElement>("[tabindex]")]
  scans.mockClear()
  for (let index = 1; index < items.length; index++) {
    items[index - 1]!.tabIndex = -1
    items[index]!.tabIndex = 0
    await tick()
  }
  // The other order, the old stop first and the new one after, as some roving code writes it.
  items.at(-1)!.tabIndex = -1
  items[0]!.tabIndex = 0
  await tick()
  expect(scans).not.toHaveBeenCalled()
  expect(viewport.hasAttribute("tabindex")).toBe(false)
  items[0]!.tabIndex = -1
  await tick()
  expect(scans).toHaveBeenCalledTimes(1)
  expect(viewport.getAttribute("tabindex")).toBe("0")
})

test("primitive: inert content holds no focus, and an authored tabindex is left alone", async () => {
  const { viewport } = mountArea(`<div><a href="#/a">A</a></div>`)
  layOut(viewport, { client: 100, scroll: 400 }).scrollTo(0)
  expect(viewport.hasAttribute("tabindex")).toBe(false)
  viewport.querySelector("div")!.setAttribute("inert", "")
  await tick()
  expect(viewport.getAttribute("tabindex")).toBe("0")
  viewport.querySelector("div")!.removeAttribute("inert")
  await tick()
  expect(viewport.hasAttribute("tabindex")).toBe(false)

  const authored = mount(scrollArea, {}, markup.replace("<viewport ", `<viewport tabindex="-1" `))
  views.push(authored)
  const own = authored.part("viewport")!
  layOut(own, { client: 100, scroll: 400 }).scrollTo(0)
  expect(own.getAttribute("tabindex")).toBe("-1")
})

test("primitive: a hidden scrollbar lets presses through, and type always keeps it shown", async () => {
  const { view, viewport } = mountArea()
  layOut(viewport, { client: 100, scroll: 400 }).scrollTo(0)
  const scrollbar = view.part("scrollbar")!
  expect(scrollbar.style.pointerEvents).toBe("none")
  expect(scrollbar.getAttribute("aria-hidden")).toBe("true")
  view.root.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }))
  expect(scrollbar.hasAttribute("data-visible")).toBe(true)
  expect(scrollbar.style.pointerEvents).toBe("")

  const always = mount(scrollArea, { type: "always" }, markup)
  views.push(always)
  const fits = always.part("viewport")!
  layOut(fits, { client: 100, scroll: 100 })
  // A new child is what a ResizeObserver reports in a browser: the viewport measures again.
  fits.append(document.createElement("p"))
  await tick()
  expect(always.part("scrollbar")!.hasAttribute("data-visible")).toBe(true)
})

test("controller and agents scroll to either end", async () => {
  const controller = createScrollAreaController()
  render(
    <ScrollArea className="h-40" controller={controller}>
      <ScrollAreaViewport aria-label="Release notes">
        <ScrollAreaContent>
          <p>Notes</p>
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar />
      <ScrollAreaScrollbar orientation="horizontal" />
      <ScrollAreaCorner />
    </ScrollArea>,
  )
  await tick()
  const viewport = screen.getByLabelText("Release notes")
  layOut(viewport, { client: 100, scroll: 400 }).scrollTo(0)
  expect(controller.isAtStart()).toBe(true)
  act(() => controller.scrollToEnd({ behavior: "instant" }))
  expect(viewport.scrollTop).toBe(300)
  expect(controller.isAtEnd()).toBe(true)

  const agent = createAgent()
  const entry = agent.snapshot().find((item) => item.component === "scroll-area")
  expect(entry).toMatchObject({ label: "Release notes", actions: ["scrollToEnd", "scrollToStart"] })
  const result = await act(() =>
    agent.act({ steps: [{ ref: "Release notes", action: "scrollToStart", args: [{ behavior: "instant" }] }] }),
  )
  expect(result.ok).toBe(true)
  expect(viewport.scrollTop).toBe(0)
})

test("a scrollbar marked data-agent-hidden leaves its scroll area out of the snapshot", async () => {
  render(
    <ScrollArea className="h-40">
      <ScrollAreaViewport aria-label="Hidden notes">
        <p>Notes</p>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar data-agent-hidden="" />
    </ScrollArea>,
  )
  await tick()
  expect(
    createAgent()
      .snapshot()
      .some((item) => item.component === "scroll-area"),
  ).toBe(false)
})

test("a scroll area with scrollbars, the corner and a labelled viewport has no axe violations", async () => {
  const { container } = render(
    <ScrollArea className="h-40">
      <ScrollAreaViewport render={<section />} aria-label="Changelog">
        <ScrollAreaContent>
          <p>Notes</p>
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar />
      <ScrollAreaScrollbar orientation="horizontal" />
      <ScrollAreaCorner />
    </ScrollArea>,
  )
  await tick()
  expect(await axeViolations(container)).toEqual([])
})
