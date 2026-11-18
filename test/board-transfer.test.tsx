import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { TransferLists } from "@ui-sdk/core"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Board, BoardItem, BoardItemHandle, BoardColumn } from "@/components/ui/board"
import { boardTransfer } from "@/components/ui/board-transfer-primitive"
import type { BoardTransferChangeDetails } from "@/components/ui/board-transfer-primitive"
import { readAnnouncements } from "@/lib/test-utils"

const agent = createAgent()
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const TITLES: Record<string, string> = { todo: "To do", doing: "Doing", done: "Done" }
const START: TransferLists = { todo: ["a", "b"], doing: ["c"], done: [] }

const cardsIn = (title: string) =>
  within(screen.getByRole("list", { name: title }))
    .queryAllByRole("listitem")
    .map((card) => card.textContent?.replace(/^Move \w+/, ""))

type SprintProps = {
  onValueChange?: (lists: TransferLists, details: BoardTransferChangeDetails) => void
  accepts?: (key: string, list: string) => boolean
  handle?: boolean
  handleFocus?: "roving" | "card"
}

function Sprint({ onValueChange, accepts, handle = false, handleFocus }: SprintProps) {
  const [lists, setLists] = useState(START)
  return (
    <Board
      aria-label="Sprint"
      value={lists}
      accepts={accepts}
      handle={handle}
      handleFocus={handleFocus}
      listLabel={(list) => TITLES[list]}
      onValueChange={(next, details) => {
        onValueChange?.(next, details)
        setLists(next)
      }}
    >
      {Object.keys(TITLES).map((list) => (
        <BoardColumn key={list} value={list} title={TITLES[list] ?? list} empty="Nothing here">
          {(ids) =>
            ids.map((id) => (
              <BoardItem key={id} value={id}>
                {handle && <BoardItemHandle label={`Card ${id}`} />}
                Card {id}
              </BoardItem>
            ))
          }
        </BoardColumn>
      ))}
    </Board>
  )
}

test("primitive: Space lifts a card, Right changes lists, Space drops it", async () => {
  const view = mount(
    boardTransfer,
    { defaultValue: { todo: ["a"], done: [] } },
    `<root aria-label="Board"><list value="todo"><card value="a">a</card></list><list value="done"></list></root>`,
  )
  try {
    await view.keys("Tab", "Space", "ArrowRight", "Space")
    expect(view.state.value).toEqual({ todo: [], done: ["a"] })
    expect(view.changes.at(-1)).toMatchObject({ key: "value", reason: "move-key" })
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(
    boardTransfer,
    { defaultValue: { todo: ["a"] }, handle: true },
    `<root aria-label="Board"><list value="todo"><card value="a">a<handle></handle></card></list><instructions>Move</instructions></root>`,
  )
})

test("a card moves to the next column with the keyboard, and the change says from where to where", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Sprint onValueChange={onValueChange} />)
  expect(cardsIn("To do")).toEqual(["Card a", "Card b"])
  expect(screen.getByText("Nothing here")).toBeTruthy()

  await user.tab()
  expect(document.activeElement?.textContent).toBe("Card a")
  expect(document.activeElement?.getAttribute("aria-roledescription")).toBe("draggable card")
  await user.keyboard(" ")
  await waitFor(() => expect(readAnnouncements().assertive).toMatch(/Card a/))
  await user.keyboard("{ArrowRight}")
  expect(cardsIn("Doing")).toEqual(["Card a", "Card c"])
  await user.keyboard("{ArrowDown} ")
  expect(onValueChange).toHaveBeenCalledTimes(1)
  expect(onValueChange.mock.calls[0]?.[0]).toEqual({ todo: ["b"], doing: ["c", "a"], done: [] })
  expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({
    key: "a",
    from: "todo",
    to: "doing",
    index: 1,
    reason: "move-key",
  })
  expect(cardsIn("Doing")).toEqual(["Card c", "Card a"])
  expect(document.activeElement?.textContent).toBe("Card a")
})

test("Escape puts a card back in its column", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Sprint onValueChange={onValueChange} />)
  await user.tab()
  await user.keyboard(" {ArrowRight}{ArrowRight}")
  expect(cardsIn("Done")).toEqual(["Card a"])
  await user.keyboard("{Escape}")
  expect(cardsIn("To do")).toEqual(["Card a", "Card b"])
  expect(onValueChange).not.toHaveBeenCalled()
})

test("a column that doesn't accept the card is skipped", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Sprint onValueChange={onValueChange} accepts={(_key, list) => list !== "doing"} />)
  await user.tab()
  await user.keyboard(" {ArrowRight} ")
  expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ to: "done" })
  expect(cardsIn("Done")).toEqual(["Card a"])
})

test("with handles, the handle moves the card and is the only tab stop among cards", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Sprint handle onValueChange={onValueChange} />)
  const handles = screen.getAllByRole("button", { name: /^Move Card / })
  expect(handles.map((handle) => handle.tabIndex)).toEqual([0, -1, -1])
  expect(screen.getAllByRole("listitem").every((card) => !card.hasAttribute("tabindex"))).toBe(true)
  await user.tab()
  expect(document.activeElement).toBe(handles[0])
  await user.keyboard(" {ArrowRight}{ArrowRight} ")
  expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ key: "a", from: "todo", to: "done", index: 0 })
})

test('with handleFocus="card", each handle is a plain control of its card and still lifts it', async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Sprint handle handleFocus="card" onValueChange={onValueChange} />)
  const handles = screen.getAllByRole("button", { name: /^Move Card / })
  expect(handles.every((handle) => !handle.hasAttribute("tabindex"))).toBe(true)
  await user.tab()
  await user.tab()
  expect(document.activeElement).toBe(handles[1])
  await user.keyboard(" {ArrowRight} ")
  expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ key: "b", from: "todo", to: "doing" })
})

test("an agent moves a card to a column at an index, and is told the lists and the range", async () => {
  const onValueChange = vi.fn()
  render(<Sprint onValueChange={onValueChange} />)
  await tick()
  const entry = agent.snapshot().find((each) => each.component === "board-transfer")
  expect(entry?.label).toBe("Sprint")
  expect(entry?.actions).toContain("move")

  const result = await agent.act({ steps: [{ ref: "Sprint", action: "move", args: ["b", "done", 0] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(cardsIn("Done")).toEqual(["Card b"])
  expect(onValueChange.mock.calls.at(-1)?.[1]).toMatchObject({ key: "b", from: "todo", to: "done", source: "agent" })

  const atEnd = await agent.act({ steps: [{ ref: "Sprint", action: "move", args: ["a", "done"] }] })
  expect(atEnd.ok, atEnd.error?.message).toBe(true)
  expect(cardsIn("Done")).toEqual(["Card b", "Card a"])

  const wrongList = await agent.act({ steps: [{ ref: "Sprint", action: "move", args: ["a", "archive", 0] }] })
  expect(wrongList.error?.message).toMatch(/No list "archive". Lists: todo, doing, done/)
  const wrongIndex = await agent.act({ steps: [{ ref: "Sprint", action: "move", args: ["c", "done", 7] }] })
  expect(wrongIndex.error?.message).toMatch(/index from 0 to 2/)
})
