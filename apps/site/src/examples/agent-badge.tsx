import { AgentBadge } from "@/components/ui/agent-badge"
import { effectiveAgent } from "@/lib/agent-task-types"

import { sampleTasks } from "./fixtures"

const attempts = sampleTasks.flatMap((task) => task.attempts).slice(0, 3)

export default function AgentBadgeDemo() {
  return (
    <ul className="flex w-full max-w-md flex-col gap-items">
      {attempts.map((attempt) => (
        <li key={attempt.id} className="flex flex-col gap-inline rounded-surface border bg-card p-inset-surface">
          <span className="font-mono text-caption text-muted-foreground">{attempt.id}</span>
          <AgentBadge agent={effectiveAgent(attempt)} requested={attempt.configured} />
        </li>
      ))}
    </ul>
  )
}
