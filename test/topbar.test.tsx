import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { createSidebarController, Sidebar, SidebarGroup, SidebarItem, SidebarTrigger } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

afterEach(() => vi.unstubAllGlobals())

function Shell({ known = true }: { known?: boolean }) {
  const [controller] = useState(() => createSidebarController())
  const [collapsed, setCollapsed] = useState(false)
  return (
    <>
      <Topbar
        brand={<a href="#home">Acme</a>}
        leading={<SidebarTrigger controller={controller} collapsed={known ? collapsed : undefined} />}
        center={<Button variant="outline">Search</Button>}
        centerCompact={<Button variant="ghost" size="icon" aria-label="Search" />}
        trailing={<Button variant="ghost">Account</Button>}
      />
      <Sidebar
        label="Main"
        controller={controller}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        trigger={false}
      >
        <SidebarGroup label="Workspace">
          <SidebarItem href="#/" current>
            Overview
          </SidebarItem>
        </SidebarGroup>
      </Sidebar>
      <main id="main">Content</main>
    </>
  )
}

test("is a banner landmark with its slots, and the sidebar's own toggle can step aside", async () => {
  const { container } = render(<Shell />)
  await settle()
  const banner = screen.getByRole("banner")
  expect(banner.querySelector('[data-slot="topbar-center"]')?.textContent).toBe("Search")
  expect(banner.querySelector('[data-slot="topbar-center-compact"] button')?.getAttribute("aria-label")).toBe("Search")
  expect(screen.getAllByRole("button", { name: /sidebar/i })).toHaveLength(1)
  expect(await axeViolations(container)).toEqual([])
})

test("SidebarTrigger toggles the sidebar through its controller and names the next step", async () => {
  const user = userEvent.setup()
  render(<Shell />)
  await settle()
  const nav = screen.getByRole("navigation", { name: "Main" })
  const trigger = screen.getByRole("button", { name: "Collapse sidebar" })
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  await user.click(trigger)
  expect(nav.hasAttribute("data-collapsed")).toBe(true)
  const expand = screen.getByRole("button", { name: "Expand sidebar" })
  expect(expand.getAttribute("aria-expanded")).toBe("false")
  await user.click(expand)
  expect(nav.hasAttribute("data-collapsed")).toBe(false)
})

test("without the state it is a plain Toggle sidebar button, and it steps aside on narrow screens", async () => {
  const user = userEvent.setup()
  const { unmount } = render(<Shell known={false} />)
  await settle()
  const trigger = screen.getByRole("button", { name: "Toggle sidebar" })
  expect(trigger.hasAttribute("aria-expanded")).toBe(false)
  await user.click(trigger)
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(true)
  unmount()

  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  render(<Shell />)
  await settle()
  expect(screen.queryByRole("button", { name: /Collapse sidebar|Toggle sidebar/ })).toBeNull()
  expect(screen.getByRole("button", { name: "Open navigation" })).toBeTruthy()
})

test("an agent presses the trigger by name", async () => {
  render(<Shell />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const result = await act(() => agent.act({ steps: [{ ref: "Collapse sidebar", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(true)
})
