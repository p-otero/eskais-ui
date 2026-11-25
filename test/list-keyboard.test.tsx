import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { List, ListItem } from "@/components/ui/list-item"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

type Row = { id: string; title: string }

const rows: Row[] = Array.from({ length: 30 }, (_, index) => ({
  id: `R-${String(index + 1)}`,
  title: `Row ${String(index + 1)}`,
}))

function Rows({
  onOpen,
  virtualize = false,
  count = rows.length,
  checkable = false,
}: {
  onOpen?: (id: string) => void
  virtualize?: boolean | "auto"
  count?: number
  checkable?: boolean
}) {
  const [checked, setChecked] = useState<string[]>([])
  const data =
    count <= rows.length
      ? rows.slice(0, count)
      : Array.from({ length: count }, (_, index) => ({
          id: `R-${String(index + 1)}`,
          title: `Row ${String(index + 1)}`,
        }))
  return (
    <>
      <List
        aria-label="Inbox"
        items={data}
        virtualize={virtualize}
        checkedIds={checkable ? checked : undefined}
        onCheckedIdsChange={checkable ? setChecked : undefined}
        renderItem={(row: Row) => <ListItem id={row.id} title={row.title} onSelect={() => onOpen?.(row.id)} />}
      />
      <output>{checked.join(" ")}</output>
    </>
  )
}

// Workaround: jsdom has no layout, so rendered rows get a height for the virtualizer to measure.
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.index === undefined ? 0 : 52
    },
  })
  vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {})
})
afterEach(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight)
  vi.restoreAllMocks()
})

function focused() {
  return document.activeElement?.textContent
}

test("rows are one tab stop; j/k and arrows move, Home/End jump", async () => {
  const user = userEvent.setup()
  render(<Rows />)
  await user.tab()
  expect(focused()).toBe("Row 1")
  const buttons = screen.getAllByRole("button")
  expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1)

  await user.keyboard("jj")
  expect(focused()).toBe("Row 3")
  await user.keyboard("k")
  expect(focused()).toBe("Row 2")
  await user.keyboard("{ArrowDown}{ArrowDown}")
  expect(focused()).toBe("Row 4")
  await user.keyboard("{ArrowUp}")
  expect(focused()).toBe("Row 3")
  await user.keyboard("{End}")
  expect(focused()).toBe("Row 30")
  await user.keyboard("j")
  expect(focused()).toBe("Row 30")
  await user.keyboard("{Home}")
  expect(focused()).toBe("Row 1")
  await user.keyboard("{PageDown}")
  expect(focused()).toBe("Row 11")
  await user.keyboard("{PageUp}")
  expect(focused()).toBe("Row 1")

  await user.tab()
  await user.tab({ shift: true })
  expect(focused()).toBe("Row 1")
})

test("Enter opens the focused row through its own button", async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<Rows onOpen={onOpen} />)
  await user.tab()
  await user.keyboard("jj{Enter}")
  expect(onOpen).toHaveBeenCalledWith("R-3")
})

test("x and Space toggle a row's check without leaving it; the boxes add no tab stops", async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  const { container } = render(<Rows checkable onOpen={onOpen} />)
  await user.tab()
  await user.keyboard("x")
  await user.keyboard("j ")
  expect(screen.getByRole("status").textContent).toBe("R-1 R-2")
  expect(onOpen).not.toHaveBeenCalled()
  expect(screen.getByRole("checkbox", { name: "Select Row 2" }).getAttribute("aria-checked")).toBe("true")
  await user.keyboard("x")
  expect(screen.getByRole("status").textContent).toBe("R-1")
  await user.tab()
  expect(document.activeElement?.getAttribute("role")).not.toBe("checkbox")
  expect(await axeViolations(container)).toEqual([])
})

test("keys typed in a row's own control stay with that control", async () => {
  const user = userEvent.setup()
  render(
    <List aria-label="Rows with fields">
      <ListItem id="a" title="Alpha" onSelect={() => {}} actions={<input aria-label="Rename Alpha" />} />
      <ListItem id="b" title="Beta" onSelect={() => {}} />
    </List>,
  )
  await user.click(screen.getByLabelText("Rename Alpha"))
  await user.keyboard("jk")
  expect((screen.getByLabelText("Rename Alpha") as HTMLInputElement).value).toBe("jk")
})

test("link rows navigate the same way", async () => {
  const user = userEvent.setup()
  render(
    <List aria-label="Projects">
      <ListItem id="atlas" title="Atlas" href="#atlas" />
      <ListItem id="borealis" title="Borealis" href="#borealis" />
    </List>,
  )
  await user.tab()
  await user.keyboard("j")
  expect(document.activeElement?.getAttribute("href")).toBe("#borealis")
})

function Pick() {
  const [value, setValue] = useState<string | null>("R-1")
  return (
    <>
      <List
        aria-label="Pick"
        value={value}
        onValueChange={setValue}
        items={rows.slice(0, 5)}
        renderItem={(row: Row) => <ListItem id={row.id} title={row.title} />}
      />
      <output>{value}</output>
    </>
  )
}

test("a listbox list takes j/k as its arrow keys", async () => {
  const user = userEvent.setup()
  render(<Pick />)
  await user.tab()
  await user.keyboard("jj")
  expect(screen.getByRole("status").textContent).toBe("R-3")
  await user.keyboard("k")
  expect(screen.getByRole("status").textContent).toBe("R-2")
})

test("past the threshold the list virtualizes, keeping positions and every row for agents", async () => {
  render(<Rows count={2000} virtualize="auto" />)
  const items = screen.getAllByRole("listitem")
  expect(items.length).toBeLessThan(200)
  expect(items[0]?.getAttribute("aria-setsize")).toBe("2000")
  expect(items[0]?.getAttribute("aria-posinset")).toBe("1")
  expect(document.querySelector('[data-slot="list-gap"]')).not.toBeNull()
  await settle()
  const agent = createAgent()
  const entry = agent.snapshot().find((component) => component.label === "Inbox")
  expect(entry?.actions).toContain("select")
})

test("an agent selects a row that isn't rendered", async () => {
  const onOpen = vi.fn()
  render(<Rows count={2000} virtualize onOpen={onOpen} />)
  await settle()
  const agent = createAgent()
  const result = await agent.act({ steps: [{ ref: "Inbox", action: "select", args: ["R-1500"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onOpen).toHaveBeenCalledWith("R-1500")
})
