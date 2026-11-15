import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { ProposalActions, type ProposalActionsProps } from "@/components/ui/proposal-actions"
import { agentTaskBoardLabelsEs } from "@/lib/agent-task-board-labels"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function renderActions(props: Partial<ProposalActionsProps> = {}) {
  return render(<ProposalActions taskId="T-011" mode="live" onApprove={vi.fn()} onReject={vi.fn()} {...props} />)
}

test("approve stays pending, ignores a second press, then settles", async () => {
  const user = userEvent.setup()
  const work = Promise.withResolvers<void>()
  const onApprove = vi.fn(() => work.promise)
  renderActions({ onApprove })

  const button = screen.getByRole("button", { name: "Approve proposal T-011" })
  expect(button.textContent).toBe("Approve")
  expect(button.dataset.agentConfirm).toBe("Approves proposal T-011, which starts agents")
  await user.click(button)
  await user.click(button)
  expect(onApprove).toHaveBeenCalledTimes(1)
  expect(onApprove).toHaveBeenCalledWith("T-011")
  expect(button.getAttribute("aria-busy")).toBe("true")

  await act(async () => work.resolve())
  expect(button.hasAttribute("aria-busy")).toBe(false)
  expect(screen.queryByRole("alert")?.textContent ?? "").toBe("")
})

test("a failed approve shows the error, and a retry clears it", async () => {
  const user = userEvent.setup()
  const onApprove = vi.fn().mockRejectedValueOnce(new Error("Quota exhausted")).mockResolvedValueOnce(undefined)
  renderActions({ onApprove, onReject: undefined })
  const button = screen.getByRole("button", { name: "Approve proposal T-011" })

  await user.click(button)
  expect((await screen.findByRole("alert")).textContent).toBe("Quota exhausted")
  await user.click(button)
  await vi.waitFor(() => expect(screen.getByRole("alert").textContent).toBe(""))
  expect(onApprove).toHaveBeenCalledTimes(2)
})

test("reject asks on screen; Cancel keeps the proposal and confirming rejects it", async () => {
  const user = userEvent.setup()
  const onReject = vi.fn()
  renderActions({ onReject })
  const trigger = screen.getByRole("button", { name: "Reject proposal T-011" })

  await user.click(trigger)
  const dialog = screen.getByRole("alertdialog", { name: "Reject proposal T-011?" })
  expect(dialog.textContent).toContain("No agent starts on it")
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(onReject).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(trigger)

  await user.click(trigger)
  const confirm = screen.getByRole("button", { name: "Discard it" })
  expect(confirm.dataset.agentConfirm).toBe("Rejects proposal T-011")
  await user.click(confirm)
  expect(onReject).toHaveBeenCalledWith("T-011")
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
})

test("a failed reject keeps the dialog open with the error", async () => {
  const user = userEvent.setup()
  renderActions({ onReject: () => Promise.reject(new Error("Board is read-only")) })
  await user.click(screen.getByRole("button", { name: "Reject proposal T-011" }))
  await user.click(screen.getByRole("button", { name: "Discard it" }))
  const dialog = screen.getByRole("alertdialog")
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Board is read-only")
})

test("snapshot mode, or no handlers, renders nothing", () => {
  const { container, rerender } = renderActions({ mode: "snapshot" })
  expect(container.innerHTML).toBe("")
  rerender(<ProposalActions taskId="T-011" mode="live" />)
  expect(container.innerHTML).toBe("")
})

test("labels can be overridden, for example with the Spanish preset", () => {
  renderActions({ labels: agentTaskBoardLabelsEs.proposals })
  expect(screen.getByRole("button", { name: "Aprobar propuesta T-011" }).textContent).toBe("Aprobar")
  expect(screen.getByRole("button", { name: "Rechazar propuesta T-011" })).toBeTruthy()
})

test("has no axe violations, closed and open", async () => {
  const user = userEvent.setup()
  const { container } = renderActions()
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Reject proposal T-011" }))
  expect(await axeViolations(document.body)).toEqual([])
})

const approveStep = { steps: [{ ref: "Approve proposal T-011", action: "press" }] }
const rejectStep = { steps: [{ ref: "Reject proposal T-011", action: "press", args: ["Discard it"] }] }

test("with confirm, an agent needs a person to approve or reject", async () => {
  const onApprove = vi.fn()
  const onReject = vi.fn()
  renderActions({ onApprove, onReject })
  await tick()

  approve = false
  expect((await agent.act(approveStep)).ok).toBe(false)
  expect((await agent.act(rejectStep)).ok).toBe(false)
  expect(onApprove).not.toHaveBeenCalled()
  expect(onReject).not.toHaveBeenCalled()

  approve = true
  const approved = await agent.act(approveStep)
  const rejected = await agent.act(rejectStep)
  approve = false
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(rejected.ok, rejected.error?.message).toBe(true)
  expect(onApprove).toHaveBeenCalledTimes(1)
  expect(onReject).toHaveBeenCalledTimes(1)
})

test("with allow, an agent approves and rejects without asking", async () => {
  const onApprove = vi.fn()
  const onReject = vi.fn()
  renderActions({ onApprove, onReject, agentApproval: "allow" })
  await tick()
  expect(screen.getByRole("button", { name: "Approve proposal T-011" }).dataset.agentConfirm).toBeUndefined()

  const result = await agent.act({ steps: [...approveStep.steps, ...rejectStep.steps] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onApprove).toHaveBeenCalledTimes(1)
  expect(onReject).toHaveBeenCalledTimes(1)
})

test("with deny, agents don't see the actions, but a person still can use them", async () => {
  renderActions({ agentApproval: "deny" })
  await tick()
  const labels = agent
    .snapshot()
    .filter((entry) => !entry.offPage)
    .map((entry) => entry.label)
  expect(labels).not.toContain("Approve proposal T-011")
  expect(labels).not.toContain("Reject proposal T-011")
  expect((await agent.act(approveStep)).ok).toBe(false)
  expect(screen.getByRole("button", { name: "Approve proposal T-011" })).toBeTruthy()
})
