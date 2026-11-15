import { act, render, screen } from "@testing-library/react"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { agentTaskBoard } from "@/components/ui/agent-task-board-primitive"
import { AgentTaskBoardRoot, AgentTaskProposalsRoot } from "@/components/ui/agent-task-board-root"
import { agentTaskProposals } from "@/components/ui/agent-task-proposals-primitive"
import type { TaskFilters } from "@/lib/agent-task-board-model"

import { axeViolations } from "./axe"
import { sampleTasks } from "./fixtures/agent-tasks"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const markup = `<root aria-label="Agent tasks"></root>`

test("primitive: view, filters and selection change with a reason, uncontrolled", () => {
  const onViewChange = vi.fn()
  const view = mount(agentTaskBoard, { tasks: sampleTasks, onViewChange }, markup)
  try {
    expect(view.state).toMatchObject({ view: "board", filters: {}, selectedTaskId: null })
    expect(view.api.setView("table")).toBe(true)
    expect(view.state.view).toBe("table")
    expect(onViewChange).toHaveBeenCalledWith("table", expect.objectContaining({ reason: "imperative" }))
    expect(view.part("root")?.getAttribute("data-view")).toBe("table")

    view.api.filter({ model: "zai/glm-5.3", query: "docs" })
    view.api.filter({ query: null })
    expect(view.state.filters).toEqual({ model: "zai/glm-5.3" })

    view.api.selectTask("T-014", { reason: "item-press" })
    expect(view.state.selectedTaskId).toBe("T-014")
    expect(view.changes.at(-1)).toMatchObject({ key: "selectedTaskId", reason: "item-press" })
    view.api.selectTask(null)
    expect(view.state.selectedTaskId).toBeNull()
  } finally {
    view.unmount()
  }
})

test("primitive: a canceled change and a controlled value keep the state", () => {
  const view = mount(
    agentTaskBoard,
    {
      tasks: sampleTasks,
      selectedTaskId: "T-012",
      onSelectedTaskIdChange: () => {},
      onViewChange: (_view, details) => details.cancel(),
    },
    markup,
  )
  try {
    expect(view.api.setView("table")).toBe(false)
    expect(view.state.view).toBe("board")
    view.api.selectTask("T-014")
    expect(view.state.selectedTaskId).toBe("T-012")
  } finally {
    view.unmount()
  }
})

test("primitive: actions refuse arguments the bridge passes unchecked", () => {
  const view = mount(agentTaskBoard, { tasks: sampleTasks }, markup)
  try {
    expect(() => view.api.setView("grid")).toThrow(/board.*table/)
    expect(() => view.api.filter("claude")).toThrow(TypeError)
    expect(() => view.api.filter({ owner: "me" })).toThrow(/Unknown filter "owner"/)
    expect(() => view.api.filter({ model: "gpt" })).toThrow(/Choices: claude-opus-5-5/)
    expect(() => view.api.filter({ query: 3 })).toThrow(TypeError)
    expect(() => view.api.selectTask("T-999")).toThrow(/No task "T-999"/)
    expect(() => view.api.openThread("T-014-A1")).toThrow(/doesn't open threads/)
    expect(view.changes).toHaveLength(0)
  } finally {
    view.unmount()
  }
})

test("primitive: openThread passes the attempt's thread and refuses attempts without one", () => {
  const onOpenThread = vi.fn()
  const view = mount(agentTaskBoard, { tasks: sampleTasks, onOpenThread }, markup)
  try {
    expect(view.api.openThread("T-014-A1")).toBe(true)
    expect(onOpenThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: "th-1" }),
      expect.objectContaining({ attemptId: "T-014-A1", reason: "imperative" }),
    )
    expect(() => view.api.openThread("T-016-A1")).toThrow(/no thread/)
    expect(() => view.api.openThread("nope")).toThrow(/No attempt/)
  } finally {
    view.unmount()
  }
})

test("primitives render on the server", () => {
  checkServer(agentTaskBoard, { tasks: sampleTasks }, markup)
  checkServer(agentTaskProposals, { tasks: sampleTasks, mode: "live", agentConfirm: "Approves" }, markup)
})

function Board({ onOpenThread }: { onOpenThread: () => void }) {
  const [filters, setFilters] = useState<TaskFilters>({})
  return (
    <AgentTaskBoardRoot
      aria-label="Agent tasks"
      tasks={sampleTasks}
      filters={filters}
      onFiltersChange={setFilters}
      onOpenThread={onOpenThread}
    >
      <output aria-label="Active filters">{JSON.stringify(filters)}</output>
    </AgentTaskBoardRoot>
  )
}

test("an agent can switch the view, filter, select a task and open a thread", async () => {
  const onOpenThread = vi.fn()
  const { container } = render(<Board onOpenThread={onOpenThread} />)
  await tick()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const board = components.find((entry) => entry.component === "agent-task-board")
  expect(board?.label).toBe("Agent tasks")
  expect(board?.actions).toEqual(expect.arrayContaining(["setView", "filter", "selectTask", "openThread"]))
  const [first] = (board?.items ?? []) as { value: string }[]

  const result = await agent.act({
    steps: [
      { ref: "Agent tasks", action: "setView", args: ["table"] },
      { ref: "Agent tasks", action: "filter", args: [{ profile: "bounded" }] },
      { ref: "Agent tasks", action: "selectTask", args: [first?.value] },
      { ref: "Agent tasks", action: "openThread", args: ["T-014-A2"] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("status", { name: "Active filters" }).textContent).toBe(`{"profile":"bounded"}`)
  expect(agent.snapshot().find((entry) => entry.ref === board?.ref)).toMatchObject({
    view: "table",
    filters: { profile: "bounded" },
    selectedTaskId: "T-011",
  })
  expect(onOpenThread).toHaveBeenCalledWith(
    expect.objectContaining({ id: "th-2" }),
    expect.objectContaining({ source: "agent" }),
  )

  const refused = await agent.act({ steps: [{ ref: "Agent tasks", action: "filter", args: [{ model: "gpt" }] }] })
  expect(refused.ok).toBe(false)
  expect(refused.error?.message).toMatch(/No model "gpt"/)
  expect(await axeViolations(container)).toEqual([])
})

function Proposals(props: { mode?: "live" | "snapshot"; agentApproval?: "confirm" | "allow" | "deny" }) {
  return (
    <AgentTaskProposalsRoot
      aria-label="Proposal decisions"
      tasks={sampleTasks}
      mode={props.mode ?? "live"}
      agentApproval={props.agentApproval}
      agentConfirm="Approves or rejects a task proposal; approving starts agents"
      onApproveProposal={onApprove}
      onRejectProposal={onReject}
    />
  )
}
const onApprove = vi.fn()
const onReject = vi.fn()
const approveStep = { steps: [{ ref: "Proposal decisions", action: "approveProposal", args: ["T-011"] }] }
const proposalsEntry = () =>
  agent.snapshot().find((entry) => !entry.offPage && entry.component === "agent-task-proposals")

test("approveProposal needs a person's approval when agentApproval is confirm", async () => {
  onApprove.mockClear()
  render(<Proposals />)
  await tick()
  expect(proposalsEntry()?.confirm).toBe("Approves or rejects a task proposal; approving starts agents")

  approve = false
  expect((await agent.act(approveStep)).ok).toBe(false)
  expect(onApprove).not.toHaveBeenCalled()

  approve = true
  const approved = await agent.act(approveStep)
  const wrong = await agent.act({ steps: [{ ref: "Proposal decisions", action: "rejectProposal", args: ["T-012"] }] })
  approve = false
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(onApprove).toHaveBeenCalledWith("T-011", expect.objectContaining({ source: "agent" }))
  expect(wrong.error?.message).toMatch(/No proposal "T-012". Proposals: T-011/)
})

test("with allow, an agent approves and rejects without asking", async () => {
  onReject.mockClear()
  render(<Proposals agentApproval="allow" />)
  await tick()
  expect(proposalsEntry()?.confirm).toBeUndefined()
  const result = await agent.act({ steps: [{ ref: "Proposal decisions", action: "rejectProposal", args: ["T-011"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onReject).toHaveBeenCalledWith("T-011", expect.anything())
})

test.each([
  ["deny", { agentApproval: "deny" as const }],
  ["snapshot mode", { mode: "snapshot" as const }],
])("proposal actions are absent with %s", async (_name, props) => {
  render(<Proposals {...props} />)
  await tick()
  expect(proposalsEntry()).toBeUndefined()
  expect((await agent.act(approveStep)).ok).toBe(false)
})
