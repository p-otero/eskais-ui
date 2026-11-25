import { useState } from "react"

import { Button } from "@/components/ui/button"
import { CommitHistory } from "@/components/ui/commit-history"
import { GitTree } from "@/components/ui/git-tree"
import type { Commit } from "@/lib/commit-graph"
import type { GitTreeFile } from "@/lib/git-status"

import { Section } from "../section"
import { branchHistory, pendingCommit, trailCommits } from "./git-fixtures"

const NOW = Date.now()
const trail = trailCommits(NOW)

function CommitTrailDemo() {
  const [commits, setCommits] = useState<Commit[]>(() => [pendingCommit(NOW, trail[0]?.id ?? ""), ...trail])
  const [branch, setBranch] = useState("main")
  const pending = commits[0]?.status === "pending"
  return (
    <div className="flex w-full max-w-md flex-col gap-items">
      <CommitHistory
        aria-label="Commits on main"
        commits={commits}
        branch={branch}
        branches={["main", "invoice-pdf", "tax-rates"]}
        onBranchChange={setBranch}
      />
      <div className="flex flex-wrap gap-items">
        <Button
          variant="outline"
          size="sm"
          disabled={!pending}
          onClick={() =>
            setCommits(([first, ...rest]) => [
              { ...(first as Commit), status: "done", date: Date.now(), tags: [{ label: "Fix", tone: "warning" }] },
              ...rest,
            ])
          }
        >
          Finish the commit
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setCommits([pendingCommit(Date.now(), trail[0]?.id ?? ""), ...trail])}
        >
          Start again
        </Button>
      </div>
    </div>
  )
}

const changedFiles: (string | GitTreeFile)[] = [
  "package.json",
  "README.md",
  { path: "src/routes.ts", status: "added" },
  { path: "src/billing/proration.ts", status: "modified" },
  { path: "src/billing/legacy-rates.ts", status: "deleted" },
  { path: "src/invoice/pdf.ts", status: "renamed", from: "src/invoice/print.ts" },
  "src/invoice/fonts.ts",
  "docs/billing.md",
]

const branchDemo = branchHistory(NOW)

function CommitBranchesDemo() {
  const [focused, setFocused] = useState<string | null>(null)
  return (
    <div className="flex w-full max-w-xl flex-col gap-items">
      <CommitHistory
        aria-label="Branches of billing"
        view="branches"
        commits={branchDemo.commits}
        branch="main"
        branches={branchDemo.branches}
        focusedBranch={focused}
        onFocusedBranchChange={setFocused}
        filterBranch
      />
      <p className="text-caption text-muted-foreground" aria-live="polite">
        {focused ? `Showing main and ${focused}` : "Showing every active branch"}
      </p>
    </div>
  )
}

function GitSection() {
  return (
    <>
      <Section
        title="CommitHistory"
        description="A commit trail, one line per commit: merges open their branch on a side lane, a commit opens its details inline, and a pending commit spins until it lands."
      >
        <CommitTrailDemo />
        <CommitBranchesDemo />
        <CommitHistory
          aria-label="Commits on main, one open"
          className="w-full max-w-xl"
          commits={trail}
          branch="main"
          defaultExpanded={["5c0d1be77a"]}
          defaultDetails={["e02c6d9f31"]}
        />
      </Section>
      <Section
        title="GitTree"
        description="A repository's files at a commit: folders first, changed files marked added, modified, deleted or renamed, folders with changes open."
      >
        <GitTree aria-label="Files at e02c6d9" className="w-full max-w-sm" files={changedFiles} />
      </Section>
    </>
  )
}

export { CommitBranchesDemo, CommitTrailDemo, GitSection }
