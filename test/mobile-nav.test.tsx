import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { MobileNav, type MobileNavItem } from "@/components/ui/mobile-nav"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function Icon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

const items: MobileNavItem[] = [
  { label: "Home", href: "#home", icon: <Icon /> },
  { label: "Inbox", href: "#inbox", icon: <Icon />, badge: 3, current: true },
  { label: "Projects", href: "#projects", icon: <Icon /> },
  { label: "Agents", href: "#agents", icon: <Icon /> },
]

test("is a named navigation with the current page marked and the badge in its name", async () => {
  const { container } = render(<MobileNav label="Primary" items={items} />)
  const nav = screen.getByRole("navigation", { name: "Primary" })
  const links = within(nav).getAllByRole("link")
  expect(links.map((link) => link.textContent)).toEqual(["Home", "Inbox, 3", "Projects", "Agents"])
  expect(
    within(nav)
      .getByRole("link", { name: /^Inbox\W+3$/ })
      .getAttribute("aria-current"),
  ).toBe("page")
  expect(links.filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1)
  expect(within(nav).queryByRole("button", { name: "More" })).toBeNull()
  expect(nav.className).toContain("narrow:flex")
  expect(await axeViolations(container)).toEqual([])
})

test("past five, or with overflow, the fifth slot is More and opens the rest", async () => {
  const user = userEvent.setup()
  render(
    <MobileNav
      label="Primary"
      always
      items={[
        ...items,
        { label: "Usage", href: "#usage", icon: <Icon /> },
        { label: "Docs", href: "#docs", icon: <Icon /> },
      ]}
      overflow={[{ label: "Settings", href: "#settings", icon: <Icon />, current: false }]}
    />,
  )
  const nav = screen.getByRole("navigation", { name: "Primary" })
  expect(nav.className).not.toContain("hidden")
  expect(within(nav).getAllByRole("link")).toHaveLength(4)
  const more = within(nav).getByRole("button", { name: "More" })
  await user.click(more)
  expect(more.getAttribute("aria-expanded")).toBe("true")
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Home", "Inbox, 3", "Projects", "Agents", "Usage", "Docs", "Settings"])
  expect(await axeViolations(document.body)).toEqual([])
})

test("More reads as current when the current page is inside it", () => {
  render(
    <MobileNav
      label="Primary"
      items={items.map((item) => ({ ...item, current: false }))}
      overflow={[{ label: "Settings", href: "#settings", icon: <Icon />, current: true }]}
    />,
  )
  expect(screen.getByRole("button", { name: "More" }).hasAttribute("data-current")).toBe(true)
})

test("renderLink uses the router's link", () => {
  render(
    <MobileNav
      label="Primary"
      items={items}
      renderLink={(item) => <a href={`/app${item.href?.slice(1) ?? ""}`} data-router="" aria-label={item.label} />}
    />,
  )
  expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/apphome")
})

test("an agent finds every control by name and opens More", async () => {
  render(<MobileNav label="Primary" items={items} overflow={[{ label: "Settings", href: "#s", icon: <Icon /> }]} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const result = await act(() => agent.act({ steps: [{ ref: "Primary", action: "setValue", args: ["more"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy()
})
