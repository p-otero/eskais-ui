import { render, screen } from "@testing-library/react"
import { TrashIcon } from "lucide-react"
import type { SVGAttributes } from "react"
import { expect, test } from "vitest"

import { Icon } from "@/components/ui/icon"

function DotIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

test("lucide icons are decorative on their own", () => {
  const { container } = render(<TrashIcon />)
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
})

test("a labelled icon is a named image", () => {
  render(<Icon icon={TrashIcon} label="Deleted" className="size-4" />)
  const image = screen.getByRole("img", { name: "Deleted" })
  expect(image.getAttribute("aria-hidden")).toBeNull()
  expect(image.getAttribute("data-slot")).toBe("icon")
  expect(image.getAttribute("class")).toContain("size-4")
})

test("without a label it stays hidden, for lucide and for any SVG component", () => {
  const { container } = render(
    <>
      <Icon icon={TrashIcon} />
      <Icon icon={DotIcon} className="text-success" />
    </>,
  )
  const [lucide, own] = container.querySelectorAll("svg")
  expect(lucide?.getAttribute("aria-hidden")).toBe("true")
  expect(own?.getAttribute("aria-hidden")).toBe("true")
  expect(own?.getAttribute("class")).toContain("text-success")
  expect(screen.queryByRole("img")).toBeNull()
})
