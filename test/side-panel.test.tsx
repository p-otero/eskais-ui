import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { Button } from "@/components/ui/button"
import { SidePanel } from "@/components/ui/side-panel"
import { StatusPill } from "@/components/ui/status-pill"

import { axeViolations } from "./axe"

test("the header's actions share a wrapping row with the heading, and the close button keeps its corner", async () => {
  const { container } = render(
    <SidePanel
      open
      onOpenChange={() => {}}
      title="Webhook retries stop after the first timeout"
      description="Opened two days ago"
      actions={
        <>
          <StatusPill tone="info">In review</StatusPill>
          <Button size="sm">Assign</Button>
        </>
      }
    />,
  )
  const heading = container.querySelector<HTMLElement>("[data-slot=side-panel-heading]")
  const actions = container.querySelector<HTMLElement>("[data-slot=side-panel-actions]")
  expect(heading?.className).toContain("basis-(--card-heading-basis)")
  expect(heading?.className).toContain("grow")
  expect(actions?.parentElement).toBe(heading?.parentElement)
  expect(actions?.parentElement?.className).toContain("flex-wrap")
  expect(actions?.contains(screen.getByRole("button", { name: "Assign" }))).toBe(true)
  expect(actions?.contains(screen.getByRole("button", { name: "Close" }))).toBe(false)
  expect(await axeViolations(container)).toEqual([])
})

test("without actions there is no actions box", () => {
  const { container } = render(<SidePanel open onOpenChange={() => {}} title="Detail" />)
  expect(container.querySelector("[data-slot=side-panel-actions]")).toBeNull()
})
