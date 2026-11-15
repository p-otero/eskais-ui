import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Meter, MeterLabel, MeterTrack, MeterValue } from "@/components/ui/meter"
import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function Gauges({ uploaded }: { uploaded: number | null }) {
  return (
    <>
      <Progress value={uploaded}>
        <ProgressLabel>Uploading report.pdf</ProgressLabel>
        <ProgressValue />
        <ProgressTrack />
      </Progress>
      <Meter value={68}>
        <MeterLabel>Storage used</MeterLabel>
        <MeterValue />
        <MeterTrack />
      </Meter>
    </>
  )
}

test("a Label names a slider and a switch by htmlFor, and a press on it reaches the switch", async () => {
  const user = userEvent.setup()
  render(
    <>
      <Label htmlFor="volume">Volume</Label>
      <Slider id="volume" defaultValue={20}>
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <Switch id="airplane" />
      <Label htmlFor="airplane">Airplane mode</Label>
    </>,
  )
  await settle()
  expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy()
  await user.click(screen.getByText("Airplane mode"))
  expect(screen.getByRole("switch", { name: "Airplane mode" }).getAttribute("aria-checked")).toBe("true")
})

test("progress and meter are named by their labels and render their own indicator", () => {
  render(<Gauges uploaded={40} />)
  const progress = screen.getByRole("progressbar", { name: "Uploading report.pdf" })
  expect(progress.getAttribute("aria-valuenow")).toBe("40")
  expect(progress.querySelector("[data-slot=progress-indicator]")).toBeTruthy()
  const meter = screen.getByRole("meter", { name: "Storage used" })
  expect(meter.getAttribute("aria-valuetext")).toBe("68%")
  expect(meter.querySelector("[data-slot=meter-indicator]")).toBeTruthy()
})

test("a null progress is indeterminate and reaching max completes it", () => {
  const { rerender } = render(<Gauges uploaded={null} />)
  const progress = screen.getByRole("progressbar", { name: "Uploading report.pdf" })
  expect(progress.hasAttribute("data-indeterminate")).toBe(true)
  expect(progress.hasAttribute("aria-valuenow")).toBe(false)
  rerender(<Gauges uploaded={100} />)
  expect(progress.hasAttribute("data-complete")).toBe(true)
})

test("an alert has a tone and only announces itself when asked", () => {
  render(
    <>
      <Alert tone="warning">
        <AlertTitle>Quota almost used</AlertTitle>
        <AlertDescription>New runs pause at 100%.</AlertDescription>
      </Alert>
      <Alert tone="destructive" announce>
        <AlertTitle>Deploy failed</AlertTitle>
      </Alert>
    </>,
  )
  const warning = screen.getByText("Quota almost used").parentElement!
  expect(warning.dataset.slot).toBe("alert")
  expect(warning.dataset.tone).toBe("warning")
  expect(warning.hasAttribute("role")).toBe(false)
  expect(screen.getByRole("alert").textContent).toBe("Deploy failed")
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <Gauges uploaded={40} />
      <Alert tone="info">
        <svg aria-hidden="true" viewBox="0 0 24 24" />
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Builds run in the order they were queued.</AlertDescription>
      </Alert>
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent reads progress and meter by name and gets no actions on them", async () => {
  render(<Gauges uploaded={40} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const progress = components.find((entry) => entry.label === "Uploading report.pdf")
  expect(progress?.actions).toEqual([])
  expect(components.map((entry) => entry.label)).toContain("Storage used")
})
