import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { listShortcuts, ShortcutHint, ShortcutScope, useShortcut } from "@/components/ui/shortcuts"
import { ShortcutsDialog, ShortcutsDialogTrigger } from "@/components/ui/shortcuts-dialog"

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

// What each layout sends for "?" or "/": the produced key, with the modifiers that layout needed to make it.
const keyEvents = {
  "? on a US layout (Shift+/)": { key: "?", code: "Slash", shiftKey: true },
  "? on a Spanish layout (Shift+')": { key: "?", code: "Minus", shiftKey: true },
  "? with AltGr on Windows": { key: "?", code: "KeyQ", ctrlKey: true, altKey: true },
  "? with Option on a Mac": { key: "?", code: "KeyQ", altKey: true },
  "/ on a Spanish layout (Shift+7)": { key: "/", code: "Digit7", shiftKey: true },
  "1 on AZERTY (Shift+&)": { key: "1", code: "Digit1", shiftKey: true },
}

test.each(Object.entries(keyEvents))("a symbol or digit shortcut matches the produced key: %s", (_, init) => {
  const run = vi.fn()
  render(<Shortcut keys={init.key} onRun={run} />)
  fireEvent.keyDown(document.body, init)
  expect(run).toHaveBeenCalledTimes(1)
})

test("a letter keeps its exact modifiers, and Ctrl or ⌘ with a symbol is another shortcut", () => {
  const letter = vi.fn()
  const help = vi.fn()
  render(
    <>
      <Shortcut keys="u" onRun={letter} />
      <Shortcut keys="?" onRun={help} />
    </>,
  )
  fireEvent.keyDown(document.body, { key: "U", code: "KeyU", shiftKey: true })
  expect(letter).not.toHaveBeenCalled()
  fireEvent.keyDown(document.body, { key: "?", code: "Slash", shiftKey: true, ctrlKey: true })
  fireEvent.keyDown(document.body, { key: "?", code: "Slash", shiftKey: true, metaKey: true })
  expect(help).not.toHaveBeenCalled()
})

test("the dialog lists a symbol shortcut once, however many layouts it matches", async () => {
  render(
    <>
      <Shortcut keys="/" onRun={() => {}} description="Search" />
      <ShortcutsDialog />
    </>,
  )
  fireEvent.keyDown(document.body, { key: "?", code: "Minus", shiftKey: true })
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" })
  const rows = [...dialog.querySelectorAll("[data-slot=shortcuts-dialog-row] dt")].map((row) => row.textContent)
  expect(rows.toSorted()).toEqual(["Search", "Show keyboard shortcuts"])
})

function Message({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <ShortcutScope name="message" label="Message">
      <Button shortcut="u">Mark read</Button>
      <Button shortcut="p">Pin</Button>
      <ShortcutsDialog onOpenChange={onOpenChange}>
        <ShortcutsDialogTrigger>Keyboard shortcuts</ShortcutsDialogTrigger>
      </ShortcutsDialog>
    </ShortcutScope>
  )
}

test("ShortcutsDialogTrigger opens the dialog with its scope's shortcuts, and focus returns to it", async () => {
  const user = userEvent.setup()
  render(<Message />)
  const trigger = screen.getByRole("button", { name: "Keyboard shortcuts" })
  await user.click(trigger)
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" })
  expect(dialog.textContent).toContain("Mark read")
  expect(dialog.textContent).toContain("Pin")
  expect(await axeViolations(document.body)).toEqual([])
  await user.keyboard("{Escape}")
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
})

test("a press that doesn't focus the trigger, as in Safari or on touch, still lists its scope", async () => {
  render(<Message />)
  fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }))
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" })
  expect(dialog.textContent).toContain("Mark read")
})

test("agents open the dialog by pressing the trigger by name", async () => {
  const onOpenChange = vi.fn()
  render(<Message onOpenChange={onOpenChange} />)
  const agent = createAgent()
  const result = await act(() => agent.act({ steps: [{ ref: "Keyboard shortcuts", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onOpenChange).toHaveBeenLastCalledWith(true)
  expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy()
})

function Help() {
  const [open, setOpen] = useState(false)
  return (
    <ShortcutScope name="message" label="Message">
      <Button shortcut="u">Mark read</Button>
      <Button onClick={() => setOpen(true)}>Help</Button>
      <ShortcutsDialog open={open} onOpenChange={setOpen} />
    </ShortcutScope>
  )
}

test("a controlled ShortcutsDialog opened from a Button lists the shortcuts", async () => {
  const user = userEvent.setup()
  render(<Help />)
  await user.click(screen.getByRole("button", { name: "Help" }))
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" })
  expect(dialog.textContent).toContain("Mark read")
})
