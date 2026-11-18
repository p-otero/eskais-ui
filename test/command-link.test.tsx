import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

import { axeViolations } from "./overlay-helpers"

const agent = createAgent()

afterEach(() => {
  history.replaceState(null, "", "/")
})

function Palette({
  onAction = vi.fn(),
  onFollow,
}: {
  onAction?: (value: string) => void
  onFollow?: (href: string) => void
}) {
  return (
    <main>
      <Command aria-label="Go to" onAction={onAction}>
        <CommandInput aria-label="Find a page" />
        <CommandList>
          <CommandItem value="ideas" href="#/ideas" onFollow={onFollow}>
            Ideas
          </CommandItem>
          <CommandItem value="notes" href="#/notes" shortcut="mod+shift+n" onFollow={onFollow}>
            Notes
          </CommandItem>
          <CommandItem value="new-task">New task</CommandItem>
        </CommandList>
      </Command>
    </main>
  )
}

const pointerDown = () => new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" })

test("an href renders the command as a link with the item's slot; plain items stay divs", async () => {
  const { container } = render(<Palette />)
  const ideas = screen.getByRole("option", { name: "Ideas" })
  expect(ideas.tagName).toBe("A")
  expect(ideas.getAttribute("href")).toBe("#/ideas")
  expect(ideas.dataset.slot).toBe("command-item")
  expect(ideas.className).toContain("h-control-sm")
  const task = screen.getByRole("option", { name: "New task" })
  expect(task.tagName).toBe("DIV")
  expect(task.hasAttribute("href")).toBe(false)
  expect(await axeViolations(container)).toEqual([])
})

test("Enter on a highlighted link follows its hash route without running onAction", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<Palette onAction={onAction} />)
  await user.click(screen.getByRole("combobox", { name: "Find a page" }))
  await user.keyboard("idea{Enter}")
  expect(location.hash).toBe("#/ideas")
  expect(onAction).not.toHaveBeenCalled()
})

test("onFollow takes over Enter, a click, a mouse press and the shortcut, once each", async () => {
  const user = userEvent.setup()
  const onFollow = vi.fn()
  const onAction = vi.fn()
  render(<Palette onAction={onAction} onFollow={onFollow} />)
  await user.click(screen.getByRole("combobox", { name: "Find a page" }))
  await user.keyboard("{Enter}")
  expect(onFollow).toHaveBeenLastCalledWith("#/ideas", expect.objectContaining({ event: expect.any(Event) }))

  await user.click(screen.getByRole("option", { name: "Notes" }))
  expect(onFollow).toHaveBeenLastCalledWith("#/notes", expect.anything())
  expect(onFollow).toHaveBeenCalledTimes(2)

  await user.keyboard("{Control>}{Shift>}n{/Shift}{/Control}")
  expect(onFollow).toHaveBeenCalledTimes(3)
  expect(onFollow).toHaveBeenLastCalledWith("#/notes", expect.anything())
  expect(location.hash).toBe("")
  expect(onAction).not.toHaveBeenCalled()
})

test("a mouse press follows a hash route before the click, which follows nothing more", () => {
  const onFollow = vi.fn()
  render(<Palette onFollow={onFollow} />)
  const ideas = screen.getByRole("option", { name: "Ideas" })
  ideas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }))
  expect(onFollow).toHaveBeenCalledTimes(1)
  const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })
  ideas.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  expect(onFollow).toHaveBeenCalledTimes(1)
})

test("fast={false} follows on the click, not the press", () => {
  const onFollow = vi.fn()
  render(
    <Command aria-label="Go to">
      <CommandList>
        <CommandItem value="ideas" href="#/ideas" fast={false} onFollow={onFollow}>
          Ideas
        </CommandItem>
      </CommandList>
    </Command>,
  )
  const ideas = screen.getByRole("option", { name: "Ideas" })
  ideas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }))
  expect(onFollow).not.toHaveBeenCalled()
  ideas.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
  expect(onFollow).toHaveBeenCalledTimes(1)
})

test("an onSelect that prevents the default keeps the link from following", async () => {
  const user = userEvent.setup()
  const onFollow = vi.fn()
  render(
    <Command aria-label="Go to">
      <CommandInput aria-label="Find a page" />
      <CommandList>
        <CommandItem value="ideas" href="#/ideas" onFollow={onFollow} onSelect={(event) => event.preventDefault()}>
          Ideas
        </CommandItem>
      </CommandList>
    </Command>,
  )
  await user.click(screen.getByRole("combobox", { name: "Find a page" }))
  await user.keyboard("{Enter}")
  expect(onFollow).not.toHaveBeenCalled()
})

test("an agent sees link commands by name and highlights one", async () => {
  render(<Palette />)
  const command = agent.snapshot().find((entry) => entry.label === "Go to" && !entry.offPage)
  expect(command?.items?.map((item) => item.label)).toEqual(["Ideas", "Notes", "New task"])
  const chosen = await act(() => agent.act({ steps: [{ ref: "Go to", action: "setValue", args: ["Notes"] }] }))
  expect(chosen.ok, chosen.error?.message).toBe(true)
  expect(screen.getByRole("option", { name: "Notes" }).dataset.highlighted).toBe("")
})

test("a mouse press follows a same-origin path through onFollow; another origin waits for the click", () => {
  const onFollow = vi.fn()
  render(
    <Command aria-label="Go to">
      <CommandList>
        <CommandItem value="ideas" href="/ideas" onFollow={onFollow}>
          Ideas
        </CommandItem>
        <CommandItem value="docs" href="https://example.com/docs" onFollow={onFollow}>
          Docs
        </CommandItem>
      </CommandList>
    </Command>,
  )
  screen.getByRole("option", { name: "Ideas" }).dispatchEvent(pointerDown())
  expect(onFollow).toHaveBeenCalledWith("/ideas", expect.objectContaining({ event: expect.any(PointerEvent) }))
  screen.getByRole("option", { name: "Docs" }).dispatchEvent(pointerDown())
  expect(onFollow).toHaveBeenCalledTimes(1)
})

test("data-no-fast-link on an ancestor leaves the press to the click", () => {
  const onFollow = vi.fn()
  render(
    <div data-no-fast-link="">
      <Command aria-label="Go to">
        <CommandList>
          <CommandItem value="ideas" href="#/ideas" onFollow={onFollow}>
            Ideas
          </CommandItem>
        </CommandList>
      </Command>
    </div>,
  )
  const ideas = screen.getByRole("option", { name: "Ideas" })
  ideas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }))
  expect(onFollow).not.toHaveBeenCalled()
  ideas.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
  expect(onFollow).toHaveBeenCalledTimes(1)
})

test("a modified click on a link stays native and runs neither onFollow nor onAction", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  const onFollow = vi.fn()
  render(<Palette onAction={onAction} onFollow={onFollow} />)
  const native = vi.fn((event: MouseEvent) => event.preventDefault())
  document.addEventListener("click", native)
  await user.keyboard("{Control>}")
  await user.click(screen.getByRole("option", { name: "Ideas" }))
  await user.keyboard("{/Control}")
  document.removeEventListener("click", native)
  expect(native).toHaveBeenCalled()
  expect(onFollow).not.toHaveBeenCalled()
  expect(onAction).not.toHaveBeenCalled()

  await user.click(screen.getByRole("option", { name: "New task" }))
  expect(onAction).toHaveBeenCalledWith("new-task", expect.anything())
})
