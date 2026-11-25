import { lazy, Suspense, type ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import { A, Article, Code, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const GitMaster = lazy(() => import("./git-views/git-master"))
const GitWorktree = lazy(() => import("./git-views/git-worktree"))
const GitTab = lazy(() => import("./git-views/git-tab"))
const GitCommit = lazy(() => import("./git-views/git-commit"))

const masterCode = `const [selected, setSelected] = useState<string | null>(dirty ? WORKING_TREE : head.id)

<div className="flex h-[50rem] gap-group">
  <CommitHistory
    aria-label={\`History of \${repo.path}\`}
    className="w-2/5 min-w-136 shrink-0"
    commits={commits}
    branch={branch}
    branches={branchNames}
    onBranchChange={setBranch}
    headerStart={
      <RepositorySelect aria-label="Repository" size="sm" repositories={repositories} value={repo.id} onValueChange={setRepo} />
    }
    workingTree={dirty ? { staged: 2, unstaged: 3 } : undefined}
    upstreamHead={upstreamHead} // git rev-parse @{u}: the commits above it are marked "not pushed"
    selected={selected}
    onSelect={setSelected}
  />
  {selected === WORKING_TREE ? <WorkingTreePane /> : <CommitPane commit={commitById(selected)} />}
</div>`

const worktreeCode = `// One group at a time, behind a read-only Staged/Unstaged toggle
<GitDiff aria-label="Staged changes" patch={staged} fileTree="collapsible" />

// Or both, as sections of the file tree, each header naming its group
<GitDiff
  aria-label="Uncommitted changes"
  groups={[
    { label: "Staged", patch: staged },   // git diff --cached
    { label: "Unstaged", patch: unstaged }, // git diff
  ]}
/>`

const commitCode = `const [current, setCurrent] = useState<string | null>(null)

<GitTree aria-label="Files at 9be07d2" files={filesAtCommit} current={current} onOpenFile={setCurrent} />
<GitDiff
  aria-label="Changes in 9be07d2"
  patch={patch}
  fileTree={false}
  currentFile={current}          // setting it scrolls the diff to that file
  onCurrentFileChange={setCurrent} // the tree follows the diff as it scrolls
/>`

const dialogCode = `<Collapsible>
  <CollapsibleTrigger>Changes</CollapsibleTrigger>
  <CollapsiblePanel>
    <GitDiff aria-label="Changes against main" patch={patch} height="auto" />
  </CollapsiblePanel>
</Collapsible>`

function Wide({ children, tall = false }: { children: ReactNode; tall?: boolean }) {
  return (
    <div className="relative w-full max-w-full min-w-0 overflow-x-auto rounded-surface border">
      <div className="min-w-288">
        <Suspense fallback={<Skeleton className={tall ? "h-320 w-full" : "h-240 w-full"} />}>{children}</Suspense>
      </div>
    </div>
  )
}

export default function GitViews() {
  return (
    <Article>
      <DocTitle
        eyebrow="Guides"
        title="Git views"
        description="A repository's history beside the selected commit, the working tree's staged and unstaged changes, a repository picker and a commit view, from CommitHistory, GitDiff, GitTree and RepositorySelect."
      />

      <H2 id="master-detail">History beside the commit</H2>
      <P>
        <A to="/docs/components/commit-history">CommitHistory</A> takes about 40% of the width (at least 34rem) and
        keeps the selected commit with <Code>selected</Code> and <Code>onSelect</Code>: a press, Enter or Space selects
        a row, which carries <Code>aria-selected</Code> and the current-page look, and a press on the selected row opens
        its details. HEAD is selected at first. <Code>headerStart</Code> puts a{" "}
        <A to="/docs/components/repository-select">RepositorySelect</A> before the branch switcher, and{" "}
        <Code>upstreamHead</Code> marks the commits that aren't pushed. The pane beside it is a header and a{" "}
        <A to="/docs/components/git-diff">GitDiff</A> with a collapsible file tree, 13rem wide.
      </P>
      <Wide>
        <GitMaster />
      </Wide>
      <Pre code={masterCode} title="git-view.tsx" />

      <H2 id="working-tree">Uncommitted changes</H2>
      <P>
        On a dirty checkout, <Code>workingTree</Code> adds an "Uncommitted changes" row above the newest commit, with a
        hollow dashed node and the staged and unstaged counts. It shares the history's focus and selection as{" "}
        <Code>WORKING_TREE</Code>, so it can start selected. The pane shows the staged and unstaged changes read-only,
        one at a time behind a toggle, or both in one diff with <Code>groups</Code>: the file tree gets a section per
        group, each file header names its group, and a file staged and then edited again shows in each.
      </P>
      <Wide>
        <GitWorktree />
      </Wide>
      <Pre code={worktreeCode} title="working-tree.tsx" />

      <H2 id="git-tab">Repository and branch</H2>
      <P>
        One history across the page, with the repository and branch in a toolbar above it. Each repository shows its
        path, its branch and its state; the branch select is a plain <A to="/docs/components/select">Select</A>{" "}
        composition with ahead and behind counts.
      </P>
      <Wide>
        <GitTab />
      </Wide>

      <H2 id="commit-view">A commit's files</H2>
      <P>
        The commit view replaces the history, like a route. A <A to="/docs/components/git-tree">GitTree</A> of every
        file at the commit drives the diff through <Code>currentFile</Code> and follows it through{" "}
        <Code>onCurrentFileChange</Code>; <Code>createDiffViewController()</Code>, exported from <Code>git-diff</Code>,
        does the same from code.
      </P>
      <Wide tall>
        <GitCommit />
      </Wide>
      <Pre code={commitCode} title="commit-view.tsx" />

      <H2 id="dialog">Changes in a scrolling dialog</H2>
      <Ul>
        <li>
          <Code>height="auto"</Code> grows to the whole diff with no scroller of its own: the dialog body is the one
          scroller, and the diff still renders only the lines in view, reads find in page and moves the body with j/k.
          The file tree beside it stays in view, up to 40rem tall.
        </li>
        <li>
          To cap a diff instead, set <Code>--diff-max-height</Code> on it or an ancestor: past it the diff scrolls
          inside, and at its top or bottom the wheel moves the dialog body on. Set the cap below the body's visible
          height, never in viewport units.
        </li>
        <li>In split layout an added or deleted file shows its one side across the whole width.</li>
      </Ul>
      <Pre code={dialogCode} title="task-changes.tsx" />
    </Article>
  )
}
