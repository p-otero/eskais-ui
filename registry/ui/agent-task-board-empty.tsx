import type { AgentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"

type AgentTaskBoardEmptyProps = {
  labels: AgentTaskBoardLabels
  /** True when tasks exist but none match the filters. */
  filtered: boolean
  onClear: () => void
}

function AgentTaskBoardEmpty({ labels, filtered, onClear }: AgentTaskBoardEmptyProps) {
  return (
    <Empty data-slot="agent-task-board-empty">
      <EmptyHeader>
        <EmptyDescription>{filtered ? labels.empty.filtered : labels.empty.board}</EmptyDescription>
      </EmptyHeader>
      {filtered && (
        <Button variant="outline" onClick={onClear}>
          {labels.filters.clear}
        </Button>
      )}
    </Empty>
  )
}

export { AgentTaskBoardEmpty }
