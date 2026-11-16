import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { LandingPage } from "@/components/landing-page"

import { axeViolations } from "./axe"

const agent = createAgent()

test("LandingPage is made of blocks, and agents can read it", async () => {
  const { container } = render(<LandingPage />)
  for (const slot of ["hero", "section-heading", "bento", "steps", "site-footer"]) {
    expect(container.querySelector(`[data-slot=${slot}]`), slot).not.toBeNull()
  }
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.map((entry) => entry.label)).toContain("Install command")
  const copy = await agent.act({ steps: [{ ref: "Install command", action: "copy" }] })
  expect(copy.error?.message ?? "").not.toMatch(/No component/)
  expect(await axeViolations(container)).toEqual([])
})
