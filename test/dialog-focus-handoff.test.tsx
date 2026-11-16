import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import {
  createDialogController,
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { settle } from "./overlay-helpers"

// Holds every exit transition open until `finish()`, the way a 200ms CSS transition keeps a closing dialog mounted.
function holdExitAnimations() {
  const { promise: finished, resolve: finish } = Promise.withResolvers<void>()
  const spy = vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (this: Element) {
    if (!this.hasAttribute("data-ending-style")) return []
    return [{ finished, playState: "running", cancel: () => {}, finish: () => {} } as unknown as Animation]
  })
  return {
    finish: async () => {
      finish()
      await settle(10)
    },
    restore: () => spy.mockRestore(),
  }
}

afterEach(() => vi.restoreAllMocks())

function TwoDialogs() {
  const [second] = useState(() => createDialogController())
  return (
    <>
      <Dialog>
        <DialogTrigger>Edit</DialogTrigger>
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Edit project</DialogTitle>
          <DialogClose>Done</DialogClose>
        </DialogContent>
      </Dialog>
      <Button onClick={() => second.open()}>Open second</Button>
      <Dialog controller={second}>
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Second</DialogTitle>
          <Button>Inside second</Button>
          <DialogClose>Close second</DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}

test("a dialog that finishes closing while another dialog is open leaves focus in the other one", async () => {
  const exit = holdExitAnimations()
  const user = userEvent.setup()
  render(<TwoDialogs />)
  await user.click(screen.getByRole("button", { name: "Edit" }))
  await settle()
  await user.click(screen.getByRole("button", { name: "Done" }))
  await settle()
  fireEvent.click(screen.getByRole("button", { name: "Open second", hidden: true }))
  await settle()
  const second = screen.getByRole("dialog", { name: "Second" })
  expect(second.contains(document.activeElement)).toBe(true)
  await exit.finish()
  expect(second.contains(document.activeElement), document.activeElement?.outerHTML).toBe(true)
  exit.restore()
})

function ThirdParty() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Dialog>
        <DialogTrigger>Edit</DialogTrigger>
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Edit project</DialogTitle>
          <DialogClose onClick={() => setOpen(true)}>Done</DialogClose>
        </DialogContent>
      </Dialog>
      {open ? (
        <dialog open aria-modal="true" aria-label="Third party">
          <input aria-label="Coupon" autoFocus />
        </dialog>
      ) : null}
    </>
  )
}

test("a third-party modal opened while a dialog closes keeps focus when the dialog finishes closing", async () => {
  const exit = holdExitAnimations()
  const user = userEvent.setup()
  render(<ThirdParty />)
  await user.click(screen.getByRole("button", { name: "Edit" }))
  await settle()
  await user.click(screen.getByRole("button", { name: "Done" }))
  await settle()
  const coupon = screen.getByRole("textbox", { name: "Coupon" })
  coupon.focus()
  await exit.finish()
  expect(document.activeElement).toBe(coupon)
  exit.restore()
})

function AutoFocusThenThirdParty({ controlled }: { controlled: boolean }) {
  const [open, setOpen] = useState(false)
  const [third, setThird] = useState(false)
  const content = (
    <>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>Rename</DialogTitle>
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the case under test */}
        <input aria-label="Name" autoFocus />
        <DialogClose onClick={() => setThird(true)}>Save</DialogClose>
      </DialogContent>
    </>
  )
  return (
    <>
      {controlled ? (
        <>
          <Button onClick={() => setOpen(true)}>Rename</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            {content}
          </Dialog>
        </>
      ) : (
        <Dialog>
          <DialogTrigger>Rename</DialogTrigger>
          {content}
        </Dialog>
      )}
      {third ? (
        <dialog open aria-modal="true" aria-label="Third party">
          <input aria-label="Coupon" />
        </dialog>
      ) : null}
    </>
  )
}

test.each([false, true])(
  "with autoFocus (controlled %s), a modal opened during the exit keeps focus",
  async (controlled) => {
    const exit = holdExitAnimations()
    const user = userEvent.setup()
    render(<AutoFocusThenThirdParty controlled={controlled} />)
    await user.click(screen.getByRole("button", { name: "Rename" }))
    await settle()
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    const coupon = screen.getByRole("textbox", { name: "Coupon" })
    coupon.focus()
    await settle()
    expect(document.activeElement, "after close start").toBe(coupon)
    expect(document.querySelector("[data-ending-style]"), "still closing").not.toBeNull()
    await exit.finish()
    expect(document.activeElement, "after exit").toBe(coupon)
    exit.restore()
  },
)

// Opens a modal of another library that moves focus in a frame after it mounts, and closes when focus leaves it.
function LateFocusModal({ onClose }: { onClose: () => void }) {
  return (
    <dialog
      open
      aria-modal="true"
      aria-label="Third party"
      ref={(element) => {
        if (!element) return
        const frame = requestAnimationFrame(() => element.querySelector("input")?.focus())
        const onFocusIn = (event: FocusEvent) => {
          if (!element.contains(event.target as Node)) onClose()
        }
        document.addEventListener("focusin", onFocusIn)
        return () => {
          cancelAnimationFrame(frame)
          document.removeEventListener("focusin", onFocusIn)
        }
      }}
    >
      <input aria-label="Coupon" />
    </dialog>
  )
}

function UnmountIntoThirdParty() {
  const [open, setOpen] = useState(false)
  const [third, setThird] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Rename</Button>
      {open ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogBackdrop />
          <DialogContent>
            <DialogTitle>Rename</DialogTitle>
            <Button
              onClick={() => {
                setOpen(false)
                setThird(true)
              }}
            >
              Pay
            </Button>
          </DialogContent>
        </Dialog>
      ) : null}
      {third ? <LateFocusModal onClose={() => setThird(false)} /> : null}
    </>
  )
}

test("a dialog that leaves while another modal opens doesn't pull focus back behind that modal", async () => {
  const user = userEvent.setup()
  render(<UnmountIntoThirdParty />)
  await user.click(screen.getByRole("button", { name: "Rename" }))
  await settle()
  await user.click(screen.getByRole("button", { name: "Pay" }))
  await settle(50)
  expect(screen.getByRole("dialog", { name: "Third party" })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Coupon" }))
})
