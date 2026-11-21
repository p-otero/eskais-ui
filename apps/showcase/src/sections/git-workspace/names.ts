/** The ?demo= pages of the git views, apart from their demos so the showcase's router can name them without loading them. */
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
