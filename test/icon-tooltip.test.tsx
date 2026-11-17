import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { BoldIcon, CopyIcon, ItalicIcon, Trash2Icon, XIcon } from "lucide-react"
import { createElement } from "react"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ShortcutScope } from "@/components/ui/shortcuts"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function tooltipOf(button: HTMLElement) {
  const id = button.getAttribute("aria-labelledby") ?? button.getAttribute("aria-describedby")
  return id ? document.getElementById(id) : null
}

function Toolbar({ onDelete }: { onDelete?: () => void }) {
  return (
    <ShortcutScope name="toolbar" active>
      <fieldset aria-label="Formatting">
        <Toggle size="icon" aria-label="Bold">
          <BoldIcon />
        </Toggle>
        <Toggle size="icon" aria-label="Italic">
          <ItalicIcon />
        </Toggle>
        <Button size="icon" variant="ghost" aria-label="Copy" shortcut="mod+c">
          <CopyIcon />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete"
          tooltip="Moves the draft to the trash"
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </fieldset>
    </ShortcutScope>
  )
}

test("an icon button shows its name in a tooltip that labels it, so the name is heard once", async () => {
  render(<Toolbar />)
  await settle()
  const copy = screen.getByRole("button", { name: "Copy" })
  const tip = tooltipOf(copy)
  expect(tip?.getAttribute("role")).toBe("tooltip")
  expect(copy.getAttribute("aria-labelledby")).toBe(tip?.id)
  expect(copy.hasAttribute("aria-describedby")).toBe(false)
  expect(tip?.hasAttribute("data-closed")).toBe(true)
  // The keys sit in the tooltip, hidden from screen readers, instead of inside the square button.
  expect(tip?.querySelector("[data-slot=tooltip-shortcut]")?.textContent).toMatch(/\+C\W*$/)
  expect(tip?.getAttribute("aria-label")).toBe("Copy")
  expect(copy.querySelector("[data-slot=shortcut-hint]")).toBeNull()
  expect(copy.getAttribute("aria-keyshortcuts")).toMatch(/\+C$/)
})

test("tooltip text other than the name describes the button and keeps its name", async () => {
  render(<Toolbar />)
  await settle()
  const remove = screen.getByRole("button", { name: "Delete" })
  expect(remove.hasAttribute("aria-labelledby")).toBe(false)
  expect(tooltipOf(remove)?.textContent).toBe("Moves the draft to the trash")
  expect(remove).toHaveProperty("ariaLabel", "Delete")
})

test("keyboard focus opens the tooltip at once, and moving on opens the next", async () => {
  const user = userEvent.setup()
  render(<Toolbar />)
  await user.tab()
  const bold = screen.getByRole("button", { name: "Bold" })
  expect(document.activeElement).toBe(bold)
  expect(tooltipOf(bold)?.hasAttribute("data-open")).toBe(true)
  await user.tab()
  const italic = screen.getByRole("button", { name: "Italic" })
  expect(tooltipOf(italic)?.hasAttribute("data-open")).toBe(true)
  expect(tooltipOf(bold)?.hasAttribute("data-open")).toBe(false)
})

test("resting the pointer on an icon button opens its tooltip", async () => {
  const user = userEvent.setup()
  render(<Toolbar />)
  const copy = screen.getByRole("button", { name: "Copy" })
  await user.hover(copy)
  await settle(700)
  expect(tooltipOf(copy)?.hasAttribute("data-open")).toBe(true)
})

test("tooltip={false} leaves the button alone, with the shortcut back inside it", async () => {
  render(
    <ShortcutScope name="plain" active>
      <Button size="icon" aria-label="Close" tooltip={false} shortcut="mod+w">
        <XIcon />
      </Button>
    </ShortcutScope>,
  )
  await settle()
  const close = screen.getByRole("button", { name: "Close" })
  expect(close.hasAttribute("aria-labelledby")).toBe(false)
  expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull()
  expect(close.querySelector("[data-slot=shortcut-hint]")).not.toBeNull()
})

test("a text button gets a tooltip only when asked for one", async () => {
  render(
    <>
      <Button>Save</Button>
      <Button tooltip="Saves a copy">Save as</Button>
    </>,
  )
  await settle()
  expect(tooltipOf(screen.getByRole("button", { name: "Save" }))).toBeNull()
  expect(tooltipOf(screen.getByRole("button", { name: "Save as" }))?.textContent).toBe("Saves a copy")
})

test("agents see the button once, under its own name, and press it", async () => {
  const onDelete = vi.fn()
  render(<Toolbar onDelete={onDelete} />)
  await settle()
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  expect(entries.filter((entry) => entry.component === "tooltip")).toEqual([])
  expect(entries.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Bold", "Italic", "Copy", "Delete"]))
  const result = await act(() => agent.act({ steps: [{ ref: "Delete", action: "press" }] }))
  expect(result.ok).toBe(true)
  expect(onDelete).toHaveBeenCalledOnce()
})

test("a natively disabled icon button gets no tooltip; focusableWhenDisabled keeps it", async () => {
  render(
    <>
      <Button size="icon" aria-label="Undo" disabled>
        <XIcon />
      </Button>
      <Button size="icon" aria-label="Redo" disabled focusableWhenDisabled>
        <XIcon />
      </Button>
    </>,
  )
  await settle()
  expect(tooltipOf(screen.getByRole("button", { name: "Undo" }))).toBeNull()
  expect(tooltipOf(screen.getByRole("button", { name: "Redo" }))?.textContent).toBe("Redo")
})

test("a link rendered as an icon button gets the tooltip too", async () => {
  render(
    <Button size="icon" aria-label="Open the docs" render={createElement("a", { href: "/docs" })}>
      <XIcon />
    </Button>,
  )
  await settle()
  const link = screen.getByRole("link", { name: "Open the docs" })
  expect(tooltipOf(link)?.textContent).toBe("Open the docs")
})

test("a Button that is already a TooltipTrigger's render keeps that one tooltip", async () => {
  render(
    <Tooltip>
      <TooltipTrigger render={<Button size="icon" aria-label="Copy model ID" />}>
        <CopyIcon />
      </TooltipTrigger>
      <TooltipContent>Copies the ID</TooltipContent>
    </Tooltip>,
  )
  await settle()
  expect(screen.getAllByRole("tooltip", { hidden: true }).map((tip) => tip.textContent)).toEqual(["Copies the ID"])
})

test("a dialog's icon close button shows its tooltip above the dialog, and the dialog has no axe violations", async () => {
  const user = userEvent.setup()
  render(
    <Dialog>
      <DialogTrigger size="icon" aria-label="Open settings">
        <XIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Settings</DialogTitle>
        <DialogClose size="icon" variant="ghost" aria-label="Close settings">
          <XIcon />
        </DialogClose>
      </DialogContent>
    </Dialog>,
  )
  const trigger = screen.getByRole("button", { name: "Open settings" })
  expect(tooltipOf(trigger)?.textContent).toBe("Open settings")
  await user.click(trigger)
  await settle()
  const close = screen.getByRole("button", { name: "Close settings" })
  const tip = tooltipOf(close)
  expect(tip?.className).toContain("z-popover")
  expect(await axeViolations(document.body)).toEqual([])
  await user.click(close)
  await settle()
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("the toolbar has no axe violations, closed or with a tooltip open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <Toolbar />
    </main>,
  )
  await settle()
  expect(await axeViolations(container)).toEqual([])
  await user.tab()
  expect(await axeViolations(container)).toEqual([])
})

test("an icon size without an aria-label doesn't compile", () => {
  // @ts-expect-error: an icon button needs a name
  const button = <Button size="icon" />
  // @ts-expect-error: an icon toggle needs a name
  const toggle = <Toggle size="icon" />
  // @ts-expect-error: an icon trigger needs a name
  const trigger = <DialogTrigger size="icon" />
  expect([button, toggle, trigger]).toHaveLength(3)
})
