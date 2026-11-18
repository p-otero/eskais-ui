import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { List, ListItem } from "@/components/ui/list-item"

type Task = { id: string; title: string }

const TASKS: Task[] = [
  { id: "a", title: "Write the brief" },
  { id: "b", title: "Review the draft" },
  { id: "c", title: "Ship it" },
]
const agent = createAgent()
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const titles = () => [...document.querySelectorAll('[data-slot="list-item-title"]')].map((title) => title.textContent)

function Tasks({ onReorder, onSelect }: { onReorder?: (ids: string[]) => void; onSelect?: (id: string) => void }) {
  const [tasks, setTasks] = useState(TASKS)
  const [checked, setChecked] = useState<string[]>([])
  return (
    <List
      aria-label="Tasks"
      items={tasks}
      sortable
      checkedIds={checked}
      onCheckedIdsChange={setChecked}
      onReorder={(ids) => {
        onReorder?.(ids)
        setTasks(ids.flatMap((id) => tasks.filter((task) => task.id === id)))
      }}
      renderItem={(task) => <ListItem id={task.id} title={task.title} onSelect={() => onSelect?.(task.id)} />}
    />
  )
}

test("each row gets a handle named after it; Space and the arrows on it reorder the rows", async () => {
  const user = userEvent.setup()
  const onReorder = vi.fn()
  render(<Tasks onReorder={onReorder} />)
  expect(screen.getByRole("list", { name: "Tasks" }).getAttribute("aria-roledescription")).toBe("sortable list")
  const handles = screen.getAllByRole("button", { name: /^Reorder / })
  expect(handles.map((handle) => handle.getAttribute("aria-label"))).toEqual([
    "Reorder Write the brief",
    "Reorder Review the draft",
    "Reorder Ship it",
  ])

  await user.tab()
  expect(document.activeElement).toBe(handles[0])
  await user.keyboard(" {ArrowDown}{ArrowDown} ")
  expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"])
  expect(titles()).toEqual(["Review the draft", "Ship it", "Write the brief"])
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Reorder Write the brief")
})

test("the row's own button still selects it, and rows keep their single tab stop", async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(<Tasks onSelect={onSelect} />)
  await user.click(screen.getByRole("button", { name: "Review the draft" }))
  expect(onSelect).toHaveBeenCalledWith("b")
  const rows = screen.getAllByRole("listitem")
  expect(rows).toHaveLength(3)
  expect(rows.every((row) => row.getAttribute("data-slot") === "sortable-entry")).toBe(true)
  expect(rows.map((row) => row.getAttribute("data-item-id"))).toEqual(["a", "b", "c"])
})

test("checked rows move together", async () => {
  const user = userEvent.setup()
  const onReorder = vi.fn()
  render(<Tasks onReorder={onReorder} />)
  await user.click(screen.getByRole("checkbox", { name: "Select Write the brief" }))
  await user.click(screen.getByRole("checkbox", { name: "Select Review the draft" }))
  screen.getAllByRole("button", { name: /^Reorder / })[0]?.focus()
  await user.keyboard(" {End} ")
  expect(onReorder).toHaveBeenCalledWith(["c", "a", "b"])
})

test("an agent reorders the rows through the list's sortable", async () => {
  const onReorder = vi.fn()
  render(<Tasks onReorder={onReorder} />)
  await tick()
  const sortable = agent.snapshot().find((entry) => entry.component === "sortable")
  expect(sortable?.label).toBe("Tasks")
  expect(sortable?.items?.map((item) => item.label)).toEqual(["Write the brief", "Review the draft", "Ship it"])
  const result = await agent.act({ steps: [{ ref: sortable?.ref ?? "", action: "move", args: ["c", 0] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onReorder).toHaveBeenCalledWith(["c", "a", "b"])
  expect(titles()).toEqual(["Ship it", "Write the brief", "Review the draft"])
})

test("a sortable list renders every row, past the virtualization threshold too", () => {
  const many = Array.from({ length: 250 }, (_, index) => ({ id: String(index), title: `Task ${String(index)}` }))
  render(
    <List
      aria-label="Many"
      items={many}
      sortable
      onReorder={() => {}}
      renderItem={(task) => <ListItem id={task.id} title={task.title} />}
    />,
  )
  expect(screen.getAllByRole("listitem")).toHaveLength(250)
})
