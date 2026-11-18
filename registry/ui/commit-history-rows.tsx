"use client"

import type { TreeItemData } from "@ui-sdk/react/tree"

import type { CommitBranchSummary } from "@/components/ui/commit-history-primitive"
import { CommitRow, type CommitRowContext } from "@/components/ui/commit-history-row"
import type { useCommitTrail } from "@/components/ui/use-commit-history"
import type { useTrailRows } from "@/components/ui/use-trail-rows"
import type { BranchInfo } from "@/lib/commit-branches"
import { isMergeRow, type Commit, type CommitGraph } from "@/lib/commit-graph"
import { commitSubject } from "@/lib/commit-message"
import { toISO } from "@/lib/time"

type Trail = ReturnType<typeof useCommitTrail>

/** The Tree's items: every commit, merges holding the commits nested under them. O(commits). */
function treeItemsOf(graph: CommitGraph): TreeItemData[] {
  const items: TreeItemData[] = []
  const nodes: TreeItemData[] = []
  for (let row = 0; row < graph.size; row += 1) {
    const commit = graph.commits[row] as Commit
    const node: TreeItemData = { value: commit.id, label: commitSubject(commit) }
    if (isMergeRow(graph, row)) node.children = []
    nodes.push(node)
    const owner = graph.owner[row] as number
    if (owner < 0) items.push(node)
    else nodes[owner]?.children?.push(node)
  }
  return items
}

function summaryOf(info: BranchInfo): CommitBranchSummary {
  const updatedAt = info.updatedAt === undefined ? undefined : toISO(info.updatedAt)
  return { name: info.name, head: info.head, ahead: info.ahead, behind: info.behind, updatedAt, state: info.state }
}

function doneCount(commits: readonly Commit[]) {
  let count = 0
  for (const commit of commits) if (commit.status !== "pending") count += 1
  return count
}

function ancestorIn(graph: CommitGraph, row: number, ids: ReadonlySet<string>) {
  for (let owner = graph.owner[row] as number; owner >= 0; owner = graph.owner[owner] as number) {
    if (ids.has((graph.commits[owner] as Commit).id)) return true
  }
  return false
}

type RowsProps = {
  trail: Trail
  details: ReadonlySet<string>
  justExpanded: ReadonlySet<string>
  context: CommitRowContext
  virtual: Omit<ReturnType<typeof useTrailRows>, "setScroller" | "anchor">
  heads: ReadonlyMap<string, readonly BranchInfo[]> | undefined
}

function Rows({ trail, details, justExpanded, context, virtual, heads }: RowsProps) {
  const { graph, visible, layout } = trail
  return virtual.segments.map((segment) => {
    if (segment.type === "gap") {
      return (
        <div key={segment.key} aria-hidden="true" data-slot="commit-history-gap" style={{ height: segment.size }} />
      )
    }
    const { index, top } = segment
    const row = visible.rows[index] as number
    const commit = graph.commits[row] as Commit
    return (
      <CommitRow
        key={commit.id}
        commit={commit}
        index={index}
        top={top}
        lanes={layout.at(index)}
        depth={graph.depth[row] as number}
        merge={isMergeRow(graph, row)}
        detailsOpen={details.has(commit.id)}
        entering={justExpanded.size > 0 && ancestorIn(graph, row, justExpanded)}
        drawIn={justExpanded.has(commit.id)}
        context={context}
        measure={virtual.measure}
        textSlot={virtual.textSlot}
        heads={heads?.get(commit.id)}
      />
    )
  })
}

export { doneCount, Rows, summaryOf, treeItemsOf }
export type { RowsProps }
