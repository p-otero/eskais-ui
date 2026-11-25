import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { PillDialog, type PillDialogProps } from "@/components/ui/pill-dialog"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

afterEach(() => {
  approve = false
})

function Migration(props: Partial<PillDialogProps>) {
  return (
    <PillDialog
      trigger="Run migration"
      title="Migrate the database?"
      description="You can't go back to the previous version."
      confirmLabel="Migrate"
      agentConfirm="Migrates the production database"
      onConfirm={() => {}}
      {...props}
    />
  )
}

const dialog = () => screen.getByRole("alertdialog", { name: "Migrate the database?" })

test("it opens on the blue pill, and the blue pill closes without confirming and returns focus", async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(<Migration onConfirm={onConfirm} onOpenChange={onOpenChange} />)
  const trigger = screen.getByRole("button", { name: "Run migration" })
  await user.click(trigger)

  const cancel = screen.getByRole("button", { name: "Cancel" })
  expect(document.activeElement).toBe(cancel)
  expect(cancel.dataset.pill).toBe("cancel")
  expect(cancel.querySelector('[data-slot="pill-dialog-capsule"]')?.getAttribute("aria-hidden")).toBe("true")
  expect(dialog().getAttribute("aria-describedby")).toBeTruthy()

  await user.click(cancel)
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ returnValue: "cancel" }))
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  expect(onConfirm).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(trigger)
})

test("while the red pill runs it stays open and busy, Escape can't close it, then it closes", async () => {
  const user = userEvent.setup()
  const work = Promise.withResolvers<void>()
  const onConfirm = vi.fn(() => work.promise)
  render(<Migration onConfirm={onConfirm} />)
  await user.click(screen.getByRole("button", { name: "Run migration" }))

  const confirm = screen.getByRole("button", { name: "Migrate" })
  expect(confirm.dataset.agentConfirm).toBe("Migrates the production database")
  await user.click(confirm)
  await user.click(confirm)
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(confirm.getAttribute("aria-busy")).toBe("true")
  expect(confirm.querySelector('[data-show="pending"]')).toBeTruthy()

  await user.keyboard("{Escape}")
  expect(dialog()).toBeTruthy()

  await act(async () => work.resolve())
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
})

test("a failed confirmation stays open with the error", async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn().mockRejectedValueOnce(new Error("The migration server didn't answer."))
  render(<Migration onConfirm={onConfirm} />)
  await user.click(screen.getByRole("button", { name: "Run migration" }))
  await user.click(screen.getByRole("button", { name: "Migrate" }))
  expect((await screen.findByRole("alert")).textContent).toBe("The migration server didn't answer.")
  expect(dialog()).toBeTruthy()
})

test("Escape cancels, and labels.cancel names the blue pill", async () => {
  const user = userEvent.setup()
  render(<Migration labels={{ cancel: "Quedarme" }} />)
  await user.click(screen.getByRole("button", { name: "Run migration" }))
  expect(screen.getByRole("button", { name: "Quedarme" })).toBeTruthy()
  await user.keyboard("{Escape}")
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
})

test("triggerDisabled stops the trigger", async () => {
  const user = userEvent.setup()
  render(<Migration triggerDisabled />)
  await user.click(screen.getByRole("button", { name: "Run migration" }))
  expect(screen.queryByRole("alertdialog")).toBeNull()
})

test("it has no axe violations", async () => {
  const user = userEvent.setup()
  render(<Migration />)
  await user.click(screen.getByRole("button", { name: "Run migration" }))
  expect(await axeViolations(dialog())).toEqual([])
})

test("an agent needs a person's approval to press the red pill, and presses the blue one alone", async () => {
  const onConfirm = vi.fn()
  render(<Migration onConfirm={onConfirm} />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const migrate = { steps: [{ ref: "Run migration", action: "press", args: ["Migrate"] }] }

  const refused = await agent.act(migrate)
  expect(refused.ok).toBe(false)
  expect(onConfirm).not.toHaveBeenCalled()
  expect(screen.queryByRole("alertdialog")).toBeNull()

  const cancelled = await agent.act({ steps: [{ ref: "Run migration", action: "press", args: ["Cancel"] }] })
  expect(cancelled.ok, cancelled.error?.message).toBe(true)
  expect(onConfirm).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())

  approve = true
  const approved = await agent.act(migrate)
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(onConfirm).toHaveBeenCalledTimes(1)
})
