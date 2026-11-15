import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function SiteNav({ onValueChange }: { onValueChange?: (value: string | null) => void }) {
  return (
    <NavigationMenu aria-label="Main" openOnHover={false} onValueChange={onValueChange}>
      <NavigationMenuList>
        <NavigationMenuItem value="agents">
          <NavigationMenuTrigger>Agents</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="m-0 grid list-none p-0">
              <li>
                <NavigationMenuLink href="#planner">Planner</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#reviewer">Reviewer</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem value="boards">
          <NavigationMenuTrigger>Boards</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#sprint">Sprint board</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#docs" current variant="top">
            Docs
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

test("is a named navigation whose triggers disclose panels of links", async () => {
  const user = userEvent.setup()
  render(<SiteNav />)
  expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Docs" }).getAttribute("aria-current")).toBe("page")
  const agents = screen.getByRole("button", { name: "Agents" })
  expect(agents.getAttribute("aria-expanded")).toBe("false")
  await user.click(agents)
  expect(agents.getAttribute("aria-expanded")).toBe("true")
  const planner = screen.getByRole("link", { name: "Planner" })
  expect(planner.closest('[data-slot="navigation-menu-content"]')?.className).toContain("bg-popover/(--glass-opacity)")
})

test("keyboard: Enter opens, arrows move between triggers, Escape closes and returns focus", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<SiteNav onValueChange={onValueChange} />)
  const agents = screen.getByRole("button", { name: "Agents" })
  agents.focus()
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Boards" }))
  await user.keyboard("{ArrowLeft}{Enter}")
  expect(onValueChange).toHaveBeenLastCalledWith("agents", expect.anything())
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Planner" }))
  await user.keyboard("{Escape}")
  expect(agents.getAttribute("aria-expanded")).toBe("false")
  expect(document.activeElement).toBe(agents)
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(<SiteNav />)
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Boards" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can open a panel by name", async () => {
  render(<SiteNav />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const nav = components.find((entry) => entry.label === "Main")
  expect(nav, JSON.stringify(components)).toBeTruthy()
  const boards = nav?.items?.find((item) => item.label === "Boards" || item.value === "boards")
  expect(boards, JSON.stringify(nav)).toBeTruthy()
  const result = await agent.act({ steps: [{ ref: "Main", action: "setValue", args: [boards?.value] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("button", { name: "Boards" }).getAttribute("aria-expanded")).toBe("true")
})
