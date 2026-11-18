import { useState } from "react"

import { Button } from "@/components/ui/button"
import { CommitHistory } from "@/components/ui/commit-history"
import { useNow } from "@/components/ui/use-now"
import type { Commit } from "@/lib/commit-graph"

import { pendingCommit, trailCommits } from "./git-fixtures"

const NOW = Date.now()
const trail = trailCommits(NOW)

export default function CommitHistoryDemo() {
  const now = useNow()
  const [commits, setCommits] = useState<Commit[]>(() => [pendingCommit(NOW, trail[0]?.id ?? ""), ...trail])
  const [branch, setBranch] = useState("main")
  const pending = commits[0]?.status === "pending"
  return (
    <div className="flex w-full max-w-xl flex-col gap-items">
      <CommitHistory
        aria-label="Commits on main"
        commits={commits}
        now={now}
        branch={branch}
        branches={["main", "invoice-pdf", "tax-rates"]}
        onBranchChange={setBranch}
      />
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          setCommits(
            pending
              ? ([first, ...rest]) => [
                  { ...(first as Commit), status: "done", date: Date.now(), tags: [{ label: "Fix", tone: "warning" }] },
                  ...rest,
                ]
              : [pendingCommit(Date.now(), trail[0]?.id ?? ""), ...trail],
          )
        }
      >
        {pending ? "Finish the commit" : "Start again"}
      </Button>
    </div>
  )
}
