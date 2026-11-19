import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test } from "vitest"

import type { Liveness, TaskView } from "@/lib/agent-task-types"
import { TaskCard } from "@/components/ui/task-card"

import { axeViolations } from "./axe"
import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

const evidence = "No output for 25 min; the process is still alive"

function withLiveness(liveness: Liveness, livenessEvidence?: string): TaskView {
  const task = sampleTasks.find((item) => item.id === "T-015")!
  return {
    ...task,
    attempts: task.attempts.map((attempt) =>
      attempt.id === task.activeAttemptId ? { ...attempt, liveness, livenessEvidence } : attempt,
    ),
  }
}

const chip = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-slot="task-card-liveness"]')!

test("a stuck attempt with evidence explains its verdict in a tooltip", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <TaskCard task={withLiveness("suspect_dead", evidence)} now={GENERATED_AT} locale="en-US" />,
  )
  expect(chip(container).getAttribute("title")).toBeNull()
  expect(screen.getByRole("button", { name: "Possibly stuck" })).toBe(chip(container))
  await user.hover(chip(container))
  const tooltip = await screen.findByRole("tooltip")
  expect(tooltip.textContent).toContain("Possibly stuck")
  expect(tooltip.textContent).toContain(evidence)
  expect(await axeViolations(container)).toEqual([])
})

test("a waiting attempt with evidence explains it too", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <TaskCard task={withLiveness("waiting_input", "Asked to approve a migration")} now={GENERATED_AT} />,
  )
  await user.hover(chip(container))
  expect((await screen.findByRole("tooltip")).textContent).toContain("Asked to approve a migration")
})

test("without evidence, or for a routine state, the chip keeps its title", () => {
  const { container, rerender } = render(<TaskCard task={withLiveness("suspect_dead")} now={GENERATED_AT} />)
  expect(chip(container).getAttribute("title")).toBeTruthy()
  rerender(<TaskCard task={withLiveness("running", evidence)} now={GENERATED_AT} />)
  expect(chip(container).getAttribute("title")).toBeTruthy()
})
