import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { IconTile, List, ListGroup, ListItem } from "@/components/ui/list-item"
import { list } from "@/components/ui/list-primitive"
import { StatusPill } from "@/components/ui/status-pill"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

const issues = [
  { id: "ENG-412", title: "Webhook retries stop after the first timeout", stage: "proposed" },
  { id: "ENG-415", title: "Audit log export misses rows past 10,000", stage: "proposed" },
  { id: "ENG-398", title: "Billing page shows last month's seats", stage: "active" },
]

test("primitive: select validates the id and onSelect can cancel", () => {
  const activate = vi.fn(() => true)
  const view = mount(
    list,
    {
      entries: [{ value: "a", label: "Alpha" }],
      activate,
      onSelect: (_id, details) => details.cancel(),
    },
    `<root aria-label="Rows"></root>`,
  )
  try {
    expect(() => view.api.select("zzz")).toThrow(/Rows: a/)
    expect(() => view.api.select("a")).toThrow("select was refused by the app.")
    expect(view.api.select("a", { reason: "item-press", event: new MouseEvent("click") })).toBe(false)
    expect(activate).not.toHaveBeenCalled()
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(list, { entries: [] }, `<root aria-label="Rows"></root>`)
})

function Navigation({ onSelect }: { onSelect?: (id: string) => void }) {
  const [selected, setSelected] = useState("ENG-398")
  return (
    <List aria-label="Issues" onSelect={(id) => onSelect?.(id)}>
      {["proposed", "active"].map((stage) => {
        const rows = issues.filter((issue) => issue.stage === stage)
        return (
          <ListGroup key={stage} label={stage === "proposed" ? "Proposed" : "Active"} count={rows.length}>
            {rows.map((issue) => (
              <ListItem
                key={issue.id}
                id={issue.id}
                title={issue.title}
                leading={<IconTile tone="info">#</IconTile>}
                subtitle={issue.id}
                status={<StatusPill tone="info">{issue.stage}</StatusPill>}
                trailing="2h"
                selected={selected === issue.id}
                onSelect={() => setSelected(issue.id)}
                actions={
                  <Button size="sm" variant="ghost" aria-label={`Archive ${issue.id}`}>
                    Archive
                  </Button>
                }
              />
            ))}
          </ListGroup>
        )
      })}
    </List>
  )
}

test("a list of rows with groups, a selected row and its own actions", async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  const { container } = render(<Navigation onSelect={onSelect} />)
  const proposed = screen.getByRole("list", { name: "Proposed 2" })
  expect(within(proposed).getAllByRole("listitem")).toHaveLength(2)
  const current = screen.getByRole("button", { name: issues[2]!.title })
  expect(current.getAttribute("aria-current")).toBe("true")

  await user.click(screen.getByRole("button", { name: issues[0]!.title }))
  expect(onSelect).toHaveBeenCalledWith("ENG-412")
  expect(screen.getByRole("button", { name: issues[0]!.title }).getAttribute("aria-current")).toBe("true")
  expect(screen.getByRole("button", { name: "Archive ENG-412" })).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("a row's tooltip mounts only once its title is cut off, and its title keeps its element and focus", async () => {
  const user = userEvent.setup()
  let cutOff = false
  const height = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => (cutOff ? 40 : 20))
  const client = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => 20)
  const callbacks: ((entries: ResizeObserverEntry[]) => void)[] = []
  const Observer = globalThis.ResizeObserver
  globalThis.ResizeObserver = class {
    constructor(callback: (entries: ResizeObserverEntry[]) => void) {
      callbacks.push(callback)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  try {
    render(
      <List aria-label="Issues">
        <ListItem id="ENG-412" title="Webhook retries stop after the first timeout" onSelect={() => {}} />
      </List>,
    )
    const title = screen.getByRole("button", { name: "Webhook retries stop after the first timeout" })
    await user.hover(title)
    await settle()
    expect(screen.queryByRole("tooltip")).toBeNull()

    title.focus()
    cutOff = true
    act(() => callbacks.forEach((callback) => callback([])))
    await settle()
    expect(screen.getByRole("button", { name: "Webhook retries stop after the first timeout" })).toBe(title)
    expect(document.activeElement).toBe(title)
    await user.unhover(title)
    await user.hover(title)
    expect(await screen.findByRole("tooltip")).toBeTruthy()
  } finally {
    globalThis.ResizeObserver = Observer
    height.mockRestore()
    client.mockRestore()
  }
})

test("rows with href are links, current one marked as the page", async () => {
  const { container } = render(
    <List aria-label="Projects" variant="card">
      <ListItem id="atlas" title="Atlas" href="/projects/atlas" selected meta={<span>12 open</span>} />
      <ListItem id="borealis" title="Borealis" href="/projects/borealis" />
    </List>,
  )
  const atlas = screen.getByRole("link", { name: "Atlas" })
  expect(atlas.getAttribute("href")).toBe("/projects/atlas")
  expect(atlas.getAttribute("aria-current")).toBe("page")
  expect(container.querySelector("[data-slot=list-item]")?.getAttribute("data-variant")).toBe("card")
  expect(await axeViolations(container)).toEqual([])
})

function Selectable() {
  const [value, setValue] = useState<string | null>("ENG-412")
  return (
    <>
      <List aria-label="Triage queue" value={value} onValueChange={setValue}>
        <ListGroup label="Proposed" count={2}>
          {issues.slice(0, 2).map((issue) => (
            <ListItem key={issue.id} id={issue.id} title={issue.title} subtitle={issue.id} />
          ))}
        </ListGroup>
      </List>
      <output>{value}</output>
    </>
  )
}

test("the name is on the list itself, not on a group around it", () => {
  render(
    <List aria-label="x">
      <ListItem id="a" title="A" onSelect={() => {}} />
    </List>,
  )
  const named = screen.getByRole("list", { name: "x" })
  expect(named.dataset.slot).toBe("list")
  expect(within(named).getByRole("button", { name: "A" })).toBeTruthy()
  expect(screen.queryByRole("group")).toBeNull()
})

test("a selectable list is a listbox, with arrow keys", async () => {
  const user = userEvent.setup()
  const { container } = render(<Selectable />)
  const listbox = screen.getByRole("listbox", { name: "Triage queue" })
  expect(listbox.dataset.slot).toBe("list")
  const options = within(listbox).getAllByRole("option")
  expect(options).toHaveLength(2)
  expect(options[0]?.getAttribute("aria-selected")).toBe("true")
  await user.click(options[1]!)
  expect(screen.getByRole("status").textContent).toBe("ENG-415")
  expect(await axeViolations(container)).toEqual([])
})

test("an agent selects a row by id, in either kind of list", async () => {
  const onSelect = vi.fn()
  const { unmount } = render(<Navigation onSelect={onSelect} />)
  await settle()

  let components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const issuesList = components.find((entry) => entry.component === "list")
  expect(issuesList?.label).toBe("Issues")
  expect(issuesList?.actions).toContain("select")

  let result = await agent.act({ steps: [{ ref: "Issues", action: "select", args: ["ENG-415"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onSelect).toHaveBeenCalledWith("ENG-415")
  expect(screen.getByRole("button", { name: issues[1]!.title }).getAttribute("aria-current")).toBe("true")
  unmount()

  render(<Selectable />)
  await settle()
  components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  // One element: the List takes `select`, its listbox `setValue`, so each action names one of them.
  const named = components.filter((entry) => entry.label === "Triage queue")
  expect(named.map((entry) => entry.component).toSorted()).toEqual(["list", "listbox"])
  expect(named.filter((entry) => entry.actions.includes("select"))).toHaveLength(1)
  result = await agent.act({ steps: [{ ref: "Triage queue", action: "select", args: ["ENG-415"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("status").textContent).toBe("ENG-415")
})

test("an agent selecting a link row follows the link once", async () => {
  const onSelect = vi.fn()
  render(
    <List aria-label="Projects to open" onSelect={(id) => onSelect(id)}>
      <ListItem id="atlas" title="Atlas" href="#atlas" />
      <ListItem id="borealis" title="Borealis" href="#borealis" />
    </List>,
  )
  await settle()
  const result = await agent.act({ steps: [{ ref: "Projects to open", action: "select", args: ["borealis"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onSelect).toHaveBeenCalledTimes(1)
  expect(globalThis.location.hash).toBe("#borealis")
})
