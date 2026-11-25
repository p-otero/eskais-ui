import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test } from "vitest"

import { DocsBreadcrumb, DocsLayout } from "@/components/ui/docs-layout"
import { Sidebar, SidebarGroup, SidebarItem, SidebarTrigger, useSidebarState } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"

import { settle } from "./overlay-helpers"

afterEach(() => localStorage.clear())

function Docs() {
  const sidebar = useSidebarState({ storageKey: "test-docs-sidebar" })
  return (
    <DocsLayout
      topbar={<Topbar leading={<SidebarTrigger {...sidebar.triggerProps} />} />}
      sidebar={
        <Sidebar label="Documentation" {...sidebar.sidebarProps} collapse="hide" trigger={false}>
          <SidebarGroup label="Guides">
            <SidebarItem href="/docs/installation">Installation</SidebarItem>
            <SidebarItem href="/docs/theming" current>
              Theming
            </SidebarItem>
          </SidebarGroup>
        </Sidebar>
      }
      header={<DocsBreadcrumb items={[{ label: "Docs", href: "/docs" }, { label: "Theming" }]} />}
    >
      <h1>Theming</h1>
    </DocsLayout>
  )
}

test("DocsLayout puts the topbar first, the sidebar under it and the breadcrumb in the main column", async () => {
  const { container } = render(<Docs />)
  await settle()
  const layout = container.querySelector('[data-slot="docs-layout"]')!
  expect(layout.firstElementChild?.getAttribute("data-slot")).toBe("topbar")
  expect((layout as HTMLElement).style.getPropertyValue("--docs-top")).toBe("var(--topbar-height)")
  const column = container.querySelector('[data-slot="docs-layout-main"]')!
  expect(column.contains(screen.getByRole("navigation", { name: "Breadcrumb" }))).toBe(true)
  expect(column.contains(screen.getByRole("main"))).toBe(true)
  const sidebar = screen.getByRole("navigation", { name: "Documentation" })
  expect(container.querySelector('[data-slot="docs-layout-sidebar"]')?.contains(sidebar)).toBe(true)
  expect(screen.getByRole("link", { name: "Installation" }).getAttribute("href")).toBe("/docs/installation")
})

test("the trigger hides the sidebar, and the state survives a remount", async () => {
  const { unmount } = render(<Docs />)
  await settle()
  await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
  const sidebar = screen.getByRole("navigation", { name: "Documentation" })
  expect(sidebar.hasAttribute("data-collapsed")).toBe(true)
  expect(sidebar.getAttribute("data-collapse")).toBe("hide")
  expect(screen.getByRole("link", { name: "Installation" }).hasAttribute("aria-describedby")).toBe(false)
  expect(localStorage.getItem("test-docs-sidebar")).toBe("collapsed")
  unmount()

  render(<Docs />)
  await settle()
  const expand = screen.getByRole("button", { name: "Expand sidebar" })
  expect(expand.getAttribute("aria-expanded")).toBe("false")
  await act(() => createAgent().act({ steps: [{ ref: "Expand sidebar", action: "press" }] }))
  expect(screen.getByRole("navigation", { name: "Documentation" }).hasAttribute("data-collapsed")).toBe(false)
  expect(localStorage.getItem("test-docs-sidebar")).toBe("expanded")
})
