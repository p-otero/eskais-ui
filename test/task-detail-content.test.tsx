import { render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import {
  TaskDetailAttempts,
  TaskDetailContent,
  TaskDetailUsage,
  type TaskDetailContentProps,
} from "@/components/ui/task-detail-content"

import { axeViolations } from "./axe"
import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"
import { settle } from "./overlay-helpers"

const agent = createAgent()
const indexDocs = sampleTasks.find((candidate) => candidate.id === "T-014") ?? sampleTasks[0]!
const task = { ...indexDocs, goal: "Make every docs page findable." }
const time = { now: GENERATED_AT, locale: "en-US", timeZone: "UTC" }

function headings(container: HTMLElement, slot: "main" | "side") {
  const column = container.querySelector(`[data-slot="task-detail-${slot}"]`) as HTMLElement
  return within(column)
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent)
}

function renderContent(props: Partial<TaskDetailContentProps> = {}) {
  return render(<TaskDetailContent task={task} {...time} {...props} />)
}

test("hide leaves out the sections and rows a header already shows", () => {
  const { container } = renderContent()
  expect(headings(container, "main")).toContain("Acceptance")
  expect(headings(container, "side")).toContain("Work")
  expect(screen.getByText("Status")).toBeTruthy()

  const hidden = renderContent({ hide: ["status", "cost", "attemptsSummary", "usage", "acceptance"] })
  expect(headings(hidden.container, "main")).not.toContain("Acceptance")
  expect(headings(hidden.container, "side")).not.toContain("Work")
  expect(headings(hidden.container, "side")).not.toContain("Usage")
  expect(within(hidden.container).queryByText("Status")).toBeNull()
  expect(within(hidden.container).getByText("Updated")).toBeTruthy()
})

test("hide also drops the cost row of a task without usage", () => {
  const withoutUsage = { ...task, usage: undefined }
  const shown = render(<TaskDetailContent task={withoutUsage} {...time} />)
  expect(within(shown.container).getByText("Cost")).toBeTruthy()
  const hidden = render(<TaskDetailContent task={withoutUsage} {...time} hide={["cost"]} />)
  expect(within(hidden.container).queryByText("Cost")).toBeNull()
})

test("sections sets which sections each column shows, in order", () => {
  const { container } = renderContent({
    sections: { main: ["activity", "goal"], side: ["details", "links", "usage"] },
  })
  expect(headings(container, "main")).toEqual(["Activity", "Goal"])
  expect(headings(container, "side")).toEqual(task.links?.length ? ["Links", "Usage"] : ["Usage"])
})

test("a section renders on its own", () => {
  render(<TaskDetailAttempts task={task} headingLevel={2} />)
  expect(screen.getByRole("heading", { level: 2, name: "Work" })).toBeTruthy()
  render(<TaskDetailUsage task={task} {...time} />)
  expect(screen.getByRole("heading", { level: 3, name: "Usage" })).toBeTruthy()
})

test("a section with nothing to show renders nothing", () => {
  const { container } = render(<TaskDetailUsage task={{ ...task, usage: undefined }} />)
  expect(container.innerHTML).toBe("")
})

test("has no axe violations with sections hidden", async () => {
  const { container } = renderContent({ hide: ["status", "acceptance", "attemptsSummary"] })
  expect(await axeViolations(container)).toEqual([])
})

test("an agent reads every remaining control by name", async () => {
  renderContent({ hide: ["status", "cost", "attemptsSummary", "acceptance"] })
  await settle()
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  expect(entries.length).toBeGreaterThan(0)
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
})
