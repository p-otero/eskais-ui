import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"

import { axeViolations } from "./axe"

test("variant and size are exposed as data attributes and classes", () => {
  render(
    <Button variant="destructive" size="sm">
      Delete
    </Button>,
  )
  const button = screen.getByRole("button", { name: "Delete" })
  expect(button.dataset.slot).toBe("button")
  expect(button.dataset.variant).toBe("destructive")
  expect(button.dataset.size).toBe("sm")
  expect(button.className).toContain("bg-destructive")
  expect(button.getAttribute("type")).toBe("button")
})

test("an async click keeps the button pending and ignores repeated presses", async () => {
  const user = userEvent.setup()
  const work = Promise.withResolvers<void>()
  const save = vi.fn(() => work.promise)
  render(<Button onClick={save}>Save</Button>)
  const button = screen.getByRole("button", { name: "Save" })

  await user.click(button)
  await user.click(button)
  expect(save).toHaveBeenCalledTimes(1)
  expect(button.getAttribute("aria-busy")).toBe("true")
  expect(button.getAttribute("aria-disabled")).toBe("true")
  expect(button.hasAttribute("data-pending")).toBe(true)
  expect(document.activeElement).toBe(button)

  work.resolve()
  await vi.waitFor(() => expect(button.hasAttribute("data-pending")).toBe(false))
  expect(button.hasAttribute("aria-disabled")).toBe(false)
})

test("a state function className still receives the part state", async () => {
  const user = userEvent.setup()
  const work = Promise.withResolvers<void>()
  render(
    <Button
      onClick={() => work.promise}
      // oxlint-disable-next-line shadcn/require-static-classes -- this test proves cnState forwards a state function
      className={(state) => (state.pending ? "is-pending" : "is-idle")}
    >
      Sync
    </Button>,
  )
  const button = screen.getByRole("button", { name: "Sync" })
  expect(button.className).toContain("is-idle")
  expect(button.className).toContain("bg-primary")
  await user.click(button)
  expect(button.className).toContain("is-pending")
  work.resolve()
})

test("focusableWhenDisabled keeps it in the tab order without running the handler", async () => {
  const user = userEvent.setup()
  const publish = vi.fn()
  render(
    <Button disabled focusableWhenDisabled onClick={publish}>
      Publish
    </Button>,
  )
  await user.tab()
  const button = screen.getByRole("button", { name: "Publish" })
  expect(document.activeElement).toBe(button)
  await user.keyboard("{Enter}")
  expect(publish).not.toHaveBeenCalled()
})

test("loading marks the button busy, keeps focus and ignores presses and submits", async () => {
  const user = userEvent.setup()
  const save = vi.fn()
  const submit = vi.fn((event: SubmitEvent) => event.preventDefault())
  const { rerender } = render(
    <form onSubmit={(event) => submit(event.nativeEvent as SubmitEvent)}>
      <Button type="submit" onClick={save}>
        Save
      </Button>
    </form>,
  )
  const button = screen.getByRole("button", { name: "Save" })
  button.focus()
  rerender(
    <form onSubmit={(event) => submit(event.nativeEvent as SubmitEvent)}>
      <Button type="submit" loading onClick={save}>
        Save
      </Button>
    </form>,
  )
  expect(button.getAttribute("aria-busy")).toBe("true")
  expect(button.getAttribute("aria-disabled")).toBe("true")
  expect(button.hasAttribute("data-pending")).toBe(true)
  expect(button.hasAttribute("disabled")).toBe(false)
  expect(document.activeElement).toBe(button)
  expect(button.className).toContain("data-disabled:not-data-pending:opacity-50")

  await user.click(button)
  await user.keyboard("{Enter}")
  await user.keyboard(" ")
  expect(save).not.toHaveBeenCalled()
  expect(submit).not.toHaveBeenCalled()

  rerender(
    <form onSubmit={(event) => submit(event.nativeEvent as SubmitEvent)}>
      <Button type="submit" loading={false} onClick={save}>
        Save
      </Button>
    </form>,
  )
  expect(button.hasAttribute("aria-busy")).toBe(false)
  expect(button.hasAttribute("data-pending")).toBe(false)
  await user.click(button)
  expect(save).toHaveBeenCalledOnce()
  expect(submit).toHaveBeenCalledOnce()
})

test("an idle button renders no spinner; one appears while it's busy", async () => {
  const user = userEvent.setup()
  const pending = Promise.withResolvers<void>()
  render(<Button onClick={() => pending.promise}>Save</Button>)
  const button = screen.getByRole("button", { name: "Save" })
  expect(button.querySelector("[data-slot=spinner]")).toBeNull()
  await user.click(button)
  expect(button.querySelector("[data-slot=spinner]")).not.toBeNull()
  await act(async () => pending.resolve())
  expect(button.querySelector("[data-slot=spinner]")).toBeNull()
})

test("the spinner takes the leading icon's place, so the width holds", () => {
  const { container } = render(
    <Button loading>
      <svg data-testid="icon" aria-hidden="true" />
      Upload
    </Button>,
  )
  const button = screen.getByRole("button", { name: "Upload" })
  const [spinner, icon] = button.children
  expect(spinner!.getAttribute("data-slot")).toBe("spinner")
  expect(spinner!.getAttribute("data-show")).toBe("pending")
  expect(icon).toBe(screen.getByTestId("icon"))
  expect(button.className).toContain("data-pending:[&>[data-slot=spinner]+*]:hidden")
  expect(container.querySelector("[data-slot=spinner]")?.hasAttribute("data-overlay")).toBe(false)
})

test("without an icon the spinner centers over the label, which keeps its name and space", () => {
  render(
    <Button variant="outline" loading>
      Publish
    </Button>,
  )
  const button = screen.getByRole("button", { name: "Publish" })
  const spinner = button.querySelector("[data-slot=spinner]")!
  expect(spinner.hasAttribute("data-overlay")).toBe(true)
  expect(spinner.getAttribute("class")).toContain("absolute")
  expect(spinner.getAttribute("class")).toContain("text-foreground")
  expect(button.lastChild?.nodeType).toBe(Node.TEXT_NODE)
  expect(button.className).toContain("data-pending:has-[>[data-slot=spinner][data-overlay]]:text-transparent!")
  expect(button.className).toContain("data-pending:relative")
})

test("an icon button keeps its name and swaps its icon for the spinner", () => {
  render(
    <Button size="icon" aria-label="Refresh" loading>
      <svg aria-hidden="true" />
    </Button>,
  )
  const button = screen.getByRole("button", { name: "Refresh" })
  expect(button.firstElementChild?.getAttribute("data-slot")).toBe("spinner")
  expect(button.querySelector("[data-overlay]")).toBeNull()
})

test("a Promise from onClick still shows the spinner while pending", async () => {
  const user = userEvent.setup()
  const work = Promise.withResolvers<void>()
  render(<Button onClick={() => work.promise}>Sync</Button>)
  const button = screen.getByRole("button", { name: "Sync" })
  await user.click(button)
  expect(button.hasAttribute("data-pending")).toBe(true)
  expect(button.querySelector("[data-slot=spinner]")).toBeTruthy()
  work.resolve()
  await vi.waitFor(() => expect(button.hasAttribute("data-pending")).toBe(false))
})

test("an agent can't press a loading button", async () => {
  const agent = createAgent()
  const save = vi.fn()
  const { rerender } = render(<Button onClick={save}>Save draft</Button>)
  const entry = agent.snapshot().find((item) => item.label === "Save draft")
  expect(entry?.component).toBe("button")
  rerender(
    <Button loading onClick={save}>
      Save draft
    </Button>,
  )
  const result = await act(() => agent.act({ steps: [{ ref: "Save draft", action: "press" }] }))
  expect(result.ok).toBe(false)
  expect(save).not.toHaveBeenCalled()
  rerender(<Button onClick={save}>Save draft</Button>)
  const again = await act(() => agent.act({ steps: [{ ref: "Save draft", action: "press" }] }))
  expect(again.ok, again.error?.message).toBe(true)
  expect(save).toHaveBeenCalledOnce()
})

test("a loading button has no axe violations", async () => {
  const { container } = render(
    <>
      <Button loading>Save</Button>
      <Button size="icon" aria-label="Refresh" loading>
        <svg aria-hidden="true" />
      </Button>
    </>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("wrap lets a text button shrink and wrap its label; icon buttons ignore it", () => {
  render(
    <>
      <Button wrap>A long label that has to wrap in a tight row</Button>
      <Button size="icon" aria-label="Close" wrap>
        ×
      </Button>
    </>,
  )
  const text = screen.getByRole("button", { name: /long label/ }).classList
  expect(text.contains("whitespace-normal")).toBe(true)
  expect(text.contains("min-h-control")).toBe(true)
  expect(text.contains("whitespace-nowrap")).toBe(false)
  expect(text.contains("shrink-0")).toBe(false)
  expect(screen.getByRole("button", { name: "Close" }).classList.contains("whitespace-nowrap")).toBe(true)
})
