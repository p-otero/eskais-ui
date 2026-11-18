import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ChangeDetails } from "@ui-sdk/core"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Sortable, SortableHandle, SortableItem } from "@/components/ui/sortable"
import { sortable } from "@/components/ui/sortable-primitive"
import type { SortableReason } from "@/components/ui/sortable-primitive"
import { readAnnouncements } from "@/lib/test-utils"

const FRUITS = ["apple", "banana", "cherry"]
const agent = createAgent()
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const order = (name = "Fruits") =>
  [...screen.getByLabelText(name).querySelectorAll("[data-sortable-item]")].map((el) =>
    el.textContent?.replace(/Open \w+$/, ""),
  )

type FruitsProps = {
  onValueChange?: (value: string[], details: ChangeDetails<SortableReason>) => void
  /** Leaves the order alone, as a parent that refuses the change. */
  frozen?: boolean
  handle?: boolean
  disabledKeys?: string[]
  labels?: Parameters<typeof Sortable>[0]["labels"]
}

function Fruits({ onValueChange, frozen = false, handle = false, disabledKeys, labels }: FruitsProps) {
  const [value, setValue] = useState(FRUITS)
  return (
    <Sortable
      aria-label="Fruits"
      handle={handle}
      value={value}
      disabledKeys={disabledKeys}
      labels={labels}
      onValueChange={(next, details) => {
        onValueChange?.(next, details)
        if (!frozen) setValue(next)
      }}
    >
      {({ order: shown }) =>
        shown.map((key) => (
          <SortableItem key={key} value={key}>
            {handle && <SortableHandle label={key} />}
            <span>{key}</span>
            {handle && <button type="button">Open {key}</button>}
          </SortableItem>
        ))
      }
    </Sortable>
  )
}

test("primitive: Space lifts, arrows move, Space drops, Escape cancels", async () => {
  const view = mount(
    sortable,
    { defaultValue: FRUITS },
    `<root aria-label="Fruits"><entry value="apple">apple</entry><entry value="banana">banana</entry><entry value="cherry">cherry</entry></root>`,
  )
  try {
    await view.keys("Tab", "Space", "ArrowDown", "ArrowDown", "Space")
    expect(view.state.value).toEqual(["banana", "cherry", "apple"])
    expect(view.changes.at(-1)).toMatchObject({ key: "value", reason: "move-key", source: "keyboard" })
    await view.keys("Space", "ArrowUp", "Escape")
    expect(view.state.value).toEqual(["banana", "cherry", "apple"])
    expect(view.state.moving).toBeNull()
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(
    sortable,
    { defaultValue: FRUITS, handle: true },
    `<root aria-label="Fruits"><entry value="apple">apple<handle></handle></entry><instructions>Move</instructions></root>`,
  )
})

test("a listbox of options: Space lifts, the arrows move, Space drops and focus stays on the moved item", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Fruits onValueChange={onValueChange} />)
  const list = screen.getByRole("listbox", { name: "Fruits" })
  expect(list.getAttribute("aria-roledescription")).toBe("sortable list")
  const options = screen.getAllByRole("option")
  expect(options.map((option) => option.tabIndex)).toEqual([0, -1, -1])
  const description = document.getElementById(options[0]?.getAttribute("aria-describedby") ?? "")
  expect(description?.textContent).toMatch(/Space to pick up/)

  await user.tab()
  await user.keyboard(" ")
  expect(document.activeElement?.getAttribute("aria-selected")).toBe("true")
  expect(document.activeElement?.hasAttribute("data-moving")).toBe(true)
  expect(list.hasAttribute("data-moving")).toBe(true)
  await user.keyboard("{ArrowDown}")
  expect(order()).toEqual(["banana", "apple", "cherry"])
  expect(onValueChange).not.toHaveBeenCalled()
  await user.keyboard(" ")
  expect(onValueChange).toHaveBeenCalledTimes(1)
  expect(onValueChange.mock.calls[0]?.[0]).toEqual(["banana", "apple", "cherry"])
  expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: "move-key" })
  expect(document.activeElement?.textContent).toBe("apple")
  expect(list.hasAttribute("data-moving")).toBe(false)
})

test("Escape puts the item back without a change; arrows only move focus until something is lifted", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Fruits onValueChange={onValueChange} />)
  await user.tab()
  await user.keyboard("{ArrowDown}")
  expect(document.activeElement?.textContent).toBe("banana")
  expect(order()).toEqual(FRUITS)
  await user.keyboard(" {ArrowUp}")
  expect(order()).toEqual(["banana", "apple", "cherry"])
  await user.keyboard("{Escape}")
  expect(order()).toEqual(FRUITS)
  expect(onValueChange).not.toHaveBeenCalled()
})

test("a controlled order that the parent keeps stays as it was after the drop", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Fruits frozen onValueChange={onValueChange} />)
  await user.tab()
  await user.keyboard(" {ArrowDown} ")
  expect(onValueChange).toHaveBeenCalledTimes(1)
  await tick()
  expect(order()).toEqual(FRUITS)
})

test("moves are announced, in the words of overridable labels", async () => {
  const user = userEvent.setup()
  render(
    <Fruits
      labels={{
        message: ({ type, label, position, total }) => `${type} ${label} ${String(position)}/${String(total)}`,
      }}
    />,
  )
  await user.tab()
  await user.keyboard(" ")
  await waitFor(() => expect(readAnnouncements().assertive).toBe("grab apple 1/3"))
  await user.keyboard("{ArrowDown}")
  await waitFor(() => expect(readAnnouncements().assertive).toBe("move apple 2/3"))
  await user.keyboard(" ")
  await waitFor(() => expect(readAnnouncements().assertive).toBe("drop apple 2/3"))
})

test("with a handle, items are list items, the handle is one tab stop and the item's own button still works", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Fruits handle onValueChange={onValueChange} />)
  expect(screen.getByRole("list", { name: "Fruits" })).toBeTruthy()
  expect(screen.getAllByRole("listitem")).toHaveLength(3)
  const handles = screen.getAllByRole("button", { name: /^Reorder / })
  expect(handles.map((handle) => handle.getAttribute("aria-label"))).toEqual([
    "Reorder apple",
    "Reorder banana",
    "Reorder cherry",
  ])
  expect(handles.map((handle) => handle.tabIndex)).toEqual([0, -1, -1])
  expect(handles[0]?.getAttribute("aria-pressed")).toBe("false")

  await user.tab()
  expect(document.activeElement).toBe(handles[0])
  await user.keyboard(" ")
  expect(handles[0]?.getAttribute("aria-pressed")).toBe("true")
  await user.keyboard("{End} ")
  expect(onValueChange.mock.calls[0]?.[0]).toEqual(["banana", "cherry", "apple"])
  expect(order("Fruits")).toEqual(["banana", "cherry", "apple"])
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Reorder apple")

  await user.click(screen.getByRole("button", { name: "Open banana" }))
  expect(onValueChange).toHaveBeenCalledTimes(1)
})

test("a disabled item can't be picked up but makes room for others", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Fruits disabledKeys={["apple"]} onValueChange={onValueChange} />)
  await user.tab()
  expect(document.activeElement?.getAttribute("aria-disabled")).toBe("true")
  await user.keyboard(" {ArrowDown}")
  expect(order()).toEqual(FRUITS)
  expect(document.activeElement?.textContent).toBe("banana")
  await user.keyboard(" {ArrowUp} ")
  expect(onValueChange.mock.calls[0]?.[0]).toEqual(["banana", "apple", "cherry"])
})

test("Ctrl+Space checks items, and checked items move together", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(
    <Sortable aria-label="Steps" defaultValue={["a", "b", "c", "d"]} onValueChange={onValueChange}>
      {({ order: shown }) =>
        shown.map((key) => (
          <SortableItem key={key} value={key}>
            {key}
          </SortableItem>
        ))
      }
    </Sortable>,
  )
  await user.tab()
  await user.keyboard("{Control>} {/Control}{ArrowDown}{ArrowDown}{Control>} {/Control}")
  const checked = screen.getAllByRole("option").filter((option) => option.hasAttribute("data-checked"))
  expect(checked.map((option) => option.textContent)).toEqual(["a", "c"])
  await user.keyboard(" {End} ")
  expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["b", "d", "a", "c"])
})

test("an agent moves one item or sets the whole order, and wrong arguments say what's allowed", async () => {
  const onValueChange = vi.fn()
  render(<Fruits onValueChange={onValueChange} />)
  await tick()
  const entry = agent.snapshot().find((each) => each.component === "sortable")
  expect(entry?.label).toBe("Fruits")
  expect(entry?.actions).toEqual(expect.arrayContaining(["move", "reorder"]))

  const moved = await agent.act({ steps: [{ ref: "Fruits", action: "move", args: ["cherry", 0] }] })
  expect(moved.ok, moved.error?.message).toBe(true)
  expect(order()).toEqual(["cherry", "apple", "banana"])
  expect(onValueChange.mock.calls.at(-1)?.[1]).toMatchObject({ reason: "imperative", source: "agent" })

  const reordered = await agent.act({
    steps: [{ ref: "Fruits", action: "reorder", args: [["banana", "apple", "cherry"]] }],
  })
  expect(reordered.ok, reordered.error?.message).toBe(true)
  expect(order()).toEqual(["banana", "apple", "cherry"])

  const missing = await agent.act({ steps: [{ ref: "Fruits", action: "reorder", args: [["apple", "banana"]] }] })
  expect(missing.ok).toBe(false)
  expect(missing.error?.message).toMatch(/each of these ids once: banana, apple, cherry/)
  const unknown = await agent.act({ steps: [{ ref: "Fruits", action: "move", args: ["kiwi", 0] }] })
  expect(unknown.error?.message).toMatch(/No item "kiwi"/)
  const outOfRange = await agent.act({ steps: [{ ref: "Fruits", action: "move", args: ["apple", 9] }] })
  expect(outOfRange.error?.message).toMatch(/index from 0 to 2/)
})

test("agentMoves={false} keeps the moves from agents", async () => {
  render(
    <Sortable aria-label="Hidden moves" defaultValue={FRUITS} agentMoves={false}>
      {({ order: shown }) =>
        shown.map((key) => (
          <SortableItem key={key} value={key}>
            {key}
          </SortableItem>
        ))
      }
    </Sortable>,
  )
  await tick()
  expect(agent.snapshot().find((each) => each.label === "Hidden moves")).toBeUndefined()
})
