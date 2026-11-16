import { act, render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"

import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const onPage = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")

test("beside the side panel, an agent finds every control by name and can select, switch views, filter and open a thread", async () => {
  const onOpenThread = vi.fn()
  render(
    <AgentTaskBoard
      tasks={sampleTasks}
      mode="snapshot"
      generatedAt={GENERATED_AT}
      defaultSelectedTaskId="T-014"
      detailPresentation="side"
      onOpenThread={onOpenThread}
    />,
  )
  await tick()

  const components = onPage()
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  for (const label of [
    "Agent tasks",
    "Search tasks",
    "Profile",
    "Model",
    "View",
    "Proposed",
    "Open T-014 Index the docs for search",
    "Close task details",
  ]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label)
  }
  expect(components.find((entry) => entry.component === "agent-task-proposals")).toBeUndefined()
  expect(labels).not.toContain("Approve proposal T-011")

  const board = components.find((entry) => entry.component === "agent-task-board")
  expect(board?.actions).toEqual(expect.arrayContaining(["selectTask", "setView", "filter", "openThread"]))
  const result = await agent.act({
    steps: [
      { ref: "Agent tasks", action: "selectTask", args: ["T-015"] },
      { ref: "Agent tasks", action: "setView", args: ["table"] },
      { ref: "Agent tasks", action: "filter", args: [{ profile: "review" }] },
      { ref: "Agent tasks", action: "openThread", args: ["T-014-A1"] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(document.querySelector('[data-slot="task-detail-panel"]')?.getAttribute("data-task-id")).toBe("T-015")
  expect(screen.getByRole("table", { name: "Agent tasks table" })).toBeTruthy()
  expect(within(screen.getByRole("table", { name: "Agent tasks table" })).getAllByRole("row")).toHaveLength(2)
  expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: "th-1" }))

  const viaControls = await agent.act({
    steps: [
      { ref: "View", action: "setValue", args: ["board"] },
      { ref: "Profile", action: "setValue", args: ["bounded"] },
      { ref: "Close task details", action: "press" },
    ],
  })
  expect(viaControls.ok, viaControls.error?.message).toBe(true)
  expect(document.querySelectorAll('[data-slot="task-card"]')).toHaveLength(3)
  expect(document.querySelector('[data-slot="task-detail-panel"]')).toBeNull()
})

test("in live mode with confirm, approving a proposal needs a person", async () => {
  const onApproveProposal = vi.fn()
  render(
    <AgentTaskBoard
      tasks={sampleTasks}
      mode="live"
      now={GENERATED_AT}
      onApproveProposal={onApproveProposal}
      onRejectProposal={vi.fn()}
    />,
  )
  await tick()
  const proposals = onPage().find((entry) => entry.component === "agent-task-proposals")
  expect(proposals?.label).toBe("Proposal decisions")
  expect(proposals?.confirm).toBe("Approves or rejects a task proposal; approving starts agents")
  for (const entry of onPage()) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()

  const step = { steps: [{ ref: "Proposal decisions", action: "approveProposal", args: ["T-011"] }] }
  approve = false
  expect((await agent.act(step)).ok).toBe(false)
  const press = { steps: [{ ref: "Approve proposal T-011", action: "press" }] }
  expect((await agent.act(press)).ok).toBe(false)
  expect(onApproveProposal).not.toHaveBeenCalled()

  approve = true
  const approved = await agent.act(step)
  approve = false
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(onApproveProposal).toHaveBeenCalledWith("T-011")
})

test("with deny, agents see no proposal actions", async () => {
  render(
    <AgentTaskBoard
      tasks={sampleTasks}
      mode="live"
      now={GENERATED_AT}
      agentApproval="deny"
      onApproveProposal={vi.fn()}
    />,
  )
  await tick()
  const labels = onPage().map((entry) => entry.label)
  expect(onPage().find((entry) => entry.component === "agent-task-proposals")).toBeUndefined()
  expect(labels).not.toContain("Approve proposal T-011")
  expect(screen.getByRole("button", { name: "Approve proposal T-011" })).toBeTruthy()
})
