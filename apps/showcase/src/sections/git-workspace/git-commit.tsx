import { ArrowLeftIcon, CopyIcon, GitCommitHorizontalIcon, ListIcon } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GitBranchChip, GitFileChip } from "@/components/ui/git-chip"
import { createDiffViewController, GitDiff } from "@/components/ui/git-diff"
import { GitTree } from "@/components/ui/git-tree"
import type { Commit } from "@/lib/commit-graph"

import {
  RATE_LIMIT_COMMIT,
  rateLimitChangedPaths,
  rateLimitPatch,
  rateLimitTree,
  repos,
} from "../git-workspace-fixtures"

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })

const authorName = (commit: Commit) =>
  typeof commit.author === "string" ? commit.author : (commit.author?.name ?? "Unknown author")

const changed = new Set(rateLimitChangedPaths)

/**
 * The commit view, a route that takes the history's place: every file at the commit in a GitTree on the left, the
 * whole diff on the right. A file picked in the tree scrolls the diff to it, and the tree follows the diff's scroll.
 */
function GitCommitDemo() {
  const [controller] = useState(createDiffViewController)
  const [current, setCurrent] = useState<string | null>(null)
  const [unchanged, setUnchanged] = useState<string | null>(null)
  const [back, setBack] = useState(false)
  const repo = repos[0]!
  const commit = RATE_LIMIT_COMMIT
  const hash = commit.hash ?? commit.id.slice(0, 7)
  const subject = typeof commit.message === "string" ? commit.message : "Commit"
  return (
    <div className="flex flex-col gap-group">
      {back ? (
        <Alert>
          <AlertDescription>History goes back to the Git tab at the same scroll position.</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-items">
        <Button variant="outline" size="sm" onClick={() => setBack(true)}>
          <ArrowLeftIcon />
          History
        </Button>
        <nav aria-label="Location" className="flex min-w-0 items-center gap-inline text-sm text-muted-foreground">
          <span>{repo.path}</span>
          <span aria-hidden="true">/</span>
          <GitBranchChip name="main" />
          <span aria-hidden="true">/</span>
          <span className="font-mono text-foreground">{hash}</span>
        </nav>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{subject}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-items">
            {commit.body ? (
              <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{commit.body}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-group gap-y-inline text-sm">
              <span>
                <span className="font-medium">{authorName(commit)}</span>{" "}
                <span className="text-muted-foreground">committed {when.format(new Date(commit.date))} UTC</span>
              </span>
              <span className="inline-flex items-center gap-inline">
                <GitCommitHorizontalIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="font-mono">{hash}</span>
                <Button variant="ghost" size="icon" aria-label="Copy the full hash" className="size-control-sm">
                  <CopyIcon />
                </Button>
              </span>
              <span className="text-muted-foreground">
                Parent{" "}
                {commit.parents.map((parent) => (
                  <span key={parent} className="font-mono text-foreground">
                    {parent.slice(0, 7)}
                  </span>
                ))}
              </span>
              {commit.tags?.map((tag) => (
                <Badge key={tag.label} tone={tag.tone}>
                  {tag.label}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex h-200 min-h-0 gap-group">
        <div className="flex w-72 shrink-0 flex-col gap-items">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              setUnchanged(null)
              controller.openFile(rateLimitChangedPaths[0] ?? "")
            }}
          >
            <ListIcon />
            All changes
            <span className="ms-auto text-caption text-muted-foreground tabular-nums">
              {rateLimitChangedPaths.length} files
            </span>
          </Button>
          <GitTree
            aria-label={`Files at ${hash}`}
            files={rateLimitTree}
            current={current}
            onOpenFile={(path) => {
              if (changed.has(path)) {
                setUnchanged(null)
                setCurrent(path)
              } else setUnchanged(path)
            }}
            className="min-h-0 flex-1"
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-items">
          {unchanged === null ? null : (
            <p className="flex items-center gap-inline text-sm text-muted-foreground">
              <GitFileChip path={unchanged} /> is unchanged in {hash}.
            </p>
          )}
          <GitDiff
            aria-label={`Changes in ${hash}`}
            patch={rateLimitPatch}
            fileTree={false}
            controller={controller}
            currentFile={current}
            onCurrentFileChange={setCurrent}
            className="min-h-0 min-w-0 flex-1"
          />
        </div>
      </div>
    </div>
  )
}

export { GitCommitDemo }
