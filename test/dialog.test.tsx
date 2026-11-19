import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const agent = createAgent()

function RenameDialog(props: { dismissible?: boolean; onDismissAttempt?: () => void }) {
  return (
    <Dialog {...props}>
      <DialogTrigger>Rename project</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Apollo</DialogTitle>
          <DialogDescription>Everyone on the team sees the new name.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Project name</FieldLabel>
          <Input defaultValue="Apollo" />
        </Field>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose variant="default" value="save">
            Save
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

test("opens named and described, and Escape returns focus to the trigger", async () => {
  const user = userEvent.setup()
  render(<RenameDialog />)
  const trigger = screen.getByRole("button", { name: "Rename project" })
  expect(trigger.className).toContain("border-input")

  await user.click(trigger)
  const dialog = screen.getByRole("dialog", { name: "Rename Apollo" })
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy()
  expect(dialog.querySelector('[data-slot="dialog-header"]')).not.toBeNull()

  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("each close button closes the dialog", async () => {
  const user = userEvent.setup()
  render(<RenameDialog />)
  for (const name of ["Cancel", "Save"]) {
    await user.click(screen.getByRole("button", { name: "Rename project" }))
    await user.click(screen.getByRole("button", { name }))
    expect(screen.queryByRole("dialog")).toBeNull()
  }
})

test("a non-dismissible dialog refuses Escape and reports the attempt", async () => {
  const user = userEvent.setup()
  const onDismissAttempt = vi.fn()
  render(<RenameDialog dismissible={false} onDismissAttempt={onDismissAttempt} />)
  await user.click(screen.getByRole("button", { name: "Rename project" }))
  await user.keyboard("{Escape}")
  expect(screen.getByRole("dialog", { name: "Rename Apollo" })).toBeTruthy()
  expect(onDismissAttempt).toHaveBeenCalledTimes(1)
})

test("an agent can open the dialog and edit its field", async () => {
  render(<RenameDialog />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const opened = await agent.act({ steps: [{ ref: "Rename project", action: "open" }] })
  expect(opened.ok, opened.error?.message).toBe(true)

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Project name")

  const result = await agent.act({ steps: [{ ref: "Project name", action: "setValue", args: ["Atlas"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" }).value).toBe("Atlas")
})

function SizedDialog({ size, sheet }: { size?: "sm" | "md" | "lg" | "xl" | "full"; sheet?: boolean }) {
  return (
    <Dialog defaultOpen>
      <DialogBackdrop />
      <DialogContent size={size} sheet={sheet}>
        <DialogHeader>
          <DialogTitle>Sized</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p>Body</p>
        </DialogBody>
        <DialogFooter>
          <DialogClose>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

test("sizes set the width; md is the default; the body scrolls between a header and footer that don't shrink", () => {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-6xl", full: "max-w-none" } as const
  for (const [size, width] of Object.entries(widths) as [keyof typeof widths, string][]) {
    const { unmount } = render(<SizedDialog size={size} />)
    const dialog = screen.getByRole("dialog", { name: "Sized" })
    expect(dialog.getAttribute("data-size")).toBe(size)
    expect(dialog.className).toContain(width)
    expect(dialog.className).toContain("wrap-anywhere")
    expect(dialog.className).not.toMatch(/\d+d?vh\b|h-screen/)
    unmount()
  }
  render(<SizedDialog />)
  const dialog = screen.getByRole("dialog", { name: "Sized" })
  expect(dialog.getAttribute("data-size")).toBe("md")
  expect(dialog.querySelector('[data-slot="dialog-body"]')?.parentElement?.dataset.slot).toBe("scroll-area")
  expect(dialog.querySelector('[data-slot="dialog-header"]')?.className).toContain("shrink-0")
  expect(dialog.querySelector('[data-slot="dialog-footer"]')?.className).toContain("shrink-0")
})

test("on narrow screens it is a bottom sheet unless sheet={false}", () => {
  const { unmount } = render(<SizedDialog />)
  const sheet = screen.getByRole("dialog", { name: "Sized" })
  expect(sheet.hasAttribute("data-sheet")).toBe(true)
  expect(sheet.className).toContain("narrow:rounded-b-none")
  unmount()
  render(<SizedDialog sheet={false} />)
  const centered = screen.getByRole("dialog", { name: "Sized" })
  expect(centered.hasAttribute("data-sheet")).toBe(false)
  expect(centered.className).not.toContain("narrow:")
})
