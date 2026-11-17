import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"

import { AgentTaskBoard, type AgentTaskBoardProps } from "@/components/ui/agent-task-board"

import { GENERATED_AT, generateTasks, sampleTasks } from "./fixtures/agent-tasks"

function renderBoard(props: Partial<AgentTaskBoardProps>) {
  const all = {
    tasks: sampleTasks,
    mode: "snapshot",
    generatedAt: GENERATED_AT,
    timeZone: "UTC",
    locale: "en-US",
    ...props,
  }
  return render(<AgentTaskBoard {...(all as AgentTaskBoardProps)} />)
}

const focusedTask = () =>
  document.activeElement?.closest("[data-task-id], [data-item-id]")?.getAttribute("data-task-id") ??
  document.activeElement?.closest("[data-item-id]")?.getAttribute("data-item-id")

test("the table's task buttons are one tab stop that j/k move through, and Enter opens the task", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  const onSelect = vi.fn()
  renderBoard({ defaultView: "table", onSelectTask: onSelect })
  const buttons = [...document.querySelectorAll<HTMLElement>("[data-task-select]")]
  expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1)
  buttons.find((button) => button.tabIndex === 0)?.focus()
  const first = focusedTask()
  await user.keyboard("j")
  const second = focusedTask()
  expect(second).not.toBe(first)
  await user.keyboard("k")
  expect(focusedTask()).toBe(first)
  await user.keyboard("{End}")
  expect(focusedTask()).toBe(buttons.at(-1)?.getAttribute("data-task-id"))
  await user.keyboard("{Enter}")
  expect(onSelect).toHaveBeenCalledWith(buttons.at(-1)?.getAttribute("data-task-id"))
})

test("the backlog's rows move with j/k across its groups", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  renderBoard({ tasks: generateTasks(40, 30), defaultView: "backlog" })
  const rows = [...document.querySelectorAll<HTMLElement>('[data-slot="list-item-title"]')].flatMap((title) => {
    const button = title.closest("button")
    return button ? [button] : []
  })
  expect(rows.length).toBeGreaterThan(1)
  expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1)
  rows[0]?.focus()
  for (let index = 1; index < rows.length; index += 1) await user.keyboard("j")
  expect(document.activeElement).toBe(rows.at(-1))
})
