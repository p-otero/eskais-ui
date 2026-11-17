import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Inbox } from "@/components/inbox"
import { sampleInboxItems } from "@/components/inbox-sample"
import { Button } from "@/components/ui/button"
import { SidePanel } from "@/components/ui/side-panel"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.index === undefined ? 0 : 56
    },
  })
  vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {})
})
afterEach(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight)
  vi.restoreAllMocks()
})

function Panel() {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState("")
  return (
    <>
      <Button id="opener" onClick={() => setOpen(true)}>
        Open detail
      </Button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title="Item detail"
        returnFocus={() => document.getElementById("opener")}
      >
        <Button shortcut="u" onClick={() => setLog("read")}>
          Mark read
        </Button>
      </SidePanel>
      <output>{log}</output>
    </>
  )
}

test("SidePanel: a named complementary region whose shortcuts run while it's open; Escape closes it", async () => {
  const user = userEvent.setup()
  const { container } = render(<Panel />)
  await user.keyboard("u")
  expect(screen.getByRole("status").textContent).toBe("")

  await user.click(screen.getByRole("button", { name: "Open detail" }))
  const panel = screen.getByRole("complementary", { name: "Item detail" })
  await user.keyboard("u")
  expect(screen.getByRole("status").textContent).toBe("read")
  expect(await axeViolations(container)).toEqual([])

  await user.click(within(panel).getByRole("button", { name: "Mark read" }))
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("complementary")).toBeNull()
  expect(document.activeElement?.id).toBe("opener")
})

test("SidePanel: closing with focus outside leaves focus where it is", async () => {
  const user = userEvent.setup()
  render(<Panel />)
  await user.click(screen.getByRole("button", { name: "Open detail" }))
  await user.click(screen.getByRole("button", { name: "Close" }))
  expect(document.activeElement?.id).toBe("opener")
})

const rowButton = (id: string) =>
  document.querySelector<HTMLElement>(`[data-item-id="${id}"] [data-slot="list-item-title"]`)?.closest("button")

test("Inbox: j/k move, Enter opens the inspector that follows focus, U and P act, Escape returns to the row", async () => {
  const user = userEvent.setup()
  const items = sampleInboxItems(1500)
  render(<Inbox items={items} locale="en-US" timeZone="UTC" />)
  expect(screen.getAllByRole("listitem").length).toBeLessThan(100)

  rowButton(items[0]!.id)?.focus()
  await user.keyboard("jj{Enter}")
  const panel = screen.getByRole("complementary", { name: items[2]!.subject })
  expect(within(panel).getByRole("button", { name: /Mark (un)?read/ })).toBeTruthy()

  const before = within(panel).getByRole("button", { name: /Mark (un)?read/ }).textContent
  await user.keyboard("u")
  expect(within(panel).getByRole("button", { name: /Mark (un)?read/ }).textContent).not.toBe(before)
  await user.keyboard("p")
  expect(within(panel).getByRole("button", { name: /Pin|Unpin/ }).textContent).toMatch(/Unpin|Pin/)

  await user.keyboard("j")
  expect(screen.getByRole("complementary", { name: items[3]!.subject })).toBeTruthy()

  await user.keyboard("{Escape}")
  expect(screen.queryByRole("complementary")).toBeNull()
  expect(document.activeElement).toBe(rowButton(items[3]!.id))
})

test("Inbox: x selects rows for a bulk action and ? lists the keys by scope", async () => {
  const user = userEvent.setup()
  const items = sampleInboxItems(40)
  render(<Inbox items={items} locale="en-US" timeZone="UTC" />)
  rowButton(items[0]!.id)?.focus()
  await user.keyboard("xjx")
  expect(screen.getByText("2 selected")).toBeTruthy()
  await user.keyboard("{Enter}")
  await user.keyboard("?")
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" })
  const groups = [...dialog.querySelectorAll("section")].map((section) => section.getAttribute("aria-label"))
  expect(groups).toEqual(["General", "Item detail"])
  expect(dialog.textContent).toContain("Next message")
  expect(dialog.textContent).toContain("Mark read or unread")
  expect(dialog.querySelector('section[aria-label="Item detail"]')?.textContent).toContain("Close")
  await user.keyboard("{Escape}")
  await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(screen.getByRole("complementary")).toBeTruthy()
})

test("Inbox: agents select any message and press the inspector's buttons by name", async () => {
  const items = sampleInboxItems(1500)
  render(<Inbox items={items} locale="en-US" timeZone="UTC" />)
  await settle()
  const agent = createAgent()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  let result = await act(() => agent.act({ steps: [{ ref: "Messages", action: "select", args: [items[1200]!.id] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("complementary", { name: items[1200]!.subject })).toBeTruthy()
  await settle()
  const label = items[1200]!.read ? "Mark unread" : "Mark read"
  result = await act(() => agent.act({ steps: [{ ref: label, action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
})
