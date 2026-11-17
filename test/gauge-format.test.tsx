import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { Meter, MeterLabel, MeterTrack, MeterValue } from "@/components/ui/meter"
import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"

import { settle } from "./overlay-helpers"

function valueText() {
  return document.querySelector("[data-slot=meter-value], [data-slot=progress-value]")?.textContent
}

test("the default stays locale-correct: es-ES writes a no-break space before %, as CLDR does", async () => {
  render(
    <Meter value={21} locale="es-ES">
      <MeterLabel>Cuota</MeterLabel>
      <MeterValue />
      <MeterTrack />
    </Meter>,
  )
  await settle()
  expect(valueText()).toBe("21 %")
})

test("the root's format changes the visible value and what screen readers hear", async () => {
  render(
    <Meter value={21} locale="es-ES" format={(value) => `${String(value)}%`}>
      <MeterLabel>Cuota</MeterLabel>
      <MeterValue />
      <MeterTrack />
    </Meter>,
  )
  await settle()
  expect(valueText()).toBe("21%")
  expect(screen.getByRole("meter", { name: "Cuota" }).getAttribute("aria-valuetext")).toBe("21%")
})

test("MeterValue formatValue replaces only the visible value, with the range and the formatted text", async () => {
  const seen: unknown[] = []
  render(
    <Meter value={30} min={20} max={70} locale="en-US">
      <MeterLabel>Seats</MeterLabel>
      <MeterValue
        formatValue={(value, details) => {
          seen.push(details)
          return `${String(value)} of ${String(details.max)}`
        }}
      />
      <MeterTrack />
    </Meter>,
  )
  await settle()
  expect(valueText()).toBe("30 of 70")
  expect(seen.at(-1)).toEqual({ min: 20, max: 70, percent: 20, text: "20%" })
  expect(screen.getByRole("meter", { name: "Seats" }).getAttribute("aria-valuetext")).toBe("20%")
})

test("ProgressValue formatValue gets null while the bar is indeterminate", async () => {
  const { rerender } = render(
    <Progress value={null} locale="en-US">
      <ProgressLabel>Upload</ProgressLabel>
      <ProgressValue formatValue={(value) => (value === null ? "Starting" : `${String(value)} files`)} />
      <ProgressTrack />
    </Progress>,
  )
  await settle()
  expect(valueText()).toBe("Starting")
  rerender(
    <Progress value={4} locale="en-US">
      <ProgressLabel>Upload</ProgressLabel>
      <ProgressValue formatValue={(value) => (value === null ? "Starting" : `${String(value)} files`)} />
      <ProgressTrack />
    </Progress>,
  )
  expect(valueText()).toBe("4 files")
})
