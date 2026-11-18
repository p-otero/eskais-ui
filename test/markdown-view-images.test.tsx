import { render } from "@testing-library/react"
import { expect, test } from "vitest"

import { MarkdownView } from "@/components/ui/markdown-view"

const imageOf = (container: HTMLElement) => container.querySelector("img")

test("an image's size in its alt text reserves its box, as in Obsidian", () => {
  const { container } = render(<MarkdownView markdown="![A chart|640x360](chart.png)" />)
  const image = imageOf(container)
  expect(image?.getAttribute("alt")).toBe("A chart")
  expect(image?.getAttribute("width")).toBe("640")
  expect(image?.getAttribute("height")).toBe("360")
})

test("imageSize answers for images whose Markdown has no size", () => {
  const { container } = render(
    <MarkdownView
      markdown="![Logo](logo.svg)"
      imageSize={(src) => (src === "logo.svg" ? { width: 120, height: 40 } : undefined)}
    />,
  )
  const image = imageOf(container)
  expect(image?.getAttribute("alt")).toBe("Logo")
  expect([image?.getAttribute("width"), image?.getAttribute("height")]).toEqual(["120", "40"])
})

test("an image with no size known renders as before, and a | in prose alt text stays", () => {
  const { container } = render(<MarkdownView markdown="![Before | after](compare.png)" />)
  const image = imageOf(container)
  expect(image?.getAttribute("alt")).toBe("Before | after")
  expect(image?.hasAttribute("width")).toBe(false)
})
