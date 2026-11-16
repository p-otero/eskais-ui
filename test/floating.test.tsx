import { readFileSync } from "node:fs"

import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { FilterBar, FilterBarButton } from "@/components/ui/filter-bar"
import { Floating, FloatingContent } from "@/components/ui/floating"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

function ActionBar({ onArchive, onDelete }: { onArchive?: () => void; onDelete?: () => void }) {
  return (
    <Floating side="bottom" align="end">
      <FloatingContent>
        <FilterBar label="Selection actions" className="w-auto">
          <FilterBarButton onClick={onArchive}>Archive</FilterBarButton>
          <FilterBarButton data-agent-confirm="Deletes the 3 selected runs" onClick={onDelete}>
            Delete
          </FilterBarButton>
        </FilterBar>
      </FloatingContent>
    </Floating>
  )
}

test("floating defaults to a sticky bar centred on the bottom edge, offset by the token and the safe area", () => {
  const { container } = render(<Floating />)
  const floating = container.querySelector<HTMLElement>("[data-slot=floating]")!
  expect(floating.dataset).toMatchObject({ side: "bottom", align: "center", strategy: "sticky" })
  expect(floating.className).toContain("sticky")
  expect(floating.className).toContain("justify-center")
  expect(floating.className).toContain("bottom-[calc(var(--floating-offset)+env(safe-area-inset-bottom))]")
})

test("each side, alignment and strategy maps to logical positioning", () => {
  const { container, rerender } = render(<Floating side="start" align="end" strategy="fixed" />)
  const floating = () => container.querySelector<HTMLElement>("[data-slot=floating]")!
  expect(floating().className).toContain("fixed")
  expect(floating().className).toContain("start-[calc(var(--floating-offset)+env(safe-area-inset-left))]")
  expect(floating().className).toContain("rtl:start-[calc(var(--floating-offset)+env(safe-area-inset-right))]")
  expect(floating().className).toContain("flex-col")
  expect(floating().className).toContain("justify-end")
  rerender(<Floating side="top" align="start" strategy="absolute" />)
  expect(floating().className).toContain("absolute")
  expect(floating().className).toContain("top-[calc(var(--floating-offset)+env(safe-area-inset-top))]")
  expect(floating().className).toContain("justify-start")
})

test("floating never uses a viewport height unit", () => {
  const source = readFileSync("registry/ui/floating.tsx", "utf8")
  expect(source).not.toMatch(/\b\d+(\.\d+)?[dls]?vh\b|\b(min-|max-)?h-(screen|[dls]?vh)\b/)
})

test("the floating elevation tokens and utilities exist, with a flat override", () => {
  const theme = readFileSync("registry/styles/theme.css", "utf8")
  for (const token of ["shadow", "radius", "backdrop", "border", "offset", "opacity"]) {
    expect(theme).toContain(`--floating-${token}:`)
  }
  for (const utility of ["surface-floating", "bg-floating", "backdrop-floating"]) {
    expect(theme).toContain(`@utility ${utility} {`)
  }
  expect(theme).toContain('[data-elevation="flat"]')
})

test("a floating action bar keeps its toolbar operable and accessible", async () => {
  const onArchive = vi.fn()
  const { container } = render(<ActionBar onArchive={onArchive} />)
  await settle()
  expect(screen.getByRole("toolbar", { name: "Selection actions" })).toBeTruthy()
  screen.getByRole("button", { name: "Archive" }).click()
  expect(onArchive).toHaveBeenCalledOnce()
  expect(await axeViolations(container)).toEqual([])
})

test("an agent presses the bar's buttons, and Delete waits for approval", async () => {
  const onArchive = vi.fn()
  const onDelete = vi.fn()
  render(<ActionBar onArchive={onArchive} onDelete={onDelete} />)
  await settle()
  for (const entry of agent.snapshot().filter((item) => !item.offPage && item.component !== "more")) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }

  const archived = await act(() =>
    agent.act({ steps: [{ ref: "Selection actions", action: "press", args: ["Archive"] }] }),
  )
  expect(archived.ok, archived.error?.message).toBe(true)
  expect(onArchive).toHaveBeenCalledOnce()

  approve = false
  const refused = await act(() =>
    agent.act({ steps: [{ ref: "Selection actions", action: "press", args: ["Delete"] }] }),
  )
  expect(refused.ok).toBe(false)
  expect(onDelete).not.toHaveBeenCalled()

  approve = true
  const deleted = await act(() =>
    agent.act({ steps: [{ ref: "Selection actions", action: "press", args: ["Delete"] }] }),
  )
  expect(deleted.ok, deleted.error?.message).toBe(true)
  expect(onDelete).toHaveBeenCalledOnce()
})
