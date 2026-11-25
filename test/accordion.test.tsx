import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

const sections = [
  { value: "limits", title: "What are the rate limits?", body: "Each agent gets 60 requests a minute." },
  { value: "retries", title: "When does a task retry?", body: "After a failure, up to three attempts." },
]

function Faq({ onValueChange }: { onValueChange?: (value: string[]) => void }) {
  return (
    <main>
      <Accordion aria-label="Task questions" defaultValue={["limits"]} onValueChange={onValueChange}>
        {sections.map((section) => (
          <AccordionItem key={section.value} value={section.value}>
            <AccordionHeader>
              <AccordionTrigger>{section.title}</AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel>{section.body}</AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </main>
  )
}

test("triggers sit in headings, control their panels and rotate their chevron", () => {
  render(<Faq />)
  const open = screen.getByRole("button", { name: "What are the rate limits?" })
  expect(open.closest("h3")).not.toBeNull()
  expect(open.getAttribute("aria-expanded")).toBe("true")
  expect(open.querySelector('[data-slot="accordion-icon"]')?.getAttribute("aria-hidden")).toBe("true")
  expect(screen.getByRole("region", { name: "What are the rate limits?" }).textContent).toContain("60 requests")
  expect(screen.getByRole("button", { name: "When does a task retry?" }).getAttribute("aria-expanded")).toBe("false")
})

test("Tab moves between triggers and Enter or Space opens one, closing the other", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Faq onValueChange={onValueChange} />)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "What are the rate limits?" }))
  await user.tab()
  const retries = screen.getByRole("button", { name: "When does a task retry?" })
  expect(document.activeElement).toBe(retries)
  await user.keyboard("{Enter}")
  expect(onValueChange).toHaveBeenLastCalledWith(["retries"], expect.anything())
  expect(retries.getAttribute("aria-expanded")).toBe("true")
  expect(screen.queryByRole("region", { name: "What are the rate limits?" })).toBeNull()
  await user.keyboard(" ")
  expect(retries.getAttribute("aria-expanded")).toBe("false")
})

test("has no axe violations open and closed", async () => {
  const user = userEvent.setup()
  const { container } = render(<Faq />)
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "What are the rate limits?" }))
  expect(await axeViolations(container)).toEqual([])
})

test("an agent can open a section by name", async () => {
  render(<Faq />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const accordion = components.find((entry) => entry.label === "Task questions")
  expect(accordion, "Task questions is missing from the snapshot").toBeTruthy()
  // Workaround: UI SDK beta.5 names accordion items by value, not by their trigger text.
  const retries = accordion?.items?.find((item) => item.value === "retries")
  expect(retries, JSON.stringify(accordion?.items)).toBeTruthy()
  const result = await agent.act({ steps: [{ ref: "Task questions", action: "open", args: [retries?.value] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("button", { name: "When does a task retry?" }).getAttribute("aria-expanded")).toBe("true")
})
