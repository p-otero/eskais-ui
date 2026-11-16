import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { expect, test } from "vitest"

import { readFileSync } from "node:fs"

import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Meter, MeterTrack } from "@/components/ui/meter"
import { Progress, ProgressLabel, ProgressTrack } from "@/components/ui/progress"
import { StatusDot, StatusPill } from "@/components/ui/status-pill"
import { ToastStack, createToaster, toastTone } from "@/components/ui/toast"
import { tones } from "@/lib/tone"

import { axeViolations } from "./axe"

test("the shared vocabulary has five status tones and a violet category tone", () => {
  expect(tones).toEqual(["neutral", "info", "success", "warning", "destructive", "violet"])
})

test.each(tones)("a %s badge and status pill fill with the soft tone tokens", async (tone) => {
  const { container } = render(
    <p>
      <Badge tone={tone}>Badge</Badge> <StatusPill tone={tone}>Pill</StatusPill>
      <Alert tone={tone}>
        <AlertTitle>Alert</AlertTitle>
      </Alert>
    </p>,
  )
  for (const slot of ["badge", "status-pill"]) {
    const className = container.querySelector(`[data-slot="${slot}"]`)!.className
    expect(className).toContain(`bg-${tone}-soft text-${tone}-soft-foreground`)
    expect(className).toContain(`border-${tone}-border`)
  }
  expect(await axeViolations(container)).toEqual([])
})

test("toned components don't tint with opacity modifiers", () => {
  for (const file of ["badge", "status-pill", "alert", "toast", "list-item"]) {
    expect(readFileSync(`registry/ui/${file}.tsx`, "utf8")).not.toMatch(
      /(bg|border)-(info|success|warning|destructive)\/\d+/,
    )
  }
  expect(readFileSync("registry/ui/skeleton.tsx", "utf8")).toContain("bg-skeleton")
})

test("a status dot says what it means to screen readers, and only pulses with motion allowed", async () => {
  const { container } = render(
    <p>
      <StatusDot tone="success" label="Online" pulse /> api-1
    </p>,
  )
  const dot = container.querySelector<HTMLElement>('[data-slot="status-dot"]')!
  expect(dot.dataset.tone).toBe("success")
  expect(dot.className).toContain("text-success")
  expect(dot.hasAttribute("data-pulse")).toBe(true)
  expect(within(dot).getByText("Online").className).toContain("sr-only")
  const ping = dot.querySelector(".motion-safe\\:animate-ping")!
  expect(ping.className).toContain("motion-reduce:hidden")
  expect(await axeViolations(container)).toEqual([])
})

test("alerts take the neutral tone too", () => {
  render(
    <Alert tone="neutral">
      <AlertTitle>Maintenance</AlertTitle>
    </Alert>,
  )
  expect(screen.getByText("Maintenance").parentElement!.dataset.tone).toBe("neutral")
})

test("progress and meter mark their tone for the indicator", () => {
  const { container } = render(
    <>
      <Progress value={40} tone="success">
        <ProgressLabel>Upload</ProgressLabel>
        <ProgressTrack />
      </Progress>
      <Meter value={90} tone="warning" aria-label="Quota">
        <MeterTrack />
      </Meter>
    </>,
  )
  const [progress, meter] = container.querySelectorAll<HTMLElement>("[data-tone]")
  expect(progress!.dataset.tone).toBe("success")
  expect(meter!.dataset.tone).toBe("warning")
  expect(container.querySelector('[data-slot="progress-indicator"]')?.className).toContain(
    "group-data-[tone=success]/gauge:bg-success",
  )
})

function Toasts() {
  const [toaster] = useState(() => createToaster())
  return (
    <>
      <Button onClick={() => toaster.error("Deploy failed")}>Fail</Button>
      <ToastStack toaster={toaster} />
    </>
  )
}

test("a toast's type maps onto the shared tones", async () => {
  expect(toastTone("error")).toBe("destructive")
  expect(toastTone("default")).toBe("neutral")
  expect(toastTone("loading")).toBe("neutral")
  const user = userEvent.setup()
  render(<Toasts />)
  await user.click(screen.getByRole("button", { name: "Fail" }))
  const item = within(screen.getByRole("region", { name: "Notifications" })).getByRole("listitem")
  expect(item.className).toContain("border-destructive-border")
})
