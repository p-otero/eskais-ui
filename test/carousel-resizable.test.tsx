import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterAll, beforeAll, expect, test, vi } from "vitest"

import {
  Carousel,
  CarouselContent,
  CarouselIndicator,
  CarouselIndicatorGroup,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselViewport,
} from "@/components/ui/carousel"
import { Resizable, ResizableHandle, ResizablePanel } from "@/components/ui/resizable"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()
const WIDTH = 300

// jsdom has no layout: give the viewport and each slide a width so the carousel can measure its pages.
const restore: (() => void)[] = []
function stub<K extends keyof HTMLElement>(key: K, get: (element: HTMLElement) => unknown) {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)
  Object.defineProperty(HTMLElement.prototype, key, {
    configurable: true,
    get(this: HTMLElement) {
      const value = get(this)
      return value === undefined ? original?.get?.call(this) : value
    },
  })
  restore.push(() => original && Object.defineProperty(HTMLElement.prototype, key, original))
}
function slotOf(element: HTMLElement) {
  return element.dataset.slot
}
function indexOf(element: HTMLElement) {
  return [...(element.parentElement?.children ?? [])].indexOf(element)
}
beforeAll(() => {
  stub("clientWidth", (el) =>
    slotOf(el) === "carousel-viewport" || slotOf(el) === "carousel-item" ? WIDTH : undefined,
  )
  stub("offsetWidth", (el) =>
    slotOf(el) === "carousel-viewport" || slotOf(el) === "carousel-item" ? WIDTH : undefined,
  )
  stub("offsetLeft", (el) => (slotOf(el) === "carousel-item" ? indexOf(el) * WIDTH : undefined))
  stub("scrollWidth", (el) => (slotOf(el) === "carousel-viewport" ? WIDTH * slides.length : undefined))
  const rect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element) {
    const el = this as HTMLElement
    const viewport = el.closest<HTMLElement>("[data-slot=carousel-viewport]")
    if (slotOf(el) === "carousel-item" && viewport) {
      const x = indexOf(el) * WIDTH - viewport.scrollLeft
      return DOMRect.fromRect({ x, y: 0, width: WIDTH, height: 100 })
    }
    if (slotOf(el) === "carousel-viewport") return DOMRect.fromRect({ x: 0, y: 0, width: WIDTH, height: 100 })
    return rect.call(this)
  }
  restore.push(() => (Element.prototype.getBoundingClientRect = rect))
})
afterAll(() => restore.forEach((undo) => undo()))
const slides = ["Atlas", "Borealis", "Cygnus"]

function Featured({ onPageChange }: { onPageChange?: (page: number) => void }) {
  return (
    <Carousel aria-label="Featured" onPageChange={onPageChange}>
      <CarouselViewport>
        <CarouselContent>
          {slides.map((slide) => (
            <CarouselItem key={slide}>{slide}</CarouselItem>
          ))}
        </CarouselContent>
      </CarouselViewport>
      <CarouselPrevious />
      <CarouselNext />
      <CarouselIndicatorGroup aria-label="Choose slide">
        {slides.map((slide, index) => (
          <CarouselIndicator key={slide} page={index + 1} />
        ))}
      </CarouselIndicatorGroup>
    </Carousel>
  )
}

test("a carousel pages with Next, Previous and the arrow keys", async () => {
  const user = userEvent.setup()
  const onPageChange = vi.fn()
  render(<Featured onPageChange={onPageChange} />)
  await settle()
  expect(screen.getByRole("region", { name: "Featured" })).toBeTruthy()
  const previous = screen.getByRole("button", { name: "Previous slide" })
  expect(previous.getAttribute("aria-disabled")).toBe("true")

  await user.click(screen.getByRole("button", { name: "Next slide" }))
  expect(onPageChange).toHaveBeenLastCalledWith(2, expect.objectContaining({ reason: "next-press" }))
  expect(screen.getByRole("tab", { name: "Slide 2" }).getAttribute("aria-selected")).toBe("true")

  const viewport = document.querySelector<HTMLElement>("[data-slot=carousel-viewport]") as HTMLElement
  viewport.focus()
  fireEvent.keyDown(viewport, { key: "ArrowRight" })
  expect(onPageChange).toHaveBeenLastCalledWith(3, expect.objectContaining({ reason: "list-navigation" }))
  await user.click(previous)
  expect(onPageChange).toHaveBeenLastCalledWith(2, expect.objectContaining({ reason: "previous-press" }))
})

test("a carousel has no axe violations and an agent can page it", async () => {
  const { container } = render(<Featured />)
  await settle()
  expect(await axeViolations(container)).toEqual([])
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const carousel = components.find((entry) => entry.component === "carousel")
  expect(carousel?.label).toBe("Featured")
  expect(carousel?.actions).toContain("setPage")
  const result = await act(() => agent.act({ steps: [{ ref: "Featured", action: "setPage", args: [2] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("tab", { name: "Slide 2" }).getAttribute("aria-selected")).toBe("true")
})

function Editor() {
  return (
    <Resizable className="h-64">
      <ResizablePanel defaultSize={30} minSize={20} collapsible>
        Files
      </ResizablePanel>
      <ResizableHandle aria-label="Resize files" withGrip />
      <ResizablePanel>Editor</ResizablePanel>
    </Resizable>
  )
}

test("a resizable handle moves with the arrow keys and collapses with Enter", async () => {
  const user = userEvent.setup()
  const { container } = render(<Editor />)
  await settle()
  const handle = screen.getByRole("separator", { name: "Resize files" })
  expect(handle.getAttribute("aria-valuenow")).toBe("30")
  expect(container.querySelector("[data-slot=resizable-grip]")).toBeTruthy()

  await user.tab()
  expect(document.activeElement).toBe(handle)
  await user.keyboard("{ArrowRight}")
  expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThan(30)
  await user.keyboard("{Shift>}{ArrowLeft}{/Shift}")
  expect(Number(handle.getAttribute("aria-valuenow"))).toBeLessThan(30)
  await user.keyboard("{Enter}")
  expect(handle.getAttribute("aria-valuenow")).toBe("0")
  expect(container.querySelector("[data-slot=resizable-panel]")?.hasAttribute("data-collapsed")).toBe(true)
  expect(await axeViolations(container)).toEqual([])
})
