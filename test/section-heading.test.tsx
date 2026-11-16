import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { SectionHeading } from "@/components/ui/section-heading"

test("SectionHeading gives the enclosing section its name", () => {
  render(
    <section aria-labelledby="features">
      <SectionHeading headingId="features" eyebrow="Features" title="Everything" description="More" />
    </section>,
  )
  expect(screen.getByRole("region", { name: "Everything" })).toBeTruthy()
})
