import {
  agentTaskBoardLabels as baseLabels,
  agentTaskBoardLabelsEs as baseLabelsEs,
  mergeLabels,
  type AgentTaskBoardLabels as BaseLabels,
  type AgentTaskBoardLabelsInput as BaseLabelsInput,
} from "@/lib/agent-task-board-labels"
import type { TaskStatus } from "@/lib/agent-task-types"
import type { AcceptanceCounts, AcceptanceLabels } from "@/components/ui/acceptance-list"
import { agentBadgeLabelsEs, type AgentBadgeLabels } from "@/components/ui/agent-badge"
import { attemptTimelineLabelsEs, type AttemptTimelineLabels } from "@/components/ui/attempt-timeline-labels"
import type { BoardColumnLabels } from "@/components/ui/board-column"
import { livenessLabelsEs, type LivenessLabels } from "@/components/ui/liveness-indicator"
import { taskStatusLabelsEs } from "@/components/ui/task-status"
import { usageLabelsEs, type UsageLabels } from "@/components/ui/usage"

interface AgentTaskComponentLabels {
  agentBadge?: Partial<AgentBadgeLabels>
  liveness?: Partial<LivenessLabels>
  taskStatus?: Partial<Record<TaskStatus, string>>
  acceptance?: Partial<AcceptanceLabels>
  acceptanceSummary?: (counts: AcceptanceCounts) => string
  usage?: Partial<UsageLabels>
  attemptTimeline?: Partial<AttemptTimelineLabels>
  boardColumn?: Partial<BoardColumnLabels>
}

type AgentTaskBoardLabels = Omit<BaseLabels, "components"> & { components: AgentTaskComponentLabels }
type AgentTaskBoardLabelsInput = Omit<BaseLabelsInput, "components"> & { components?: AgentTaskComponentLabels }

const agentTaskBoardLabels: AgentTaskBoardLabels = baseLabels

const agentTaskBoardLabelsEs: AgentTaskBoardLabels = {
  ...baseLabelsEs,
  components: {
    agentBadge: agentBadgeLabelsEs,
    liveness: livenessLabelsEs,
    taskStatus: taskStatusLabelsEs,
    acceptance: { pass: "Superado", fail: "Fallido", unverified: "Sin verificar", bar: "Criterios de aceptación" },
    acceptanceSummary: ({ pass, fail, unverified }) => {
      const summary = `${pass} de ${pass + fail + unverified} superados`
      return fail > 0 ? `${summary}, ${fail} fallidos` : summary
    },
    usage: usageLabelsEs,
    attemptTimeline: attemptTimelineLabelsEs,
    boardColumn: { collapse: (title) => `Contraer ${title}`, expand: (title) => `Expandir ${title}` },
  },
}

function resolveLabels(labels?: AgentTaskBoardLabelsInput): AgentTaskBoardLabels {
  return labels ? (mergeLabels(baseLabels, labels as BaseLabelsInput) as AgentTaskBoardLabels) : agentTaskBoardLabels
}

export { agentTaskBoardLabels, agentTaskBoardLabelsEs, resolveLabels }
export type { AgentTaskBoardLabels, AgentTaskBoardLabelsInput, AgentTaskComponentLabels }
