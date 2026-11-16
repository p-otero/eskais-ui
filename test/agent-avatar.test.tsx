import { act, render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import type { AgentRef } from "@/lib/agent-task-types"
import { AgentAvatar, agentAvatarTint, agentInitials, type AgentAvatars } from "@/components/ui/agent-avatar"
import { AgentBadge } from "@/components/ui/agent-badge"
import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { TaskCard } from "@/components/ui/task-card"
import { TaskStatusIcon } from "@/components/ui/task-status"

import { axeViolations } from "./axe"
import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

const codex: AgentRef = { provider: "codex", model: "gpt-6.1" }
const avatar = (root: ParentNode = document) => root.querySelector<HTMLElement>("[data-agent-avatar]")!

test.each([
  ["claudeAgent", "CA"],
  ["codex", "Co"],
  ["pi", "Pi"],
  ["open-ai", "OA"],
  ["Gemini CLI", "GC"],
  ["", "?"],
])("initials of %s are %s", (name, expected) => {
  expect(agentInitials(name)).toBe(expected)
})

test("a provider always gets the same color, and the initials sit on it", () => {
  expect(agentAvatarTint("codex")).toBe(agentAvatarTint("codex"))
  expect(new Set(["codex", "claudeAgent", "pi", "opencode", "gemini"].map(agentAvatarTint)).size).toBe(5)
  for (const provider of ["codex", "claudeAgent", "pi", "opencode", "gemini"]) {
    expect(agentAvatarTint(provider)).toBeGreaterThanOrEqual(0)
    expect(agentAvatarTint(provider)).toBeLessThan(8)
  }
  render(<AgentAvatar agent={codex} />)
  const fallback = avatar().querySelector<HTMLElement>("[data-tint]")!
  expect(fallback.dataset.tint).toBe(String(agentAvatarTint("codex")))
  expect(fallback.className).toContain("text-foreground")
  expect(fallback.textContent).toBe("Co")
})

test("beside visible text the avatar is decorative; alone it carries the name", () => {
  const { rerender } = render(<AgentAvatar agent={codex} />)
  expect(avatar().getAttribute("aria-hidden")).toBe("true")
  expect(avatar().getAttribute("role")).toBeNull()
  rerender(<AgentAvatar agent={codex} label="codex · gpt-6.1" />)
  expect(screen.getByRole("img", { name: "codex · gpt-6.1" })).toBe(avatar())
})

test("agentAvatars supply an image, an icon or a name per provider, and AgentRef.avatar wins", () => {
  const avatars: AgentAvatars = {
    codex: { src: "data:image/png;base64,AAAA" },
    claudeAgent: { icon: <svg data-testid="claude-icon" /> },
    pi: { label: "Inflection Pi" },
  }
  const { rerender } = render(<AgentAvatar agent={codex} avatars={avatars} />)
  expect(avatar().querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA")
  expect(avatar().querySelector("img")?.getAttribute("alt")).toBe("")

  rerender(<AgentAvatar agent={{ ...codex, avatar: { src: "data:image/png;base64,BBBB" } }} avatars={avatars} />)
  expect(avatar().querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,BBBB")

  rerender(<AgentAvatar agent={{ provider: "claudeAgent", model: "opus" }} avatars={avatars} />)
  expect(within(avatar()).getByTestId("claude-icon")).toBeTruthy()

  rerender(<AgentAvatar agent={{ provider: "pi", model: "glm" }} avatars={avatars} />)
  expect(avatar().textContent).toBe("IP")
})

test("the board threads agentAvatars to cards, the table and attempt routes", () => {
  const avatars: AgentAvatars = { codex: { label: "Open Codex" } }
  const board = { tasks: sampleTasks, mode: "snapshot", generatedAt: GENERATED_AT, agentAvatars: avatars } as const
  const { unmount } = render(<AgentTaskBoard {...board} defaultSelectedTaskId="T-014" />)
  const card = document.querySelector<HTMLElement>('[data-slot="task-card"][data-task-id="T-014"]')!
  expect(avatar(card).textContent).toBe("OC")
  expect(avatar(card).getAttribute("role")).toBe("img")
  expect(avatar(card).getAttribute("aria-label")).toMatch(/^codex · openai-codex\/gpt-6.1-terra-preview-2026-11/)
  const routes = [...document.querySelectorAll<HTMLElement>('[data-slot="attempt-route"]')]
  expect(
    routes.flatMap((route) => [...route.querySelectorAll("[data-agent-avatar]")].map((item) => item.textContent)),
  ).toContain("OC")
  unmount()

  render(<AgentTaskBoard {...board} defaultView="table" />)
  const row = document.querySelector<HTMLElement>('tr[data-task-id="T-014"]')!
  expect(avatar(row).textContent).toBe("OC")
  expect(avatar(row).getAttribute("aria-hidden")).toBe("true")
})

test("a card with no agent shows a decorative placeholder and a named status icon", async () => {
  const task = sampleTasks.find((item) => item.id === "T-012")!
  const { container } = render(<TaskCard task={task} now={GENERATED_AT} locale="en-US" />)
  expect(container.querySelector('[data-slot="agent-avatar-unassigned"]')?.getAttribute("aria-hidden")).toBe("true")
  expect(screen.getByRole("img", { name: "To do" })).toBeTruthy()
  expect(within(container).getByText(/^Updated/).textContent).toBe("Updated 47 min. ago")
  expect(await axeViolations(container)).toEqual([])
})

test("status icons are decorative beside text and named alone", () => {
  render(
    <>
      <TaskStatusIcon status="done" />
      <TaskStatusIcon status="blocked" label="Blocked" />
    </>,
  )
  const icons = document.querySelectorAll('[data-slot="task-status-icon"]')
  expect(icons[0]?.getAttribute("aria-hidden")).toBe("true")
  expect(screen.getByRole("img", { name: "Blocked" })).toBe(icons[1])
})

test("badges with avatars have no axe violations and no unnamed agent entries", async () => {
  const agent = createAgent()
  const { container } = render(
    <main>
      <AgentBadge agent={codex} />
      <AgentBadge variant="detail" agent={codex} avatars={{ codex: { src: "data:image/png;base64,AAAA" } }} />
      <TaskCard task={sampleTasks.find((item) => item.id === "T-014")!} now={GENERATED_AT} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  for (const entry of agent.snapshot()) expect(entry.label, JSON.stringify(entry)).toBeTruthy()
})
