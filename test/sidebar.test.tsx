import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import type { ReactNode } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { Sidebar, SidebarGroup, SidebarItem } from "@/components/ui/sidebar"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

function Icon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

function RouterLink({ to, children, ...props }: { to: string; children?: ReactNode }) {
  return (
    <a href={`#${to}`} data-router="" {...props}>
      {children}
    </a>
  )
}

function Main(props: Partial<Parameters<typeof Sidebar>[0]>) {
  return (
    <Sidebar label="Main" header={<span>Acme</span>} {...props}>
      <SidebarGroup label="Workspace">
        <SidebarItem href="#/" icon={<Icon />} current>
          Overview
        </SidebarItem>
        <SidebarItem render={<RouterLink to="/projects" />} icon={<Icon />} badge={3}>
          Projects
        </SidebarItem>
      </SidebarGroup>
      <SidebarGroup label="Account">
        <SidebarItem href="#/settings" icon={<Icon />}>
          Settings
        </SidebarItem>
      </SidebarGroup>
    </Sidebar>
  )
}

function mockNarrow(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => vi.unstubAllGlobals())

test("a sidebar is a named navigation landmark with groups and a current item", async () => {
  const { container } = render(<Main />)
  await settle()
  const nav = screen.getByRole("navigation", { name: "Main" })
  expect(screen.getByRole("list", { name: "Workspace" })).toBeTruthy()
  const overview = screen.getByRole("link", { name: "Overview" })
  expect(overview.getAttribute("aria-current")).toBe("page")
  expect(screen.getByRole("link", { name: /Settings/ }).hasAttribute("aria-current")).toBe(false)
  const projects = screen.getByRole("link", { name: /Projects/ })
  expect(projects.getAttribute("href")).toBe("#/projects")
  expect(projects.hasAttribute("data-router")).toBe(true)
  expect(nav.contains(projects)).toBe(true)
  expect(await axeViolations(container)).toEqual([])
})

test("the toggle collapses it to a rail of items named by tooltips, and expands it again", async () => {
  const user = userEvent.setup()
  const onCollapsedChange = vi.fn()
  const { container } = render(<Main onCollapsedChange={onCollapsedChange} />)
  await settle()
  const toggle = screen.getByRole("button", { name: "Collapse sidebar" })
  expect(toggle.getAttribute("aria-expanded")).toBe("true")

  await user.click(toggle)
  expect(onCollapsedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: "trigger-press" }))
  const nav = screen.getByRole("navigation", { name: "Main" })
  expect(nav.hasAttribute("data-collapsed")).toBe(true)
  expect(screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded")).toBe("false")
  const tips = screen.getAllByRole("tooltip", { hidden: true })
  // The toggle's own tooltip first, then one per rail item.
  expect(tips.map((tip) => tip.textContent)).toEqual(["Expand sidebar", "Overview", "Projects", "Settings"])
  expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page")
  expect(await axeViolations(container)).toEqual([])

  await user.click(screen.getByRole("button", { name: "Expand sidebar" }))
  expect(nav.hasAttribute("data-collapsed")).toBe(false)
  expect(screen.getAllByRole("tooltip", { hidden: true }).map((tip) => tip.textContent)).toEqual(["Collapse sidebar"])
})

test("a controlled sidebar follows the app, and collapsible={false} has no toggle", async () => {
  const { rerender } = render(<Main collapsed />)
  await settle()
  expect(screen.getByRole("navigation").hasAttribute("data-collapsed")).toBe(true)
  rerender(<Main collapsed={false} />)
  expect(screen.getByRole("navigation").hasAttribute("data-collapsed")).toBe(false)
  rerender(<Main collapsible={false} />)
  expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull()
})

test("on a narrow screen it opens in a drawer that closes when a link is followed", async () => {
  mockNarrow(true)
  const user = userEvent.setup()
  const { baseElement } = render(<Main labels={{ open: "Open menu" }} />)
  await settle()
  expect(screen.queryByRole("navigation")).toBeNull()
  await user.click(screen.getByRole("button", { name: "Open menu" }))
  await settle()
  const drawer = screen.getByRole("dialog", { name: "Main" })
  expect(drawer.contains(screen.getByRole("navigation", { name: "Main" }))).toBe(true)
  expect(screen.queryByRole("button", { name: "Collapse sidebar" })).toBeNull()
  expect(await axeViolations(baseElement)).toEqual([])

  await user.click(screen.getByRole("link", { name: /Settings/ }))
  await settle(50)
  expect(screen.queryByRole("dialog", { name: "Main" })).toBeNull()
})

test("an agent collapses and expands the sidebar by name", async () => {
  render(<Main />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const entry = components.find((candidate) => candidate.component === "sidebar")
  expect(entry?.label).toBe("Main")
  expect(entry?.actions).toEqual(expect.arrayContaining(["collapse", "expand"]))

  const collapsed = await act(() => agent.act({ steps: [{ ref: "Main", action: "collapse" }] }))
  expect(collapsed.ok, collapsed.error?.message).toBe(true)
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(true)
  for (const rail of agent.snapshot().filter((candidate) => !candidate.offPage && candidate.component !== "more")) {
    expect(rail.label, `${rail.component} ${rail.ref} has no name`).toBeTruthy()
  }
  const expanded = await act(() => agent.act({ steps: [{ ref: "Main", action: "expand" }] }))
  expect(expanded.ok, expanded.error?.message).toBe(true)
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(false)
})
