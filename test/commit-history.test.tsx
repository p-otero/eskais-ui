import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, describe, expect, test, vi } from "vitest"

import { CommitHistory } from "@/components/ui/commit-history"
import type { Commit } from "@/lib/commit-graph"

const NOW = Date.parse("2026-11-18T12:00:00Z")
const ago = (minutes: number) => NOW - minutes * 60_000

const done: Commit[] = [
  {
    id: "a1b2c3d4e5",
    parents: ["m38"],
    message: "Bump version in `package.json`",
    date: ago(26),
    tags: [{ label: "Release", tone: "violet" }],
  },
  {
    id: "m38",
    parents: ["e02c6d9aa", "f41"],
    message: "Merge invoice-pdf into main",
    date: ago(38),
    author: "Kai Brandt",
  },
  { id: "f41", parents: ["f43"], message: "Render line items as a PDF table", date: ago(41) },
  { id: "f43", parents: ["f46"], message: "Embed fonts in invoice exports", date: ago(43) },
  { id: "f46", parents: ["e02c6d9aa"], message: "Add the PDF route in `routes.ts`", date: ago(46) },
  {
    id: "e02c6d9aa",
    hash: "e02c6d9",
    parents: ["m48"],
    message: "Fix rounding in `proration.ts`",
    date: ago(44),
    author: "Kai Brandt",
    body: "Prorations now round half to even.",
    stats: { files: 2, additions: 18, deletions: 9 },
    tags: [{ label: "Fix", tone: "warning" }],
  },
  { id: "m48", parents: ["t1", "t2"], message: "Merge tax-rates into main", date: ago(48) },
  { id: "t2", parents: ["t1"], message: "Add EU tax rates", date: ago(50) },
  { id: "t1", parents: [], message: "Initial commit", date: ago(60) },
]

const pending: Commit = {
  id: "p1",
  parents: ["a1b2c3d4e5"],
  message: "Retry failed webhooks in `queue.ts`",
  date: ago(0),
  status: "pending",
}

afterEach(() => vi.restoreAllMocks())

const labelOf = (row: HTMLElement) => row.querySelector("[data-slot=tree-label]") as HTMLElement
const rowNamed = (name: RegExp | string) => screen.getByRole("treeitem", { name })

describe("CommitHistory", () => {
  test("one line per commit: merges collapsed, chips in messages, names with time and tags", () => {
    render(<CommitHistory aria-label="History" branch="main" commits={done} now={NOW} locale="en" />)
    const tree = screen.getByRole("tree", { name: "History" })
    expect(within(tree).getAllByRole("treeitem")).toHaveLength(5)
    expect(rowNamed("Merge invoice-pdf into main, 38 minutes ago")?.getAttribute("aria-expanded")).toBe("false")
    expect(rowNamed("Bump version in package.json, 26 minutes ago, Release")).toBeTruthy()
    expect(screen.getByText("package.json").closest("[data-slot=git-file-chip]")).not.toBeNull()
    expect(screen.getByText("invoice-pdf").closest("[data-slot=git-branch-chip]")).not.toBeNull()
    expect(screen.getByText("26m")).toBeTruthy()
    expect(screen.getByText("9 commits")).toBeTruthy()
  })

  test("pressing a merge opens its branch on a side lane; Left closes it", async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    render(<CommitHistory aria-label="History" commits={done} now={NOW} onExpandedChange={onExpandedChange} />)
    await user.click(labelOf(rowNamed(/^Merge invoice-pdf/)))
    expect(onExpandedChange).toHaveBeenLastCalledWith(["m38"], expect.anything())
    const merge = rowNamed(/^Merge invoice-pdf/)
    expect(merge?.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getAllByRole("treeitem")).toHaveLength(8)
    expect(rowNamed(/^Embed fonts/)?.getAttribute("aria-level")).toBe("2")
    const curves = [...merge.querySelectorAll("[data-slot=commit-graph] path")].filter((path) =>
      path.getAttribute("d")?.includes("C"),
    )
    expect(curves).toHaveLength(1)
    merge.focus()
    await user.keyboard("{ArrowLeft}")
    expect(merge?.getAttribute("aria-expanded")).toBe("false")
    await user.keyboard("{ArrowRight}")
    expect(merge?.getAttribute("aria-expanded")).toBe("true")
  })

  test("Enter on a commit shows its details inline; single-expand moves them", async () => {
    const user = userEvent.setup()
    render(<CommitHistory aria-label="History" commits={done} now={NOW} locale="en" timeZone="UTC" />)
    const fix = rowNamed(/^Fix rounding/)
    fix.focus()
    await user.keyboard("{Enter}")
    expect(fix.hasAttribute("data-details-open")).toBe(true)
    const panel = fix.querySelector<HTMLElement>("[data-slot=commit-details]")
    expect(panel).not.toBeNull()
    const details = within(panel as HTMLElement)
    expect(details.getByText("Kai Brandt")).toBeTruthy()
    expect(details.getByText("e02c6d9")).toBeTruthy()
    expect(details.getByText("2 files")).toBeTruthy()
    expect(details.getByText("+18").parentElement?.className).toEqual(expect.stringContaining("text-success"))
    expect(details.getByText("18 additions")?.className).toEqual(expect.stringContaining("sr-only"))
    expect(details.getByText("Prorations now round half to even.")).toBeTruthy()
    expect(document.getElementById(fix.getAttribute("aria-describedby") ?? "")?.textContent).toMatch(/Kai Brandt/)
    expect(screen.getByRole("region", { name: "History" })?.hasAttribute("data-focus-mode")).toBe(true)

    await user.click(labelOf(rowNamed(/^Bump version/)))
    expect(fix.hasAttribute("data-details-open")).toBe(false)
    expect(rowNamed(/^Bump version/)?.hasAttribute("data-details-open")).toBe(true)
  })

  test("pressing inside the details doesn't close them", async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    const onCopyHash = vi.fn()
    render(
      <CommitHistory
        aria-label="History"
        commits={done}
        now={NOW}
        defaultDetails={["e02c6d9aa"]}
        onCopyHash={onCopyHash}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Copy hash" }))
    expect(writeText).toHaveBeenCalledWith("e02c6d9")
    expect(onCopyHash).toHaveBeenCalledWith("e02c6d9", expect.objectContaining({ id: "e02c6d9aa" }))
    expect(rowNamed(/^Fix rounding/)?.hasAttribute("data-details-open")).toBe(true)
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy()
  })

  test("onOpenCommit takes the press instead of the details", async () => {
    const user = userEvent.setup()
    const onOpenCommit = vi.fn()
    render(<CommitHistory aria-label="History" commits={done} now={NOW} onOpenCommit={onOpenCommit} />)
    await user.click(labelOf(rowNamed(/^Bump version/)))
    expect(onOpenCommit).toHaveBeenCalledWith(expect.objectContaining({ id: "a1b2c3d4e5" }), expect.anything())
    expect(rowNamed(/^Bump version/)?.hasAttribute("data-details-open")).toBe(false)
  })

  test("a pending commit spins and shows its status; finishing turns it into a counted commit", () => {
    const labels = { pending: "Enviando" }
    const { rerender } = render(
      <CommitHistory aria-label="History" commits={[pending, ...done]} now={NOW} locale="en" labels={labels} />,
    )
    const row = rowNamed(/^Retry failed webhooks in queue\.ts, Enviando/)
    expect(row.querySelector("[data-node=pending]")?.classList.contains("animate-spin")).toBe(true)
    expect(within(row).getByText("Enviando")?.className).toEqual(expect.stringContaining("text-link"))
    expect(screen.getByText("9 commits")).toBeTruthy()

    const finished = { ...pending, status: "done" as const, tags: [{ label: "Fix", tone: "warning" as const }] }
    rerender(<CommitHistory aria-label="History" commits={[finished, ...done]} now={NOW} locale="en" />)
    const after = rowNamed(/^Retry failed webhooks in queue\.ts, now, Fix/)
    expect(after.querySelector("[data-node=commit]")?.className).toContain("starting:scale-50")
    expect(screen.getByText("10 commits")).toBeTruthy()
  })

  test("the branch switcher reports the chosen branch", async () => {
    const user = userEvent.setup()
    const onBranchChange = vi.fn()
    render(
      <CommitHistory
        aria-label="History"
        commits={done}
        now={NOW}
        branch="main"
        branches={["main", "invoice-pdf"]}
        onBranchChange={onBranchChange}
      />,
    )
    await user.click(screen.getByRole("combobox", { name: "Branch" }))
    await user.click(await screen.findByRole("option", { name: "invoice-pdf" }))
    expect(onBranchChange).toHaveBeenCalledWith("invoice-pdf", expect.anything())
  })
})

describe("agents", () => {
  test("read commits by name and act on them by id or subject", async () => {
    const agent = createAgent()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    const onBranchChange = vi.fn()
    render(
      <CommitHistory
        aria-label="History"
        commits={done}
        now={NOW}
        locale="en"
        branch="main"
        branches={["main", "invoice-pdf"]}
        onBranchChange={onBranchChange}
      />,
    )
    const history = agent.snapshot().find((entry) => entry.component === "commit-history")
    expect(history).toMatchObject({ label: "History", expanded: [], details: [], branch: "main" })
    expect(history?.actions).toEqual(
      expect.arrayContaining(["expandDetails", "collapseDetails", "expand", "collapse", "copyHash", "selectBranch"]),
    )
    expect(agent.snapshot().some((entry) => entry.component === "tree")).toBe(false)

    const found = await agent.query({ within: "History", text: "invoice" })
    expect(Array.isArray(found) && found[0]?.items).toContainEqual({
      value: "m38",
      label: "Merge invoice-pdf into main, 38 minutes ago",
    })

    let result = await agent.act({
      steps: [{ ref: "History", action: "expand", args: ["Merge invoice-pdf into main"] }],
    })
    expect(result.ok).toBe(true)
    expect(rowNamed(/^Merge invoice-pdf/)?.getAttribute("aria-expanded")).toBe("true")

    result = await agent.act({ steps: [{ ref: "History", action: "expandDetails", args: ["e02c6d9"] }] })
    expect(result.ok).toBe(true)
    expect(rowNamed(/^Fix rounding/)?.hasAttribute("data-details-open")).toBe(true)

    result = await agent.act({
      steps: [{ ref: "History", action: "copyHash", args: ["Fix rounding in proration.ts"] }],
    })
    expect(result.ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith("e02c6d9")

    result = await agent.act({ steps: [{ ref: "History", action: "collapseDetails", args: ["e02c6d9aa"] }] })
    expect(rowNamed(/^Fix rounding/)?.hasAttribute("data-details-open")).toBe(false)

    result = await agent.act({ steps: [{ ref: "History", action: "selectBranch", args: ["invoice-pdf"] }] })
    expect(result.ok).toBe(true)
    expect(onBranchChange).toHaveBeenCalledWith("invoice-pdf", expect.objectContaining({ source: "agent" }))

    result = await agent.act({ steps: [{ ref: "History", action: "expand", args: ["Bump version in package.json"] }] })
    expect(result.ok).toBe(false)
    expect(result.error?.message).toMatch(/no merged commits/)

    result = await agent.act({ steps: [{ ref: "History", action: "openCommit", args: ["m38"] }] })
    expect(result.ok).toBe(false)
    expect(result.error?.message).toMatch(/expandDetails/)
    await act(async () => {})
  })
})
