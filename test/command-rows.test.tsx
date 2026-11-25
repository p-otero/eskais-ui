import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
  CommandRows,
  type CommandData,
} from "@/components/ui/command"

import { settle } from "./overlay-helpers"

const agent = createAgent()

const teams = ["Design", "Platform", "Growth"]
const grouped: CommandData = teams.map((team) => ({
  type: "group",
  label: team,
  items: Array.from({ length: 100 }, (_, index) => ({
    value: `${team.toLowerCase()}-${String(index + 1)}`,
    label: `${team} task ${String(index + 1)}`,
  })),
}))
const few: CommandData = [
  { type: "group", label: "Go to", items: [{ value: "board", label: "Open board" }] },
  { type: "separator" },
  "Retry failed tasks",
]

// Workaround: jsdom has no layout, so rows get a height and the command list a viewport.
const descriptors = {
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
  clientHeight: Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight"),
}
function scrollElementTo(this: Element, options?: ScrollToOptions | number, y?: number) {
  this.scrollTop = typeof options === "number" ? (y ?? 0) : (options?.top ?? this.scrollTop)
  this.dispatchEvent(new Event("scroll"))
}
const isList = (el: Element) => el.getAttribute("data-slot") === "command-list"
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.index === undefined ? 0 : 32
    },
  })
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get(this: Element) {
      return isList(this) ? 320 : 0
    },
  })
  Element.prototype.scrollTo = scrollElementTo as Element["scrollTo"]
})
afterEach(() => {
  for (const [name, descriptor] of Object.entries(descriptors)) {
    const target = name === "offsetHeight" ? HTMLElement.prototype : Element.prototype
    if (descriptor) Object.defineProperty(target, name, descriptor)
  }
  Reflect.deleteProperty(Element.prototype, "scrollTo")
})

const noAction = () => {}

function Palette({ items, onAction = noAction }: { items: CommandData; onAction?: (value: string) => void }) {
  return (
    <main>
      <Command items={items} onAction={onAction}>
        <CommandInput aria-label="Run a command" />
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandList>{(state) => <CommandRows items={state.items} />}</CommandList>
      </Command>
    </main>
  )
}

const highlighted = () => document.querySelector<HTMLElement>('[role="option"][data-highlighted]')

test("past 50 commands only those in view mount, with their place among all of them", async () => {
  render(<Palette items={grouped} />)
  await settle()
  const options = screen.getAllByRole("option")
  expect(options.length).toBeLessThan(60)
  expect(options[0]?.textContent).toBe("Design task 1")
  expect(options[0]?.getAttribute("aria-posinset")).toBe("1")
  expect(options[0]?.getAttribute("aria-setsize")).toBe("300")
  expect(screen.getByText("Design").dataset.slot).toBe("command-group-label")
})

test("the arrow keys reach commands that weren't mounted, and Enter runs them", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<Palette items={grouped} onAction={onAction} />)
  await settle()
  await user.click(screen.getByRole("combobox", { name: "Run a command" }))
  expect(screen.queryByText("Design task 46")).toBeNull()
  await user.keyboard("{ArrowDown>45/}")
  expect(highlighted()?.textContent).toBe("Design task 46")
  expect(screen.getByRole("combobox").getAttribute("aria-activedescendant")).toBe(highlighted()?.id)
  await user.keyboard("{Enter}")
  expect(onAction.mock.calls[0]?.[0]).toBe("design-46")
})

test("typing searches every command, mounted or not", async () => {
  const user = userEvent.setup()
  render(<Palette items={grouped} />)
  await settle()
  await user.type(screen.getByRole("combobox", { name: "Run a command" }), "growth task 99")
  expect(highlighted()?.textContent).toBe("Growth task 99")
})

test("an agent highlights a command that isn't mounted", async () => {
  render(<Palette items={grouped} />)
  await settle()
  const chosen = await agent.act({ steps: [{ ref: "Run a command", action: "setValue", args: ["Growth task 80"] }] })
  expect(chosen.ok, chosen.error?.message).toBe(true)
  await settle()
  expect(highlighted()?.textContent).toBe("Growth task 80")
})

test("a short list keeps its groups and separators as parts", async () => {
  render(<Palette items={few} />)
  await settle()
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Open board",
    "Retry failed tasks",
  ])
  expect(screen.getByRole("group", { name: "Go to" })).toBeTruthy()
  const user = userEvent.setup()
  await user.click(screen.getByRole("combobox", { name: "Run a command" }))
  await settle()
  const options = screen.getAllByRole("option")
  const before = options.indexOf(highlighted() as HTMLElement)
  await user.keyboard("{ArrowDown}")
  expect(options.indexOf(highlighted() as HTMLElement)).toBe((before + 1) % options.length)
  expect(document.querySelector('[data-slot="command-separator"]')).not.toBeNull()
})

test("a command after a group stays out of it", async () => {
  render(<Palette items={[{ type: "group", label: "Go to", items: ["Open board"] }, "Retry failed tasks"]} />)
  await settle()
  const group = screen.getByRole("group", { name: "Go to" })
  expect([...group.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toEqual(["Open board"])
  expect(screen.getAllByRole("option")).toHaveLength(2)
})
