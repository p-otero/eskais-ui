import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  Dialog,
  DialogBackdrop,
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
