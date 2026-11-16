import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { axeViolations } from "./axe"

const agent = createAgent()

test("live picks alert for warning and destructive tones, status otherwise", () => {
  const { rerender } = render(
    <Alert tone="destructive" live>
      <AlertTitle>Deploy failed</AlertTitle>
    </Alert>,
  )
  expect(screen.getByRole("alert").textContent).toBe("Deploy failed")
  rerender(
    <Alert tone="warning" live>
      <AlertTitle>Quota almost used</AlertTitle>
    </Alert>,
  )
  expect(screen.getByRole("alert")).toBeTruthy()
  for (const tone of ["info", "success", "neutral"] as const) {
    rerender(
      <Alert tone={tone} live>
        <AlertTitle>Saved</AlertTitle>
      </Alert>,
    )
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("status").textContent).toBe("Saved")
  }
})

test("an alert is not a live region unless asked", () => {
  render(
    <Alert tone="destructive">
      <AlertTitle>Deploy failed</AlertTitle>
    </Alert>,
  )
  expect(screen.queryByRole("alert")).toBeNull()
  expect(screen.queryByRole("status")).toBeNull()
})

test("long unbroken text wraps instead of overflowing", () => {
  render(
    <Alert>
      <AlertTitle>{"x".repeat(200)}</AlertTitle>
      <AlertDescription>{"https://example.com/".repeat(20)}</AlertDescription>
    </Alert>,
  )
  for (const slot of ["alert-title", "alert-description"]) {
    const element = document.querySelector(`[data-slot=${slot}]`)!
    expect(element.className).toContain("min-w-0")
    expect(element.className).toContain("wrap-anywhere")
  }
  expect(document.querySelector("[data-slot=alert]")!.className).toContain("grid-cols-[minmax(0,1fr)_auto]")
})

test("the action slot holds a trailing button that agents can press", async () => {
  const retry = vi.fn()
  const { container } = render(
    <Alert
      tone="destructive"
      action={
        <Button size="sm" variant="outline" onClick={retry}>
          Retry deploy
        </Button>
      }
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" />
      <AlertTitle>Deploy failed</AlertTitle>
      <AlertDescription>The build timed out.</AlertDescription>
    </Alert>,
  )
  const action = container.querySelector("[data-slot=alert-action]")!
  expect(action.parentElement?.dataset.slot).toBe("alert")
  expect(action.lastElementChild).toBe(screen.getByRole("button", { name: "Retry deploy" }))
  expect(await axeViolations(container)).toEqual([])

  const entries = agent.snapshot().filter((entry) => !entry.offPage)
  for (const entry of entries) expect(entry.label, `${entry.component} has no name`).toBeTruthy()
  expect(entries.map((entry) => entry.label)).toContain("Retry deploy")
  const result = await act(() => agent.act({ steps: [{ ref: "Retry deploy", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(retry).toHaveBeenCalledOnce()
})
