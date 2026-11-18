import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { List, ListGroup, ListItem } from "@/components/ui/list-item"

import { settle } from "./overlay-helpers"

type Row = { id: string; title: string }

const COUNT = 5000
const rows: Row[] = Array.from({ length: COUNT }, (_, index) => ({
  id: `R-${String(index + 1)}`,
  title: `Row ${String(index + 1)}`,
}))

// jsdom has no layout: give rendered rows a height so the virtualizer measures something.
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.index === undefined ? 0 : 52
    },
  })
  // The window scrolls as far as the document is tall, which jsdom reports as 0.
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: COUNT * 52 + 800 })
  // The virtualizer reveals a row by scrolling the window; make that scroll, so the row renders and takes focus.
  vi.spyOn(globalThis, "scrollTo").mockImplementation(((options?: ScrollToOptions | number, y?: number) => {
    const top = typeof options === "number" ? (y ?? 0) : (options?.top ?? globalThis.scrollY)
    Object.defineProperty(globalThis, "scrollY", { configurable: true, value: top })
    Object.defineProperty(globalThis, "pageYOffset", { configurable: true, value: top })
    globalThis.dispatchEvent(new Event("scroll"))
  }) as typeof globalThis.scrollTo)
})
afterEach(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight)
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, "scrollY", { configurable: true, value: 0 })
  Object.defineProperty(globalThis, "pageYOffset", { configurable: true, value: 0 })
  Reflect.deleteProperty(document.documentElement, "scrollHeight")
})

function FromItems({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <List
      aria-label="Inbox"
      items={rows}
      getItemId={(row) => row.id}
      itemText={(row) => row.title}
      renderItem={(row) => <ListItem id={row.id} title={row.title} onSelect={() => onOpen(row.id)} />}
    />
  )
}

function FromChildren({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <List aria-label="Inbox">
      {rows.map((row) => (
        <ListItem key={row.id} id={row.id} title={row.title} onSelect={() => onOpen(row.id)} />
      ))}
    </List>
  )
}

const focusedTitle = () => document.activeElement?.textContent

for (const [name, Rows] of [
  ["items + renderItem", FromItems],
  ["ListItem children", FromChildren],
] as const) {
  test(`${name}: 5,000 rows render only a window, with their positions and every row's text`, () => {
    render(<Rows onOpen={() => {}} />)
    const list = screen.getByRole("list", { name: "Inbox" })
    const rendered = screen.getAllByRole("listitem")
    expect(rendered.length).toBeLessThan(200)
    expect(rendered[0]?.getAttribute("aria-setsize")).toBe(String(COUNT))
    expect(rendered[0]?.getAttribute("aria-posinset")).toBe("1")
    expect(list.querySelector('[data-slot="list-gap"]')).not.toBeNull()
    expect(list.textContent).toContain("Row 4321")
  })

  test(`${name}: one tab stop, j/k move, End reaches row 5,000 and focus stays on it`, async () => {
    const user = userEvent.setup()
    render(<Rows onOpen={() => {}} />)
    await user.tab()
    expect(focusedTitle()).toBe("Row 1")
    await user.keyboard("j")
    expect(focusedTitle()).toBe("Row 2")
    await user.keyboard("k")
    expect(focusedTitle()).toBe("Row 1")
    await user.keyboard("{End}")
    await settle()
    expect(focusedTitle()).toBe(`Row ${String(COUNT)}`)
    expect(document.activeElement?.closest("li")?.getAttribute("aria-posinset")).toBe(String(COUNT))
    await user.keyboard("{Home}")
    await settle()
    expect(focusedTitle()).toBe("Row 1")
  })

  test(`${name}: Enter opens the focused row; an agent selects one that isn't rendered`, async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<Rows onOpen={onOpen} />)
    await user.tab()
    await user.keyboard("j{Enter}")
    expect(onOpen).toHaveBeenLastCalledWith("R-2")

    await settle()
    const agent = createAgent()
    const entry = agent.snapshot().find((component) => component.label === "Inbox")
    expect(entry?.component).toBe("list")
    expect(entry?.actions).toContain("select")
    const result = await agent.act({ steps: [{ ref: "Inbox", action: "select", args: ["R-4321"] }] })
    expect(result.ok, result.error?.message).toBe(true)
    expect(onOpen).toHaveBeenLastCalledWith("R-4321")
  })
}

test("children that aren't flat id'd rows, like groups, render as they are", () => {
  render(
    <List aria-label="Grouped">
      <ListGroup label="All">
        {rows.slice(0, 300).map((row) => (
          <ListItem key={row.id} id={row.id} title={row.title} />
        ))}
      </ListGroup>
    </List>,
  )
  expect(screen.getAllByRole("listitem")).toHaveLength(301)
  expect(document.querySelector('[data-slot="list-gap"]')).toBeNull()
})
