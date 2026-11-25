import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { describe, expect, test, vi } from "vitest"

import { CommitHistory } from "@/components/ui/commit-history"
import type { CommitBranch } from "@/lib/commit-branches"
import type { Commit } from "@/lib/commit-graph"

const NOW = Date.parse("2026-11-18T12:00:00Z")
const ago = (minutes: number) => NOW - minutes * 60_000
const c = (id: string, parents: string[], message: string, minutes: number): Commit => ({
  id,
  parents,
  message,
  date: ago(minutes),
})

const commits: Commit[] = [
  c("w2", ["w1"], "Back off with jitter", 4),
  c("w1", ["m0"], "Retry failed webhooks", 9),
  c("x1", ["m1"], "Keep proration in cents", 20),
  c("m0", ["m1", "f1"], "Merge invoice-pdf into main", 26),
  c("f1", ["m1"], "Render line items", 30),
  c("u2", ["u1"], "Stream usage rows", 31),
  c("u1", ["m1"], "Add the usage route", 35),
  c("m1", ["m2"], "Fix rounding", 44),
  c("s1", ["m2"], "Spike edge cache", 60 * 24 * 45),
  c("m2", [], "Create the billing service", 90),
]

const branches: CommitBranch[] = [
  { name: "main", head: "m0" },
  { name: "webhooks", head: "w2" },
  { name: "cents", head: "x1", tone: "warning" },
  { name: "usage", head: "u2" },
  { name: "edge-cache", head: "s1" },
  { name: "release", head: "m0" },
  { name: "invoice-pdf", head: "f1" },
]

function History(props: Partial<Parameters<typeof CommitHistory>[0]>) {
  return (
    <CommitHistory
      aria-label="Branches"
      view="branches"
      commits={commits}
      branch="main"
      branches={branches}
      now={NOW}
      locale="en"
      {...props}
    />
  )
}

const row = (name: RegExp) => screen.getByRole("treeitem", { name })

describe("branches view", () => {
  test("the select lists every active branch with its lane dot, arrows that read in words, and last update", async () => {
    const user = userEvent.setup()
    render(<History />)
    await user.click(screen.getByRole("combobox", { name: "Branches shown" }))
    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.getAttribute("aria-selected"))).toContain("true")
    expect(
      screen.getByRole("option", { name: "All branches" }).querySelector("[data-slot=select-item-icon]"),
    ).toBeNull()
    const webhooks = screen.getByRole("option", { name: /^webhooks/ })
    expect(webhooks.querySelector(".sr-only")?.textContent).toBe("2 ahead, 0 behind")
    expect(webhooks.querySelector("[data-slot=commit-branch-counts] [aria-hidden]")?.textContent).toBe("2")
    expect(webhooks.querySelectorAll("[data-slot=commit-branch-counts] svg")).toHaveLength(1)
    expect(webhooks.textContent).toContain("4m")
    const edge = screen.getByRole("option", { name: /^edge-cache/ })
    expect(edge.querySelector("[data-slot=commit-branch-counts] [aria-hidden]")?.textContent).toBe("12")
    expect(
      options.map((option) => option.getAttribute("data-value") ?? option.textContent?.split(/\d/)[0]),
    ).toHaveLength(6)
  })

  test("typing in the select filters branches by name, with an empty state", async () => {
    const user = userEvent.setup()
    render(<History />)
    await user.click(screen.getByRole("combobox", { name: "Branches shown" }))
    const search = screen.getByRole("combobox", { name: "Search branches" })
    await user.type(search, "us")
    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent?.slice(0, 5))).toEqual(["usage"]),
    )
    await user.type(search, "zz")
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0))
    expect(screen.getByText("No branches match")).toBeTruthy()
  })

  test("heads carry a pill read in the row's name, and each branch runs in its own colour beside main", () => {
    render(<History />)
    const head = row(/^Back off with jitter, 4 minutes ago, branch webhooks, 2 ahead, 0 behind/)
    const pill = head.querySelector("[data-slot=commit-branch-pill]")
    expect(pill?.textContent).toBe("webhooks2")
    expect(pill?.querySelectorAll("svg")).toHaveLength(1)
    expect(row(/^Merge invoice-pdf into main, 26 minutes ago, branch main, branch release, 0 ahead/)).toBeTruthy()
    const lane = (name: RegExp) => row(name).querySelector("[data-slot=commit-graph]")
    const webhookTags = new Set(
      [...(lane(/^Retry failed/)?.querySelectorAll("[data-tag]") ?? [])].map((el) => el.getAttribute("data-tag")),
    )
    const mainTag = lane(/^Fix rounding/)?.querySelector('[data-tag="0"]')
    expect(mainTag).not.toBeNull()
    expect(webhookTags.size).toBeGreaterThan(1)
    expect(lane(/^Keep proration in cents/)?.querySelector('[data-tag="13"]')).not.toBeNull()
  })

  test("choosing a branch focuses its head and, with filterBranch, shows only main and that branch", async () => {
    const user = userEvent.setup()
    render(<History filterBranch />)
    expect(screen.getAllByRole("treeitem")).toHaveLength(9)
    await user.click(screen.getByRole("combobox", { name: "Branches shown" }))
    await user.click(await screen.findByRole("option", { name: /^usage/ }))
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(document.activeElement).toBe(row(/^Stream usage rows/))
    expect(screen.queryByRole("treeitem", { name: /^Back off with jitter/ })).toBeNull()
    expect(screen.getAllByRole("treeitem")).toHaveLength(5)
    await user.click(screen.getByRole("combobox", { name: "Branches shown" }))
    await user.click(await screen.findByRole("option", { name: "All branches" }))
    expect(screen.getAllByRole("treeitem")).toHaveLength(9)
  })

  test("pressing a branch's pill in the trail shows only it; pressing it again shows every branch", async () => {
    const user = userEvent.setup()
    const onFocusedBranchChange = vi.fn()
    render(<History filterBranch onFocusedBranchChange={onFocusedBranchChange} />)
    const pill = () => row(/^Back off with jitter/).querySelector<HTMLElement>("[data-branch=webhooks]") as HTMLElement
    await user.click(pill())
    expect(onFocusedBranchChange).toHaveBeenLastCalledWith(
      "webhooks",
      expect.objectContaining({ reason: "item-press" }),
    )
    expect(screen.getAllByRole("treeitem")).toHaveLength(5)
    expect(row(/^Back off with jitter/).hasAttribute("data-details-open")).toBe(false)
    expect(pill().hasAttribute("data-focused")).toBe(true)
    await user.click(pill())
    expect(onFocusedBranchChange).toHaveBeenLastCalledWith(null, expect.anything())
    expect(screen.getAllByRole("treeitem")).toHaveLength(9)
  })

  test("past maxLanes, a +N shows the lanes not drawn", () => {
    render(<History maxLanes={2} />)
    const more = [...document.querySelectorAll("[data-slot=commit-graph-more]")].map((el) => el.textContent)
    expect(more.length).toBeGreaterThan(0)
    expect(more.some((text) => /^\+[1-9]/.test(text ?? ""))).toBe(true)
  })

  test("the trail view ignores branch objects except for the switcher's names", () => {
    render(<History view="trail" onBranchChange={() => {}} />)
    expect(screen.queryByRole("combobox", { name: "Branches shown" })).toBeNull()
    expect(document.querySelector("[data-slot=commit-branch-pill]")).toBeNull()
    expect(screen.getByRole("combobox", { name: "Branch" })).toBeTruthy()
  })
})

describe("agents", () => {
  test("listBranches reads heads and ahead/behind; focusBranch focuses a head; unknown names are refused", async () => {
    const agent = createAgent()
    render(<History />)
    let result = await agent.act({ steps: [{ ref: "Branches", action: "listBranches" }] })
    expect(result.ok).toBe(true)
    const list = result.steps[0]?.result as {
      name: string
      head: string
      ahead: number
      behind: number
      state: string
    }[]
    expect(list.find((branch) => branch.name === "usage")).toMatchObject({
      head: "u2",
      ahead: 2,
      behind: 1,
      state: "active",
    })
    expect(list.find((branch) => branch.name === "invoice-pdf")?.state).toBe("merged")
    expect(list.find((branch) => branch.name === "edge-cache")?.state).toBe("stale")

    result = await agent.act({ steps: [{ ref: "Branches", action: "focusBranch", args: ["webhooks"] }] })
    expect(result.ok).toBe(true)
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(document.activeElement).toBe(row(/^Back off with jitter/))
    expect(agent.snapshot().find((entry) => entry.component === "commit-history")).toMatchObject({
      focusedBranch: "webhooks",
    })

    result = await agent.act({ steps: [{ ref: "Branches", action: "focusBranch", args: ["nope"] }] })
    expect(result.error?.message).toMatch(/No branch "nope".*webhooks/)
  })
})
