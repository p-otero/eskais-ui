import { ServerCommitHistory } from "@/components/ui/server-commit-history"
import { arraySource } from "@/lib/array-source"
import type { Commit } from "@/lib/commit-graph"

import { generatedCommits } from "./git-fixtures"

const source = arraySource<Commit, { branch: string }>(generatedCommits(5000), {
  key: ["docs", "server-commit-history"],
  delay: 300,
})

export default function ServerCommitHistoryDemo() {
  return (
    <ServerCommitHistory
      aria-label="Commits on main"
      className="h-96 w-full max-w-xl"
      source={source}
      filter={{ branch: "main" }}
      branch="main"
      labels={{ errorTitle: "Couldn't load commits", retry: "Try again", emptyTitle: "No commits yet" }}
    />
  )
}
