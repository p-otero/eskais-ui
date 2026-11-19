import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { CommitHistory } from "@/components/ui/commit-history"
import type { Commit } from "@/lib/commit-graph"

const NOW = Date.parse("2026-11-18T12:00:00Z")
const ago = (minutes: number) => NOW - minutes * 60_000

const commits: Commit[] = [
  { id: "c4", parents: ["c3"], message: "Cap retries", date: ago(5) },
  { id: "c3", parents: ["c2"], message: "Back off with jitter", date: ago(10) },
  { id: "c2", parents: ["c1"], message: "Bump version", date: ago(20) },
  { id: "c1", parents: [], message: "Initial commit", date: ago(30) },
]

test("upstreamHead marks the commits above it, in the name and with a mark, and the header counts them", () => {
  render(<CommitHistory aria-label="History" commits={commits} now={NOW} locale="en" upstreamHead="c2" />)
  const top = screen.getByRole("treeitem", { name: "Cap retries, 5 minutes ago, not pushed" })
  expect(top.querySelector("[data-slot=commit-unpushed]")).not.toBeNull()
  expect(screen.getByRole("treeitem", { name: "Back off with jitter, 10 minutes ago, not pushed" })).toBeTruthy()
  const pushed = screen.getByRole("treeitem", { name: "Bump version, 20 minutes ago" })
  expect(pushed.querySelector("[data-slot=commit-unpushed]")).toBeNull()
  expect(document.querySelector("[data-slot=commit-history-unpushed]")?.textContent).toBe("2 not pushed")
})

test("a commit's own unpushed marks it; labels change the words", () => {
  render(
    <CommitHistory
      aria-label="History"
      commits={commits.map((commit) => (commit.id === "c4" ? { ...commit, unpushed: true } : commit))}
      now={NOW}
      locale="en"
      labels={{ notPushed: "sin publicar", unpushed: (n) => `${String(n)} sin publicar` }}
    />,
  )
  expect(screen.getByRole("treeitem", { name: "Cap retries, 5 minutes ago, sin publicar" })).toBeTruthy()
  expect(screen.getByText("1 sin publicar")).toBeTruthy()
})

test("no upstream mark and no count when everything is pushed", () => {
  render(<CommitHistory aria-label="History" commits={commits} now={NOW} locale="en" upstreamHead="c4" />)
  expect(document.querySelector("[data-slot=commit-unpushed]")).toBeNull()
  expect(document.querySelector("[data-slot=commit-history-unpushed]")).toBeNull()
})

test("agents read the mark in each commit's name", async () => {
  const agent = createAgent()
  render(<CommitHistory aria-label="History" commits={commits} now={NOW} locale="en" upstreamHead="c3" />)
  const found = await agent.query({ within: "History", text: "Cap" })
  expect(Array.isArray(found) && found[0]?.items).toContainEqual({
    value: "c4",
    label: "Cap retries, 5 minutes ago, not pushed",
  })
})
