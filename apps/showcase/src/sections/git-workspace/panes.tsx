import { CircleCheckIcon, CopyIcon, Maximize2Icon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GitBranchChip } from "@/components/ui/git-chip"
import { GitDiff } from "@/components/ui/git-diff"
import { RelativeTime } from "@/components/ui/relative-time"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import type { Commit } from "@/lib/commit-graph"

import type { Repo, Worktree } from "../git-workspace-fixtures"

const authorName = (commit: Commit) =>
  typeof commit.author === "string" ? commit.author : (commit.author?.name ?? "Unknown author")

const paneHeader =
  "flex flex-col gap-inline rounded-surface border bg-card px-inset-item py-inset-item text-card-foreground"

type CommitPaneProps = { commit: Commit; patch: string; now: string; onOpenFull?: () => void }

function CommitPane({ commit, patch, now, onOpenFull }: CommitPaneProps) {
  const hash = commit.hash ?? commit.id.slice(0, 7)
  const subject = typeof commit.message === "string" ? commit.message : "Commit"
  return (
    <section aria-label={`Commit ${hash}`} className="flex min-h-0 min-w-0 flex-1 flex-col gap-items">
      <header className={paneHeader}>
        <div className="flex items-start gap-items">
          <h2 className="min-w-0 flex-1 text-body font-medium">{subject}</h2>
          {onOpenFull ? (
            <Button variant="ghost" size="sm" onClick={onOpenFull}>
              <Maximize2Icon />
              Full view
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-group gap-y-inline text-caption text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{authorName(commit)}</span>{" "}
            <RelativeTime value={commit.date} now={now} locale="en" timeZone="UTC" />
          </span>
          <span className="inline-flex items-center gap-inline">
            <span className="font-mono text-foreground">{hash}</span>
            <Button variant="ghost" size="icon" aria-label="Copy the full hash" className="size-control-sm">
              <CopyIcon />
            </Button>
          </span>
          <span>
            {commit.parents.length > 1 ? "Merge of " : "Parent "}
            {commit.parents.map((parent, index) => (
              <span key={parent} className="font-mono text-foreground">
                {index > 0 ? " + " : ""}
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
      </header>
      <GitDiff
        key={commit.id}
        aria-label={`Changes in ${hash}`}
        patch={patch}
        fileTree="collapsible"
        className="min-h-0 flex-1"
      />
    </section>
  )
}

function CleanStatus({ repo }: { repo: Repo }) {
  const upstream = repo.remote === null ? "no remote" : `up to date with ${repo.remote}/${repo.branch}`
  return (
    <p className="flex items-center gap-inline px-inset-item text-caption text-muted-foreground">
      <CircleCheckIcon className="size-4 text-success" aria-hidden="true" />
      Working tree clean on <GitBranchChip name={repo.branch} /> · {upstream}
    </p>
  )
}

type Group = "staged" | "unstaged"

type WorkingTreePaneProps = { repo: Repo; worktree: Worktree; layout: "toggle" | "groups" }

function WorkingTreePane({ repo, worktree, layout }: WorkingTreePaneProps) {
  const [group, setGroup] = useState<Group>(worktree.staged.files > 0 ? "staged" : "unstaged")
  return (
    <section aria-label="Uncommitted changes" className="flex min-h-0 min-w-0 flex-1 flex-col gap-items">
      <header className={`${paneHeader} flex-row flex-wrap items-center`}>
        <span className="flex min-w-0 flex-1 flex-col gap-inline">
          <span className="text-body font-medium">Uncommitted changes</span>
          <span className="flex flex-wrap items-center gap-inline text-caption text-muted-foreground">
            on <GitBranchChip name={repo.branch} /> in <span className="font-mono">{repo.path}</span> · read-only
          </span>
        </span>
        {layout === "toggle" ? (
          <SegmentedControl<Group>
            aria-label="Which changes"
            value={group}
            onValueChange={(next) => {
              if (next) setGroup(next)
            }}
          >
            <SegmentedControlIndicator />
            <SegmentedControlItem value="staged">Staged · {worktree.staged.files}</SegmentedControlItem>
            <SegmentedControlItem value="unstaged">Unstaged · {worktree.unstaged.files}</SegmentedControlItem>
          </SegmentedControl>
        ) : null}
      </header>
      {layout === "toggle" ? (
        <GitDiff
          key={group}
          aria-label={group === "staged" ? "Staged changes" : "Unstaged changes"}
          patch={worktree[group].patch}
          fileTree="collapsible"
          className="min-h-0 flex-1"
        />
      ) : (
        <GitDiff
          aria-label="Uncommitted changes"
          groups={[
            { label: "Staged", patch: worktree.staged.patch },
            { label: "Unstaged", patch: worktree.unstaged.patch },
          ]}
          fileTree="collapsible"
          className="min-h-0 flex-1"
        />
      )}
    </section>
  )
}

export { CleanStatus, CommitPane, WorkingTreePane }
