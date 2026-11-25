import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test } from "vitest"

import { createDataClient, DataProvider } from "@/components/ui/server-data"
import { ServerCommitHistory } from "@/components/ui/server-commit-history"
import { arraySource } from "@/lib/array-source"
import type { Commit } from "@/lib/commit-graph"

const NOW = Date.parse("2026-11-18T12:00:00Z")

const commits: Commit[] = []
for (let index = 0; index < 30; index += 1) {
  const next = `m${String(index + 1)}`
  if (index === 5) {
    commits.push({ id: "m5", parents: [next, "f3"], message: "Merge feature into main", date: NOW - index * 60_000 })
    for (const step of [3, 2, 1]) {
      const parent = step === 1 ? next : `f${String(step - 1)}`
      commits.push({ id: `f${String(step)}`, parents: [parent], message: `Feature step ${String(step)}`, date: NOW })
    }
  } else {
    commits.push({
      id: `m${String(index)}`,
      parents: index === 29 ? [] : [next],
      message: `Commit ${String(index)}`,
      date: NOW,
    })
  }
}

test("pages of commits continue one graph, count the source's total and load more", async () => {
  const user = userEvent.setup()
  const source = arraySource<Commit, { branch: string }>(commits, { key: ["test", "commits"] })
  render(
    <DataProvider client={createDataClient({ retryDelay: 0 })}>
      <ServerCommitHistory
        aria-label="History"
        source={source}
        filter={{ branch: "main" }}
        pageSize={8}
        now={NOW}
        defaultExpanded={["m5"]}
        labels={{ errorTitle: "Couldn't load commits", retry: "Retry", emptyTitle: "No commits" }}
      />
    </DataProvider>,
  )
  await screen.findByRole("treeitem", { name: /^Commit 0/ })
  expect(screen.getByText("33 commits")).toBeTruthy()
  expect(screen.getAllByRole("treeitem")).toHaveLength(8)
  const merge = screen.getByRole("treeitem", { name: /^Merge feature/ })
  expect(merge.getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByRole("treeitem", { name: /^Feature step 2/ }).getAttribute("aria-level")).toBe("2")

  await user.click(screen.getByRole("button", { name: "Load more" }))
  await waitFor(() => expect(screen.getAllByRole("treeitem")).toHaveLength(16))
  expect(screen.getByRole("treeitem", { name: /^Commit 6/ }).getAttribute("aria-level")).toBe("1")
  const lastNested = screen.getByRole("treeitem", { name: /^Feature step 1/ })
  expect(lastNested.getAttribute("aria-level")).toBe("2")
  expect(lastNested.querySelector("[data-slot=commit-graph] path")?.getAttribute("d")).toContain("C")
})
