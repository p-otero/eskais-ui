import { render, screen } from "@testing-library/react"
import { UsersIcon } from "lucide-react"
import { expect, test } from "vitest"

import { DashboardStat, DashboardStats } from "@/components/ui/dashboard-grid"
import { Stat, StatGroup, StatHint, StatLabel, StatMedia, StatValue } from "@/components/ui/stat"
import { tones } from "@/lib/tone"

import { axeViolations } from "./axe"

function media(root: Element) {
  return root.querySelector<HTMLElement>("[data-slot=stat-media]")!
}

test("StatMedia is a decorative chip by default, sized from the control height with a choice radius", async () => {
  const { container } = render(
    <Stat>
      <StatLabel>Members</StatLabel>
      <StatValue value={42} locale="en-US" />
      <StatMedia>
        <UsersIcon />
      </StatMedia>
    </Stat>,
  )
  const chip = media(container)
  expect(chip.getAttribute("aria-hidden")).toBe("true")
  expect(chip.hasAttribute("role")).toBe(false)
  expect(chip.dataset.tone).toBe("neutral")
  expect(chip.className).toContain("h-control")
  expect(chip.className).toContain("min-w-control")
  expect(chip.className).toContain("rounded-choice")
  expect(chip.className).toContain("[&_svg]:size-5")
  expect(chip.className).toContain("bg-neutral-soft text-neutral-soft-foreground")
  expect(screen.queryByRole("img")).toBeNull()
  expect(await axeViolations(container)).toEqual([])
})

test("StatMedia with a label is an image named by it", async () => {
  const { container } = render(
    <Stat>
      <StatLabel>Members</StatLabel>
      <StatValue value={42} locale="en-US" />
      <StatMedia tone="info" label="Team">
        <UsersIcon />
      </StatMedia>
    </Stat>,
  )
  const image = screen.getByRole("img", { name: "Team" })
  expect(image).toBe(media(container))
  expect(image.hasAttribute("aria-hidden")).toBe(false)
  expect(await axeViolations(container)).toEqual([])
})

test.each(tones)("StatMedia tone %s uses its soft fill and text, never an opacity modifier", (tone) => {
  const { container } = render(<StatMedia tone={tone} />)
  const chip = media(container)
  expect(chip.dataset.tone).toBe(tone)
  expect(chip.className).toContain(`bg-${tone}-soft`)
  expect(chip.className).toContain(`text-${tone}-soft-foreground`)
  expect(chip.className).not.toMatch(/\/\d/)
})

test("Stat puts a StatMedia child in an end column, top-aligned beside the text, wherever it is written", () => {
  const { container } = render(
    <Stat>
      <StatMedia tone="success">
        <UsersIcon />
      </StatMedia>
      <StatLabel>Members</StatLabel>
      <StatValue value={42} locale="en-US" />
      <StatHint>of 50</StatHint>
    </Stat>,
  )
  const stat = container.querySelector("[data-slot=stat]")!
  expect(stat.className).toContain("has-[>[data-slot=stat-media]]:grid")
  expect(stat.className).toContain("has-[>[data-slot=stat-media]]:grid-cols-[minmax(0,1fr)_auto]")
  expect(stat.className).toContain("*:col-start-1")
  expect(stat.className).toContain("[&>[data-slot=stat-media]]:col-start-2")
  expect(stat.className).toContain("[&>[data-slot=stat-media]]:row-start-1")
  expect(media(container).className).toContain("self-start")
  expect(stat.className).toMatch(/(^| )flex( |$)/)
})

test("DashboardStat renders icon, tone and iconLabel as a StatMedia, also while loading", async () => {
  const { container, rerender } = render(
    <DashboardStats aria-label="This week">
      <DashboardStat label="Members" value={42} locale="en-US" icon={<UsersIcon />} tone="violet" />
      <DashboardStat label="Seats" value={50} locale="en-US" icon={<UsersIcon />} iconLabel="Seats in use" />
      <DashboardStat label="Plain" value={1} locale="en-US" />
    </DashboardStats>,
  )
  const chips = container.querySelectorAll<HTMLElement>("[data-slot=stat-media]")
  expect(chips).toHaveLength(2)
  expect(chips[0]!.dataset.tone).toBe("violet")
  expect(chips[0]!.getAttribute("aria-hidden")).toBe("true")
  expect(chips[1]!.dataset.tone).toBe("neutral")
  expect(screen.getByRole("img", { name: "Seats in use" })).toBe(chips[1])
  expect(await axeViolations(container)).toEqual([])

  rerender(
    <DashboardStats aria-label="This week" loading>
      <DashboardStat label="Members" value={42} icon={<UsersIcon />} tone="info" loading />
    </DashboardStats>,
  )
  expect(media(container).dataset.tone).toBe("info")
})

test("StatMedia in a StatGroup passes axe", async () => {
  const { container } = render(
    <StatGroup aria-label="Team">
      <Stat>
        <StatLabel>Members</StatLabel>
        <StatValue value={42} locale="en-US" />
        <StatMedia tone="warning" label="Members">
          <UsersIcon />
        </StatMedia>
      </Stat>
      <Stat>
        <StatLabel>Seats</StatLabel>
        <StatValue value={50} locale="en-US" />
      </Stat>
    </StatGroup>,
  )
  expect(await axeViolations(container)).toEqual([])
})
