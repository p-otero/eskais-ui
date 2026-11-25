import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarItemIndicator,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function noop() {}

function Editor({ onAction = noop }: { onAction?: (value: string) => void }) {
  return (
    <main>
      <Menubar aria-label="Editor">
        <MenubarMenu onAction={onAction}>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem value="new" shortcut="mod+alt+n">
              New task
              <MenubarShortcut />
            </MenubarItem>
            <MenubarItem value="import">Import tasks</MenubarItem>
            <MenubarSeparator />
            <MenubarItem value="export">Export board</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu onAction={onAction}>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem value="cancelled">
              <MenubarItemIndicator />
              Show cancelled
            </MenubarCheckboxItem>
            <MenubarItem value="zoom">Zoom to fit</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </main>
  )
}

test("the bar is one tab stop and arrow keys move between its menus", async () => {
  const user = userEvent.setup()
  render(<Editor />)
  expect(screen.getByRole("menubar", { name: "Editor" })).toBeTruthy()
  const file = screen.getByRole("menuitem", { name: "File" })
  const view = screen.getByRole("menuitem", { name: "View" })
  await user.tab()
  expect(document.activeElement).toBe(file)
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(view)
  await user.tab()
  expect(document.activeElement).toBe(document.body)
})

test("Enter opens a menu, arrows switch menus while open, Escape closes and returns focus", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<Editor onAction={onAction} />)
  const file = screen.getByRole("menuitem", { name: "File" })
  file.focus()
  await user.keyboard("{Enter}")
  expect(screen.getByRole("menu").className).toContain("surface-floating")
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: /New task/ }))
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(screen.getByRole("menuitemcheckbox", { name: "Show cancelled" }))
  await user.keyboard("{ArrowLeft}")
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: /New task/ }))
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("menu")).toBeNull()
  expect(document.activeElement).toBe(file)
  await user.keyboard("{Enter}i{Enter}")
  expect(onAction).toHaveBeenLastCalledWith("import", expect.anything())
  expect(document.activeElement).toBe(file)
})

// Workaround: UI SDK 0.1.0-beta.10 focuses the first menu's trigger on Escape after ArrowRight switched menus.
test.fails("Escape after switching menus with the arrows focuses the open menu's trigger", async () => {
  const user = userEvent.setup()
  render(<Editor />)
  screen.getByRole("menuitem", { name: "File" }).focus()
  await user.keyboard("{Enter}{ArrowRight}{Escape}")
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "View" }))
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(<Editor />)
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("menuitem", { name: "File" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can open a menu and choose an item", async () => {
  const onAction = vi.fn()
  render(<Editor onAction={onAction} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  expect(labels).toContain("File")
  expect(labels).toContain("View")
  const result = await agent.act({ steps: [{ ref: "View", action: "press", args: ["Zoom to fit"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onAction).toHaveBeenLastCalledWith("zoom", expect.anything())
})
