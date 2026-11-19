import { useState, type ReactNode } from "react"
import { ArrowRightIcon, GitBranchIcon, HistoryIcon, LayersIcon } from "lucide-react"

import type { TaskView } from "@/lib/agent-task-types"
import { AcceptancePopover } from "@/components/ui/acceptance-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleIcon, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CommitHistory, WORKING_TREE } from "@/components/ui/commit-history"
import { GitBranchChip } from "@/components/ui/git-chip"
import { GitDiff } from "@/components/ui/git-diff"
import { Icon } from "@/components/ui/icon"
import { TaskDetailDialog } from "@/components/ui/task-detail-dialog"
import { TaskStatusIcon } from "@/components/ui/task-status"
import { Toggle } from "@/components/ui/toggle"
import { UsageQuantity } from "@/components/ui/usage"

import {
  TASK_DIALOG_NOW,
  taskBranches,
  taskChanges,
  taskDialogTasks,
  type PatchTotals,
  type TaskBranch,
  type TaskChangeSet,
} from "./task-dialog-fixtures"

const statusLabel: Record<TaskView["status"], string> = {
  proposed: "Proposed",
  todo: "To do",
  working: "Working",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
}

function totalTokens(task: TaskView) {
  const usage = task.usage
  const parts = usage ? [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens] : []
  return parts.length > 0 && parts.every((part) => part.value !== null)
    ? { value: parts.reduce((sum, part) => sum + (part.value ?? 0), 0), quality: "measured" as const }
    : { value: null, quality: "unknown" as const }
}

function Stat({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-inline">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="text-sm tabular-nums">{children}</dd>
    </div>
  )
}

function StatsStrip({ task, acceptanceOpen }: { task: TaskView; acceptanceOpen?: boolean }) {
  const counts = task.counts
  return (
    <div className="flex flex-wrap items-center gap-x-section gap-y-items">
      <dl className="flex flex-wrap items-start gap-x-section gap-y-items">
        <Stat term="Status">
          <span className="inline-flex items-center gap-inline">
            <TaskStatusIcon status={task.status} />
            {statusLabel[task.status]}
          </span>
        </Stat>
        <Stat term="Cost">
          <UsageQuantity value={task.usage?.costUsd} kind="cost" locale="en-US" className="text-sm font-medium" />
        </Stat>
        <Stat term="Tokens">
          <UsageQuantity value={totalTokens(task)} kind="tokens" locale="en-US" className="text-sm font-medium" />
        </Stat>
        <Stat term="Attempts">{counts?.attempts ?? task.attempts.length}</Stat>
        <Stat term="Repairs">{counts?.repairs ?? "—"}</Stat>
        <Stat term="Reviews">{counts?.reviews ?? "—"}</Stat>
        <Stat term="People">{counts?.humanInterventions ?? "—"}</Stat>
        <Stat term="First pass">
          {task.acceptedFirstPass === undefined ? "—" : task.acceptedFirstPass ? "Yes" : "No"}
        </Stat>
      </dl>
      <AcceptancePopover criteria={task.acceptance} defaultOpen={acceptanceOpen} />
    </div>
  )
}

function changeCounts(changes: TaskChangeSet | undefined) {
  const worktree = changes?.worktree
  return {
    all: changes?.all,
    uncommitted: worktree ? worktree.staged.files + worktree.unstaged.files : 0,
    unpushed: changes?.commits.filter((commit) => commit.unpushed).length ?? 0,
  }
}

function Additions({ additions, deletions }: Omit<PatchTotals, "files">) {
  return (
    <>
      <span className="text-success">+{additions}</span> <span className="text-destructive">−{deletions}</span>
    </>
  )
}

function GitLine({
  branch,
  changes,
  onOpenHistory,
}: {
  branch: TaskBranch | undefined
  changes: TaskChangeSet | undefined
  onOpenHistory: () => void
}) {
  const { all, uncommitted, unpushed } = changeCounts(changes)
  return (
    <div data-slot="task-git" className="flex min-h-control flex-wrap items-center gap-items text-sm">
      {branch ? (
        <>
          <span className="inline-flex min-w-0 items-center gap-inline">
            <GitBranchChip name={branch.name} />
            <Icon icon={ArrowRightIcon} label="into" className="size-4 text-muted-foreground" />
            <GitBranchChip name={branch.base} />
          </span>
          <span className="text-muted-foreground tabular-nums">
            {branch.ahead} ahead · {branch.behind} behind
          </span>
          {branch.upstream === null ? <Badge tone="warning">Local only</Badge> : <Badge tone="success">Pushed</Badge>}
          {all ? (
            <span className="tabular-nums">
              {all.files} files <Additions additions={all.additions} deletions={all.deletions} />
            </span>
          ) : null}
          {unpushed > 0 ? <Badge tone="warning">{unpushed} not pushed</Badge> : null}
          {uncommitted > 0 ? <Badge tone="warning">{uncommitted} uncommitted</Badge> : null}
          {branch.pullRequest ? null : <span className="text-muted-foreground">No pull request</span>}
        </>
      ) : (
        <span className="inline-flex items-center gap-inline text-muted-foreground">
          <GitBranchIcon className="size-4" />
          No branch: this task's attempts haven't created one
        </span>
      )}
      <span className="ms-auto flex items-center gap-inline">
        <Button variant="outline" size="sm" disabled={!branch} onClick={onOpenHistory}>
          <HistoryIcon />
          Branch history
        </Button>
      </span>
    </div>
  )
}

/** The branch's diff against its base, shown while no commit is selected. A press clears the selection. */
function AllChangesToggle({ all, pressed, onPress }: { all: PatchTotals; pressed: boolean; onPress: () => void }) {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={pressed}
      onPressedChange={(next, details) => {
        if (next) onPress()
        else details.cancel()
      }}
    >
      <LayersIcon />
      All changes
      <span aria-hidden="true" className="tabular-nums">
        +{all.additions} −{all.deletions}
      </span>
      <span className="sr-only">
        , {all.additions} added, {all.deletions} removed
      </span>
    </Toggle>
  )
}

function DiffOf({ changes, selected, base }: { changes: TaskChangeSet; selected: string | null; base: string }) {
  if (selected === WORKING_TREE && changes.worktree) {
    const groups = [
      { label: "Staged", patch: changes.worktree.staged.patch },
      { label: "Unstaged", patch: changes.worktree.unstaged.patch },
    ].filter((group) => group.patch !== "")
    return (
      <GitDiff
        key={WORKING_TREE}
        aria-label="Uncommitted changes"
        groups={groups}
        height="auto"
        fileTree="collapsible"
        defaultFileTreeOpen={false}
        className="min-w-0 flex-1"
      />
    )
  }
  const commit = changes.commits.find((entry) => entry.id === selected)
  return (
    <GitDiff
      key={commit?.id ?? "all"}
      aria-label={commit ? `Changes in ${commit.id.slice(0, 7)}` : `All changes against ${base}`}
      patch={commit ? changes.patches[commit.id] : changes.all.patch}
      height="auto"
      fileTree="collapsible"
      defaultFileTreeOpen={false}
      className="min-w-0 flex-1"
    />
  )
}

type TaskChangesProps = {
  branch: TaskBranch | undefined
  changes: TaskChangeSet | undefined
  defaultSelected?: string | null
}

function TaskChanges({ branch, changes, defaultSelected = null }: TaskChangesProps) {
  const [selected, setSelected] = useState<string | null>(defaultSelected)
  if (!branch || !changes) {
    return (
      <div className="flex flex-col items-center justify-center gap-items rounded-surface border border-dashed p-section text-center">
        <GitBranchIcon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">No changes to show</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This task has no branch. When an attempt creates one, its commits, uncommitted work and diff against the base
          show here.
        </p>
      </div>
    )
  }
  const worktree = changes.worktree
  return (
    <div className="flex items-start gap-group narrow:flex-col narrow:items-stretch">
      <CommitHistory
        aria-label={`Commits on ${branch.name}`}
        className="w-96 shrink-0 narrow:w-full"
        commits={changes.commits}
        headerStart={
          <AllChangesToggle all={changes.all} pressed={selected === null} onPress={() => setSelected(null)} />
        }
        workingTree={worktree ? { staged: worktree.staged.files, unstaged: worktree.unstaged.files } : undefined}
        upstreamHead={changes.upstreamHead}
        selected={selected}
        onSelect={setSelected}
        now={TASK_DIALOG_NOW}
        locale="en-US"
        timeZone="UTC"
      />
      <DiffOf changes={changes} selected={selected} base={branch.base} />
    </div>
  )
}

function ChangesSection({ defaultOpen = false, ...props }: TaskChangesProps & { defaultOpen?: boolean }) {
  const { all, uncommitted, unpushed } = changeCounts(props.changes)
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="flex flex-col gap-items rounded-surface border bg-card/(--glass-opacity) px-inset-item py-inset-item"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-items text-start">
        <span className="shrink-0 text-sm font-medium">Changes</span>
        {all ? (
          <span className="flex flex-wrap items-center gap-inline text-sm text-muted-foreground tabular-nums">
            <span>{all.files} files</span>
            <Additions additions={all.additions} deletions={all.deletions} />
            {unpushed > 0 ? <Badge tone="warning">{unpushed} not pushed</Badge> : null}
            {uncommitted > 0 ? <Badge tone="warning">{uncommitted} uncommitted</Badge> : null}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No branch yet</span>
        )}
        <CollapsibleIcon className="ms-auto" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="pt-items">
          <TaskChanges {...props} />
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}

type TaskDialogProps = {
  task: TaskView | undefined
  onClose: () => void
  onOpenHistory: (branch: string) => void
  changesOpen?: boolean
  /** The commit (or `WORKING_TREE`) selected when the changes open; `null`, all changes, by default. */
  changesSelected?: string | null
  acceptanceOpen?: boolean
}

function TaskDialog({ task, onClose, onOpenHistory, changesOpen, changesSelected, acceptanceOpen }: TaskDialogProps) {
  return (
    <TaskDetailDialog
      task={task}
      onClose={onClose}
      now={TASK_DIALOG_NOW}
      locale="en-US"
      timeZone="UTC"
      hide={["status", "cost", "attemptsSummary", "acceptance"]}
      sections={{ side: ["details", "dependencies", "links", "usage", "location"] }}
      renderHeader={(current) => {
        const branch = taskBranches[current.id]
        return (
          <>
            <StatsStrip task={current} acceptanceOpen={acceptanceOpen} />
            <GitLine
              branch={branch}
              changes={taskChanges[current.id]}
              onOpenHistory={() => branch && onOpenHistory(branch.name)}
            />
          </>
        )
      }}
      renderBeforeBody={(current) => (
        <ChangesSection
          branch={taskBranches[current.id]}
          changes={taskChanges[current.id]}
          defaultOpen={changesOpen}
          defaultSelected={changesSelected}
        />
      )}
    />
  )
}

export default function TaskDetailDialogDemo() {
  const [open, setOpen] = useState<string>()
  const [history, setHistory] = useState<string>()
  return (
    <div className="flex flex-col items-start gap-items">
      <div className="flex flex-wrap gap-items">
        {taskDialogTasks.map((task) => (
          <Button key={task.id} variant="outline" onClick={() => setOpen(task.id)}>
            Open {task.id}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {history ? `Branch history of ${history}` : "Branch history opens your git view."}
      </p>
      <TaskDialog
        task={taskDialogTasks.find((task) => task.id === open)}
        onClose={() => setOpen(undefined)}
        onOpenHistory={(branch) => {
          setOpen(undefined)
          setHistory(branch)
        }}
      />
    </div>
  )
}

export { TaskDialog }
export type { TaskDialogProps }
