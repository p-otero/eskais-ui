import type { CSSProperties } from "react"

import { CommitHistory } from "@/components/ui/commit-history"
import { GitTree } from "@/components/ui/git-tree"
import type { Commit } from "@/lib/commit-graph"
import type { GitTreeFile } from "@/lib/git-status"

import { branchedCommits, generatedCommits } from "../sections/git-fixtures"

declare global {
  var gitBench: { mounted?: number; start: number } | undefined
}

const params = new URLSearchParams(location.search)
const demo = params.get("demo")
const NOW = Date.parse("2026-11-18T12:00:00Z")

function benchFiles(count: number): GitTreeFile[] {
  const statuses = ["added", "modified", "deleted", "renamed"] as const
  return Array.from({ length: count }, (_, index) => {
    const path = `packages/pkg-${String(index % 40)}/src/dir-${String((index >> 5) % 250)}/file-${String(index)}.ts`
    return index % 997 === 0 ? { path, status: statuses[index % 4] } : { path }
  })
}

// Built before the clock starts, as a server's response would be, and only on the bench pages.
const commitCount = Number(params.get("commits") ?? 50_000)
const branchCount = Number(params.get("branches") ?? 0)
const branched = demo === "commit-bench" && branchCount > 0 ? branchedCommits(commitCount, branchCount, NOW) : undefined
const commits: Commit[] = demo === "commit-bench" ? (branched?.commits ?? generatedCommits(commitCount, NOW)) : []
const merges =
  params.get("expanded") === "all"
    ? commits.filter((commit) => commit.parents.length > 1).map((commit) => commit.id)
    : []
const files: GitTreeFile[] = demo === "git-tree-bench" ? benchFiles(Number(params.get("files") ?? 100_000)) : []
const findable = params.get("findable") === "true"
if (demo === "commit-bench" || demo === "git-tree-bench") globalThis.gitBench = { start: performance.now() }

// The bench page is the scroller's whole height, past the components' default caps.
const unbounded = { "--commit-history-height": "none", "--git-tree-height": "none" } as CSSProperties

// Records when the first rows have painted: a frame, then a task after it.
function markMounted(node: HTMLElement | null) {
  if (!node) return
  requestAnimationFrame(() => {
    const channel = new MessageChannel()
    channel.port1.addEventListener("message", () => {
      if (globalThis.gitBench) globalThis.gitBench.mounted = performance.now() - globalThis.gitBench.start
    })
    channel.port1.start()
    channel.port2.postMessage(null)
  })
}

/**
 * ?demo=commit-bench&commits=50000&expanded=all (or &branches=200 for the branches view) and ?demo=git-tree-bench&files=100000, with &findable=true for the
 * find-in-page layers: tooling/git-bench.mjs's.
 */
function GitBench({ kind }: { kind: "commits" | "files" }) {
  return (
    <main ref={markMounted} className="flex h-dvh flex-col p-inset-surface">
      {kind === "commits" ? (
        <CommitHistory
          aria-label="Benchmark commits"
          className="min-h-0 flex-1"
          style={unbounded}
          commits={commits}
          branch="main"
          now={NOW}
          defaultExpanded={merges}
          findable={findable}
          view={branched ? "branches" : "trail"}
          branches={branched?.branches}
        />
      ) : (
        <GitTree
          aria-label="Benchmark files"
          className="min-h-0 flex-1"
          style={unbounded}
          files={files}
          findable={findable}
        />
      )}
    </main>
  )
}

export { GitBench }
