import { render } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { useFlip } from "@/components/ui/use-flip"

function Row({ order }: { order: string[] }) {
  const root = useRef<HTMLDivElement>(null)
  useFlip(root, "[data-flip]", order.join(","))
  return (
    <div ref={root}>
      {order.map((key) => (
        <div key={key} data-flip={key} />
      ))}
    </div>
  )
}

// jsdom lays nothing out, so each element sits where its index says.
function layOut() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0
    return { left: 0, top: this.dataset.flip ? index * 40 : 0 } as DOMRect
  })
}

function timing(duration: string, easing: string) {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = real(element)
    return { ...style, transitionDuration: duration, transitionTimingFunction: easing } as CSSStyleDeclaration
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, "matchMedia")
})

test("slides moved elements from where they were, with the root's duration and its whole easing", () => {
  layOut()
  timing("0.18s, 0.14s", "cubic-bezier(0.2, 0, 0, 1), ease")
  const animate = vi.fn()
  HTMLElement.prototype.animate = animate
  const { rerender } = render(<Row order={["a", "b", "c"]} />)
  expect(animate).not.toHaveBeenCalled()
  rerender(<Row order={["b", "a", "c"]} />)
  expect(animate).toHaveBeenCalledTimes(2)
  expect(animate.mock.calls[0]?.[0]).toEqual([{ translate: "0px 40px" }, { translate: "0 0" }])
  expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" })
})

test("does nothing under reduced motion", () => {
  layOut()
  timing("180ms", "ease")
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: query.includes("reduce") }),
  })
  const animate = vi.fn()
  HTMLElement.prototype.animate = animate
  const { rerender } = render(<Row order={["a", "b"]} />)
  rerender(<Row order={["b", "a"]} />)
  expect(animate).not.toHaveBeenCalled()
})
