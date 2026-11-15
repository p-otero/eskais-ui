import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Board, BoardColumn, BoardColumnGroup } from "@/components/ui/board"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyTitle } from "@/components/ui/empty"

import { axeViolations } from "./axe"

const agent = createAgent()
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function Item({ children }: { children: string }) {
  return (
    <Card>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Sprint({ doneCollapsed = true }: { doneCollapsed?: boolean }) {
  return (
    <Board aria-label="Sprint">
      <BoardColumn
        title="Backlog"
        count={3}
        defaultCollapsed={false}
        actions={<Button size="sm">Add to Backlog</Button>}
      >
        <BoardColumnGroup title="Ready" count={2}>
          <Item>Write the brief</Item>
          <Item>Pick a venue</Item>
        </BoardColumnGroup>
        <BoardColumnGroup title="Waiting on a dependency" count={1}>
          <Item>Book the caterer</Item>
        </BoardColumnGroup>
      </BoardColumn>
      <BoardColumn title="Review" count={0} empty={<EmptyTitle>Nothing to review</EmptyTitle>} />
      <BoardColumn title="Done" count={1} defaultCollapsed={doneCollapsed}>
        <Item>Send invites</Item>
      </BoardColumn>
    </Board>
  )
}

test("the board is a named region holding a list of columns, each named by its header", async () => {
  render(<Sprint />)
  await tick()
  const board = screen.getByRole("region", { name: "Sprint" })
  const columns = within(within(board).getByRole("list")).getAllByRole("listitem")
  expect(columns).toHaveLength(3)

  const backlog = screen.getByRole("region", { name: "Backlog" })
  expect(within(backlog).getByRole("heading", { level: 3, name: "Backlog" })).toBeTruthy()
  expect(backlog.querySelector('[data-slot="board-column-count"]')?.textContent).toBe("3")
  expect(within(backlog).getByRole("button", { name: "Add to Backlog" })).toBeTruthy()
  expect(
    screen.getByRole("region", { name: "Review" }).querySelector('[data-slot="board-column-count"]')?.textContent,
  ).toBe("0")
})

test("a column collapses and expands from the keyboard and keeps its title and count", async () => {
  const user = userEvent.setup()
  render(<Sprint />)
  await tick()
  const toggle = screen.getByRole("button", { name: "Collapse Backlog" })
  expect(toggle.getAttribute("aria-expanded")).toBe("true")

  toggle.focus()
  await user.keyboard("{Enter}")
  await tick()
  const collapsed = screen.getByRole("button", { name: "Expand Backlog" })
  expect(collapsed).toBe(document.activeElement)
  expect(collapsed.getAttribute("aria-expanded")).toBe("false")
  const column = screen.getByRole("region", { name: "Backlog" })
  expect(column.closest("li")?.hasAttribute("data-collapsed")).toBe(true)
  expect(within(column).getByRole("heading", { name: "Backlog" })).toBeTruthy()
  expect(column.querySelector('[data-slot="board-column-count"]')?.textContent).toBe("3")
  expect(screen.queryByText("Write the brief")).toBeNull()

  await user.keyboard(" ")
  await tick()
  expect(screen.getByRole("button", { name: "Collapse Backlog" }).getAttribute("aria-expanded")).toBe("true")
  expect(column.closest("li")?.hasAttribute("data-collapsed")).toBe(false)
  expect(screen.getByText("Write the brief")).toBeTruthy()
})

test("uncontrolled columns start from defaultCollapsed and report each change", async () => {
  const user = userEvent.setup()
  const onCollapsedChange = vi.fn()
  render(
    <Board aria-label="Sprint">
      <BoardColumn title="Done" defaultCollapsed onCollapsedChange={onCollapsedChange}>
        <Item>Send invites</Item>
      </BoardColumn>
    </Board>,
  )
  await tick()
  expect(screen.queryByText("Send invites")).toBeNull()
  await user.click(screen.getByRole("button", { name: "Expand Done" }))
  await tick()
  expect(screen.getByText("Send invites")).toBeTruthy()
  expect(onCollapsedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "trigger-press" }))
})

test("a controlled column follows its collapsed prop, and a canceled change keeps a column open", async () => {
  const user = userEvent.setup()
  const onCollapsedChange = vi.fn()
  function Controlled() {
    const [collapsed, setCollapsed] = useState(false)
    return (
      <Board aria-label="Sprint">
        <BoardColumn
          title="Doing"
          collapsed={collapsed}
          onCollapsedChange={(next) => {
            onCollapsedChange(next)
            setCollapsed(next)
          }}
        >
          <Item>Draft agenda</Item>
        </BoardColumn>
        <BoardColumn title="Pinned" collapsed={false} onCollapsedChange={() => {}}>
          <Item>Keep this open</Item>
        </BoardColumn>
        <BoardColumn title="Locked" defaultCollapsed={false} onCollapsedChange={(_, details) => details.cancel()}>
          <Item>Cannot collapse</Item>
        </BoardColumn>
      </Board>
    )
  }
  render(<Controlled />)
  await tick()
  await user.click(screen.getByRole("button", { name: "Collapse Doing" }))
  await tick()
  expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
  expect(screen.queryByText("Draft agenda")).toBeNull()

  await user.click(screen.getByRole("button", { name: "Collapse Pinned" }))
  await tick()
  expect(screen.getByText("Keep this open")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Collapse Pinned" }).getAttribute("aria-expanded")).toBe("true")

  await user.click(screen.getByRole("button", { name: "Collapse Locked" }))
  await tick()
  expect(screen.getByText("Cannot collapse")).toBeTruthy()
  expect(screen.getByRole("region", { name: "Locked" }).closest("li")?.hasAttribute("data-collapsed")).toBe(false)
})

test("a column only gets a toggle when it can collapse, and its labels can be overridden", async () => {
  render(
    <Board aria-label="Tablero">
      <BoardColumn title="Static">
        <Item>Always visible</Item>
      </BoardColumn>
      <BoardColumn
        title="Hecho"
        collapsible
        labels={{ collapse: (title) => `Plegar ${title}`, expand: (title) => `Desplegar ${title}` }}
      >
        <Item>Listo</Item>
      </BoardColumn>
    </Board>,
  )
  await tick()
  expect(within(screen.getByRole("region", { name: "Static" })).queryByRole("button")).toBeNull()
  expect(screen.getByRole("button", { name: "Plegar Hecho" })).toBeTruthy()
})

test("the empty slot shows only when a column has no children", async () => {
  render(
    <Board aria-label="Sprint">
      <BoardColumn title="Review" empty={<EmptyTitle>Nothing to review</EmptyTitle>}>
        {null}
        {false}
      </BoardColumn>
      <BoardColumn title="Doing" empty={<EmptyTitle>Nothing in progress</EmptyTitle>}>
        <Item>Draft agenda</Item>
      </BoardColumn>
    </Board>,
  )
  await tick()
  const empty = within(screen.getByRole("region", { name: "Review" })).getByText("Nothing to review")
  expect(empty.closest('[data-slot="empty"]')).toBeTruthy()
  expect(screen.queryByText("Nothing in progress")).toBeNull()
})

test("groups are named sections one heading level below their column, with their own count", async () => {
  render(<Sprint />)
  await tick()
  const ready = screen.getByRole("region", { name: "Ready" })
  expect(within(ready).getByRole("heading", { level: 4, name: "Ready" })).toBeTruthy()
  expect(ready.querySelector('[data-slot="board-column-count"]')?.textContent).toBe("2")
  expect(within(ready).getByText("Pick a venue")).toBeTruthy()
  expect(screen.getByRole("region", { name: "Waiting on a dependency" })).toBeTruthy()
})

test("the board has no axe violations, expanded or collapsed", async () => {
  const { container, unmount } = render(<Sprint doneCollapsed={false} />)
  await tick()
  expect(await axeViolations(container)).toEqual([])
  unmount()

  const collapsed = render(<Sprint doneCollapsed />)
  await tick()
  expect(await axeViolations(collapsed.container)).toEqual([])
})

test("an agent can find every column and toggle, and collapse and expand a column by name", async () => {
  render(<Sprint />)
  await tick()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  for (const label of ["Sprint", "Backlog", "Review", "Done", "Add to Backlog"]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label)
  }
  const toggles = components.filter((entry) => entry.component === "collapsible")
  expect(toggles.map((entry) => entry.label)).toEqual(["Backlog", "Done"])
  expect(toggles.every((entry) => entry.actions.includes("setOpen"))).toBe(true)

  const result = await act(() =>
    agent.act({
      steps: [
        { ref: "Backlog", action: "setOpen", args: [false] },
        { ref: "Done", action: "setOpen", args: [true] },
      ],
    }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("button", { name: "Expand Backlog" }).getAttribute("aria-expanded")).toBe("false")
  expect(screen.getByRole("button", { name: "Collapse Done" }).getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByText("Send invites")).toBeTruthy()
})

test("renders 200 items across 7 columns", async () => {
  const columns = Array.from({ length: 7 }, (_, column) => ({
    id: `column-${column}`,
    title: `Column ${column + 1}`,
    items: Array.from({ length: column < 4 ? 29 : 28 }, (_item, item) => ({
      id: `${column}-${item}`,
      title: `Item ${column}.${item}`,
    })),
  }))
  expect(columns.reduce((total, column) => total + column.items.length, 0)).toBe(200)

  const start = performance.now()
  render(
    <Board aria-label="Large board">
      {columns.map((column) => (
        <BoardColumn key={column.id} title={column.title} count={column.items.length} defaultCollapsed={false}>
          {column.items.map((item) => (
            <Item key={item.id}>{item.title}</Item>
          ))}
        </BoardColumn>
      ))}
    </Board>,
  )
  await tick()
  const elapsed = performance.now() - start
  console.info(`board: 200 items across 7 columns rendered and mounted in ${elapsed.toFixed(1)} ms (jsdom)`)
  expect(screen.getAllByRole("listitem")).toHaveLength(7)
  expect(document.querySelectorAll('[data-slot="card"]')).toHaveLength(200)
  expect(elapsed).toBeLessThan(2000)
})
