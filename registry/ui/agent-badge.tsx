import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import type { AgentRef } from "@/lib/agent-task-types"
import { cn } from "@/lib/utils"

interface AgentBadgeLabels {
  /** Visible marker before the requested agent, as in "requested zai/glm-5.3". */
  requested: string
  /** Screen reader text that explains the marker. */
  differs: string
  /** Display names for effort names, keyed by the provider's name ("reasoningEffort"). */
  effortNames: Record<string, string>
}

const agentBadgeLabels: AgentBadgeLabels = {
  requested: "requested",
  differs: "Not the requested agent.",
  effortNames: {},
}

const agentBadgeLabelsEs: AgentBadgeLabels = {
  requested: "pedido",
  differs: "No es el agente pedido.",
  effortNames: {
    effort: "esfuerzo",
    reasoningEffort: "razonamiento",
    thinking: "pensamiento",
  },
}

/** Same comparison as `agentDiffers`, for two refs instead of an attempt. */
function sameAgent(a: AgentRef, b: AgentRef) {
  return a.provider === b.provider && a.model === b.model && a.effort?.value === b.effort?.value
}

function formatEffort(effort: AgentRef["effort"], showName: boolean, labels: AgentBadgeLabels) {
  if (!effort) return undefined
  if (!showName) return effort.value
  return `${labels.effortNames[effort.name] ?? effort.name}: ${effort.value}`
}

function describeAgent(agent: AgentRef, labels: AgentBadgeLabels) {
  return [agent.provider, agent.model, formatEffort(agent.effort, true, labels)].filter(Boolean).join(" · ")
}

/** The part of `requested` that differs from `agent`, the shortest thing that tells them apart. */
function requestedDifference(agent: AgentRef, requested: AgentRef) {
  if (requested.model !== agent.model) return requested.label ?? requested.model
  if (requested.provider !== agent.provider) return requested.provider
  return requested.effort?.value ?? "—"
}

// Two spans so CSS can cut the start and keep the tail: model ids differ most at their ends.
function MiddleTruncate({ text, tail = 12 }: { text: string; tail?: number }) {
  const split = Math.max(0, text.length - Math.min(tail, Math.floor(text.length / 2)))
  return (
    <span data-slot="agent-badge-model" className="flex min-w-0 font-medium">
      <span className="truncate">{text.slice(0, split)}</span>
      <span className="shrink-0">{text.slice(split)}</span>
    </span>
  )
}

type AgentBadgeProps = Omit<PartProps<"span">, "children"> & {
  /** The agent that ran, or the configured one when nothing ran yet. */
  agent: AgentRef
  /** What was configured; a marker shows when it differs from `agent`. */
  requested?: AgentRef
  variant?: "compact" | "detail"
  /** Show the effort as "name: value". Defaults to true in the detail variant. */
  showEffortName?: boolean
  labels?: Partial<AgentBadgeLabels>
}

function AgentBadge({
  agent,
  requested,
  variant = "compact",
  showEffortName,
  labels: labelOverrides,
  className,
  render,
  ...props
}: AgentBadgeProps) {
  const labels = { ...agentBadgeLabels, ...labelOverrides }
  const detail = variant === "detail"
  const differs = requested !== undefined && !sameAgent(agent, requested)
  const effort = formatEffort(agent.effort, showEffortName ?? detail, labels)
  const requestedInFull = differs ? `${labels.requested} ${describeAgent(requested, labels)}` : undefined
  const marker = differs && !detail ? `${labels.requested} ${requestedDifference(agent, requested)}` : requestedInFull
  const title = [describeAgent(agent, labels), requestedInFull].filter(Boolean).join(" — ")

  return renderElement(
    "span",
    {
      "data-slot": "agent-badge",
      "data-variant": variant,
      "data-differs": differs ? "" : undefined,
      title: detail ? undefined : title,
      className: cn(
        "inline-flex max-w-full min-w-0 items-baseline gap-x-1.5 text-xs text-foreground",
        detail ? "flex-wrap gap-y-0.5" : "whitespace-nowrap",
        className,
      ),
      ...props,
      children: (
        <>
          {differs && <span className="sr-only">{labels.differs}</span>}
          <span data-slot="agent-badge-provider" className="shrink-0 text-muted-foreground">
            {agent.provider}
          </span>
          {detail ? (
            <span data-slot="agent-badge-model" className="font-medium break-all">
              {agent.model}
            </span>
          ) : (
            <MiddleTruncate text={agent.model} />
          )}
          {effort && (
            <span data-slot="agent-badge-effort" className="shrink-0 text-muted-foreground">
              {effort}
            </span>
          )}
          {agent.environment && detail && (
            <span data-slot="agent-badge-environment" className="text-muted-foreground">
              @{agent.environment}
            </span>
          )}
          {marker && (
            <span
              data-slot="agent-badge-requested"
              className={cn("text-warning", detail ? "break-all" : "min-w-0 truncate")}
            >
              {marker}
            </span>
          )}
        </>
      ),
    },
    render,
  )
}

export { AgentBadge, agentBadgeLabels, agentBadgeLabelsEs }
export type { AgentBadgeLabels, AgentBadgeProps }
