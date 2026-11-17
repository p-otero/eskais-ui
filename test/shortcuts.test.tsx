import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { listShortcuts, ShortcutHint, ShortcutScope, useShortcut } from "@/components/ui/shortcuts"
import { ShortcutsDialog } from "@/components/ui/shortcuts-dialog"

import { axeViolations } from "./axe"

function Shortcut({ keys, onRun, description }: { keys: string; onRun: () => void; description?: string }) {
  useShortcut(keys, onRun, { description })
  return null
}

test("a plain key runs, but not while typing in a field or contenteditable", async () => {
  const user = userEvent.setup()
  const run = vi.fn()
  render(
    <>
      <Shortcut keys="u" onRun={run} />
      <input aria-label="Title" />
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the guard under test is for rich-text editors */}
      <div role="textbox" aria-label="Notes" contentEditable suppressContentEditableWarning tabIndex={0} />
    </>,
  )
  await user.keyboard("u")
  expect(run).toHaveBeenCalledTimes(1)

  await user.click(screen.getByLabelText("Title"))
  await user.keyboard("u")
  expect(run).toHaveBeenCalledTimes(1)

  const notes = screen.getByLabelText("Notes")
  Object.defineProperty(notes, "isContentEditable", { value: true })
  notes.focus()
  await user.keyboard("u")
  expect(run).toHaveBeenCalledTimes(1)
})

test("IME composition never runs a shortcut", () => {
  const run = vi.fn()
  render(<Shortcut keys="u" onRun={run} />)
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "u", code: "KeyU", isComposing: true, bubbles: true, cancelable: true }),
    )
  })
  expect(run).not.toHaveBeenCalled()
})

test("a sequence runs on its second key, and the second key alone keeps its own shortcut", async () => {
  const user = userEvent.setup()
  const inbox = vi.fn()
  const info = vi.fn()
  render(
    <>
      <Shortcut keys="g i" onRun={inbox} />
      <Shortcut keys="i" onRun={info} />
    </>,
  )
  await user.keyboard("gi")
  expect(inbox).toHaveBeenCalledTimes(1)
  expect(info).not.toHaveBeenCalled()

  await new Promise((resolve) => setTimeout(resolve, 5))
  await user.keyboard("i")
  expect(info).toHaveBeenCalledTimes(1)

  await user.keyboard("gx")
  await new Promise((resolve) => setTimeout(resolve, 5))
  await user.keyboard("i")
  expect(inbox).toHaveBeenCalledTimes(1)
  expect(info).toHaveBeenCalledTimes(2)
})

test("a ShortcutScope runs its shortcuts only while focus is inside", async () => {
  const user = userEvent.setup()
  const run = vi.fn()
  function Region() {
    useShortcut("e", run, { description: "Edit" })
    return <button type="button">Inside</button>
  }
  render(
    <>
      <button type="button">Outside</button>
      <ShortcutScope name="editor" label="Editor">
        <Region />
      </ShortcutScope>
    </>,
  )
  await user.click(screen.getByRole("button", { name: "Outside" }))
  await user.keyboard("e")
  expect(run).not.toHaveBeenCalled()

  await user.click(screen.getByRole("button", { name: "Inside" }))
  await user.keyboard("e")
  expect(run).toHaveBeenCalledTimes(1)
  expect(listShortcuts()).toContainEqual(
    expect.objectContaining({ keys: "e", description: "Edit", scope: "editor", scopeLabel: "Editor" }),
  )

  await user.click(screen.getByRole("button", { name: "Outside" }))
  await user.keyboard("e")
  expect(run).toHaveBeenCalledTimes(1)
})

test("an always-active scope runs while mounted", async () => {
  const user = userEvent.setup()
  const run = vi.fn()
  function Panel() {
    useShortcut("p", run)
    return null
  }
  const { rerender } = render(
    <ShortcutScope name="panel" active>
      <Panel />
    </ShortcutScope>,
  )
  await user.keyboard("p")
  expect(run).toHaveBeenCalledTimes(1)
  rerender(<div />)
  await user.keyboard("p")
  expect(run).toHaveBeenCalledTimes(1)
})

test("a Button with a shortcut shows the keys, sets aria-keyshortcuts and presses itself", async () => {
  const user = userEvent.setup()
  const markRead = vi.fn()
  render(
    <Button variant="outline" shortcut="u" onClick={markRead}>
      Mark read
    </Button>,
  )
  const button = screen.getByRole("button", { name: "Mark read" })
  expect(button.getAttribute("aria-keyshortcuts")).toBe("U")
  expect(button.querySelector('[data-slot="shortcut-hint"]')?.textContent).toContain("U")
  await user.keyboard("u")
  expect(markRead).toHaveBeenCalledTimes(1)
  expect(await axeViolations(document.body)).toEqual([])
})

test("a disabled Button ignores its shortcut", async () => {
  const user = userEvent.setup()
  const pin = vi.fn()
  render(
    <Button shortcut="p" disabled onClick={pin}>
      Pin
    </Button>,
  )
  await user.keyboard("p")
  expect(pin).not.toHaveBeenCalled()
})

test("ShortcutHint renders each step of a sequence", () => {
  render(<ShortcutHint keys="g i" />)
  const hint = document.querySelector('[data-slot="shortcut-hint"]')
  expect(hint?.getAttribute("aria-hidden")).toBe("true")
  expect([...(hint?.querySelectorAll("kbd") ?? [])].map((key) => key.textContent?.replace(/[⁦-⁩]/g, ""))).toEqual([
    "G",
    "I",
  ])
})

function Inbox() {
  const [count, setCount] = useState(0)
  useShortcut("g i", () => setCount(count + 1), { description: "Go to inbox", scope: null })
  return (
    <ShortcutScope name="inspector" label="Item detail" active>
      <Button shortcut="u">Mark read</Button>
      <output>{count}</output>
    </ShortcutScope>
  )
}

test("? opens a dialog that lists the shortcuts available where the person is, by scope", async () => {
  const user = userEvent.setup()
  render(
    <>
      <Inbox />
      <ShortcutsDialog />
    </>,
  )
  await user.keyboard("?")
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" })
  const groups = [...dialog.querySelectorAll("section")].map((section) => section.getAttribute("aria-label"))
  expect(groups).toEqual(["General", "Item detail"])
  expect(dialog.textContent).toContain("Go to inbox")
  expect(dialog.textContent).toContain("Mark read")
  expect(dialog.textContent).toContain("Show keyboard shortcuts")
  expect(await axeViolations(document.body)).toEqual([])

  await user.keyboard("{Escape}")
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

test("shortcuts add nothing for agents: the button is pressed by name", async () => {
  const markRead = vi.fn()
  render(
    <Button shortcut="u" onClick={markRead}>
      Mark read
    </Button>,
  )
  const agent = createAgent()
  const entry = agent.snapshot().find((item) => item.label === "Mark read")
  expect(entry?.component).toBe("button")
  const result = await act(() => agent.act({ steps: [{ ref: "Mark read", action: "press" }] }))
  expect(result.ok).toBe(true)
  expect(markRead).toHaveBeenCalledTimes(1)
})

test("a menu item's shortcut presses it while the menu is open", async () => {
  const user = userEvent.setup()
  const pin = vi.fn()
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem shortcut="p" onClick={pin}>
          Pin
        </DropdownMenuItem>
        <DropdownMenuItem>Archive</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  await user.keyboard("p")
  expect(pin).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Actions" }))
  const item = await screen.findByRole("menuitem", { name: /Pin/ })
  expect(item.getAttribute("aria-keyshortcuts")).toBe("P")
  // Focus moves into the menu a frame after it opens; keys pressed before that still go to the trigger.
  await vi.waitFor(() => expect(item.closest('[role="menu"]')?.contains(document.activeElement)).toBe(true))
  await user.keyboard("p")
  expect(pin).toHaveBeenCalledTimes(1)
})
