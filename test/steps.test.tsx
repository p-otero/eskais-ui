import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { Step, Steps } from "@/components/ui/steps"

test("Steps is an ordered list with numbered markers", () => {
  render(
    <Steps aria-label="Setup">
      <Step title="Install" description="Add it" />
      <Step title="Use">Body</Step>
    </Steps>,
  )
  const list = screen.getByRole("list", { name: "Setup" })
  expect(list.tagName).toBe("OL")
  expect([...list.querySelectorAll("[data-slot=step-marker]")].map((marker) => marker.textContent)).toEqual(["1", "2"])
})
