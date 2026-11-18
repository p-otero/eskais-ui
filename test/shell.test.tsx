import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { Shell, useShellSidebar, type ShellRoute, type ShellRouteGroup, type ShellProps } from "@/components/ui/shell"
import { useSidebarState } from "@/components/ui/sidebar"
import { CommandGroup, CommandGroupLabel, CommandItem } from "@/components/ui/command"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

const renders = new Map<string, number>()

// Counts its renders per route, to see which route items a navigation re-renders.
function iconFor(id: string) {
  return function RouteIcon({ className }: { className?: string }) {
    renders.set(id, (renders.get(id) ?? 0) + 1)
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="8" />
      </svg>
    )
  }
}

type Route = ShellRoute & { owner: string }

const routes: Route[] = [
  { id: "inbox", label: "Inbox", href: "/inbox", group: "work", mobile: true, owner: "a" },
  { id: "tasks", label: "Tasks", href: "/tasks", group: "work", mobile: true, keywords: ["todo"], owner: "a" },
  { id: "projects", label: "Projects", href: "/projects", group: "work", mobile: true, owner: "a" },
  { id: "calendar", label: "Calendar", href: "/calendar", group: "work", mobile: true, owner: "a" },
  { id: "reports", label: "Reports", href: "/reports", group: "work", mobile: true, owner: "b" },
  { id: "settings", label: "Settings", href: "/settings", group: "work", owner: "b" },
  { id: "old-reports", label: "Old reports", href: "/legacy/reports", group: "legacy", owner: "c" },
  { id: "archive", label: "Archive", href: "/legacy", group: "legacy", owner: "c" },
].map((route) => ({ ...route, icon: iconFor(route.id) }))

const groups: ShellRouteGroup[] = [
  { id: "work", label: "Work" },
  { id: "legacy", label: "Legacy", tone: "muted" },
]

function TestShell(props: Partial<ShellProps<Route>>) {
  return (
    <Shell routes={routes} groups={groups} currentHref="/tasks" brand={<span>Acme</span>} {...props}>
      <h1>Tasks</h1>
    </Shell>
  )
}

const stableNavigate = () => {}

function mockNarrow(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

test("the routes become a grouped sidebar with the current page marked, a muted group and the main landmark", async () => {
  const { container } = render(<TestShell />)
  await settle()
  const sidebar = screen.getByRole("navigation", { name: "Main" })
  const work = within(sidebar).getByRole("list", { name: "Work" })
  expect(
    within(work)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Inbox", "Tasks", "Projects", "Calendar", "Reports", "Settings"])
  const legacy = within(sidebar).getByRole("list", { name: "Legacy" })
  expect(legacy.closest("[data-slot=sidebar-group]")?.getAttribute("data-tone")).toBe("muted")
  const tasks = within(sidebar).getByRole("link", { name: "Tasks" })
  expect(tasks.getAttribute("aria-current")).toBe("page")
  expect(tasks.getAttribute("href")).toBe("/tasks")
  expect(within(sidebar).getByRole("link", { name: "Inbox" }).hasAttribute("aria-current")).toBe(false)

  const main = screen.getByRole("main")
  expect(main.id).toBe("main")
  expect(main.tabIndex).toBe(-1)
  expect(within(main).getByRole("heading", { name: "Tasks" })).toBeTruthy()
  expect(screen.getByRole("banner").textContent).toContain("Acme")
  expect(await axeViolations(container)).toEqual([])
})

test("the bottom bar holds the first four mobile routes and More opens the rest, the current one marked", async () => {
  const user = userEvent.setup()
  render(<TestShell labels={{ more: "Más", mobileNav: "Barra inferior" }} currentHref="/settings" />)
  await settle()
  const bar = screen.getByRole("navigation", { name: "Barra inferior" })
  expect(
    within(bar)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Inbox", "Tasks", "Projects", "Calendar"])
  const more = within(bar).getByRole("button", { name: "Más" })
  expect(more.hasAttribute("data-current")).toBe(true)
  await user.click(more)
  await settle()
  const rest = within(bar).getAllByRole("link").slice(4)
  expect(rest.map((link) => link.textContent)).toEqual(["Reports", "Settings", "Old reports", "Archive"])
  expect(within(bar).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page")
})

test("Ctrl+K opens the palette, whose Go to group lists every route and marks the current one", async () => {
  const user = userEvent.setup()
  const onNavigate = vi.fn()
  const { baseElement } = render(
    <TestShell onNavigate={onNavigate} labels={{ goTo: "Ir a", palette: "Paleta", search: "Buscar" }} />,
  )
  await settle()
  await user.keyboard("{Control>}k{/Control}")
  await settle()
  const dialog = screen.getByRole("dialog", { name: "Paleta" })
  const group = within(dialog).getByRole("group", { name: "Ir a" })
  const options = within(group).getAllByRole("option")
  expect(options.map((option) => option.textContent)).toEqual(routes.map((route) => route.label))
  expect(within(group).getByRole("option", { name: "Tasks" }).getAttribute("aria-current")).toBe("page")
  expect(await axeViolations(baseElement)).toEqual([])

  await user.type(within(dialog).getByRole("combobox", { name: "Buscar" }), "todo")
  await user.keyboard("{Enter}")
  await settle(50)
  expect(onNavigate).toHaveBeenCalledWith("/tasks", expect.objectContaining({ id: "tasks", owner: "a" }))
  expect(screen.queryByRole("dialog", { name: "Paleta" })).toBeNull()
  expect(document.activeElement?.textContent).toContain("Search")
})

test("onNavigate takes plain clicks from the sidebar and the bottom bar; modified clicks stay native", async () => {
  const user = userEvent.setup()
  const onNavigate = vi.fn()
  render(<TestShell onNavigate={onNavigate} />)
  await settle()
  await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Inbox" }))
  expect(onNavigate).toHaveBeenLastCalledWith("/inbox", expect.objectContaining({ id: "inbox" }))
  await user.click(
    within(screen.getByRole("navigation", { name: "Bottom bar" })).getByRole("link", { name: "Projects" }),
  )
  expect(onNavigate).toHaveBeenLastCalledWith("/projects", expect.objectContaining({ id: "projects" }))
  expect(onNavigate).toHaveBeenCalledTimes(2)

  const native = vi.fn((event: MouseEvent) => event.preventDefault())
  document.addEventListener("click", native)
  await user.keyboard("{Control>}")
  await user.click(within(screen.getByRole("navigation", { name: "Bottom bar" })).getByRole("link", { name: "Tasks" }))
  await user.keyboard("{/Control}")
  document.removeEventListener("click", native)
  expect(onNavigate).toHaveBeenCalledTimes(2)
})

test("without onNavigate the routes are plain links, hash routes included", async () => {
  const hashRoutes = routes.map((route) => ({ ...route, href: `#${route.href}` }))
  render(<TestShell routes={hashRoutes} currentHref="#/tasks" />)
  await settle()
  const bar = screen.getByRole("navigation", { name: "Bottom bar" })
  expect(within(bar).getByRole("link", { name: "Inbox" }).getAttribute("href")).toBe("#/inbox")
  expect(within(bar).getByRole("link", { name: "Tasks" }).getAttribute("aria-current")).toBe("page")
  expect(
    within(screen.getByRole("navigation", { name: "Main" }))
      .getByRole("link", { name: "Tasks" })
      .getAttribute("aria-current"),
  ).toBe("page")
})

test("a matcher marks the most specific route for a nested page", async () => {
  render(<TestShell currentHref={(href) => "/legacy/reports/2024".startsWith(href)} />)
  await settle()
  const sidebar = screen.getByRole("navigation", { name: "Main" })
  expect(within(sidebar).getByRole("link", { name: "Old reports" }).getAttribute("aria-current")).toBe("page")
  expect(within(sidebar).getByRole("link", { name: "Archive" }).hasAttribute("aria-current")).toBe(false)
})

test("a navigation re-renders only the routes whose current state changed", async () => {
  const { rerender } = render(<TestShell currentHref="/tasks" onNavigate={stableNavigate} />)
  await settle()
  renders.clear()
  rerender(<TestShell currentHref="/inbox" onNavigate={stableNavigate} />)
  await settle()
  expect([...renders.keys()].toSorted()).toEqual(["inbox", "tasks"])
})

test("the skip link moves focus to main, and every string comes from labels", async () => {
  const user = userEvent.setup()
  render(<TestShell labels={{ skipToContent: "Saltar al contenido", sidebar: "Principal", openSearch: "Buscar" }} />)
  await settle()
  await user.click(screen.getByRole("link", { name: "Saltar al contenido" }))
  expect(document.activeElement).toBe(screen.getByRole("main"))
  expect(screen.getByRole("navigation", { name: "Principal" })).toBeTruthy()
  expect(document.querySelector("[data-slot=dialog-trigger]")?.textContent).toContain("Buscar")
})

test("on a narrow screen the topbar opens the sidebar drawer, which a route closes, and focus returns", async () => {
  mockNarrow(true)
  const user = userEvent.setup()
  const onNavigate = vi.fn()
  const { baseElement } = render(<TestShell onNavigate={onNavigate} labels={{ openNavigation: "Abrir menú" }} />)
  await settle()
  expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull()
  const trigger = within(screen.getByRole("banner")).getByRole("button", { name: "Abrir menú" })
  await user.click(trigger)
  await settle()
  const drawer = screen.getByRole("dialog", { name: "Main" })
  expect(within(drawer).getByRole("link", { name: "Tasks" }).getAttribute("aria-current")).toBe("page")
  expect(await axeViolations(baseElement)).toEqual([])

  await user.keyboard("{Escape}")
  await settle(50)
  expect(screen.queryByRole("dialog", { name: "Main" })).toBeNull()
  expect(document.activeElement).toBe(trigger)

  await user.click(trigger)
  await settle()
  await user.click(within(screen.getByRole("dialog", { name: "Main" })).getByRole("link", { name: "Settings" }))
  await settle(50)
  expect(onNavigate).toHaveBeenLastCalledWith("/settings", expect.anything())
  expect(screen.queryByRole("dialog", { name: "Main" })).toBeNull()
})

test("an agent finds every route by name, follows one and sees the palette's commands", async () => {
  const onNavigate = vi.fn()
  render(<TestShell onNavigate={onNavigate} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  for (const label of ["Main", "Search", ...routes.map((route) => route.label)]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label)
  }

  const followed = await act(() => agent.act({ steps: [{ ref: "Calendar", action: "follow" }] }))
  expect(followed.ok, followed.error?.message).toBe(true)
  expect(onNavigate).toHaveBeenLastCalledWith("/calendar", expect.objectContaining({ id: "calendar" }))

  const opened = await act(() => agent.act({ steps: [{ ref: "Search", action: "press" }] }))
  expect(opened.ok, opened.error?.message).toBe(true)
  await settle()
  const palette = agent.snapshot().find((entry) => entry.label === "Find a page or command" && !entry.offPage)
  expect(palette?.items?.map((item) => item.label)).toEqual(expect.arrayContaining(["Inbox", "Archive"]))
})

test("commandGroups add commands that onCommand runs before the palette closes", async () => {
  const user = userEvent.setup()
  const onCommand = vi.fn(() => Promise.resolve())
  render(
    <TestShell
      onCommand={onCommand}
      commandGroups={
        <CommandGroup>
          <CommandGroupLabel>Actions</CommandGroupLabel>
          <CommandItem value="new-task">New task</CommandItem>
        </CommandGroup>
      }
    />,
  )
  await settle()
  await user.click(document.querySelector<HTMLElement>("[data-slot=dialog-trigger]")!)
  await settle()
  await user.click(screen.getByRole("option", { name: "New task" }))
  await settle(50)
  expect(onCommand).toHaveBeenCalledWith("new-task")
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("the palette reopens empty after a route is chosen, and one Escape closes it with text in the search", async () => {
  const user = userEvent.setup()
  const onNavigate = vi.fn()
  render(<TestShell onNavigate={onNavigate} />)
  await settle()
  const trigger = document.querySelector<HTMLElement>("[data-slot=dialog-trigger]")!
  await user.keyboard("{Control>}k{/Control}")
  await settle()
  await user.keyboard("Old rep{Enter}")
  await settle(50)
  expect(onNavigate).toHaveBeenLastCalledWith("/legacy/reports", expect.anything())

  await user.keyboard("{Control>}k{/Control}")
  await settle()
  const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Find a page or command" })
  expect(input.value).toBe("")
  await user.keyboard("arch")
  expect(input.value).toBe("arch")
  await user.keyboard("{Escape}")
  await settle(50)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("searchQuery controls the palette's search, and defaultSearchQuery starts every open", async () => {
  const user = userEvent.setup()
  const onSearchQueryChange = vi.fn()
  const { rerender } = render(<TestShell defaultSearchQuery="set" />)
  await settle()
  await user.keyboard("{Control>}k{/Control}")
  await settle()
  expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Find a page or command" }).value).toBe("set")
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Settings"])
  await user.keyboard("{Escape}")
  await settle(50)

  rerender(<TestShell searchQuery="inb" onSearchQueryChange={onSearchQueryChange} />)
  await user.keyboard("{Control>}k{/Control}")
  await settle()
  const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Find a page or command" })
  expect(input.value).toBe("inb")
  await user.keyboard("o")
  expect(onSearchQueryChange).toHaveBeenLastCalledWith("inbo", expect.objectContaining({ reason: "input-change" }))
  expect(input.value).toBe("inb")
})

test("sidebarShortcut toggles the sidebar and shows on the trigger; without it the keys do nothing", async () => {
  const user = userEvent.setup()
  const { unmount } = render(<TestShell />)
  await settle()
  const sidebar = screen.getByRole("navigation", { name: "Main" })
  await user.keyboard("{Control>}b{/Control}")
  await settle()
  expect(sidebar.hasAttribute("data-collapsed")).toBe(false)
  unmount()

  render(<TestShell sidebarShortcut="mod+b" />)
  await settle()
  const trigger = within(screen.getByRole("banner")).getByRole("button", { name: "Collapse sidebar" })
  expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Control+B")
  await user.keyboard("{Control>}b{/Control}")
  await settle()
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(true)
  expect(within(screen.getByRole("banner")).getByRole("button", { name: "Expand sidebar" })).toBeTruthy()
  await user.keyboard("{Control>}b{/Control}")
  await settle()
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(false)
})

test("on a narrow screen sidebarShortcut opens the drawer", async () => {
  mockNarrow(true)
  const user = userEvent.setup()
  render(<TestShell sidebarShortcut="mod+b" />)
  await settle()
  await user.keyboard("{Control>}b{/Control}")
  await settle()
  expect(screen.getByRole("dialog", { name: "Main" })).toBeTruthy()
})

function CollapseFromPage() {
  const sidebar = useShellSidebar()
  return (
    <button type="button" onClick={() => sidebar.setCollapsed(!sidebar.collapsed)}>
      {sidebar.collapsed ? "Show navigation" : "Hide navigation"}
    </button>
  )
}

test("useShellSidebar reads and sets the Shell's sidebar from inside it", async () => {
  const user = userEvent.setup()
  render(
    <Shell routes={routes} groups={groups}>
      <CollapseFromPage />
    </Shell>,
  )
  await settle()
  await user.click(screen.getByRole("button", { name: "Hide navigation" }))
  await settle()
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(true)
  expect(screen.getByRole("button", { name: "Show navigation" })).toBeTruthy()
})

function OwnSidebarState() {
  const sidebar = useSidebarState({ defaultCollapsed: true })
  return (
    <>
      <button type="button" onClick={() => sidebar.controller.toggle()}>
        Toggle from outside
      </button>
      <output aria-label="Sidebar state">{sidebar.collapsed ? "collapsed" : "expanded"}</output>
      <Shell routes={routes} groups={groups} sidebar={sidebar}>
        <h1>Page</h1>
      </Shell>
    </>
  )
}

const mainNav = () => screen.getByRole("navigation", { name: "Main" })

test("sidebar takes the app's own useSidebarState, which controls and follows the Shell's sidebar", async () => {
  const user = userEvent.setup()
  render(<OwnSidebarState />)
  await settle()
  expect(mainNav().hasAttribute("data-collapsed")).toBe(true)
  await user.click(screen.getByRole("button", { name: "Toggle from outside" }))
  await settle()
  expect(mainNav().hasAttribute("data-collapsed")).toBe(false)
  await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Collapse sidebar" }))
  await settle()
  expect(screen.getByRole("status", { name: "Sidebar state" }).textContent).toBe("collapsed")
})

test("an agent presses the sidebar's trigger by name, the shortcut adding nothing new", async () => {
  render(<TestShell sidebarShortcut="mod+b" />)
  await settle()
  const pressed = await act(() => agent.act({ steps: [{ ref: "Collapse sidebar", action: "press" }] }))
  expect(pressed.ok, pressed.error?.message).toBe(true)
  await settle()
  expect(screen.getByRole("navigation", { name: "Main" }).hasAttribute("data-collapsed")).toBe(true)
})

test("mobile order places bottom bar routes apart from the sidebar's order, still four at most", async () => {
  const user = userEvent.setup()
  const reordered: Route[] = routes.map((route) => {
    const order = { reports: 1, calendar: 2, settings: 3, inbox: 4, tasks: 5 }[route.id]
    return order === undefined
      ? { ...route, mobile: route.id === "projects" ? true : undefined }
      : { ...route, mobile: { order } }
  })
  render(<TestShell routes={reordered} />)
  await settle()
  const sidebar = screen.getByRole("navigation", { name: "Main" })
  expect(
    within(within(sidebar).getByRole("list", { name: "Work" }))
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Inbox", "Tasks", "Projects", "Calendar", "Reports", "Settings"])
  const bar = screen.getByRole("navigation", { name: "Bottom bar" })
  // `true` counts as order 0, so Projects leads.
  expect(
    within(bar)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Projects", "Reports", "Calendar", "Settings"])
  await user.click(within(bar).getByRole("button", { name: "More" }))
  await settle()
  expect(
    within(bar)
      .getAllByRole("link")
      .slice(4)
      .map((link) => link.textContent),
  ).toEqual(["Inbox", "Tasks", "Old reports", "Archive"])
})

test("equal mobile orders keep the list's order", async () => {
  const tied: Route[] = routes.map((route) => ({ ...route, mobile: { order: route.id === "archive" ? -1 : 1 } }))
  render(<TestShell routes={tied} />)
  await settle()
  expect(
    within(screen.getByRole("navigation", { name: "Bottom bar" }))
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Archive", "Inbox", "Tasks", "Projects"])
})

const linkNames = (scope: HTMLElement) =>
  within(scope)
    .queryAllByRole("link")
    .map((link) => link.textContent)

test("placements keep a route to the sidebar, out of More or out of the palette", async () => {
  const user = userEvent.setup()
  const placed: Route[] = routes.map((route) => {
    if (route.id === "settings") return { ...route, placements: ["sidebar"] }
    if (route.id === "old-reports") return { ...route, placements: ["sidebar", "palette"] }
    if (route.id === "archive") return { ...route, placements: ["sidebar", "more"] }
    return route
  })
  render(<TestShell routes={placed} />)
  await settle()
  const sidebar = screen.getByRole("navigation", { name: "Main" })
  expect(linkNames(sidebar)).toEqual(routes.map((route) => route.label))

  const bar = screen.getByRole("navigation", { name: "Bottom bar" })
  await user.click(within(bar).getByRole("button", { name: "More" }))
  await settle()
  expect(linkNames(bar).slice(4)).toEqual(["Reports", "Archive"])

  await user.keyboard("{Control>}k{/Control}")
  await settle()
  const options = within(screen.getByRole("dialog")).getAllByRole("option")
  expect(options.map((option) => option.textContent)).toEqual([
    "Inbox",
    "Tasks",
    "Projects",
    "Calendar",
    "Reports",
    "Old reports",
  ])
})

test('placements decide the bottom bar over mobile: without "mobile" a route stays out, with it a route joins', async () => {
  const placed: Route[] = routes.map((route) => {
    if (route.id === "inbox") return { ...route, placements: ["sidebar", "more", "palette"] }
    if (route.id === "archive") return { ...route, mobile: undefined, placements: ["mobile", "palette"] }
    return route
  })
  render(<TestShell routes={placed} />)
  await settle()
  const bar = screen.getByRole("navigation", { name: "Bottom bar" })
  expect(linkNames(bar)).toEqual(["Tasks", "Projects", "Calendar", "Reports"])
  expect(linkNames(screen.getByRole("navigation", { name: "Main" }))).not.toContain("Archive")
  // Archive is a mobile candidate behind four earlier ones and isn't allowed in More, so it doesn't show there.
  const user = userEvent.setup()
  await user.click(within(bar).getByRole("button", { name: "More" }))
  await settle()
  expect(linkNames(bar).slice(4)).toEqual(["Inbox", "Settings", "Old reports"])
})

test("a route in the bottom bar only, and none in the sidebar, still routes and marks current", async () => {
  const placed: Route[] = routes.map((route) =>
    route.id === "calendar" ? { ...route, mobile: { order: -1 }, placements: ["mobile"] } : route,
  )
  render(<TestShell routes={placed} currentHref="/calendar" />)
  await settle()
  const bar = screen.getByRole("navigation", { name: "Bottom bar" })
  expect(linkNames(bar)[0]).toBe("Calendar")
  expect(within(bar).getByRole("link", { name: "Calendar" }).getAttribute("aria-current")).toBe("page")
  expect(linkNames(screen.getByRole("navigation", { name: "Main" }))).not.toContain("Calendar")
})
