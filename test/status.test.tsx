import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { DependencyChips, type DependencyChip } from "@/components/ui/dependency-chips"
import { StatusPill } from "@/components/ui/status-pill"

import { axeViolations } from "./axe"

const agent = createAgent()

const blockers: DependencyChip[] = [
  { id: "a", label: "Design the schema", tone: "success" },
  { id: "b", label: "Write the migration for every table in the warehouse", tone: "warning" },
  { id: "c", label: "Review access", tone: "destructive" },
  { id: "d", label: "Seed fixtures", tone: "muted" },
  { id: "e", label: "Load test", tone: "info" },
]

const pill = (text: string) => screen.getByText(text).closest<HTMLElement>("[data-slot=status-pill]")!

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("a status pill exposes its tone and draws a decorative dot that pulses only when asked", () => {
  render(
    <>
      <StatusPill tone="success" dot pulse>
        Running
      </StatusPill>
      <StatusPill tone="muted" dot>
        Queued
      </StatusPill>
      <StatusPill>Draft</StatusPill>
    </>,
  )
  const running = pill("Running")
  expect(running.dataset.slot).toBe("status-pill")
  expect(running.dataset.tone).toBe("success")
  expect(running.hasAttribute("data-pulse")).toBe(true)
  expect(running.className).toContain("text-success")
  const dot = running.querySelector<HTMLElement>("[data-slot=status-pill-dot]")!
  expect(dot.getAttribute("aria-hidden")).toBe("true")
  expect(dot.innerHTML).toContain("motion-safe:animate-ping")
  expect(dot.innerHTML).toContain("motion-reduce:hidden")

  const queued = pill("Queued")
  expect(queued.hasAttribute("data-pulse")).toBe(false)
  expect(queued.querySelector("[data-slot=status-pill-dot]")?.innerHTML).not.toContain("animate-ping")
  expect(pill("Draft").dataset.tone).toBe("neutral")
  expect(pill("Draft").querySelector("[data-slot=status-pill-dot]")).toBeNull()
})

test("a pulse pings three times and runs again when the status changes; pulse=always keeps pinging", () => {
  const { rerender } = render(
    <>
      <StatusPill tone="info" dot pulse>
        Syncing
      </StatusPill>
      <StatusPill tone="info" dot pulse="always">
        Live
      </StatusPill>
    </>,
  )
  const ping = () => pill("Syncing").querySelector<HTMLElement>("[data-slot=status-ping]")!
  const first = ping()
  expect(first.style.animationIterationCount).toBe("3")
  expect(pill("Syncing").getAttribute("data-pulse")).toBe("")
  const always = pill("Live").querySelector<HTMLElement>("[data-slot=status-ping]")!
  expect(always.style.animationIterationCount).toBe("")
  expect(pill("Live").getAttribute("data-pulse")).toBe("always")

  rerender(
    <>
      <StatusPill tone="info" dot pulse>
        Syncing
      </StatusPill>
      <StatusPill tone="info" dot pulse="always">
        Live
      </StatusPill>
    </>,
  )
  expect(ping()).toBe(first)
  rerender(
    <>
      <StatusPill tone="warning" dot pulse>
        Syncing
      </StatusPill>
      <StatusPill tone="info" dot pulse="always">
        Live
      </StatusPill>
    </>,
  )
  expect(ping()).not.toBe(first)
  expect(ping().style.animationIterationCount).toBe("3")
})

test("chips without onSelect are plain list items with the full label in title", () => {
  render(<DependencyChips aria-label="Blocked by" items={blockers} />)
  const list = screen.getByRole("list", { name: "Blocked by" })
  expect(within(list).getAllByRole("listitem")).toHaveLength(5)
  expect(within(list).queryAllByRole("button")).toHaveLength(0)
  const long = screen.getByText("Write the migration for every table in the warehouse")
  expect(long.className).toContain("truncate")
  expect(long.parentElement?.getAttribute("title")).toBe("Write the migration for every table in the warehouse")
  expect(long.closest("[data-slot=dependency-chips-item]")?.getAttribute("data-tone")).toBe("warning")
})

test("with onSelect, each chip is a button reachable and pressed by keyboard", async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(<DependencyChips aria-label="Blocked by" items={blockers} onSelect={onSelect} />)
  const buttons = screen.getAllByRole("button")
  expect(buttons).toHaveLength(5)

  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Design the schema" }))
  await user.keyboard("{Enter}")
  expect(onSelect).toHaveBeenLastCalledWith("a")
  await user.tab()
  await user.keyboard(" ")
  expect(onSelect).toHaveBeenLastCalledWith("b")
  expect(document.activeElement?.getAttribute("title")).toBe("Write the migration for every table in the warehouse")
})

test("max collapses the rest into an overflow chip with an overridable label", () => {
  const { rerender } = render(<DependencyChips aria-label="Blocked by" items={blockers} max={2} />)
  const list = screen.getByRole("list", { name: "Blocked by" })
  expect(within(list).getAllByRole("listitem")).toHaveLength(3)
  expect(screen.queryByText("Review access")).toBeNull()
  const more = list.querySelector<HTMLElement>("[data-slot=dependency-chips-more]")!
  expect(more.textContent).toBe("+33 more")
  expect(within(more).getByText("+3").getAttribute("aria-hidden")).toBe("true")
  expect(more.getAttribute("title")).toBe("Review access, Seed fixtures, Load test")

  rerender(
    <DependencyChips aria-label="Bloqueado por" items={blockers} max={4} formatMore={(count) => `${count} más`} />,
  )
  expect(screen.getByText("1 más").className).toContain("sr-only")

  rerender(<DependencyChips aria-label="Blocked by" items={blockers} max={5} />)
  expect(document.querySelector("[data-slot=dependency-chips-more]")).toBeNull()
})

test("an empty list renders nothing unless an empty node is given", () => {
  const { container, rerender } = render(<DependencyChips aria-label="Blocked by" items={[]} />)
  expect(container.innerHTML).toBe("")
  rerender(<DependencyChips aria-label="Blocked by" items={[]} empty={<p>No blockers</p>} />)
  expect(screen.getByText("No blockers")).toBeTruthy()
  expect(screen.queryByRole("list")).toBeNull()
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <h1 id="deps">Dependencies</h1>
      <StatusPill tone="info" dot pulse>
        Running
      </StatusPill>
      <DependencyChips aria-labelledby="deps" items={blockers} onSelect={() => {}} max={3} />
      <DependencyChips aria-label="Unblocks" items={blockers} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent can find every chip and press one", async () => {
  const onSelect = vi.fn()
  render(<DependencyChips aria-label="Blocked by" items={blockers} onSelect={onSelect} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  for (const item of blockers) {
    expect(labels, `${item.label} is missing from the snapshot`).toContain(item.label)
  }

  const result = await act(() => agent.act({ steps: [{ ref: "Review access", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onSelect).toHaveBeenCalledWith("c")
})
