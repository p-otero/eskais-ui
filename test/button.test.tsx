import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"

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
