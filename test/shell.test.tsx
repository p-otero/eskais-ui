import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { Shell, type ShellRoute, type ShellRouteGroup, type ShellProps } from "@/components/ui/shell"
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
