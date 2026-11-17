import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { SidePanel, type SidePanelNarrow } from "@/components/ui/side-panel"
import { narrowQuery } from "@/components/ui/use-media-query"
import { StatusPill } from "@/components/ui/status-pill"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

test("the header's actions share a wrapping row with the heading, and the close button keeps its corner", async () => {
  const { container } = render(
    <SidePanel
      open
      onOpenChange={() => {}}
      title="Webhook retries stop after the first timeout"
      description="Opened two days ago"
      actions={
        <>
          <StatusPill tone="info">In review</StatusPill>
          <Button size="sm">Assign</Button>
        </>
      }
    />,
  )
  const heading = container.querySelector<HTMLElement>("[data-slot=side-panel-heading]")
  const actions = container.querySelector<HTMLElement>("[data-slot=side-panel-actions]")
  expect(heading?.className).toContain("basis-(--card-heading-basis)")
  expect(heading?.className).toContain("grow")
  expect(actions?.parentElement).toBe(heading?.parentElement)
  expect(actions?.parentElement?.className).toContain("flex-wrap")
  expect(actions?.contains(screen.getByRole("button", { name: "Assign" }))).toBe(true)
  expect(actions?.contains(screen.getByRole("button", { name: "Close" }))).toBe(false)
  expect(await axeViolations(container)).toEqual([])
})

test("without actions there is no actions box", () => {
  const { container } = render(<SidePanel open onOpenChange={() => {}} title="Detail" />)
  expect(container.querySelector("[data-slot=side-panel-actions]")).toBeNull()
})

function mockNarrow(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches && query === narrowQuery,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  // The drawer's sheet snaps with one once matchMedia exists; jsdom has none.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
}

afterEach(() => vi.unstubAllGlobals())

function Panel({ narrow }: { narrow?: SidePanelNarrow }) {
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
        description="From Ana"
        narrow={narrow}
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

test("narrow defaults to stack: in the flow, full width, its parent wrapping it below the list", () => {
  render(<SidePanel open onOpenChange={() => {}} title="Detail" />)
  const panel = screen.getByRole("complementary", { name: "Detail" })
  expect(panel.dataset.narrow).toBe("stack")
  expect(panel.className).toContain("narrow:[:has(>&)]:flex-wrap")
  expect(panel.className).toContain("narrow:w-full")
  expect(panel.className).not.toContain("narrow:absolute")
})

test('narrow="overlay" covers its positioned parent, as before', () => {
  render(<SidePanel open onOpenChange={() => {}} title="Detail" narrow="overlay" />)
  const panel = screen.getByRole("complementary", { name: "Detail" })
  expect(panel.className).toContain("narrow:absolute")
  expect(panel.className).toContain("narrow:inset-0")
})

test('narrow="sheet" stays a side panel on a wide screen', () => {
  mockNarrow(false)
  render(<SidePanel open onOpenChange={() => {}} title="Detail" narrow="sheet" />)
  expect(screen.getByRole("complementary", { name: "Detail" })).toBeTruthy()
  expect(screen.queryByRole("dialog")).toBeNull()
})

test('narrow="sheet" on a narrow screen is a modal bottom sheet: focus moves in, shortcuts run, Escape returns focus', async () => {
  mockNarrow(true)
  const user = userEvent.setup()
  const { baseElement } = render(<Panel narrow="sheet" />)
  await user.click(screen.getByRole("button", { name: "Open detail" }))
  await settle(50)
  const sheet = screen.getByRole("dialog", { name: "Item detail" })
  expect(sheet.getAttribute("data-side")).toBe("bottom")
  expect(screen.queryByRole("complementary")).toBeNull()
  expect(sheet.contains(document.activeElement)).toBe(true)
  expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy()
  expect(baseElement.querySelector("[data-slot=side-panel][data-narrow=sheet]")).not.toBeNull()

  await user.keyboard("u")
  expect(screen.getByRole("status").textContent).toBe("read")

  await user.keyboard("{Escape}")
  await settle(400)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement?.id).toBe("opener")
})
