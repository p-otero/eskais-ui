import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { Meter, MeterLabel, MeterRing, MeterTrack, MeterValue } from "@/components/ui/meter"
import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"

import { axeViolations } from "./axe"
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

test("Meter variant=ring keeps role=meter on the root and draws the value as an arc, with the value in the centre", async () => {
  const { container, rerender } = render(
    <Meter variant="ring" value={68} tone="success" locale="en-US">
      <MeterRing size="lg" />
      <MeterLabel>Storage</MeterLabel>
    </Meter>,
  )
  await settle()
  const meter = screen.getByRole("meter", { name: "Storage" })
  expect(meter.getAttribute("aria-valuenow")).toBe("68")
  expect(meter.dataset.variant).toBe("ring")
  expect(meter.className).toContain("group/gauge")
  expect(meter.className.split(" ")).toEqual(expect.arrayContaining(["max-w-full", "min-w-0"]))
  expect(meter.querySelector("[data-slot=meter-label]")?.className.split(" ")).toEqual(
    expect.arrayContaining(["max-w-full", "min-w-0"]),
  )
  const svg = container.querySelector("svg")!
  expect(svg.getAttribute("aria-hidden")).toBe("true")
  const arc = container.querySelector("[data-slot=meter-ring-arc]")!
  expect(arc.getAttribute("stroke-dasharray")).toBe("68 100")
  expect(arc.getAttribute("class")).toContain("group-data-[tone=success]/gauge:stroke-success")
  expect(arc.getAttribute("class")).toContain("motion-reduce:transition-none")
  expect(container.querySelector("[data-slot=meter-track]")?.getAttribute("data-size")).toBe("lg")
  expect(valueText()).toBe("68%")
  expect(await axeViolations(container)).toEqual([])

  rerender(
    <Meter variant="ring" value={0} locale="en-US" aria-label="Quota">
      <MeterRing size="sm">
        <span>0 of 5</span>
      </MeterRing>
    </Meter>,
  )
  expect(container.querySelector("[data-slot=meter-ring-arc]")?.getAttribute("stroke-linecap")).toBe("butt")
  expect(screen.getByRole("meter", { name: "Quota" }).textContent).toContain("0 of 5")
})
