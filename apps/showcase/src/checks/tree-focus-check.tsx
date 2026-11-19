import { Button } from "@/components/ui/button"
import { CommitHistory } from "@/components/ui/commit-history"
import { Dialog, DialogBackdrop, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { GitDiff } from "@/components/ui/git-diff"
import { GitTree } from "@/components/ui/git-tree"
import { Tree } from "@/components/ui/tree"

// ?demo=tree-focus-check: the fixture of tooling/tree-focus-check.mjs. Trees whose folders hold rows, so a focused
// dialog, tree or folder above them would outline every row if a row's focus style matched any focused ancestor.
const patch = ["src/billing/invoice.ts", "src/billing/tax/rates.ts", "docs/billing.md"]
  .map(
    (path) =>
      `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,2 +1,2 @@\n const total = 1\n-const tax = 0\n+const tax = 0.2\n`,
  )
  .join("")

const paths = ["src/billing/invoice.ts", "src/billing/tax/rates.ts", "src/app.ts", "docs/billing.md", "README.md"]

const commits = [
  { id: "c3", parents: ["c2"], message: "Round tax rates", date: "2026-11-15T18:30:00Z" },
  { id: "c2", parents: ["c1"], message: "Add invoice totals", date: "2026-11-15T18:00:00Z" },
  { id: "c1", parents: [], message: "Initial commit", date: "2026-11-15T17:00:00Z" },
]

function TreeFocusCheck() {
  return (
    <main className="flex max-w-3xl flex-col gap-group p-inset-surface">
      <h1 className="text-title">Tree focus</h1>
      <Dialog>
        <DialogTrigger>Open diff</DialogTrigger>
        <DialogBackdrop />
        <DialogContent size="xl" initialFocus="content">
          <DialogHeader>
            <DialogTitle>Changes</DialogTitle>
          </DialogHeader>
          <GitDiff aria-label="Dialog diff" patch={patch} className="h-96 w-full" />
        </DialogContent>
      </Dialog>
      <Button variant="outline" data-testid="before-git-tree">
        Before git tree
      </Button>
      <GitTree
        aria-label="Git tree"
        className="max-h-80"
        files={paths.map((path, index) => (index === 1 ? { path, status: "modified" as const } : path))}
        defaultExpanded={["src", "src/billing", "src/billing/tax", "docs"]}
      />
      <Button variant="outline" data-testid="before-tree">
        Before tree
      </Button>
      <Tree aria-label="Tree" paths={paths} defaultExpanded={["src", "src/billing", "src/billing/tax", "docs"]} />
      <Button variant="outline" data-testid="before-commits">
        Before commits
      </Button>
      <CommitHistory aria-label="Commits" className="max-h-80" commits={commits} now="2026-11-15T19:00:00Z" />
    </main>
  )
}

export { TreeFocusCheck }
