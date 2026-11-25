import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"

import { RetroTv } from "@/components/ui/retro-tv"
import { Teletext } from "@/components/ui/teletext"
import { teletextMosaic, type TeletextPage } from "@/components/ui/teletext-page"
import { teletext } from "@/components/ui/teletext-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()

const fastext = { red: { page: 101, label: "News" }, green: { page: 400, label: "Weather" } }

const pages: Record<number, TeletextPage> = {
  100: {
    title: "Index",
    rows: [
      { spans: [{ text: " INDEX", fg: "yellow", bg: "blue" }], doubleHeight: true, heading: true },
      [{ text: "covered by the row above" }],
      [{ mosaic: [63, 0, 21], fg: "cyan" }, { text: " News 101" }],
      [{ text: "x".repeat(50) }],
    ],
    fastext,
  },
  101: {
    title: "News",
    subpages: [[[{ text: "First story" }]], [[{ text: "Second story" }]]],
    fastext: { blue: { page: 100, label: "Index" } },
  },
  400: { title: "Weather", rows: [[{ text: "Sunny", flash: true }]], fastext },
}

afterEach(() => {
  vi.useRealTimers()
})

const region = () => screen.getByRole("region")
const heading = () => within(region()).getByRole("heading")

test("block art becomes mosaic cells, two characters across and three lines down each", () => {
  expect(teletextMosaic(["##..", "#...", "##.#"])).toEqual([[1 | 2 | 4 | 16 | 32, 32]])
  expect(teletextMosaic(["#", "", "", "", "#"])).toEqual([[1], [4]])
})

test("primitive: renders on the server", () => {
  checkServer(teletext, { pages }, `<root aria-label="Teletext"><page></page></root>`)
})

test("the set renders its first page on the server, without a clock to mismatch", () => {
  const html = renderToString(<Teletext label="Teletext" pages={pages} service="ESKAIS" />)
  expect(html).toContain("P100")
  expect(html).toContain("INDEX")
  expect(html).not.toMatch(/\d\d:\d\d\/\d\d/)
})

test("a page is a region named by its title, with a heading, real text, a hidden mosaic and rows cut at 40 cells", () => {
  render(<Teletext label="Teletext" pages={pages} clock={false} />)
  expect(region().getAttribute("aria-label")).toBe("Index")
  expect(heading().textContent).toBe(" INDEX")
  expect(within(region()).queryByText("covered by the row above")).toBeNull()
  expect(within(region()).getByText(/News 101/)).toBeTruthy()
  expect(region().querySelector('[data-slot="teletext-mosaic"]')?.getAttribute("aria-hidden")).toBe("true")
  expect(within(region()).getByText("x".repeat(40))).toBeTruthy()
})

test("three digits tune: the header shows them as they're typed, and the new page has its own heading", async () => {
  const user = userEvent.setup()
  const onPageChange = vi.fn()
  render(<Teletext label="Teletext" pages={pages} searchMs={0} clock={false} onPageChange={onPageChange} />)
  region().focus()
  await user.keyboard("4")
  expect(screen.getByText("P4--")).toBeTruthy()
  await user.keyboard("{Backspace}10")
  await user.keyboard("1")
  expect(onPageChange).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "digit-key" }))
  expect(heading().textContent).toBe("News")
  expect(screen.getByText("P101")).toBeTruthy()
})

test("a page that isn't broadcast leaves its number on the header and the page as it was", async () => {
  const user = userEvent.setup()
  render(<Teletext label="Teletext" pages={pages} searchMs={0} clock={false} />)
  region().focus()
  await user.keyboard("999")
  expect(screen.getByText("P999")).toBeTruthy()
  expect(heading().textContent).toBe(" INDEX")
})

test("the counter searches before the page shows", async () => {
  vi.useFakeTimers()
  window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never
  render(<Teletext label="Teletext" pages={pages} searchMs={600} clock={false} defaultPage={100} />)
  await act(() => screen.getByRole("button", { name: "Weather" }).click())
  expect(screen.getByRole("group", { name: "Teletext" }).hasAttribute("data-searching")).toBe(true)
  expect(heading().textContent).toBe(" INDEX")
  await act(() => vi.advanceTimersByTimeAsync(700))
  expect(region().getAttribute("aria-label")).toBe("Weather")
})

test("subpages turn by themselves and with Left and Right, shown as n/m on the header", async () => {
  vi.useFakeTimers()
  render(<Teletext label="Teletext" pages={pages} defaultPage={101} subpageMs={1000} clock={false} />)
  expect(screen.getByText("1/2")).toBeTruthy()
  expect(within(region()).getByText("First story")).toBeTruthy()
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(within(region()).getByText("Second story")).toBeTruthy()
  vi.useRealTimers()
  const user = userEvent.setup()
  region().focus()
  await user.keyboard("{ArrowRight}")
  expect(within(region()).getByText("First story")).toBeTruthy()
  expect(screen.getByText("1/2")).toBeTruthy()
})

test("the coloured keys are buttons named by the bottom row's words, only where the page links", () => {
  render(<Teletext label="Teletext" pages={pages} clock={false} />)
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["News", "Weather"])
})

test("it has no axe violations", async () => {
  const { container } = render(<Teletext label="Teletext" pages={pages} clock={false} />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent goes to a page, presses a coloured key, and presses a key by its word", async () => {
  render(<Teletext label="Teletext" pages={pages} searchMs={0} clock={false} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.find((entry) => entry.label === "Teletext")?.actions).toEqual(
    expect.arrayContaining(["goToPage", "fastext"]),
  )
  expect(entries.map((entry) => entry.label)).toEqual(expect.arrayContaining(["News", "Weather"]))

  let result = await act(() => agent.act({ steps: [{ ref: "Teletext", action: "goToPage", args: [400] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(region().getAttribute("aria-label")).toBe("Weather")

  result = await act(() => agent.act({ steps: [{ ref: "Teletext", action: "fastext", args: ["red"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(region().getAttribute("aria-label")).toBe("News")

  result = await act(() => agent.act({ steps: [{ ref: "Index", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(region().getAttribute("aria-label")).toBe("Index")

  result = await act(() => agent.act({ steps: [{ ref: "Teletext", action: "goToPage", args: [555] }] }))
  expect(result.error?.message).toContain("can't find page 555")
  expect(region().getAttribute("aria-label")).toBe("Index")
})

test("inside a RetroTv the set tunes as usual, and switching the TV off leaves the page inert", async () => {
  const user = userEvent.setup()
  render(
    <RetroTv label="Living room TV">
      <Teletext label="Teletext" pages={pages} screen="flat" searchMs={0} clock={false} />
    </RetroTv>,
  )
  expect(screen.getByRole("group", { name: "Teletext" }).getAttribute("data-screen")).toBe("flat")
  await user.click(screen.getByRole("button", { name: "Weather" }))
  expect(region().getAttribute("aria-label")).toBe("Weather")
  await user.click(screen.getByRole("button", { name: "Power" }))
  expect(region().closest("[inert]")).not.toBeNull()
})
