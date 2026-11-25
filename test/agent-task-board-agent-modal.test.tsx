import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"

import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const onPage = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
const detailId = () => document.querySelector("[data-task-detail]")?.getAttribute("data-task-id")

test("with the detail dialog open, an agent reads it, opens a thread, uses board actions and closes it", async () => {
  const onOpenThread = vi.fn()
  render(
    <AgentTaskBoard
      tasks={sampleTasks}
      mode="snapshot"
      generatedAt={GENERATED_AT}
      defaultSelectedTaskId="T-014"
      onOpenThread={onOpenThread}
    />,
  )
  await tick()

  const components = onPage()
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  for (const label of ["Agent tasks", "T-014 Index the docs for search", "Attempts", "Open thread th-2"]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label)
  }
  for (const label of ["Search tasks", "Profile", "View", "Open T-015 Review the agent approval flow"]) {
    expect(labels).not.toContain(label)
  }
  const dialog = components.find((entry) => entry.component === "dialog")
  expect(dialog?.buttons).toContain("Close task details")

  const read = await agent.act({
    steps: [
      { ref: "Open thread th-2", action: "press" },
      { ref: "Agent tasks", action: "selectTask", args: ["T-015"] },
      { ref: "Agent tasks", action: "filter", args: [{ profile: "review" }] },
    ],
  })
  expect(read.ok, read.error?.message).toBe(true)
  expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: "th-2" }))
  expect(detailId()).toBe("T-015")
  expect(document.querySelectorAll('[data-slot="task-card"]')).toHaveLength(1)

  const missing = await agent.act({ steps: [{ ref: "Agent tasks", action: "selectTask", args: ["T-404"] }] })
  expect(missing.ok).toBe(false)
  expect(missing.error?.message).toMatch(/No task "T-404"/)

  const close = await agent.act({
    steps: [{ ref: "T-015 Review the agent approval flow", action: "press", args: ["Close task details"] }],
  })
  expect(close.ok, close.error?.message).toBe(true)
  await tick()
  expect(detailId()).toBeUndefined()
  expect(onPage().map((entry) => entry.label)).toContain("Search tasks")
})

test("inside the dialog, approving and rejecting a proposal follow agentApproval", async () => {
  const onApproveProposal = vi.fn()
  const onRejectProposal = vi.fn()
  render(
    <AgentTaskBoard
      tasks={sampleTasks}
      mode="live"
      now={GENERATED_AT}
      defaultSelectedTaskId="T-011"
      onApproveProposal={onApproveProposal}
      onRejectProposal={onRejectProposal}
    />,
  )
  await tick()
  const approveStep = { steps: [{ ref: "Approve proposal T-011", action: "press" }] }
  const rejectStep = { steps: [{ ref: "Reject proposal T-011", action: "press", args: ["Discard it"] }] }

  approve = false
  expect((await agent.act(approveStep)).ok).toBe(false)
  expect((await agent.act(rejectStep)).ok).toBe(false)
  expect(onApproveProposal).not.toHaveBeenCalled()
  expect(onRejectProposal).not.toHaveBeenCalled()

  approve = true
  const approved = await agent.act(approveStep)
  const rejected = await agent.act(rejectStep)
  approve = false
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(rejected.ok, rejected.error?.message).toBe(true)
  expect(onApproveProposal).toHaveBeenCalledWith("T-011")
  expect(onRejectProposal).toHaveBeenCalledWith("T-011")
  expect(screen.getByRole("dialog", { name: /^T-011 / })).toBeTruthy()
})

test("with allow, an agent approves inside the dialog without asking; with deny it sees no actions", async () => {
  const onApproveProposal = vi.fn()
  const props = { tasks: sampleTasks, now: GENERATED_AT, defaultSelectedTaskId: "T-011", onApproveProposal }
  const { unmount } = render(<AgentTaskBoard {...props} mode="live" agentApproval="allow" />)
  await tick()
  const allowed = await agent.act({ steps: [{ ref: "Approve proposal T-011", action: "press" }] })
  expect(allowed.ok, allowed.error?.message).toBe(true)
  expect(onApproveProposal).toHaveBeenCalledWith("T-011")
  unmount()

  render(<AgentTaskBoard {...props} mode="live" agentApproval="deny" />)
  await tick()
  expect(onPage().map((entry) => entry.label)).not.toContain("Approve proposal T-011")
  expect(screen.getAllByRole("button", { name: "Approve proposal T-011" }).length).toBeGreaterThan(0)
})
