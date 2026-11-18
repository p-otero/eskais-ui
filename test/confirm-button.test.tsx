import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { ConfirmButton } from "@/components/ui/confirm-button"
import { confirmButton } from "@/components/ui/confirm-button-primitive"

import { axeViolations } from "./axe"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

afterEach(() => {
  approve = false
  vi.useRealTimers()
})

test("primitive: the first press arms, the second confirms", async () => {
  const onConfirm = vi.fn()
  const view = mount(confirmButton, { onConfirm, armedAnnouncement: "Press again" }, `<root>Delete</root>`)
  try {
    await view.click(view.root)
    expect(view.root.hasAttribute("data-armed")).toBe(true)
    expect(view.announced).toContain("Press again")
    expect(onConfirm).not.toHaveBeenCalled()
    await view.click(view.root)
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ reason: "trigger-press" }))
    expect(view.root.hasAttribute("data-armed")).toBe(false)
    expect(view.changes.map((change) => change.reason)).toEqual(["trigger-press", "confirm"])
  } finally {
    view.unmount()
  }
})

test("primitive: Escape and focus leaving disarm, each with its reason", async () => {
  const onArmedChange = vi.fn()
  const view = mount(confirmButton, { onArmedChange }, `<root>Delete</root>`)
  try {
    await view.keys("Tab", "Enter")
    expect(view.state.armed).toBe(true)
    await view.keys("Escape")
    expect(onArmedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }))
    await view.keys("Enter")
    expect(view.state.armed).toBe(true)
    view.root.blur()
    expect(onArmedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "focus-out" }))
  } finally {
    view.unmount()
  }
})

test("primitive: a canceled arm keeps the button idle", async () => {
  const onConfirm = vi.fn()
  const view = mount(
    confirmButton,
    { onConfirm, onArmedChange: (armed, details) => armed && details.cancel() },
    `<root>Delete</root>`,
  )
  try {
    await view.click(view.root)
    await view.click(view.root)
    expect(view.state.armed).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(confirmButton, { defaultArmed: true }, `<root>Delete</root>`)
})

test("it disarms after the timeout and keeps its width with both labels in one cell", async () => {
  vi.useFakeTimers()
  const onArmedChange = vi.fn()
  render(
    <ConfirmButton agentConfirm="Deletes the project" timeout={2000} onArmedChange={onArmedChange} onConfirm={() => {}}>
      Delete project
    </ConfirmButton>,
  )
  const button = screen.getByRole("button", { name: "Delete project" })
  fireEvent.click(button)
  expect(screen.getByRole("button", { name: "Press again to confirm" })).toBe(button)
  expect(button.dataset.agentConfirm).toBe("Deletes the project")
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(onArmedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "timeout" }))
  expect(screen.getByRole("button", { name: "Delete project" })).toBe(button)
})

test("a returned Promise marks the button pending until it settles", async () => {
  const user = userEvent.setup()
  const { promise, resolve: finish } = Promise.withResolvers<void>()
  const onConfirm = () => promise
  render(
    <ConfirmButton agentConfirm="Deletes the project" onConfirm={onConfirm} labels={{ armed: "¿Seguro?" }}>
      Delete
    </ConfirmButton>,
  )
  const button = screen.getByRole("button", { name: "Delete" })
  await user.click(button)
  expect(screen.getByRole("button", { name: "¿Seguro?" })).toBe(button)
  await user.click(button)
  expect(button.getAttribute("aria-busy")).toBe("true")
  await act(async () => finish())
  expect(button.hasAttribute("aria-busy")).toBe(false)
})

test("holding the button confirms, and the release doesn't arm it again", async () => {
  vi.useFakeTimers()
  const onConfirm = vi.fn()
  render(
    <ConfirmButton agentConfirm="Deletes the project" hold={800} onConfirm={onConfirm}>
      Delete
    </ConfirmButton>,
  )
  const button = screen.getByRole("button", { name: "Delete" })
  fireEvent.pointerDown(button, { button: 0 })
  expect(button.hasAttribute("data-holding")).toBe(true)
  act(() => {
    vi.advanceTimersByTime(800)
  })
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ reason: "hold" }))
  fireEvent.pointerUp(button)
  fireEvent.click(button)
  expect(button.hasAttribute("data-armed")).toBe(false)
  act(() => {
    vi.advanceTimersByTime(1)
  })
  fireEvent.pointerDown(button, { button: 0 })
  fireEvent.pointerUp(button)
  fireEvent.click(button)
  expect(button.hasAttribute("data-armed")).toBe(true)
})

test("no axe violations, idle or armed", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <ConfirmButton agentConfirm="Deletes the project" onConfirm={() => {}}>
        Delete
      </ConfirmButton>
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Delete" }))
  expect(await axeViolations(container)).toEqual([])
})

test("an agent's confirm waits for a person: refused, then approved", async () => {
  const onConfirm = vi.fn()
  render(
    <ConfirmButton agentConfirm="Deletes the project and its files" onConfirm={onConfirm}>
      Delete project
    </ConfirmButton>,
  )
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const entry = agent.snapshot().find((component) => component.label === "Delete project")
  expect(entry?.actions).toEqual(["confirm"])
  expect(entry?.confirm).toBe("Deletes the project and its files")

  const step = { steps: [{ ref: "Delete project", action: "confirm" }] }
  const refused = await act(() => agent.act(step))
  expect(refused.ok).toBe(false)
  expect(onConfirm).not.toHaveBeenCalled()

  approve = true
  const approved = await act(() => agent.act(step))
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ reason: "imperative" }))
})
