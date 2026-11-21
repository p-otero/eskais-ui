import type { ComponentType } from "react"

import { GitWorkspaceFrame } from "./frame"
import { GitCommitDemo } from "./git-commit"
import { GitMasterDemo } from "./git-master"
import { GitTabDemo } from "./git-tab"
import type { GitWorkspaceDemoName } from "./names"

/** The git views of the reference frames, one per ?demo= page. */
const gitWorkspaceDemos: Record<GitWorkspaceDemoName, ComponentType> = {
  "git-master": () => <GitMasterDemo initialRepo="api" />,
  "git-worktree": () => <GitMasterDemo initialRepo="app" worktreeLayout="toggle" />,
  "git-worktree-groups": () => <GitMasterDemo initialRepo="app" worktreeLayout="groups" />,
  "git-wide": () => <GitMasterDemo initialRepo="api" wide />,
  "git-tab": () => <GitTabDemo />,
  "git-tab-repos": () => <GitTabDemo repositoryMenuOpen />,
  "git-commit": () => <GitCommitDemo />,
}

function GitWorkspaceDemo({ name }: { name: GitWorkspaceDemoName }) {
  const Demo = gitWorkspaceDemos[name]
  return (
    <main>
      <GitWorkspaceFrame>
        <Demo />
      </GitWorkspaceFrame>
    </main>
  )
}

export { GitWorkspaceDemo }
