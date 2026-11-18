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

const columnCards = () =>
  [...document.querySelectorAll('[data-slot="board-column"]')]
    .map((column) => [...column.querySelectorAll<HTMLElement>("[data-task-select]")])
    .filter((cards) => cards.length > 0)

test("the board's cards are one tab stop: ←/→ cross columns keeping the row, ↑/↓ and j/k stay in a column", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  const onSelect = vi.fn()
  renderBoard({ tasks: generateTasks(40, 7), onSelectTask: onSelect })
  const columns = columnCards()
  const cards = columns.flat()
  expect(columns.length).toBeGreaterThan(2)
  expect(cards.filter((card) => card.tabIndex === 0)).toHaveLength(1)

  const [first = [], second = []] = columns
  first[0]?.focus()
  await user.keyboard("jj")
  expect(document.activeElement).toBe(first[Math.min(2, first.length - 1)])
  await user.keyboard("k")
  expect(document.activeElement).toBe(first[Math.min(1, first.length - 1)])
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(second[Math.min(1, second.length - 1)])
  await user.keyboard("{ArrowLeft}{Home}")
  expect(document.activeElement).toBe(first[0])
  await user.keyboard("{End}")
  expect(document.activeElement).toBe(first.at(-1))
  await user.keyboard("{Control>}{End}{/Control}")
  expect(document.activeElement).toBe(cards.at(-1))
  expect(cards.filter((card) => card.tabIndex === 0)).toEqual([cards.at(-1)])
  await user.keyboard("{Enter}")
  expect(onSelect).toHaveBeenCalledWith(cards.at(-1)?.getAttribute("data-task-id"))
})

const owned = (card: Element | null | undefined) =>
  [...(card?.querySelectorAll<HTMLElement>("a[href], button") ?? [])].filter(
    (control) => !control.hasAttribute("data-task-select"),
  )

test("only the card holding the stop keeps its own controls in the tab order", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  renderBoard({ tasks: generateTasks(40, 7), onSelectTask: vi.fn() })
  const articles = [...document.querySelectorAll('[data-slot="task-card"]')]
  const withControls = articles.filter((article) => owned(article).length > 0)
  expect(withControls.length).toBeGreaterThan(1)
  for (const article of withControls) expect(owned(article).every((control) => control.tabIndex === -1)).toBe(true)

  const [target] = withControls
  target?.querySelector<HTMLElement>("[data-task-select]")?.focus()
  await user.keyboard("{Tab}")
  expect(owned(target).every((control) => control.tabIndex === 0)).toBe(true)
  expect(document.activeElement).toBe(owned(target)[0])
  await user.keyboard("{Shift>}{Tab}{/Shift}{ArrowDown}")
  expect(owned(target).every((control) => control.tabIndex === -1)).toBe(true)
})
