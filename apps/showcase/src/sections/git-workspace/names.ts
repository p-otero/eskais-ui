const gitWorkspaceDemoNames = [
  "git-master",
  "git-worktree",
  "git-worktree-groups",
  "git-wide",
  "git-tab",
  "git-tab-repos",
  "git-commit",
] as const

type GitWorkspaceDemoName = (typeof gitWorkspaceDemoNames)[number]

export { gitWorkspaceDemoNames }
export type { GitWorkspaceDemoName }
