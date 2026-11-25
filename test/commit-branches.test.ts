import { describe, expect, test } from "vitest"

import { createBranchModel, headTagOf, type CommitBranch } from "@/lib/commit-branches"
import { createCommitGraph, visibleRows, type Commit } from "@/lib/commit-graph"
import { createLaneLayout, type LaneRow } from "@/lib/commit-lanes"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-11-18T12:00:00Z")

function c(id: string, parents: string[], date = NOW): Commit {
  return { id, parents, message: id, date }
}

function history(length: number, branches: { name: string; fork: number; ahead: number; at?: number }[]) {
  const before = new Map<number, Commit[]>()
  for (const branch of branches) {
    const own = Array.from({ length: branch.ahead }, (_, step) =>
      c(`${branch.name}-${String(branch.ahead - step)}`, [
        step === branch.ahead - 1 ? `m${String(branch.fork)}` : `${branch.name}-${String(branch.ahead - step - 1)}`,
      ]),
    )
    const at = Math.min(branch.at ?? 0, branch.fork)
    before.set(at, [...(before.get(at) ?? []), ...own])
  }
  const commits: Commit[] = []
  for (let index = 0; index < length; index += 1) {
    commits.push(...(before.get(index) ?? []))
    commits.push(c(`m${String(index)}`, index === length - 1 ? [] : [`m${String(index + 1)}`]))
  }
  const heads: CommitBranch[] = [
    { name: "main", head: "m0" },
    ...branches.map((branch) => ({
      name: branch.name,
      head: branch.ahead > 0 ? `${branch.name}-${String(branch.ahead)}` : `m${String(branch.fork)}`,
    })),
  ]
  return { commits, heads }
}

function layout(commits: Commit[], heads: CommitBranch[], maxLanes?: number) {
  const graph = createCommitGraph(commits)
  const model = createBranchModel(graph, heads, { base: "main", now: NOW })
  const visible = visibleRows(graph, new Set())
  const lanes = createLaneLayout(graph, visible, {
    maxLanes,
    reserve: model.base ? [{ id: model.base.head, tag: 0 }] : [],
    headTag: headTagOf(model),
    keepLanes: true,
  })
  const rows: Record<string, LaneRow> = {}
  for (let position = 0; position < lanes.count; position += 1) {
    rows[graph.commits[visible.rows[position] ?? 0]?.id ?? ""] = lanes.at(position)
  }
  return { graph, model, rows }
}

describe("branch model", () => {
  test("ahead and behind against the base, worked out along first parents", () => {
    const { commits, heads } = history(20, [
      { name: "feature/webhooks", fork: 3, ahead: 2 },
      { name: "fix/rounding", fork: 12, ahead: 4 },
    ])
    const { model } = layout(commits, heads)
    const byName = Object.fromEntries(model.all.map((info) => [info.name, info]))
    expect(byName.main).toMatchObject({ state: "base", ahead: 0, behind: 0, tag: 0 })
    expect(byName["feature/webhooks"]).toMatchObject({ ahead: 2, behind: 3, mergeBase: "m3", state: "active" })
    expect(byName["fix/rounding"]).toMatchObject({ ahead: 4, behind: 12, mergeBase: "m12" })
    expect(model.active.map((info) => info.name).toSorted()).toEqual(["feature/webhooks", "fix/rounding"])
  })

  test("a branch with no commits ahead sits on the base's line", () => {
    const { commits, heads } = history(10, [{ name: "release", fork: 4, ahead: 0 }])
    const { model, rows } = layout(commits, heads)
    expect(model.active[0]).toMatchObject({ name: "release", ahead: 0, behind: 4, head: "m4", mergeBase: "m4" })
    expect(rows.m4).toMatchObject({ lane: 0, width: 1 })
  })

  test("stale and merged branches", () => {
    const commits: Commit[] = [
      c("m0", ["m1", "old-1"]),
      c("old-1", ["m1"], NOW - 90 * DAY),
      c("idle-1", ["m1"], NOW - 60 * DAY),
      c("m1", []),
    ]
    const heads: CommitBranch[] = [
      { name: "main", head: "m0" },
      { name: "old", head: "old-1" },
      { name: "idle", head: "idle-1" },
      { name: "data", head: "m1", ahead: 7, behind: 2, updatedAt: NOW },
    ]
    const { model } = layout(commits, heads)
    const byName = Object.fromEntries(model.all.map((info) => [info.name, info]))
    expect(byName.old?.state).toBe("merged")
    expect(byName.idle?.state).toBe("stale")
    expect(byName.data).toMatchObject({ ahead: 7, behind: 2, state: "active" })
    expect(model.active.map((info) => info.name)).toEqual(["data", "idle"])
  })

  test("up to five active branches never share a colour", () => {
    const { commits, heads } = history(
      12,
      ["a", "b", "c", "d", "e"].map((name, index) => ({ name, fork: index + 2, ahead: 1 })),
    )
    const { model } = layout(commits, heads)
    expect(new Set(model.active.map((info) => info.tag)).size).toBe(5)
  })

  test("names pick a stable colour; a tone takes over", () => {
    const graph = createCommitGraph([c("m0", [])])
    const first = createBranchModel(graph, [{ name: "x", head: "m0" }], { base: undefined })
    const again = createBranchModel(graph, [{ name: "x", head: "m0" }], { base: undefined })
    expect(first.all[0]?.tag).toBe(again.all[0]?.tag)
    expect(first.all[0]?.tag).toBeGreaterThanOrEqual(1)
    expect(first.all[0]?.tag).toBeLessThanOrEqual(5)
    const toned = createBranchModel(graph, [{ name: "x", head: "m0", tone: "warning" }], { base: undefined })
    expect(toned.all[0]?.tag).toBe(13)
  })
})

describe("branch lanes", () => {
  test("the base keeps lane 0 and concurrent branches run beside it, each in its own colour", () => {
    const { commits, heads } = history(12, [
      { name: "a", fork: 2, ahead: 2 },
      { name: "b", fork: 5, ahead: 3 },
      { name: "c", fork: 8, ahead: 1 },
      { name: "d", fork: 6, ahead: 2, at: 4 },
    ])
    const { model, rows } = layout(commits, heads)
    for (let index = 0; index < 12; index += 1) expect(rows[`m${String(index)}`]?.lane).toBe(0)
    const lanesOf = (name: string, ahead: number) =>
      new Set(Array.from({ length: ahead }, (_, step) => rows[`${name}-${String(step + 1)}`]?.lane))
    const a = lanesOf("a", 2)
    const b = lanesOf("b", 3)
    const cLanes = lanesOf("c", 1)
    expect(a.size).toBe(1)
    expect(b.size).toBe(1)
    expect(new Set([...a, ...b, ...cLanes]).size).toBe(3)
    expect([...a][0]).toBeGreaterThan(0)
    const tagOf = (name: string) => model.all.find((info) => info.name === name)?.tag
    expect(rows["a-2"]?.tag).toBe(tagOf("a"))
    expect(rows["b-1"]?.tag).toBe(tagOf("b"))
    expect(rows.m2?.into.length).toBe(2)
    expect(rows.m0?.tag).toBe(0)
  })

  test("criss-cross between two branches keeps every lane coloured by the branch that opened it", () => {
    const commits: Commit[] = [
      c("x2", ["x1", "y1"]),
      c("y2", ["y1", "x1"]),
      c("x1", ["m1"]),
      c("y1", ["m1"]),
      c("m0", ["m1"]),
      c("m1", []),
    ]
    const heads: CommitBranch[] = [
      { name: "main", head: "m0" },
      { name: "x", head: "x2" },
      { name: "y", head: "y2" },
    ]
    const { model, rows } = layout(commits, heads)
    expect(rows.m0?.lane).toBe(0)
    expect(rows.x2?.lane).not.toBe(rows.y2?.lane)
    expect(rows.x2?.tag).toBe(model.all.find((info) => info.name === "x")?.tag)
    expect(rows.y2?.tag).toBe(model.all.find((info) => info.name === "y")?.tag)
    expect(rows.m1).toMatchObject({ lane: 0, out: [] })
  })

  test("past maxLanes, lanes are counted as hidden and a head beyond them is drawn in the +N column", () => {
    const branches = Array.from({ length: 30 }, (_, index) => ({ name: `b${String(index)}`, fork: 40, ahead: 1 }))
    const { commits, heads } = history(50, branches)
    const { rows } = layout(commits, heads, 8)
    const all = Object.values(rows)
    expect(Math.max(...all.map((row) => row.width))).toBe(8)
    expect(Math.max(...all.map((row) => row.hidden))).toBeGreaterThan(20)
    expect(rows["b29-1"]).toMatchObject({ nodeHidden: true, lane: 8 })
    expect(rows.m40?.hidden).toBeGreaterThan(20)
    expect(rows.m41?.hidden).toBe(0)
  })

  test("50,000 commits and 200 branches lay out in linear time, never wider than maxLanes", () => {
    const branches = Array.from({ length: 200 }, (_, index) => ({
      name: `feature/${String(index)}`,
      fork: 100 + index * 240,
      ahead: 5 + (index % 7),
      at: index % 2 === 0 ? 0 : 50 + index * 240,
    }))
    const { commits, heads } = history(50_000 - 1600, branches)
    expect(commits.length).toBeGreaterThan(49_000)
    const start = performance.now()
    const { model, rows } = layout(commits, heads, 8)
    const elapsed = performance.now() - start
    expect(model.active).toHaveLength(200)
    const all = Object.values(rows)
    expect(all).toHaveLength(commits.length)
    expect(Math.max(...all.map((row) => row.width))).toBeLessThanOrEqual(8)
    expect(Math.max(...all.map((row) => row.hidden))).toBeGreaterThan(50)
    expect(elapsed).toBeLessThan(1500)
  })
})
