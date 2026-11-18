import { createCommitGraph, mergeIds, visibleRows, type Commit } from "@/lib/commit-graph"
import { createLaneLayout } from "@/lib/commit-lanes"
import { commitSubject } from "@/lib/commit-message"

import { trailCommits } from "./git-fixtures"

const commits: Commit[] = trailCommits(Date.now())
const graph = createCommitGraph(commits)
const visible = visibleRows(graph, new Set(mergeIds(graph)))
const layout = createLaneLayout(graph, visible)

export default function CommitGraphDemo() {
  return (
    <table className="text-body-sm">
      <thead>
        <tr className="text-start text-muted-foreground">
          <th className="pe-group text-start font-medium">Commit</th>
          <th className="pe-group text-start font-medium">Depth</th>
          <th className="pe-group text-start font-medium">Lane</th>
          <th className="text-start font-medium">Out to</th>
        </tr>
      </thead>
      <tbody>
        {[...visible.rows].map((row, position) => {
          const commit = commits[row] as Commit
          const lanes = layout.at(position)
          return (
            <tr key={commit.id}>
              <td className="pe-group">{commitSubject(commit)}</td>
              <td className="pe-group tabular-nums">{graph.depth[row]}</td>
              <td className="pe-group tabular-nums">{lanes.lane}</td>
              <td className="tabular-nums">{lanes.out.join(", ") || "—"}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
