import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { expect, test } from "vitest"

import { Chalkboard } from "@/components/ui/chalkboard"
import { chalkboardBlocks, chalkboardText } from "@/components/ui/chalkboard-content"
import { chalkboard } from "@/components/ui/chalkboard-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()

const endAnimationAsReactHearsItInJsdom = (element: Element) =>
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }))

const board = () => screen.getByRole("region", { name: "Menu" })
const writing = () => board().querySelector<HTMLElement>('[data-slot="chalkboard-writing"]')!

const menu = `# Today
Soup ... 4.50
Sardines | 9.80
- Dogs welcome
- Terrace open
Ask about our cakes`

test("plain text reads as headings, priced menu lines, list items and lines", () => {
  expect(chalkboardBlocks(menu)).toEqual([
    { type: "heading", text: "Today" },
    {
      type: "menu",
      items: [
        { name: "Soup", price: "4.50" },
        { name: "Sardines", price: "9.80" },
      ],
    },
    { type: "list", items: ["Dogs welcome", "Terrace open"] },
    { type: "text", text: "Ask about our cakes" },
  ])
  expect(chalkboardText(chalkboardBlocks(menu)!)).toEqual([
    "Today",
    "Soup 4.50",
    "Sardines 9.80",
    "Dogs welcome",
    "Terrace open",
    "Ask about our cakes",
  ])
  expect(chalkboardBlocks([{ type: "poster" }])).toBeUndefined()
  expect(chalkboardBlocks(42)).toBeUndefined()
})

test("primitive: renders on the server as a region", () => {
  checkServer(chalkboard, { defaultContent: "# Soup" }, `<root aria-label="Menu"></root>`)
})

test("the board renders its words on the server, as real text", () => {
  const html = renderToString(<Chalkboard label="Menu" defaultContent={menu} />)
  expect(html).toContain("Sardines")
  expect(html).toContain("<h2")
})

test("the words are real text: a heading, a list, and menu lines with the price read after the dish", () => {
  render(<Chalkboard label="Menu" defaultContent={menu} />)
  expect(within(board()).getByRole("heading", { name: "Today" })).toBeTruthy()
  const items = within(board())
    .getAllByRole("listitem")
    .map((item) => item.textContent)
  expect(items).toEqual(["Soup4.50", "Sardines9.80", "Dogs welcome", "Terrace open"])
  expect(board().querySelector('[data-slot="chalkboard-leader"]')?.getAttribute("aria-hidden")).toBe("true")
  expect(board().querySelector('[data-slot="chalkboard-tray"]')?.getAttribute("aria-hidden")).toBe("true")
})

test("the reveal times each line after the one before, longer lines taking longer", () => {
  render(<Chalkboard label="Menu" defaultContent={menu} reveal writingSpeed={20} />)
  const lines = [...board().querySelectorAll<HTMLElement>("[data-line]")]
  const at = lines.map((line) => Number.parseInt(line.style.getPropertyValue("--chalk-at"), 10))
  const lasting = lines.map((line) => Number.parseInt(line.style.getPropertyValue("--chalk-for"), 10))
  expect(at[0]).toBe(0)
  for (let index = 1; index < at.length; index++) expect(at[index]).toBeGreaterThan(at[index - 1]!)
  expect(lasting[5]).toBeGreaterThan(lasting[1]!)
})

test("new words wipe the old ones: the old text leaves the reading order and the smudge clears it", () => {
  const { rerender } = render(<Chalkboard label="Menu" content="# Lunch" />)
  rerender(<Chalkboard label="Menu" content="# Dinner" />)
  expect(within(board()).getByRole("heading", { name: "Dinner" })).toBeTruthy()
  expect(within(board()).queryByRole("heading", { name: "Lunch" })).toBeNull()
  const erasing = board().querySelector('[data-slot="chalkboard-erasing"]')
  expect(erasing?.getAttribute("aria-hidden")).toBe("true")
  expect(writing().hasAttribute("data-wiped")).toBe(true)
  endAnimationAsReactHearsItInJsdom(board().querySelector('[data-slot="chalkboard-smudge"]')!)
  expect(board().querySelector('[data-slot="chalkboard-erasing"]')).toBeNull()
})

test("the same content passed again doesn't wipe the board", () => {
  const { rerender } = render(<Chalkboard label="Menu" content={[{ type: "text", text: "Open" }]} />)
  rerender(<Chalkboard label="Menu" content={[{ type: "text", text: "Open" }]} />)
  expect(board().querySelector('[data-slot="chalkboard-erasing"]')).toBeNull()
})

test("it has no axe violations", async () => {
  const { container } = render(<Chalkboard label="Menu" defaultContent={menu} reveal />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the board and writes on it, in text or blocks", async () => {
  render(<Chalkboard label="Menu" defaultContent={menu} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.find((entry) => entry.label === "Menu")?.actions).toEqual(["write"])

  let result = await act(() =>
    agent.act({ steps: [{ ref: "Menu", action: "write", args: ["# Closed\nBack on Monday"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(within(board()).getByRole("heading", { name: "Closed" })).toBeTruthy()
  expect(within(board()).getByText("Back on Monday")).toBeTruthy()

  result = await act(() =>
    agent.act({
      steps: [{ ref: "Menu", action: "write", args: [[{ type: "menu", items: [{ name: "Tea", price: "2.00" }] }]] }],
    }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(within(writing()).getByText("Tea")).toBeTruthy()
})
