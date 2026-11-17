import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { ListItem } from "@/components/ui/list-item"
import { createDataClient, DataProvider } from "@/components/ui/server-data"
import { ServerList } from "@/components/ui/server-list"

import { axeViolations } from "./axe"
import { serverTaskFilters, taskSource, type ServerTask } from "./fixtures/server-tasks"

const agent = createAgent()
const labels = { errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }

let observed: { callback: IntersectionObserverCallback; node: Element }[] = []

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(node: Element) {
    observed.push({ callback: this.callback, node })
  }
  disconnect() {
    observed = observed.filter((entry) => entry.callback !== this.callback)
  }
  unobserve() {}
  takeRecords() {
    return []
  }
}

afterEach(() => {
  observed = []
  vi.unstubAllGlobals()
})

function renderList(options: { infinite?: boolean; key: string; fail?: () => boolean }) {
  const client = createDataClient({ retryDelay: 0 })
  return render(
    <DataProvider client={client}>
      <ServerList<ServerTask, typeof serverTaskFilters>
        aria-label="Tasks"
        source={taskSource({ key: ["test", "server-list", options.key], fail: options.fail })}
        filters={serverTaskFilters}
        pageSize={20}
        infinite={options.infinite}
        itemText={(task) => `${task.id} ${task.title}`}
        renderItem={(task) => (
          <ListItem id={task.id} title={`${task.id} ${task.title}`} subtitle={task.assignee} onSelect={() => {}} />
        )}
        labels={labels}
      />
    </DataProvider>,
  )
}

function rowCount() {
  return within(screen.getByRole("group", { name: "Tasks" })).queryAllByRole("button").length
}

function status() {
  return document.querySelector("[data-slot=server-list-footer] output")?.textContent
}

test("shows the first page, loads more on the button and keeps focus there", async () => {
  const user = userEvent.setup()
  renderList({ key: "button", infinite: false })
  await waitFor(() => expect(rowCount()).toBe(20))
  expect(status()).toBe("Showing 1–20 of 312")
  const loadMore = screen.getByRole("button", { name: "Load more" })
  await user.click(loadMore)
  await waitFor(() => expect(rowCount()).toBe(40))
  expect(status()).toBe("Showing 1–40 of 312")
  expect(document.activeElement).toBe(loadMore)
})

test("loads the next page when the end scrolls into view", async () => {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
  renderList({ key: "scroll" })
  await waitFor(() => expect(rowCount()).toBe(20))
  await waitFor(() => expect(observed).toHaveLength(1))
  act(() => {
    for (const { callback, node } of observed)
      callback(
        [{ isIntersecting: true, target: node } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
  })
  await waitFor(() => expect(rowCount()).toBe(40))
})

test("rows are one tab stop with arrow keys; search filters on the server", async () => {
  const user = userEvent.setup()
  renderList({ key: "keys", infinite: false })
  await waitFor(() => expect(rowCount()).toBe(20))
  const rows = within(screen.getByRole("group", { name: "Tasks" })).getAllByRole("button")
  expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1)
  rows[0]?.focus()
  await user.keyboard("{ArrowDown}")
  expect(document.activeElement).toBe(rows[1])

  await user.type(screen.getByRole("searchbox", { name: "Search" }), "T-311")
  await waitFor(() => expect(rowCount()).toBe(1))
  expect(status()).toBe("Showing 1–1 of 1")
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull()
})

test("an error offers a retry", async () => {
  const user = userEvent.setup()
  let failing = true
  renderList({ key: "error", fail: () => failing })
  await waitFor(() => expect(screen.getByText("Couldn't load tasks")).toBeTruthy(), { timeout: 3000 })
  failing = false
  await user.click(screen.getByRole("button", { name: "Try again" }))
  await waitFor(() => expect(rowCount()).toBe(20))
})

test("agents select a row and load more by name; no axe violations", async () => {
  const { container } = renderList({ key: "agent", infinite: false })
  await waitFor(() => expect(rowCount()).toBe(20))
  const selected = await agent.act({ steps: [{ ref: "Tasks", action: "select", args: ["T-003"] }] })
  expect(selected.ok, selected.error?.message).toBe(true)
  const more = await agent.act({ steps: [{ ref: "Load more", action: "press", args: [] }] })
  expect(more.ok, more.error?.message).toBe(true)
  await waitFor(() => expect(rowCount()).toBe(40))
  expect(await axeViolations(container)).toEqual([])
})
