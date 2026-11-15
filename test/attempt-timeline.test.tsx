import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import type { AgentRef, TaskView } from "@/lib/agent-task-types"
import { AttemptTimeline, type AttemptTimelineProps } from "@/components/ui/attempt-timeline"
import { attemptTimelineLabelsEs } from "@/components/ui/attempt-timeline-labels"

import { axeViolations } from "./axe"
import { GENERATED_AT, generateTasks, sampleTasks } from "./fixtures/agent-tasks"

const agent = createAgent()
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function task(predicate: (task: TaskView) => boolean, tasks = sampleTasks) {
  const found = tasks.find(predicate)
  if (!found) throw new Error("No task matches")
  return found
}

const indexDocs = task((item) => item.id === "T-014")
const longTask = task((item) => item.attempts.length === 30, generateTasks(200, 30))

function Attempts(props: Partial<AttemptTimelineProps>) {
  return <AttemptTimeline attempts={indexDocs.attempts} now={GENERATED_AT} locale="en-US" timeZone="UTC" {...props} />
}

function event(name: RegExp) {
  return screen.getByRole("listitem", { name })
}

test("T-014 shows the fallback route, fork context, repair link, blocker and checks", async () => {
  const user = userEvent.setup()
  render(<Attempts onOpenThread={() => {}} />)
  await tick()

  const timeline = screen.getByRole("list", { name: "Attempts" })
  expect(within(timeline).getAllByRole("listitem", { name: /^A\d/ })).toHaveLength(2)

  const first = event(/^A1 · Implementation/)
  expect(first.textContent).toContain("Failed")
  const checks = within(first).getByRole("list", { name: "Checks" })
  expect(checks.textContent).toBe("testsFailed3 failing")
  const blocker = first.querySelector<HTMLElement>('[data-slot="attempt-blocker"]')
  expect(blocker?.textContent).toContain("Blocked: quota")
  expect(blocker?.textContent).toContain("Provider quota exhausted")
  expect(blocker?.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-15T21:30:00.000Z")
  expect(blocker?.querySelector("time")?.textContent).toContain("9:30 PM")
  expect(within(first).getByText("2 hours ago").getAttribute("title")).toContain("4:20 PM")

  const second = event(/^A2 · Implementation/)
  expect(second.getAttribute("aria-current")).toBe("step")
  const route = second.querySelector<HTMLElement>('[data-slot="attempt-route"]')
  expect(route?.textContent).toMatch(/zai\/glm-5\.3.*ran as.*openai-codex\/gpt-6\.1-terra-preview-2026-11/)
  expect(second.querySelector('[data-slot="attempt-context"]')?.textContent).toBe(
    "Forked context from Index docs, first try",
  )
  expect(within(second).getByRole("button", { name: "Open origin Index docs, first try" })).toBeTruthy()
  expect(second.querySelector('[data-slot="attempt-repair"]')?.textContent).toBe("Repairs A1")
  expect(second.textContent).toContain("Fallback after quota")

  await user.click(within(second).getByRole("button", { name: "1 earlier route for A2" }))
  const routes = await screen.findByRole("dialog", { name: "Earlier routes" })
  expect(routes.textContent).toContain("zai/glm-5.3")
  expect(routes.textContent).toContain("Quota exhausted")

  expect(screen.getByRole("table", { name: "A1 tokens and cost" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Usage for A2" }).getAttribute("aria-expanded")).toBe("true")
})

test("attempts render in chronological order whatever order they arrive in", () => {
  render(<Attempts attempts={indexDocs.attempts.toReversed()} />)
  const titles = [...document.querySelectorAll('[data-slot="timeline-title"]')].map((title) => title.textContent)
  expect(titles).toEqual(["A1 · Implementation", "A2 · Implementation"])
})

test("30 attempts collapse the older ones and the usage tables, and render fast", async () => {
  const user = userEvent.setup()
  const start = performance.now()
  render(<AttemptTimeline attempts={longTask.attempts} now={GENERATED_AT} locale="en-US" />)
  const firstRender = performance.now() - start
  await tick()

  const timeline = screen.getByRole("list", { name: "Attempts" })
  expect(within(timeline).getAllByRole("listitem")).toHaveLength(5)
  expect(screen.queryByRole("table")).toBeNull()
  expect(screen.getByRole("button", { name: "Usage for A30" }).getAttribute("aria-expanded")).toBe("false")

  const expandStart = performance.now()
  await user.click(screen.getByRole("button", { name: "Show 25 earlier attempts" }))
  const expand = performance.now() - expandStart
  expect(within(timeline).getAllByRole("listitem")).toHaveLength(30)
  expect(screen.getByRole("button", { name: "Hide 25 earlier attempts" }).getAttribute("aria-expanded")).toBe("true")

  console.info(`30 attempts: first render ${firstRender.toFixed(0)} ms, expand ${expand.toFixed(0)} ms`)
  expect(firstRender).toBeLessThan(1000)
  expect(expand).toBeLessThan(1000)
})

test("arrow keys move between attempts, and through the earlier ones once shown", async () => {
  const user = userEvent.setup()
  render(<AttemptTimeline attempts={longTask.attempts} now={GENERATED_AT} visibleAttempts={2} />)
  await tick()

  await user.tab()
  expect(document.activeElement?.textContent).toMatch(/^Show 28 earlier attempts/)
  await user.keyboard("{Enter}")
  await user.tab()
  expect(document.activeElement).toBe(event(/^A1 · /))
  await user.keyboard("{ArrowDown}")
  expect(document.activeElement).toBe(event(/^A2 · /))
  await user.keyboard("{End}")
  expect(document.activeElement).toBe(event(/^A30 · /))
  await user.keyboard("{ArrowUp}")
  expect(document.activeElement).toBe(event(/^A29 · /))
  await user.keyboard("{Home}")
  expect(document.activeElement).toBe(event(/^A1 · /))
})

test("the active attempt holds the timeline's tab stop", async () => {
  const user = userEvent.setup()
  render(<Attempts />)
  await tick()
  expect(event(/^A1 · /).tabIndex).toBe(-1)
  expect(event(/^A2 · /).tabIndex).toBe(0)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Usage for A1" }))
  await user.tab()
  expect(document.activeElement).toBe(event(/^A2 · /))
  await user.keyboard("{ArrowUp}")
  expect(document.activeElement).toBe(event(/^A1 · /))
})

test("onOpenThread makes each thread a button; renderThreadLink replaces it; neither leaves text", async () => {
  const user = userEvent.setup()
  const onOpenThread = vi.fn()
  const { unmount } = render(<Attempts onOpenThread={onOpenThread} />)
  await user.click(screen.getByRole("button", { name: "Open thread th-2" }))
  expect(onOpenThread).toHaveBeenCalledWith({ id: "th-2", href: "t3-thread://th-2" })
  unmount()

  const linked = render(
    <Attempts renderThreadLink={(thread) => <a href={thread.href}>{thread.title ?? thread.id}</a>} />,
  )
  expect(screen.getByRole("link", { name: "th-2" }).getAttribute("href")).toBe("t3-thread://th-2")
  expect(screen.queryByRole("button", { name: /Open thread/ })).toBeNull()
  linked.unmount()

  render(<Attempts />)
  expect(screen.queryByRole("button", { name: /Open thread|Open origin/ })).toBeNull()
  expect(screen.getByText("th-2")).toBeTruthy()
})

test("status and agents render through their render props", () => {
  const renderAgent = vi.fn((ref: AgentRef, requested: boolean) => (
    <span data-testid="agent">{`${requested ? "asked" : "ran"} ${ref.provider}`}</span>
  ))
  render(
    <Attempts renderStatus={(attempt) => <b data-testid="status">{attempt.status}</b>} renderAgent={renderAgent} />,
  )
  expect(screen.getAllByTestId("status").map((node) => node.textContent)).toEqual(["failed", "active"])
  expect(screen.getAllByTestId("agent").map((node) => node.textContent)).toEqual(["ran pi", "asked pi", "ran codex"])
})

test("labels translate the whole timeline", () => {
  render(
    <AttemptTimeline attempts={longTask.attempts} now={GENERATED_AT} locale="es-ES" labels={attemptTimelineLabelsEs} />,
  )
  expect(screen.getByRole("list", { name: "Intentos" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Mostrar 25 intentos anteriores" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Consumo de A30" })).toBeTruthy()
})

test("has no axe violations, with the earlier attempts and a route popover open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <>
      <Attempts onOpenThread={() => {}} />
      <AttemptTimeline aria-label="Long task" attempts={longTask.attempts} now={GENERATED_AT} onOpenThread={() => {}} />
    </>,
  )
  await tick()
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Show 25 earlier attempts" }))
  await user.click(screen.getByRole("button", { name: "1 earlier route for A2" }))
  expect(await axeViolations(container)).toEqual([])
  expect(await axeViolations(await screen.findByRole("dialog"))).toEqual([])
})

test("an agent opens a thread and shows the earlier attempts by name", async () => {
  const onOpenThread = vi.fn()
  render(
    <>
      <Attempts onOpenThread={onOpenThread} />
      <AttemptTimeline aria-label="Long task" attempts={longTask.attempts} now={GENERATED_AT} />
    </>,
  )
  await tick()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  for (const label of [
    "Open thread th-2",
    "Open origin Index docs, first try",
    "Show 25 earlier attempts",
    "Usage for A1",
  ])
    expect(labels).toContain(label)

  const result = await agent.act({
    steps: [
      { ref: "Open thread th-2", action: "press" },
      { ref: "Show 25 earlier attempts", action: "setOpen", args: [true] },
      { ref: "1 earlier route for A2", action: "setOpen", args: [true] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await tick()
  expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: "th-2" }))
  expect(within(screen.getByRole("list", { name: "Long task" })).getAllByRole("listitem")).toHaveLength(30)
  expect(screen.getByRole("dialog", { name: "Earlier routes" })).toBeTruthy()
})
