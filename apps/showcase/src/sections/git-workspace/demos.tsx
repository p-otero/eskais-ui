import { GitWorkspaceFrame } from "./frame"
import { GitCommitDemo } from "./git-commit"
import { GitMasterDemo } from "./git-master"
import { GitTabDemo } from "./git-tab"

/** The git views of the reference frames, one per ?demo= page. */
const gitWorkspaceDemos = {
  "git-master": () => <GitMasterDemo initialRepo="api" />,
  "git-worktree": () => <GitMasterDemo initialRepo="app" worktreeLayout="toggle" />,
  "git-worktree-groups": () => <GitMasterDemo initialRepo="app" worktreeLayout="groups" />,
  "git-wide": () => <GitMasterDemo initialRepo="api" wide />,
  "git-tab": () => <GitTabDemo />,
  "git-tab-repos": () => <GitTabDemo repositoryMenuOpen />,
  "git-commit": () => <GitCommitDemo />,
} as const

type GitWorkspaceDemoName = keyof typeof gitWorkspaceDemos

const isGitWorkspaceDemo = (name: string | null): name is GitWorkspaceDemoName =>
  name !== null && name in gitWorkspaceDemos

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

export { GitWorkspaceDemo, gitWorkspaceDemos, isGitWorkspaceDemo }
export type { GitWorkspaceDemoName }
