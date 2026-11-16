import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test } from "vitest"

import { StageFilter, StagePill, StageTrack, type Stage } from "@/components/ui/stage-track"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

const stages: Stage[] = [
  { id: "branch", label: "Branch" },
  { id: "pr", label: "Pull request" },
  { id: "dev", label: "In Dev", tone: "info" },
  { id: "prod", label: "In Prod", tone: "success" },
]

test("a track lists every stage, marks the reached ones and the current step", async () => {
  const { container } = render(
    <StageTrack
      aria-label="Deployment stage"
      stages={stages}
      current="dev"
      getHref={(stage) => (stage.id === "pr" ? "/pulls/42" : undefined)}
    />,
  )
  const list = screen.getByRole("list", { name: "Deployment stage" })
  const items = within(list).getAllByRole("listitem")
  expect(items.map((item) => item.dataset.state)).toEqual(["reached", "reached", "current", "upcoming"])
  expect(items[2]?.getAttribute("aria-current")).toBe("step")
  expect(items.filter((item) => item.hasAttribute("aria-current"))).toHaveLength(1)
  expect(screen.getByRole("link", { name: "Pull request" }).getAttribute("href")).toBe("/pulls/42")
  expect(await axeViolations(container)).toEqual([])
})

test("an unknown current stage leaves every stage upcoming, and the pill renders nothing", () => {
  const { container } = render(
    <>
      <StageTrack aria-label="Stage" stages={stages} current="gone" />
      <StageTrack aria-label="Stage pill" stages={stages} current="gone" variant="pill" />
    </>,
  )
  expect(
    [...container.querySelectorAll("[data-slot=stage]")].every(
      (item) => item.getAttribute("data-state") === "upcoming",
    ),
  ).toBe(true)
  expect(container.querySelector("[data-slot=stage-pill]")).toBeNull()
})

test("the pill variant shows only the current stage, in its tone, optionally as a link", async () => {
  const { container } = render(
    <>
      <StageTrack aria-label="Stage" stages={stages} current="dev" variant="pill" getHref={() => "/deploys/dev"} />
      <StagePill stage={stages[3]!} />
    </>,
  )
  const link = screen.getByRole("link", { name: "In Dev" })
  expect(link.getAttribute("href")).toBe("/deploys/dev")
  expect(link.dataset.tone).toBe("info")
  expect(screen.getByText("In Prod").closest("[data-slot=stage-pill]")?.getAttribute("data-tone")).toBe("success")
  expect(await axeViolations(container)).toEqual([])
})

function Filter() {
  const [value, setValue] = useState<string[]>([])
  return (
    <>
      <StageFilter
        aria-label="Filter by stage"
        stages={stages}
        counts={{ branch: 4, pr: 2, dev: 1, prod: 12 }}
        value={value}
        onValueChange={setValue}
        locale="en"
      />
      <output>{value.join(",") || "all"}</output>
    </>
  )
}

test("the filter is a toggle group with a count per stage and several choices", async () => {
  const user = userEvent.setup()
  const { container } = render(<Filter />)
  const group = screen.getByRole("group", { name: "Filter by stage" })
  const dev = within(group).getByRole("button", { name: "In Dev 1" })
  await user.click(dev)
  await user.click(within(group).getByRole("button", { name: "In Prod 12" }))
  expect(dev.getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("status").textContent).toBe("dev,prod")
  expect(await axeViolations(container)).toEqual([])
})

test("an agent can set the stage filter", async () => {
  render(<Filter />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toContain("Filter by stage")

  const result = await agent.act({ steps: [{ ref: "Filter by stage", action: "setValue", args: [["pr", "dev"]] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("status").textContent).toBe("pr,dev")
})
