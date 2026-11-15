import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { effectiveAgent, type AgentRef, type AttemptView, type Liveness } from "@/lib/agent-task-types"
import { AgentBadge, agentBadgeLabelsEs } from "@/components/ui/agent-badge"
import type { StatusTone } from "@/components/ui/status-pill"
import { LivenessIndicator, livenessLabels, livenessLabelsEs, livenessTones } from "@/components/ui/liveness-indicator"
import { AttemptStatusPill, ContextModePill, TaskStatusPill } from "@/components/ui/task-status"

import { axeViolations } from "./axe"
import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

const agent = createAgent()

const attempts = sampleTasks.flatMap((task) => task.attempts)
const attempt = (id: string) => attempts.find((item) => item.id === id) as AttemptView
const fallback = attempt("T-014-A2")
const longModel = "openai-codex/gpt-6.1-terra-preview-2026-11"
const badge = () => document.querySelector<HTMLElement>("[data-slot=agent-badge]")!

test("compact badge shows the last segment of a long model id and keeps it whole in title", () => {
  render(<AgentBadge agent={effectiveAgent(fallback)} />)
  const model = badge().querySelector<HTMLElement>("[data-slot=agent-badge-model]")!
  expect(model.textContent).toBe(longModel.slice(longModel.lastIndexOf("/") + 1))
  expect(model.className).toContain("truncate")
  expect(badge().querySelector("[data-slot=agent-badge-provider]")).toBeNull()
  expect(badge().className).toContain("whitespace-nowrap")
  expect(badge().title).toBe(`codex · ${longModel} · reasoningEffort: high`)
  expect(badge().querySelector("[data-slot=agent-badge-effort]")?.textContent).toBe("high")
  expect(badge().getAttribute("tabindex")).toBeNull()
})

test("compact badge prefers the agent's label", () => {
  render(<AgentBadge agent={{ ...effectiveAgent(fallback), label: "Terra" }} />)
  expect(badge().querySelector("[data-slot=agent-badge-model]")?.textContent).toBe("Terra")
})

test("detail badge shows the whole model id and the effort with its provider's name", () => {
  render(<AgentBadge variant="detail" agent={{ ...effectiveAgent(fallback), environment: "vps" }} />)
  expect(badge().querySelector("[data-slot=agent-badge-model]")?.textContent).toBe(longModel)
  expect(screen.getByText("reasoningEffort: high")).toBeDefined()
  expect(screen.getByText("@vps")).toBeDefined()
  expect(badge().hasAttribute("title")).toBe(false)
})

test("effort names can be renamed or hidden", () => {
  const pi = attempt("T-014-A1").configured
  const { rerender } = render(<AgentBadge agent={pi} variant="detail" labels={agentBadgeLabelsEs} />)
  expect(screen.getByText("pensamiento: high")).toBeDefined()
  rerender(<AgentBadge agent={pi} showEffortName labels={{ effortNames: { thinking: "Thinking" } }} />)
  expect(screen.getByText("Thinking: high")).toBeDefined()
  rerender(<AgentBadge agent={pi} variant="detail" showEffortName={false} />)
  expect(screen.getByText("high")).toBeDefined()
  rerender(<AgentBadge agent={{ provider: "local", model: "llama" }} />)
  expect(badge().querySelector("[data-slot=agent-badge-effort]")).toBeNull()
})

test("an executed agent that differs from the requested one is marked, with screen reader text", () => {
  const { rerender } = render(<AgentBadge agent={effectiveAgent(fallback)} requested={fallback.configured} />)
  expect(badge().hasAttribute("data-differs")).toBe(true)
  expect(screen.getByText("Not the requested agent.").className).toContain("sr-only")
  expect(badge().querySelector("[data-slot=agent-badge-requested]")?.textContent).toBe("requested zai/glm-5.3")
  expect(badge().title).toContain("— requested pi · zai/glm-5.3 · thinking: high")

  rerender(
    <AgentBadge
      variant="detail"
      agent={effectiveAgent(fallback)}
      requested={fallback.configured}
      labels={agentBadgeLabelsEs}
    />,
  )
  expect(screen.getByText("No es el agente pedido.")).toBeDefined()
  expect(screen.getByText("pedido pi · zai/glm-5.3 · pensamiento: high")).toBeDefined()

  const claude = attempt("T-015-A1").configured
  rerender(<AgentBadge agent={claude} requested={{ ...claude, effort: { name: "effort", value: "high" } }} />)
  expect(screen.getByText("requested high")).toBeDefined()

  rerender(<AgentBadge agent={claude} requested={{ ...claude, label: "Another label" }} />)
  expect(badge().hasAttribute("data-differs")).toBe(false)
  expect(badge().querySelector("[data-slot=agent-badge-requested]")).toBeNull()
})

const livenessCases: [Liveness, StatusTone, string | undefined, string | undefined][] = [
  ["running", "info", "2026-11-15T18:40:00Z", "2 minutes ago"],
  ["idle", "muted", "2026-11-15T18:12:00Z", "30 minutes ago"],
  ["waiting_input", "warning", "2026-11-15T18:41:00Z", "1 minute ago"],
  ["suspect_dead", "destructive", attempt("T-015-A1").lastActivityAt, "47 minutes ago"],
  ["finished", "neutral", undefined, undefined],
]

test.each(livenessCases)("liveness %s is %s and shows the time since the last activity", (liveness, tone, at, ago) => {
  render(<LivenessIndicator liveness={liveness} lastActivityAt={at} now={GENERATED_AT} locale="en-US" />)
  const root = document.querySelector<HTMLElement>("[data-slot=liveness]")!
  const pill = root.querySelector<HTMLElement>("[data-slot=status-pill]")!
  expect(root.dataset.liveness).toBe(liveness)
  expect(pill.textContent).toBe(livenessLabels[liveness])
  expect(pill.dataset.tone).toBe(tone)
  expect(livenessTones[liveness]).toBe(tone)
  expect(pill.hasAttribute("data-pulse")).toBe(liveness === "running")
  const activity = root.querySelector("[data-slot=liveness-activity]")
  expect(activity?.textContent ?? undefined).toBe(ago && `last activity ${ago}`)
  expect(activity?.querySelector("time")?.getAttribute("datetime") ?? undefined).toBe(at && new Date(at).toISOString())
})

test("liveness passes locale and time zone to the time, and never reads the clock when now is given", () => {
  render(
    <LivenessIndicator
      liveness="suspect_dead"
      lastActivityAt="2026-11-15T17:55:00Z"
      now={GENERATED_AT}
      locale="es-ES"
      timeZone="Asia/Tokyo"
      labels={livenessLabelsEs}
    />,
  )
  expect(screen.getByText("Posiblemente colgado")).toBeDefined()
  const time = document.querySelector("time")!
  expect(time.textContent).toBe("hace 47 minutos")
  expect(time.getAttribute("title")).toMatch(/16 nov 2026/)
  expect(time.getAttribute("title")).toMatch(/GMT\+9|JST/)
})

test("no axe violations and nothing for agents to operate", async () => {
  const task = sampleTasks.find((item) => item.id === "T-014")!
  const { container } = render(
    <main>
      <h1>{task.title}</h1>
      <TaskStatusPill status={task.status} />
      <AttemptStatusPill status={fallback.status} />
      <ContextModePill mode="fork" sourceThread={fallback.sourceThread} />
      <AgentBadge agent={effectiveAgent(fallback)} requested={fallback.configured} />
      <AgentBadge variant="detail" agent={effectiveAgent(fallback)} requested={fallback.configured} />
      <LivenessIndicator liveness="running" lastActivityAt={fallback.lastActivityAt} now={GENERATED_AT} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  expect(agent.snapshot().filter((entry) => !entry.offPage)).toEqual([])
  expect(container.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0)
})

test("badges of every fixture agent render one line in compact", () => {
  const refs = new Map<string, AgentRef>(attempts.map((item) => [effectiveAgent(item).model, effectiveAgent(item)]))
  render(
    <>
      {[...refs.values()].map((ref) => (
        <AgentBadge key={ref.model} agent={ref} />
      ))}
    </>,
  )
  const all = document.querySelectorAll<HTMLElement>("[data-slot=agent-badge]")
  expect(all).toHaveLength(refs.size)
  for (const item of all) expect(item.dataset.variant).toBe("compact")
})
