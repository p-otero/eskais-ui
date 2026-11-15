import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

function DeleteProject({ onConfirm }: { onConfirm: () => unknown }) {
  return (
    <ConfirmDialog
      trigger="Delete project"
      title="Delete Apollo?"
      description="The project and its files are deleted for everyone."
      confirmLabel="Delete forever"
      tone="destructive"
      agentConfirm="Deletes the project and its files"
      pendingAnnouncement="Deleting project"
      onConfirm={onConfirm}
    />
  )
}

test("Cancel closes without confirming and returns focus", async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  render(<DeleteProject onConfirm={onConfirm} />)
  const trigger = screen.getByRole("button", { name: "Delete project" })
  expect(trigger.className).toContain("bg-destructive")

  await user.click(trigger)
  const dialog = screen.getByRole("alertdialog", { name: "Delete Apollo?" })
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("alertdialog")).toBeNull()
  expect(onConfirm).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(trigger)
})

test("while confirming it stays open, blocks dismissal and double submits, then closes", async () => {
  const user = userEvent.setup()
  const work = Promise.withResolvers<void>()
  const onConfirm = vi.fn(() => work.promise)
  render(<DeleteProject onConfirm={onConfirm} />)
  await user.click(screen.getByRole("button", { name: "Delete project" }))

  const confirm = screen.getByRole("button", { name: "Delete forever" })
  expect(confirm.dataset.agentConfirm).toBe("Deletes the project and its files")
  await user.click(confirm)
  await user.click(confirm)
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(confirm.getAttribute("aria-busy")).toBe("true")

  await user.keyboard("{Escape}")
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.getByRole("alertdialog", { name: "Delete Apollo?" })).toBeTruthy()

  await act(async () => work.resolve())
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
})

test("a failed confirmation stays open with the error, and a retry can succeed", async () => {
  const user = userEvent.setup()
  const onConfirm = vi
    .fn()
    .mockRejectedValueOnce(new Error("Couldn't delete the project."))
    .mockResolvedValueOnce(undefined)
  render(<DeleteProject onConfirm={onConfirm} />)
  await user.click(screen.getByRole("button", { name: "Delete project" }))
  await user.click(screen.getByRole("button", { name: "Delete forever" }))

  expect((await screen.findByRole("alert")).textContent).toBe("Couldn't delete the project.")
  expect(screen.getByRole("alertdialog", { name: "Delete Apollo?" })).toBeTruthy()

  await user.click(screen.getByRole("button", { name: "Delete forever" }))
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  expect(onConfirm).toHaveBeenCalledTimes(2)
})

test("an agent needs a person's approval to confirm a destructive action", async () => {
  const onConfirm = vi.fn()
  render(<DeleteProject onConfirm={onConfirm} />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const remove = { steps: [{ ref: "Delete project", action: "press", args: ["Delete forever"] }] }

  approve = false
  const refused = await agent.act(remove)
  expect(refused.ok).toBe(false)
  expect(onConfirm).not.toHaveBeenCalled()
  expect(screen.queryByRole("alertdialog")).toBeNull()

  approve = true
  const approved = await agent.act(remove)
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(onConfirm).toHaveBeenCalledTimes(1)
})
