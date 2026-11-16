import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { Bento, BentoTile } from "@/components/ui/bento"

import { axeViolations } from "./axe"

test("Bento tiles span by column count, and a linked tile is named by its title", async () => {
  const { container } = render(
    <Bento columns={6}>
      <BentoTile span={4} title="Wide" />
      <BentoTile span={2} title="Narrow" href="#narrow" />
    </Bento>,
  )
  const tiles = [...container.querySelectorAll<HTMLElement>("[data-slot=bento-tile]")]
  expect(
    tiles.map((tile) => [tile.style.getPropertyValue("--bento-span"), tile.style.getPropertyValue("--bento-span-md")]),
  ).toEqual([
    ["4", "2"],
    ["2", "1"],
  ])
  expect(screen.getByRole("link", { name: "Narrow" }).getAttribute("href")).toBe("#narrow")
  expect(await axeViolations(container)).toEqual([])
})
