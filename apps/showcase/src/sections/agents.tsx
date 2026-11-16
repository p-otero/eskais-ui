import { effectiveAgent } from "@/lib/agent-task-types"
import { AgentBadge } from "@/components/ui/agent-badge"
import { LivenessIndicator } from "@/components/ui/liveness-indicator"
import { AttemptStatusPill, ContextModePill, TaskStatusPill } from "@/components/ui/task-status"

import { GENERATED_AT, sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const attempts = sampleTasks.flatMap((task) => task.attempts.map((attempt) => ({ task, attempt })))
const fallback = attempts.find(({ attempt }) => attempt.id === "T-014-A2")?.attempt

function AgentsSection() {
  return (
    <Section
      title="Agent identity and liveness"
      description={`AgentBadge, LivenessIndicator and task, attempt and context pills from the sample board, as of ${GENERATED_AT} UTC.`}
    >
      <div className="flex w-full flex-wrap gap-2">
        {sampleTasks.map((task) => (
          <TaskStatusPill key={task.id} status={task.status} />
        ))}
      </div>
      <ul className="flex w-full flex-col gap-3">
        {attempts.map(({ task, attempt }) => (
          <li key={attempt.id} className="flex flex-col gap-1.5 rounded-surface border p-surface">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{attempt.id}</span>
              <TaskStatusPill status={task.status} />
              <AttemptStatusPill status={attempt.status} />
              {attempt.contextMode && (
                <ContextModePill mode={attempt.contextMode} sourceThread={attempt.sourceThread} />
              )}
            </div>
            <AgentBadge className="max-w-60" agent={effectiveAgent(attempt)} requested={attempt.configured} />
            {attempt.liveness && (
              <LivenessIndicator
                liveness={attempt.liveness}
                lastActivityAt={attempt.lastActivityAt}
                now={GENERATED_AT}
                locale="en-US"
                timeZone="UTC"
              />
            )}
          </li>
        ))}
      </ul>
      {fallback && (
        <div className="flex w-full max-w-md flex-col gap-1.5 rounded-surface border p-surface">
          <p className="text-sm font-medium">Detail: {fallback.id}</p>
          <AgentBadge variant="detail" agent={effectiveAgent(fallback)} requested={fallback.configured} />
          <ContextModePill
            mode="fork"
            sourceThread={fallback.sourceThread}
            renderThreadLink={(thread) => (
              <a className="text-link underline underline-offset-2" href={thread.href ?? `#${thread.id}`}>
                {thread.title ?? thread.id}
              </a>
            )}
          />
        </div>
      )}
    </Section>
  )
}

export { AgentsSection }
