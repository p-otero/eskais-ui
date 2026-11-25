import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"

import { EjectorButton, type EjectorButtonProps } from "@/components/ui/ejector-button"
import { ejectorButton, ejectorRelease } from "@/components/ui/ejector-button-primitive"
import { parseActionRefusal } from "@/lib/action-refusal"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

afterEach(() => {
  approve = false
  vi.useRealTimers()
})

function DeleteStaging(props: Partial<EjectorButtonProps>) {
  return (
    <EjectorButton
      label="Delete staging"
      agentConfirm="Deletes the staging environment"
      onEject={() => {}}
      {...props}
    />
  )
}

const group = () => screen.getByRole("group", { name: "Delete staging" })
const cover = () => screen.getByRole("button", { name: "Safety cover" })
const release = () => screen.getByRole("button", { name: "Delete staging" })

test("primitives: render on the server", () => {
  checkServer(ejectorButton, {}, `<root aria-label="Delete staging"></root>`)
  checkServer(ejectorRelease, { armed: true }, `<root aria-label="Delete staging"></root>`)
})

test("it renders on the server with the cover closed", () => {
  const html = renderToString(<DeleteStaging />)
  expect(html).toContain('data-slot="ejector-button-cover"')
  expect(html).toContain('aria-pressed="false"')
})

test("two deliberate steps: open the cover, then press the button; then the cover closes", async () => {
  const user = userEvent.setup()
  const onEject = vi.fn()
  const onArmedChange = vi.fn()
  render(<DeleteStaging onEject={onEject} onArmedChange={onArmedChange} />)
  expect(release().getAttribute("tabindex")).toBe("-1")
  expect(release().dataset.agentConfirm).toBe("Deletes the staging environment")

  await user.click(release())
  expect(onEject).not.toHaveBeenCalled()

  await user.click(cover())
  expect(cover().getAttribute("aria-pressed")).toBe("true")
  expect(group().hasAttribute("data-armed")).toBe(true)
  expect(release().hasAttribute("tabindex")).toBe(false)
  expect(onArmedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: "cover-press" }))

  await user.tab()
  expect(document.activeElement).toBe(release())
  await user.keyboard("{Enter}")
  expect(onEject).toHaveBeenCalledWith(expect.objectContaining({ reason: "press" }))
  expect(onArmedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "eject" }))
  expect(cover().getAttribute("aria-pressed")).toBe("false")
})

test("the cover closes after armTimeoutMs, and on Escape with focus back on the cover", async () => {
  vi.useFakeTimers()
  const onArmedChange = vi.fn()
  render(<DeleteStaging armTimeoutMs={2000} onArmedChange={onArmedChange} />)
  fireEvent.click(cover())
  act(() => {
    vi.advanceTimersByTime(1999)
  })
  expect(group().hasAttribute("data-armed")).toBe(true)
  act(() => {
    vi.advanceTimersByTime(1)
  })
  expect(onArmedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "timeout" }))
  expect(group().hasAttribute("data-armed")).toBe(false)

  fireEvent.click(cover())
  act(() => release().focus())
  fireEvent.keyDown(release(), { key: "Escape" })
  expect(onArmedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }))
  expect(document.activeElement).toBe(cover())
})

test("a returned Promise keeps the button busy and the cover open, past the timeout, until it settles", async () => {
  vi.useFakeTimers()
  const work = Promise.withResolvers<void>()
  render(<DeleteStaging armTimeoutMs={1000} onEject={() => work.promise} />)
  fireEvent.click(cover())
  fireEvent.click(release())
  expect(release().getAttribute("aria-busy")).toBe("true")
  expect(group().hasAttribute("data-pending")).toBe(true)
  act(() => {
    vi.advanceTimersByTime(5000)
  })
  expect(group().hasAttribute("data-armed")).toBe(true)
  fireEvent.keyDown(release(), { key: "Escape" })
  expect(group().hasAttribute("data-armed")).toBe(true)
  await act(async () => work.resolve())
  expect(release().hasAttribute("aria-busy")).toBe(false)
  expect(group().hasAttribute("data-armed")).toBe(false)
})

test("a cancelled arm keeps the cover closed; labels.cover names it", async () => {
  const user = userEvent.setup()
  render(<DeleteStaging labels={{ cover: "Tapa" }} onArmedChange={(_armed, details) => details.cancel()} />)
  const lid = screen.getByRole("button", { name: "Tapa" })
  await user.click(lid)
  expect(lid.getAttribute("aria-pressed")).toBe("false")
})

test("it has no axe violations, covered or armed", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <DeleteStaging />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(cover())
  expect(await axeViolations(container)).toEqual([])
})

test("an agent arms it, and its eject waits for a person: refused, then approved", async () => {
  const onEject = vi.fn()
  render(<DeleteStaging onEject={onEject} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const button = entries.find((entry) => entry.actions.includes("eject"))
  expect(button?.confirm).toBe("Deletes the staging environment")
  expect(entries.find((entry) => entry.actions.includes("arm"))?.label).toBe("Delete staging")

  let result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "eject" }] }))
  expect(result.ok).toBe(false)
  expect(onEject).not.toHaveBeenCalled()

  approve = true
  result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "eject" }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "eject", kind: "unavailable" })
  expect(result.error?.message).toContain("eject isn't available while the cover is closed: arm it first")
  approve = false

  result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "arm" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(cover().getAttribute("aria-pressed")).toBe("true")

  result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "eject" }] }))
  expect(result.ok).toBe(false)
  expect(onEject).not.toHaveBeenCalled()

  approve = true
  result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "eject" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onEject).toHaveBeenCalledWith(expect.objectContaining({ reason: "imperative" }))
  expect(cover().getAttribute("aria-pressed")).toBe("false")

  result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "arm" }] }))
  result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "disarm" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(cover().getAttribute("aria-pressed")).toBe("false")
})

test("an agent's arm the app cancels, or on a disabled ejector, fails with why", async () => {
  const { rerender } = render(<DeleteStaging onArmedChange={(_armed, details) => details.cancel()} />)
  let result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "arm" }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "arm", kind: "refused" })

  rerender(<DeleteStaging disabled />)
  result = await act(() => agent.act({ steps: [{ ref: "Delete staging", action: "arm" }] }))
  expect(result.error?.message).toContain("arm isn't available while the ejector is disabled")
  expect(cover().getAttribute("aria-pressed")).toBe("false")
})
