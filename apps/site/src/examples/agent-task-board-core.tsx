import { Stat, StatGroup, StatLabel, StatValue } from "@/components/ui/stat"
import { filterTasks, summarize } from "@/lib/agent-task-board-model"

import { sampleTasks } from "./fixtures"

const usd = (value: number) => `$${value.toFixed(2)}`

export default function AgentTaskBoardCoreDemo() {
  const search = filterTasks(sampleTasks, { query: "docs" })
  const summary = summarize(sampleTasks)
  return (
    <div className="flex w-full max-w-xl flex-col gap-group">
      <StatGroup aria-label="Board summary">
        <Stat>
          <StatLabel>Tasks</StatLabel>
          <StatValue value={summary.total} />
        </Stat>
        <Stat>
          <StatLabel>Need a decision</StatLabel>
          <StatValue value={summary.awaitingDecision} />
        </Stat>
        <Stat>
          <StatLabel>Cost</StatLabel>
          <StatValue value={summary.cost} format={usd} />
        </Stat>
      </StatGroup>
      <p className="text-body-sm text-muted-foreground">
        {summary.byStatus.blocked} blocked. filterTasks with the query "docs" finds{" "}
        {search.map((task) => task.id).join(", ") || "nothing"}.
      </p>
    </div>
  )
}
