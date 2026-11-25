import { act, fireEvent, render, screen } from "@testing-library/react"
import type { MouseEvent } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { useVirtualRows } from "@/components/ui/virtual-rows"

const ROW = 50
const VIEW = 500
const keyAt = (index: number) => `row-${String(index)}`

// Workaround: jsdom has no layout: the scroller is VIEW px tall and scrolls when told to; rows are ROW px.
let scrollTop = 0
const scrolls: number[] = []
const descriptors = {
  clientHeight: Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight"),
  scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop"),
}
const isScroller = (el: Element) => el.getAttribute("data-testid") === "scroller"
beforeEach(() => {
  scrollTop = 0
  scrolls.length = 0
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get(this: Element) {
      return isScroller(this) ? VIEW : 0
    },
  })
  Object.defineProperty(Element.prototype, "scrollTop", {
    configurable: true,
    get(this: Element) {
      return isScroller(this) ? scrollTop : 0
    },
    set(this: Element, top: number) {
      if (isScroller(this)) scrollTop = top
    },
  })
  Element.prototype.scrollTo = function scrollTo(this: Element, options?: ScrollToOptions | number) {
    if (!isScroller(this) || typeof options !== "object") return
    scrollTop = options.top ?? scrollTop
    scrolls.push(scrollTop)
  } as Element["scrollTo"]
})
afterEach(() => {
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(Element.prototype, name, descriptor)
  }
  Reflect.deleteProperty(Element.prototype, "scrollTo")
  vi.unstubAllGlobals()
})

const parentOf = (el: HTMLElement) => el.parentElement

function Rows({ count = 1000 }: { count?: number }) {
  const { anchor, measureElement, segments, ...virtual } = useVirtualRows({
    count,
    estimateSize: ROW,
    getKey: keyAt,
    scrollElement: parentOf,
  })
  const run = (event: MouseEvent<HTMLButtonElement>) => {
    const index = Number(event.currentTarget.value)
    if (event.currentTarget.name === "scroll") virtual.scrollToIndex(index)
    else virtual.renderNow(index)
  }
  return (
    <div data-testid="scroller">
      {[5, 10].map((index) => (
        <button key={index} type="button" name="scroll" value={index} onClick={run}>
          Scroll to {index}
        </button>
      ))}
      <button type="button" name="render" value={800} onClick={run}>
        Render 800
      </button>
      <ul ref={anchor}>
        {segments.map((segment) =>
          segment.type === "gap" ? (
            <li key={segment.key} aria-hidden style={{ height: segment.size }} />
          ) : (
            <li key={segment.key} data-index={segment.index} ref={measureElement}>
              Row {segment.index}
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

const renderedIndexes = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("li[data-index]")].map((row) => Number(row.dataset.index))

const scrollerOf = (container: HTMLElement) => container.querySelector('[data-testid="scroller"]') as HTMLElement

function scrollBy(container: HTMLElement, top: number) {
  scrollTop = top
  act(() => {
    scrollerOf(container).dispatchEvent(new Event("scroll"))
  })
}

const nextPaint = () => act(() => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done))))

test("a row the browser centred on focus is aligned from where the list was, one row per arrow key", () => {
  const { container } = render(<Rows />)
  expect(renderedIndexes(container)).toContain(10)
  scrollTop = 300
  fireEvent.click(screen.getByRole("button", { name: "Scroll to 10" }))
  expect(scrolls).toEqual([11 * ROW - VIEW])
  fireEvent.click(screen.getByRole("button", { name: "Scroll to 5" }))
  expect(scrolls).toHaveLength(1)
})

test("a scroll that only moves rows out of view renders after the next paint; one that shows a new row, at once", async () => {
  const { container } = render(<Rows />)
  const before = renderedIndexes(container)
  scrollBy(container, ROW)
  expect(renderedIndexes(container)).toEqual(before)
  await nextPaint()
  expect(renderedIndexes(container)).not.toEqual(before)
  expect(renderedIndexes(container)).toContain(10 + 8)
  scrollBy(container, 100 * ROW)
  expect(renderedIndexes(container)).toContain(100)
})

test("renderNow renders a row far away at once", () => {
  const { container } = render(<Rows />)
  fireEvent.click(screen.getByRole("button", { name: "Render 800" }))
  expect(renderedIndexes(container)).toContain(800)
})

test("rows the size the virtualizer already has never reach its measure; a row of another size does", () => {
  type Entry = { target: Element; borderBoxSize: { blockSize: number }[] }
  const observers: { callback: (entries: Entry[]) => void; observed: Set<Element> }[] = []
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observed = new Set<Element>()
      constructor(public callback: (entries: Entry[]) => void) {
        observers.push(this)
      }
      observe(el: Element) {
        this.observed.add(el)
      }
      unobserve(el: Element) {
        this.observed.delete(el)
      }
      disconnect() {
        this.observed.clear()
      }
    },
  )
  const { container } = render(<Rows />)
  const rows = observers.find((observer) => [...observer.observed].some((el) => el.hasAttribute("data-index")))
  expect(rows).toBeDefined()
  const rowElements = [...container.querySelectorAll("li[data-index]")]
  act(() => rows?.callback(rowElements.map((target) => ({ target, borderBoxSize: [{ blockSize: ROW }] }))))
  const measuring = () =>
    observers.filter(
      (observer) => observer !== rows && [...observer.observed].some((el) => el.hasAttribute("data-index")),
    )
  expect(measuring()).toEqual([])
  const tall = rowElements[3] as Element
  act(() => rows?.callback([{ target: tall, borderBoxSize: [{ blockSize: ROW * 2 }] }]))
  expect(measuring().flatMap((observer) => [...observer.observed])).toEqual([tall])
})
