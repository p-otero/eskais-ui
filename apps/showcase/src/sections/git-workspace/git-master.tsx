import { RefreshCwIcon } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CommitHistory, WORKING_TREE } from "@/components/ui/commit-history"
import { RepositorySelect } from "@/components/ui/repository-select"
import type { Commit } from "@/lib/commit-graph"
import { cn } from "@/lib/utils"

import {
  apiBranches,
  appBranches,
  appCommits,
  appWorktree,
  commitPatch,
  commitsFor,
  NOW,
  olderCommits,
  repos,
  WORKSPACE,
  type BranchRef,
  type Worktree,
} from "../git-workspace-fixtures"
import { CleanStatus, CommitPane, WorkingTreePane } from "./panes"
import { repositoriesOf } from "./selects"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Checkout = { branches: readonly BranchRef[]; history: (branch: string) => Commit[]; worktree?: Worktree }

/** What each repository of the demo workspace holds: the api is clean, the app has uncommitted changes. */
function checkoutOf(id: string, dirty: boolean): Checkout {
  if (id === "app")
    return { branches: appBranches, history: () => appCommits, worktree: dirty ? appWorktree : undefined }
  return { branches: apiBranches, history: commitsFor }
}

type GitMasterDemoProps = {
  initialRepo?: string
  /** The app checkout's uncommitted changes as one group at a time (a toggle) or both groups in one diff. */
  worktreeLayout?: "toggle" | "groups"
  /** A wide screen: the history takes a third. */
  wide?: boolean
}

/**
 * The Git tab as master-detail: the history at 40% (at least 34rem) with the repository picker before its branch
 * switcher, and the selected commit beside it. HEAD is selected at first, or the working tree when the checkout
 * has uncommitted changes; commits the upstream doesn't have are marked.
 */
function GitMasterDemo({ initialRepo = "api", worktreeLayout = "toggle", wide = false }: GitMasterDemoProps) {
  const [repoId, setRepoId] = useState(initialRepo)
  const repo = repos.find((entry) => entry.id === repoId) ?? repos[0]!
  const checkout = checkoutOf(repo.id, repo.dirty > 0)
  const [branch, setBranch] = useState(repo.branch)
  const [pages, setPages] = useState<Commit[][]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const base = checkout.history(branch)
  const all = [...base, ...pages.flat()]
  const [selected, setSelected] = useState<string | null>(checkout.worktree ? WORKING_TREE : (base[0]?.id ?? null))
  const [fullView, setFullView] = useState<string | null>(null)
  const commit = all.find((entry) => entry.id === selected)
  const upstreamHead = repo.ahead === null ? undefined : all[repo.ahead]?.id

  const reset = (nextRepo: string, nextBranch: string) => {
    const next = repos.find((entry) => entry.id === nextRepo) ?? repo
    const nextCheckout = checkoutOf(next.id, next.dirty > 0)
    setPages([])
    setSelected(nextCheckout.worktree ? WORKING_TREE : (nextCheckout.history(nextBranch)[0]?.id ?? null))
  }

  return (
    <>
      <p className="text-caption text-muted-foreground">
        Read from the local checkout at <span className="font-mono">{`${WORKSPACE}/${repo.path}`}</span>
      </p>
      {fullView ? (
        <Alert>
          <AlertTitle>Opens {fullView.slice(0, 7)} in the full commit view</AlertTitle>
          <AlertDescription>The route with every file at the commit, as in the commit view demo.</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex h-200 min-w-0 gap-group">
        <div className={cn("flex min-h-0 shrink-0 flex-col gap-items", wide ? "w-1/3 min-w-120" : "w-2/5 min-w-136")}>
          {checkout.worktree ? null : <CleanStatus repo={repo} />}
          <CommitHistory
            aria-label={`History of ${repo.path}`}
            className="min-h-0 flex-1"
            commits={all}
            count={repo.commits}
            branch={branch}
            branches={checkout.branches.map((entry) => entry.name)}
            onBranchChange={(next) => {
              setBranch(next)
              reset(repo.id, next)
            }}
            headerStart={
              <RepositorySelect
                aria-label="Repository"
                size="sm"
                repositories={repositoriesOf(repos)}
                value={repo.id}
                onValueChange={(next) => {
                  if (next === null) return
                  const nextRepo = repos.find((entry) => entry.id === next)
                  setRepoId(next)
                  setBranch(nextRepo?.branch ?? "main")
                  reset(next, nextRepo?.branch ?? "main")
                }}
                triggerProps={{
                  className:
                    "-ms-(--item-padding-x) w-auto border-transparent bg-transparent px-(--item-padding-x) font-medium shadow-none hover:bg-accent",
                }}
              />
            }
            workingTree={
              checkout.worktree
                ? { staged: checkout.worktree.staged.files, unstaged: checkout.worktree.unstaged.files }
                : undefined
            }
            upstreamHead={upstreamHead}
            selected={selected}
            onSelect={setSelected}
            hasMore
            loadingMore={loadingMore}
            onLoadMore={async () => {
              setLoadingMore(true)
              await wait(600)
              setPages((current) => [...current, olderCommits([...base, ...current.flat()], 100)])
              setLoadingMore(false)
            }}
            now={NOW}
            timeZone="UTC"
            locale="en"
            actions={
              <Button variant="ghost" size="icon" aria-label="Read the repository again">
                <RefreshCwIcon />
              </Button>
            }
          />
        </div>
        {selected === WORKING_TREE && checkout.worktree ? (
          <WorkingTreePane repo={repo} worktree={checkout.worktree} layout={worktreeLayout} />
        ) : commit ? (
          <CommitPane commit={commit} patch={commitPatch(commit)} now={NOW} onOpenFull={() => setFullView(commit.id)} />
        ) : null}
      </div>
    </>
  )
}

export { GitMasterDemo }
export type { GitMasterDemoProps }
