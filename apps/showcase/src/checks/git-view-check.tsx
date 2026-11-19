import { GitDiff } from "@/components/ui/git-diff"

// ?demo=git-view-check: the fixture of tooling/git-view-check.mjs. A GitDiff beside a 34rem list (tree width),
// GitDiff height="auto" inside a scrolling body (no scroll trap; uncapped, the body is its one scroller), and an
// added file in split view (column sizing).
const file = (path: string, lines: number, kind: "added" | "modified") => {
  const body = Array.from({ length: lines }, (_, index) => `export const value${String(index)} = ${String(index)}`)
  if (kind === "added") {
    return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${String(lines)} @@\n${body.map((line) => `+${line}`).join("\n")}\n`
  }
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,3 +1,3 @@\n ${body[0] ?? ""}\n-${body[1] ?? ""}\n+${body[1] ?? ""} // changed\n ${body[2] ?? ""}\n`
}

const shortPatch = file("src/short.ts", 3, "modified") + file("src/other.ts", 3, "modified")
const longPatch = Array.from({ length: 6 }, (_, index) => file(`src/long/file-${String(index)}.ts`, 30, "added")).join(
  "",
)
const addedPatch = file("src/rate-limit/token-bucket.ts", 33, "added")
// 2,000 lines in 20 files: one hunk each, so j has somewhere to go.
const hugePatch = Array.from({ length: 20 }, (_, index) =>
  file(`src/huge/file-${String(index)}.ts`, 100, "added"),
).join("")

function GitViewCheck() {
  return (
    <main className="flex flex-col gap-section p-inset-surface">
      <h1 className="text-title">Git views</h1>
      <section aria-label="Beside a list" data-testid="beside-list" className="flex h-160 min-w-0 gap-group">
        <div className="w-2/5 min-w-136 shrink-0 rounded-surface border" />
        <GitDiff aria-label="Beside the list" patch={longPatch} className="min-h-0 min-w-0 flex-1" />
      </section>
      <section aria-label="Collapsible" data-testid="collapsible" className="flex h-96 min-w-0">
        <GitDiff aria-label="Collapsible diff" patch={longPatch} fileTree="collapsible" className="min-w-0 flex-1" />
      </section>
      <div
        data-testid="dialog-body"
        className="flex h-120 flex-col gap-group overflow-y-auto rounded-surface border p-inset-surface"
      >
        <p>Task details above the changes.</p>
        <div data-testid="auto-short">
          <GitDiff aria-label="Short changes" patch={shortPatch} height="auto" />
        </div>
        {/* oxlint-disable-next-line shadcn/no-arbitrary-values -- the cap a dialog body sets, as the docs show */}
        <div data-testid="auto-long" className="[--diff-max-height:20rem]">
          <GitDiff aria-label="Long changes" patch={longPatch} height="auto" />
        </div>
        <p className="h-200 shrink-0">Acceptance criteria below the changes.</p>
      </div>
      <div
        data-testid="huge-body"
        className="flex h-120 flex-col gap-group overflow-y-auto rounded-surface border p-inset-surface"
      >
        <p>Task details above the changes.</p>
        <GitDiff aria-label="Huge changes" patch={hugePatch} height="auto" fileTree="collapsible" />
        <p>Acceptance criteria below the changes.</p>
      </div>
      <section aria-label="Split" data-testid="split" className="flex h-96 min-w-0">
        <GitDiff
          aria-label="Added file in split"
          patch={addedPatch}
          defaultLayout="split"
          fileTree={false}
          className="min-w-0 flex-1"
        />
      </section>
      <section aria-label="In the page" data-testid="page-huge" className="flex min-w-0 flex-col">
        <GitDiff aria-label="Huge changes in the page" patch={hugePatch} height="auto" fileTree={false} />
      </section>
    </main>
  )
}

export { GitViewCheck }
