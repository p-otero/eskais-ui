import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { AcceptancePopover, type AcceptanceCriterion } from "@/components/ui/acceptance-list"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

const criteria: AcceptanceCriterion[] = [
  { text: "Delays grow with each attempt", result: "pass", evidence: "backoff.test.ts: 3 passed" },
  { text: "A delivery gives up after 8 attempts", result: "fail", evidence: "expected 8 calls, got 3" },
  { text: "Each retry is logged with its delay", result: "unverified" },
]

test("the trigger shows the label, a bar and n/m, and its name carries the counts", () => {
  render(<AcceptancePopover criteria={criteria} />)
  const trigger = screen.getByRole("button", { name: "Acceptance: 1 of 3 passed, 1 failed" })
  expect(trigger.textContent).toBe("Acceptance1/3")
  expect(trigger.querySelectorAll('[data-slot="acceptance-segment"]')).toHaveLength(3)
})

test("a press opens the criteria with their state and evidence", async () => {
  const user = userEvent.setup()
  render(<AcceptancePopover criteria={criteria} />)
  await user.click(screen.getByRole("button", { name: /^Acceptance:/ }))
  const popover = screen.getByRole("dialog", { name: "Acceptance" })
  const items = within(popover).getAllByRole("listitem")
  expect(items.map((item) => item.dataset.result)).toEqual(["pass", "fail", "unverified"])
  expect(items[0]!.textContent).toBe("PassedDelays grow with each attemptbackoff.test.ts: 3 passed")
  expect(items[1]!.textContent).toContain("Failed")
  expect(items[2]!.textContent).toContain("Not verified")
  expect(items.every((item) => item.querySelector("svg"))).toBe(true)
})

test("it opens on hover without moving focus", async () => {
  const user = userEvent.setup()
  render(<AcceptancePopover criteria={criteria} delay={10} />)
  const trigger = screen.getByRole("button", { name: /^Acceptance:/ })
  await user.hover(trigger)
  await settle(30)
  expect(screen.getByRole("dialog", { name: "Acceptance" })).toBeTruthy()
  expect(document.activeElement).toBe(document.body)
})

test("Enter opens it and moves focus in", async () => {
  const user = userEvent.setup()
  render(<AcceptancePopover criteria={criteria} labels={{ title: "Criteria" }} />)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Criteria:/ }))
  await user.keyboard("{Enter}")
  expect(screen.getByRole("dialog", { name: "Criteria" }).contains(document.activeElement)).toBe(true)
})

test("labels and formatSummary word the trigger", () => {
  render(
    <AcceptancePopover
      criteria={criteria}
      labels={{ title: "Aceptación" }}
      formatSummary={({ pass }) => `${pass} de ${criteria.length} cumplidos`}
    />,
  )
  expect(screen.getByRole("button", { name: "Aceptación: 1 de 3 cumplidos" })).toBeTruthy()
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <AcceptancePopover criteria={criteria} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: /^Acceptance:/ }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent opens it by its name and reads every criterion", async () => {
  render(<AcceptancePopover criteria={criteria} />)
  await settle()
  const closed = agent.snapshot().filter((entry) => !entry.offPage)
  expect(closed.map((entry) => entry.component)).toEqual(["popover"])
  expect(closed[0]!.label).toBe("Acceptance: 1 of 3 passed, 1 failed")
  const opened = await agent.act({ steps: [{ ref: "Acceptance", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  expect(agent.snapshot().find((entry) => entry.component === "popover")).toMatchObject({ open: true })
})
