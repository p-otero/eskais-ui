import { RefreshCwIcon } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CommitHistory } from "@/components/ui/commit-history"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import type { Commit } from "@/lib/commit-graph"

import {
  allCommits,
  apiBranches,
  branchHeadsList,
  commitsFor,
  NOW,
  olderCommits,
  repos,
  WORKSPACE,
} from "../git-workspace-fixtures"
import { BranchField, RepositoryField } from "./selects"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type HistoryView = "trail" | "branches"

/**
 * The Git tab with one history: Repository and Branch selects side by side, then the trail, with One branch and
 * All branches. A commit opens the commit view, a route that takes the history's place.
 */
function GitTabDemo({ repositoryMenuOpen }: { repositoryMenuOpen?: boolean }) {
  const [repoId, setRepoId] = useState("api")
  const [branch, setBranch] = useState("main")
  const [view, setView] = useState<HistoryView>("trail")
  const [pages, setPages] = useState<Commit[][]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState<Commit | null>(null)
  const repo = repos.find((entry) => entry.id === repoId) ?? repos[0]!
  const base = view === "branches" ? allCommits : commitsFor(branch)
  const commits = [...base, ...pages.flat()]
  const changeBranch = (next: string) => {
    setBranch(next)
    setPages([])
  }

  return (
    <>
      {open ? (
        <Alert>
          <AlertTitle>Opens {open.id.slice(0, 7)} in the commit view</AlertTitle>
          <AlertDescription>
            The history gives way to the commit's files and diff, as in the commit view demo.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end gap-items">
        <RepositoryField
          repos={repos}
          aria-label="Repository"
          value={repo.id}
          defaultOpen={repositoryMenuOpen}
          onValueChange={(next) => {
            if (next === null) return
            setRepoId(next)
            changeBranch("main")
          }}
        />
        <BranchField branches={apiBranches} value={branch} onChange={changeBranch} base="main" />
        <p className="pb-inline text-caption text-muted-foreground">
          Read from the local checkout at <span className="font-mono">{`${WORKSPACE}/${repo.path}`}</span>, unpushed
          commits included
        </p>
      </div>
      <CommitHistory
        aria-label={`Commits in ${repo.path}`}
        commits={commits}
        branch={view === "branches" ? "main" : undefined}
        branches={view === "branches" ? branchHeadsList : undefined}
        view={view}
        count={repo.commits}
        hasMore
        loadingMore={loadingMore}
        onLoadMore={async () => {
          setLoadingMore(true)
          await wait(600)
          setPages((current) => [...current, olderCommits([...base, ...current.flat()], 100)])
          setLoadingMore(false)
        }}
        onOpenCommit={(commit) => setOpen(commit)}
        now={NOW}
        timeZone="UTC"
        locale="en"
        className="h-200"
        actions={
          <>
            <SegmentedControl<HistoryView>
              aria-label="History layout"
              value={view}
              onValueChange={(next) => {
                if (next) setView(next)
              }}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="trail">One branch</SegmentedControlItem>
              <SegmentedControlItem value="branches">All branches</SegmentedControlItem>
            </SegmentedControl>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Read the repository again"
              loading={refreshing}
              onClick={async () => {
                setRefreshing(true)
                await wait(500)
                setRefreshing(false)
              }}
            >
              <RefreshCwIcon />
            </Button>
          </>
        }
      />
    </>
  )
}

export { GitTabDemo }
