import { describe, expect, test } from "vitest"

import {
  filterOptions,
  filterTasks,
  groupByStatus,
  sortTasks,
  sumQuantities,
  summarize,
  taskCost,
} from "@/lib/agent-task-board"
import { agentTaskBoardLabels, agentTaskBoardLabelsEs, mergeLabels } from "@/lib/agent-task-board-labels"
import type { TaskView } from "@/lib/agent-task-types"

import { generateTasks, sampleTasks } from "./fixtures/agent-tasks"

const ids = (tasks: readonly TaskView[]) => tasks.map((task) => task.id)
const task = (overrides: Partial<TaskView> & Pick<TaskView, "id">): TaskView => ({
  title: overrides.id,
  status: "todo",
  dependsOn: [],
  acceptance: [],
  attempts: [],
  updatedAt: "2026-11-15T00:00:00Z",
  ...overrides,
})

describe("filterTasks", () => {
  test("the model filter matches the model that actually ran on any attempt", () => {
    expect(ids(filterTasks(sampleTasks, { model: "openai-codex/gpt-6.1-terra-preview-2026-11" }))).toEqual([
      "T-014",
      "T-016",
    ])
    expect(ids(filterTasks(sampleTasks, { model: "zai/glm-5.3" }))).toEqual(["T-014"])
  })

  test("the configured model counts only when the executed one is missing", () => {
    const configuredOnly = filterTasks(sampleTasks, { model: "openai-codex/gpt-6.1-terra-preview-2026-11" })
    expect(ids(configuredOnly)).toContain("T-016")
    const swapped = task({
      id: "X",
      attempts: [
        {
          ...sampleTasks[3]!.attempts[1]!,
          configured: { provider: "pi", model: "requested" },
          executed: { provider: "codex", model: "ran" },
        },
      ],
    })
    expect(ids(filterTasks([swapped], { model: "requested" }))).toEqual([])
    expect(ids(filterTasks([swapped], { model: "ran" }))).toEqual(["X"])
  })

  test("the query matches id, title and goal, ignoring case", () => {
    expect(ids(filterTasks(sampleTasks, { query: "t-012" }))).toEqual(["T-012"])
    expect(ids(filterTasks(sampleTasks, { query: "  SCHEMA " }))).toEqual(["T-009"])
    expect(ids(filterTasks([task({ id: "G", goal: "Faster Lookups" })], { query: "lookups" }))).toEqual(["G"])
  })

  test("project and profile filters combine; empty filters keep everything", () => {
    const tasks = [task({ id: "A", project: "nf", profile: "bounded" }), task({ id: "B", project: "nf" })]
    expect(ids(filterTasks(tasks, { project: "nf", profile: "bounded" }))).toEqual(["A"])
    expect(filterTasks(sampleTasks, {})).toHaveLength(sampleTasks.length)
    expect(filterTasks(sampleTasks, { query: "" })).toHaveLength(sampleTasks.length)
  })
})

describe("groupByStatus", () => {
  test("one column per status in contract order, with cancelled hidden by default", () => {
    const columns = groupByStatus([...sampleTasks, task({ id: "C", status: "cancelled" })])
    expect(columns.map((column) => column.status)).toEqual(["proposed", "todo", "working", "review", "blocked", "done"])
    expect(ids(columns[0]!.tasks)).toEqual(["T-011"])
  })

  test("todo splits into ready and waiting, falling back to the dependencies", () => {
    const todo = groupByStatus([
      ...sampleTasks,
      task({ id: "D1", dependsOn: [{ id: "T-009", status: "done" }] }),
      task({ id: "D2", dependsOn: [{ id: "T-014", status: "working" }] }),
      task({ id: "D3", ready: false, dependsOn: [{ id: "T-009", status: "done" }] }),
    ]).find((column) => column.status === "todo")
    expect(ids(todo!.groups!.ready)).toEqual(["T-012", "D1"])
    expect(ids(todo!.groups!.waiting)).toEqual(["T-013", "D2", "D3"])
    expect(groupByStatus(sampleTasks).find((column) => column.status === "done")!.groups).toBeUndefined()
  })

  test("the columns config sets order, hidden and collapsed", () => {
    const columns = groupByStatus(sampleTasks, [
      { status: "done", collapsed: true },
      { status: "proposed", hidden: true },
      { status: "cancelled", hidden: false },
    ])
    expect(columns.map((column) => column.status)).toEqual([
      "done",
      "cancelled",
      "todo",
      "working",
      "review",
      "blocked",
    ])
    expect(columns[0]!.collapsed).toBe(true)
    expect(columns[1]!.collapsed).toBe(false)
  })
})

test("filterOptions lists distinct projects, profiles and effective models, sorted", () => {
  const options = filterOptions([...sampleTasks, task({ id: "P", project: "nf" }), task({ id: "Q", project: "atlas" })])
  expect(options.projects).toEqual(["atlas", "nf"])
  expect(options.profiles).toEqual(["bounded", "lookup", "reasoning", "review"])
  expect(options.models).toEqual(["claude-opus-5-5", "openai-codex/gpt-6.1-terra-preview-2026-11", "zai/glm-5.3"])
})

describe("sortTasks", () => {
  test("unknown cost sorts last in both directions, never as 0", () => {
    const tasks = [
      task({ id: "unknown" }),
      task({ id: "free", usage: { ...sampleTasks[3]!.usage!, costUsd: { value: 0, quality: "measured" } } }),
      task({ id: "dear", usage: sampleTasks[3]!.usage }),
    ]
    expect(ids(sortTasks(tasks, "cost", "ascending"))).toEqual(["free", "dear", "unknown"])
    expect(ids(sortTasks(tasks, "cost", "descending"))).toEqual(["dear", "free", "unknown"])
  })

  test("ids sort numerically, status in contract order, and the input is not mutated", () => {
    const tasks = [task({ id: "T-10", status: "done" }), task({ id: "T-9", status: "proposed" })]
    expect(ids(sortTasks(tasks, "id"))).toEqual(["T-9", "T-10"])
    expect(ids(sortTasks(tasks, "status", "descending"))).toEqual(["T-10", "T-9"])
    expect(ids(tasks)).toEqual(["T-10", "T-9"])
  })

  test("title, updatedAt and attempts", () => {
    expect(ids(sortTasks(sampleTasks, "attempts", "descending")).slice(0, 1)).toEqual(["T-014"])
    expect(ids(sortTasks(sampleTasks, "updatedAt")).at(0)).toBe("T-009")
    expect(ids(sortTasks(sampleTasks, "title")).at(0)).toBe("T-013")
  })
})

describe("cost quality", () => {
  test("a sum is unknown when every part is, estimated when any part is estimated or missing", () => {
    const measured = { value: 1, quality: "measured" } as const
    expect(sumQuantities([{ value: null, quality: "unknown" }])).toEqual({ value: null, quality: "unknown" })
    expect(sumQuantities([measured, { value: 2, quality: "estimated" }])).toEqual({ value: 3, quality: "estimated" })
    expect(sumQuantities([measured, { value: null, quality: "unknown" }])).toEqual({ value: 1, quality: "estimated" })
    expect(sumQuantities([measured, measured])).toEqual({ value: 2, quality: "derived" })
  })

  test("a task without usage sums its attempts", () => {
    expect(taskCost(sampleTasks.find((item) => item.id === "T-015")!)).toEqual({ value: null, quality: "unknown" })
    expect(taskCost(sampleTasks.find((item) => item.id === "T-011")!).quality).toBe("unknown")
  })
})

test("summarize counts statuses, first-pass acceptance, cost and pending decisions", () => {
  const summary = summarize(sampleTasks)
  expect(summary.total).toBe(7)
  expect(summary.byStatus).toEqual({ proposed: 1, todo: 2, working: 1, review: 1, blocked: 1, done: 1, cancelled: 0 })
  expect(summary.acceptedFirstPass).toEqual({ accepted: 1, rated: 1 })
  expect(summary.cost.quality).toBe("estimated")
  expect(summary.cost.value).toBeCloseTo(1.01)
  // T-011 has a decision and is a review-mode proposal; T-016 has a decision.
  expect(summary.awaitingDecision).toBe(2)
  expect(summarize([task({ id: "R", status: "proposed", analysisMode: "review" })]).awaitingDecision).toBe(1)
  expect(summarize([task({ id: "N" })]).cost).toEqual({ value: null, quality: "unknown" })
})

test("200 tasks with up to 30 attempts filter and group in under 50 ms", () => {
  const tasks = generateTasks(200, 30)
  const start = performance.now()
  const filtered = filterTasks(tasks, { model: "claude-opus-5-5", query: "generated" })
  const columns = groupByStatus(filtered)
  const elapsed = performance.now() - start
  expect(columns.length).toBe(6)
  expect(filtered.length).toBeGreaterThan(0)
  expect(elapsed).toBeLessThan(50)
})

describe("labels", () => {
  test("mergeLabels overrides one nested label and keeps its siblings", () => {
    const labels = mergeLabels(agentTaskBoardLabels, { filters: { anyModel: "Every model" }, board: "Tasks" })
    expect(labels.filters.anyModel).toBe("Every model")
    expect(labels.filters.allProjects).toBe("All projects")
    expect(labels.board).toBe("Tasks")
    expect(agentTaskBoardLabels.filters.anyModel).toBe("Any model")
  })

  test("interpolated labels in both languages", () => {
    expect(agentTaskBoardLabels.snapshot("Nov 15")).toBe("Snapshot · Nov 15")
    expect(agentTaskBoardLabelsEs.snapshot("15 nov")).toBe("Instantánea · 15 nov")
    expect(agentTaskBoardLabels.proposals.approveAgentConfirm("T-011")).toBe(
      "Approves proposal T-011, which starts agents",
    )
    expect(Object.keys(agentTaskBoardLabelsEs).toSorted()).toEqual(Object.keys(agentTaskBoardLabels).toSorted())
  })
})
