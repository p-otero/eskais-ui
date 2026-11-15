import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

import { axeViolations, settle } from "./overlay-helpers"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

function noop() {}

function TaskRow({ onAction = noop }: { onAction?: (value: string) => void }) {
  return (
    <main>
      <ContextMenu onAction={onAction}>
        <ContextMenuTrigger aria-label="Task Index the docs" className="block p-surface">
          Index the docs
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem value="copy">Copy task id</ContextMenuItem>
          <ContextMenuItem value="duplicate">Duplicate</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem value="delete" destructive data-agent-confirm="Deletes the Index the docs task">
            Delete forever
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </main>
  )
}

// Browsers turn Shift+F10 and the context-menu key into a contextmenu event on the focused element; jsdom doesn't.
function pressContextMenuKey(target: Element) {
  return fireEvent.contextMenu(target, { button: 0, clientX: 0, clientY: 0, detail: 0 })
}

test("the area takes focus, and the context-menu key opens a menu the arrow keys and typeahead move through", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<TaskRow onAction={onAction} />)
  const area = screen.getByText("Index the docs")
  expect(area.tabIndex).toBe(0)
  area.focus()
  pressContextMenuKey(area)
  await settle()
  const menu = screen.getByRole("menu")
  expect(menu.className).toContain("bg-popover/(--glass-opacity)")
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy task id" }))
  await user.keyboard("{ArrowDown}")
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Duplicate" }))
  await user.keyboard("c")
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy task id" }))
  await user.keyboard("{Enter}")
  expect(onAction).toHaveBeenCalledWith("copy", expect.anything())
  expect(screen.queryByRole("menu")).toBeNull()
  expect(document.activeElement).toBe(area)
})

test("a right-click opens it and Escape closes it, returning focus to the area", async () => {
  const user = userEvent.setup()
  render(<TaskRow />)
  const area = screen.getByText("Index the docs")
  area.focus()
  fireEvent.contextMenu(area, { clientX: 10, clientY: 10 })
  await settle()
  expect(screen.getByRole("menu")).toBeTruthy()
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("menu")).toBeNull()
  expect(document.activeElement).toBe(area)
})

test("has no axe violations closed or open", async () => {
  const { container } = render(<TaskRow />)
  expect(await axeViolations(container)).toEqual([])
  screen.getByText("Index the docs").focus()
  pressContextMenuKey(screen.getByText("Index the docs"))
  await settle()
  expect(screen.getByRole("menuitem", { name: "Delete forever" }).dataset.destructive).toBe("")
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can run an item, and needs a person to delete", async () => {
  const onAction = vi.fn()
  render(<TaskRow onAction={onAction} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Task Index the docs")

  const duplicated = await agent.act({
    steps: [{ ref: "Task Index the docs", action: "press", args: ["Duplicate"] }],
  })
  expect(duplicated.ok, duplicated.error?.message).toBe(true)
  expect(onAction).toHaveBeenLastCalledWith("duplicate", expect.anything())

  const remove = { steps: [{ ref: "Task Index the docs", action: "press", args: ["Delete forever"] }] }
  approve = false
  expect((await agent.act(remove)).ok).toBe(false)
  expect(onAction).not.toHaveBeenCalledWith("delete", expect.anything())
  approve = true
  const approved = await agent.act(remove)
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(onAction).toHaveBeenLastCalledWith("delete", expect.anything())
})
