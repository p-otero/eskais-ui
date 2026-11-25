import { describe, expect, test } from "vitest"

import {
  createCommitGraph,
  mergeIds,
  updateCommitGraph,
  visibleRows,
  type Commit,
  type CommitGraph,
} from "@/lib/commit-graph"
import { createLaneLayout, type LaneRow } from "@/lib/commit-lanes"
import { commitSubject, parseCommitMessage } from "@/lib/commit-message"

function c(id: string, ...parents: string[]): Commit {
  return { id, parents, message: id, date: 0 }
}

function depths(graph: CommitGraph) {
  return graph.commits.map((commit) => `${commit.id}:${String(graph.depth[graph.rowOf.get(commit.id) ?? 0])}`)
}

function lanes(commits: Commit[], expanded: Iterable<string> | "all" = "all", maxLanes?: number) {
  const graph = createCommitGraph(commits)
  const open = new Set(expanded === "all" ? mergeIds(graph) : expanded)
  const visible = visibleRows(graph, open)
  const layout = createLaneLayout(graph, visible, { maxLanes })
  const rows: Record<string, LaneRow> = {}
  for (let position = 0; position < layout.count; position += 1) {
    const row = visible.rows[position] ?? 0
    rows[graph.commits[row]?.id ?? ""] = layout.at(position)
  }
  return { graph, visible, rows }
}

const merged = [c("M", "m1", "f3"), c("f3", "f2"), c("f2", "f1"), c("f1", "m1"), c("m1", "m0"), c("m0")]

describe("nesting", () => {
  test("a linear history is one top-level line", () => {
    const graph = createCommitGraph([c("c", "b"), c("b", "a"), c("a")])
    expect(depths(graph)).toEqual(["c:0", "b:0", "a:0"])
    expect([...graph.owner.subarray(0, 3)]).toEqual([-1, -1, -1])
    expect(mergeIds(graph)).toEqual([])
  })

  test("a merged branch nests under its merge, the fork point stays on the mainline", () => {
    const graph = createCommitGraph(merged)
    expect(depths(graph)).toEqual(["M:0", "f3:1", "f2:1", "f1:1", "m1:0", "m0:0"])
    expect(graph.children[0]).toBe(3)
    expect(graph.end[0]).toBe(4)
    expect(mergeIds(graph)).toEqual(["M"])
  })

  test("collapsed, a merge hides its whole block; expanded, it shows", () => {
    const graph = createCommitGraph(merged)
    expect([...visibleRows(graph, new Set()).rows]).toEqual([0, 4, 5])
    expect([...visibleRows(graph, new Set(["M"])).rows]).toEqual([0, 1, 2, 3, 4, 5])
  })

  test("nested merges nest twice and collapse with their parent", () => {
    const graph = createCommitGraph([
      c("M", "m1", "f3"),
      c("f3", "f2", "g2"),
      c("g2", "g1"),
      c("g1", "f2"),
      c("f2", "f1"),
      c("f1", "m1"),
      c("m1"),
    ])
    expect(depths(graph)).toEqual(["M:0", "f3:1", "g2:2", "g1:2", "f2:1", "f1:1", "m1:0"])
    expect(graph.end[0]).toBe(6)
    expect(graph.end[1]).toBe(4)
    expect([...visibleRows(graph, new Set(["M"])).rows]).toEqual([0, 1, 4, 5, 6])
    expect([...visibleRows(graph, new Set(["f3"])).rows]).toEqual([0, 6])
  })

  test("criss-cross merges keep every row once and blocks contiguous", () => {
    const graph = createCommitGraph([
      c("m3", "m2", "f2"),
      c("f2", "f1", "m1"),
      c("m2", "m1", "f1"),
      c("f1", "b"),
      c("m1", "b"),
      c("b"),
    ])
    expect(depths(graph)).toEqual(["m3:0", "f2:1", "m2:0", "f1:0", "m1:0", "b:0"])
    const outside = [...graph.owner.subarray(0, graph.size)].filter(
      (owner, row) => owner >= 0 && row >= (graph.end[owner] ?? 0),
    )
    expect(outside).toEqual([])
  })

  test("an octopus merge nests each branch under it", () => {
    const graph = createCommitGraph([c("O", "m", "a", "b"), c("a", "m"), c("b", "m"), c("m")])
    expect(depths(graph)).toEqual(["O:0", "a:1", "b:1", "m:0"])
    expect(graph.children[0]).toBe(2)
  })

  test("appending a page gives the same graph as building it at once, without rebuilding", () => {
    const all = [
      c("M", "m1", "f3"),
      c("f3", "f2"),
      c("f2", "f1"),
      c("f1", "m1"),
      c("m1", "N"),
      c("N", "n1", "g1"),
      c("g1", "n1"),
      c("n1"),
    ]
    const first = createCommitGraph(all.slice(0, 3))
    const paged = updateCommitGraph(first, all)
    const whole = createCommitGraph(all)
    expect(paged.rowOf).toBe(first.rowOf)
    expect(depths(paged)).toEqual(depths(whole))
    expect([...paged.end.subarray(0, all.length)]).toEqual([...whole.end.subarray(0, all.length)])
    expect([...paged.owner.subarray(0, all.length)]).toEqual([...whole.owner.subarray(0, all.length)])
  })

  test("a content-only change (a pending commit that finished) keeps the structure", () => {
    const pending = [{ ...c("p", "M"), status: "pending" as const }, ...merged]
    const before = createCommitGraph(pending)
    const after = updateCommitGraph(before, [{ ...c("p", "M"), status: "done" }, ...merged])
    expect(after.depth).toBe(before.depth)
    expect(after.commits[0]?.status).toBe("done")
  })

  test("a reordered history rebuilds", () => {
    const before = createCommitGraph(merged)
    const after = updateCommitGraph(before, merged.toReversed())
    expect(after.rowOf).not.toBe(before.rowOf)
  })
})

describe("lanes", () => {
  test("a linear history stays on lane 0", () => {
    const { rows } = lanes([c("c", "b"), c("b", "a"), c("a")])
    expect(rows.c).toMatchObject({ lane: 0, width: 1, into: [], out: [0], through: [], hidden: 0, nodeHidden: false })
    expect(rows.b).toMatchObject({ lane: 0, into: [0], out: [0] })
    expect(rows.a).toMatchObject({ lane: 0, into: [0], out: [] })
  })

  test("an expanded merge opens a second lane that comes back at the fork point", () => {
    const { rows } = lanes(merged)
    expect(rows.M).toMatchObject({ lane: 0, out: [0, 1], width: 2 })
    expect(rows.f3).toMatchObject({ lane: 1, into: [1], out: [1], through: [0] })
    expect(rows.f1).toMatchObject({ lane: 1, into: [1], out: [0], through: [0] })
    expect(rows.m1).toMatchObject({ lane: 0, into: [0], out: [0], through: [] })
  })

  test("a collapsed merge draws no lane for its hidden branch", () => {
    const { rows } = lanes(merged, [])
    expect(rows.M).toMatchObject({ lane: 0, out: [0], width: 1 })
    expect(rows.f3).toBeUndefined()
    expect(rows.m1).toMatchObject({ lane: 0, into: [0] })
  })

  test("nested merges open a third lane", () => {
    const { rows } = lanes([
      c("M", "m1", "f3"),
      c("f3", "f2", "g2"),
      c("g2", "g1"),
      c("g1", "f2"),
      c("f2", "f1"),
      c("f1", "m1"),
      c("m1"),
    ])
    expect(rows.f3).toMatchObject({ lane: 1, out: [1, 2], through: [0] })
    expect(rows.g1).toMatchObject({ lane: 2, out: [1], through: [0, 1] })
    expect(rows.f2).toMatchObject({ lane: 1, into: [1] })
    expect(rows.m1).toMatchObject({ lane: 0, into: [0] })
  })

  test("criss-cross: edges to a commit already expected join its lane", () => {
    const { rows } = lanes([
      c("m3", "m2", "f2"),
      c("f2", "f1", "m1"),
      c("m2", "m1", "f1"),
      c("f1", "b"),
      c("m1", "b"),
      c("b"),
    ])
    expect(rows.m2?.out).toEqual([2, 1])
    expect(rows.b).toMatchObject({ lane: 1, into: [1], out: [] })
  })

  test("octopus: a lane per parent; past maxLanes they are counted, not drawn", () => {
    const octopus = [c("O", "m", "a", "b", "d"), c("a", "m"), c("b", "m"), c("d", "m"), c("m")]
    expect(lanes(octopus).rows.O).toMatchObject({ out: [0, 1, 2, 3], hidden: 0, width: 4 })
    expect(lanes(octopus, "all", 2).rows.O).toMatchObject({ out: [0, 1], hidden: 2, width: 2 })
  })

  test("a parent not loaded yet keeps its lane open to the last row", () => {
    const { rows } = lanes([c("M", "m1", "f1"), c("f1", "x"), c("m1", "y")])
    expect(rows.m1).toMatchObject({ lane: 0, out: [0], through: [1] })
  })

  test("rows are computed on demand and kept", () => {
    const graph = createCommitGraph(merged)
    const layout = createLaneLayout(graph, visibleRows(graph, new Set(["M"])))
    expect(layout.at(5)).toBe(layout.at(5))
    expect(() => layout.at(6)).toThrow(RangeError)
  })

  test("50,000 commits with a merge every ten lay out in well under a frame per row", () => {
    const commits: Commit[] = []
    for (let block = 0; block < 5000; block += 1) {
      const main = `m${String(block)}`
      const next = `m${String(block + 1)}`
      commits.push(c(main, next, `${main}-f8`))
      for (let step = 8; step >= 1; step -= 1) {
        commits.push(c(`${main}-f${String(step)}`, step === 1 ? next : `${main}-f${String(step - 1)}`))
      }
    }
    const start = performance.now()
    const graph = createCommitGraph(commits)
    const visible = visibleRows(graph, new Set(mergeIds(graph)))
    const layout = createLaneLayout(graph, visible)
    layout.at(visible.count - 1)
    expect(visible.count).toBe(45_000)
    expect(performance.now() - start).toBeLessThan(1000)
  })
})

describe("messages", () => {
  test("backticked paths become file chips, branch: names branch chips, the rest code", () => {
    expect(parseCommitMessage("Add the PDF route in `routes.ts` and `npm run x`")).toEqual([
      { type: "text", text: "Add the PDF route in " },
      { type: "file", path: "routes.ts" },
      { type: "text", text: " and " },
      { type: "code", text: "npm run x" },
    ])
    expect(parseCommitMessage("Rebase `branch:main`")).toEqual([
      { type: "text", text: "Rebase " },
      { type: "branch", name: "main" },
    ])
  })

  test("git's merge subjects become branch chips", () => {
    expect(parseCommitMessage("Merge invoice-pdf into main")).toEqual([
      { type: "text", text: "Merge " },
      { type: "branch", name: "invoice-pdf" },
      { type: "text", text: " into " },
      { type: "branch", name: "main" },
    ])
    expect(parseCommitMessage("Merge branch 'feat/x' into main").map((s) => s.type)).toEqual([
      "text",
      "branch",
      "text",
      "branch",
    ])
  })

  test("the subject reads chips as their names", () => {
    expect(commitSubject({ message: "Fix rounding in `proration.ts`" })).toBe("Fix rounding in proration.ts")
    expect(
      commitSubject({
        message: [
          { type: "text", text: "Bump " },
          { type: "file", path: "a.json" },
        ],
      }),
    ).toBe("Bump a.json")
  })
})
