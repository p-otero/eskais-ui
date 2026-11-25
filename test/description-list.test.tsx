import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import {
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
  type DescriptionListLayout,
} from "@/components/ui/description-list"
import { descriptionValue } from "@/components/ui/description-list-primitive"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

afterEach(() => vi.unstubAllGlobals())

function stubClipboard() {
  const writeText = vi.fn(async (_text: string) => {})
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
  return writeText
}

function Details({ layout, columns }: { layout?: DescriptionListLayout; columns?: number }) {
  return (
    <DescriptionList layout={layout} columns={columns} aria-label="Deployment">
      <DescriptionItem>
        <DescriptionTerm>Region</DescriptionTerm>
        <DescriptionDetails>eu-west-1</DescriptionDetails>
      </DescriptionItem>
      <DescriptionItem>
        <DescriptionTerm>Commit</DescriptionTerm>
        <DescriptionDetails copyable mono>
          9f2c4e1
        </DescriptionDetails>
      </DescriptionItem>
      <DescriptionItem>
        <DescriptionTerm>Owner</DescriptionTerm>
        <DescriptionDetails>{null}</DescriptionDetails>
      </DescriptionItem>
    </DescriptionList>
  )
}

test("a dl of terms and details, each pair in a div, valid for every layout", async () => {
  for (const layout of ["stacked", "inline", "grid"] as const) {
    const { container, unmount } = render(<Details layout={layout} />)
    const list = container.querySelector("dl")!
    expect(list.dataset.layout).toBe(layout)
    expect([...list.children].map((child) => child.tagName)).toEqual(["DIV", "DIV", "DIV"])
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["Region", "Commit", "Owner"])
    expect(screen.getAllByRole("definition")[0]?.textContent).toBe("eu-west-1")
    expect(await axeViolations(container)).toEqual([])
    unmount()
  }
})

test("inline puts term and details side by side only in a wide container; grid caps its columns", () => {
  const { container, rerender } = render(<Details layout="inline" />)
  const list = container.querySelector("dl")!
  expect(list.className).toContain("@container/description-list")
  expect(container.querySelector("[data-slot=description-item]")?.className).toContain("@sm/description-list:flex-row")
  rerender(<Details layout="grid" columns={2} />)
  expect(list.className).toContain("grid-cols-(--description-grid)")
  expect(list.style.getPropertyValue("--description-grid")).toContain("calc((100% - 1 * var(--gap-section)) / 2)")
})

test("an empty value shows a dash and reads the overridable empty label", () => {
  const { rerender } = render(<Details />)
  const owner = screen.getAllByRole("definition")[2]!
  expect(owner.dataset.empty).toBe("")
  expect(owner.querySelector("[aria-hidden=true]")?.textContent).toBe("—")
  expect(owner.textContent).toContain("Not set")
  rerender(
    <DescriptionList labels={{ empty: "Sin asignar" }}>
      <DescriptionItem>
        <DescriptionTerm>Owner</DescriptionTerm>
        <DescriptionDetails />
      </DescriptionItem>
    </DescriptionList>,
  )
  expect(screen.getByRole("definition").textContent).toContain("Sin asignar")
})

test("copyable details copy their text, announce it, and are named by their term", async () => {
  // Workaround: user-event's setup() installs a clipboard of its own, so stub it after.
  const user = userEvent.setup()
  const writeText = stubClipboard()
  render(<Details />)
  const group = screen.getByRole("group", { name: "Commit" })
  await user.click(within(group).getByRole("button", { name: "Copy" }))
  expect(writeText).toHaveBeenCalledWith("9f2c4e1")
  expect(within(group).getByRole("status").textContent).toBe("Copied")
  expect(group.hasAttribute("data-copied")).toBe(true)
})

test("copyValue copies something other than what shows", async () => {
  // Workaround: user-event's setup() installs a clipboard of its own, so stub it after.
  const user = userEvent.setup()
  const writeText = stubClipboard()
  render(
    <DescriptionList>
      <DescriptionItem>
        <DescriptionTerm>Commit</DescriptionTerm>
        <DescriptionDetails copyable copyValue="9f2c4e1a7b">
          <code>9f2c4e1</code>
        </DescriptionDetails>
      </DescriptionItem>
    </DescriptionList>,
  )
  await user.click(screen.getByRole("button", { name: "Copy" }))
  expect(writeText).toHaveBeenCalledWith("9f2c4e1a7b")
})

test("agents copy a value by its term; the button stays out of their snapshot", async () => {
  const writeText = stubClipboard()
  render(<Details />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  const value = components.find((entry) => entry.component === "description-value")
  expect(value?.label).toBe("Commit")
  expect(value?.actions).toEqual(["copy"])
  expect(components.some((entry) => entry.label === "Copy")).toBe(false)
  const result = await agent.act({ steps: [{ ref: "Commit", action: "copy" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(writeText).toHaveBeenCalledWith("9f2c4e1")
})

test("primitive: copy without a clipboard or text throws for a call and gives a press false, and renders on a server", async () => {
  vi.stubGlobal("navigator", { ...navigator, clipboard: undefined })
  const view = mount(descriptionValue, { text: "abc" }, `<root aria-label="Commit"></root>`)
  const empty = mount(descriptionValue, { text: "" }, `<root aria-label="Empty"></root>`)
  try {
    expect(() => view.api.copy()).toThrow("copy isn't available: the page has no clipboard access.")
    expect(await view.api.copy(new MouseEvent("click"))).toBe(false)
    expect(() => empty.api.copy()).toThrow("copy has nothing to copy.")
  } finally {
    view.unmount()
    empty.unmount()
  }
  checkServer(descriptionValue, { text: "abc" }, `<root aria-label="Commit"></root>`)
})
