import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { HoverCard, HoverCardArrow, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function Author() {
  return (
    <main>
      <p>
        Planned by{" "}
        <HoverCard delay={0} closeDelay={0}>
          <HoverCardTrigger href="/agents/planner">planner</HoverCardTrigger>
          <HoverCardContent>
            <HoverCardArrow />
            <p className="font-medium">Planner agent</p>
            <p>Splits work into tasks and assigns them.</p>
          </HoverCardContent>
        </HoverCard>
      </p>
    </main>
  )
}

test("the trigger stays a link and focus opens the preview on a glass-ready surface", async () => {
  const user = userEvent.setup()
  render(<Author />)
  const link = screen.getByRole("link", { name: "planner" })
  expect(link.getAttribute("href")).toBe("/agents/planner")
  expect(screen.queryByText("Planner agent")).toBeNull()

  await user.tab()
  expect(document.activeElement).toBe(link)
  await settle(20)
  const card = screen.getByText("Planner agent").closest('[data-slot="hover-card-content"]')
  expect(card?.className).toContain("surface-floating")
  expect(link.dataset.open).toBe("")
})

test("Escape closes it and focus stays on the link", async () => {
  const user = userEvent.setup()
  render(<Author />)
  await user.tab()
  await settle(20)
  expect(screen.getByText("Planner agent")).toBeTruthy()
  await user.keyboard("{Escape}")
  await settle(20)
  expect(screen.queryByText("Planner agent")).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "planner" }))
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(<Author />)
  expect(await axeViolations(container)).toEqual([])
  await user.tab()
  await settle(20)
  expect(await axeViolations(document.body)).toEqual([])
})

test("adds no unnamed component to the agent snapshot", async () => {
  render(<Author />)
  await settle()
  for (const entry of agent.snapshot().filter((item) => !item.offPage && item.component !== "more")) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
})
