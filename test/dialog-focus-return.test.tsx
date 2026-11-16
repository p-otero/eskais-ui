import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode, useState, type ReactNode } from "react"
import { expect, test } from "vitest"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { CommandDialog, CommandDialogContent } from "@/components/ui/command-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
  type DialogContentProps,
} from "@/components/ui/dialog"
import { Drawer, DrawerBackdrop, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { FormField } from "@/components/ui/form"
import { FormDialog } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"

import { settle } from "./overlay-helpers"

function Opener({ children }: { children: (open: boolean, close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit</Button>
      {children(open, () => setOpen(false))}
    </>
  )
}

function UnmountingDialog({ finalFocus }: Pick<DialogContentProps, "finalFocus">) {
  return (
    <Opener>
      {(open, close) =>
        open ? (
          <Dialog open onOpenChange={(next) => next || close()}>
            <DialogBackdrop />
            <DialogContent finalFocus={finalFocus}>
              <DialogTitle>Edit project</DialogTitle>
              <Button onClick={close}>Done</Button>
            </DialogContent>
          </Dialog>
        ) : null
      }
    </Opener>
  )
}

test("a dialog unmounted while open returns focus to the element that opened it", async () => {
  const user = userEvent.setup()
  render(<UnmountingDialog />)
  await user.click(screen.getByRole("button", { name: "Edit" }))
  expect(screen.getByRole("dialog", { name: "Edit project" }).contains(document.activeElement)).toBe(true)
  await user.click(screen.getByRole("button", { name: "Done" }))
  await settle()
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }))
})

test("it also works under StrictMode, and Escape still closes through onOpenChange", async () => {
  const user = userEvent.setup()
  render(
    <StrictMode>
      <UnmountingDialog />
    </StrictMode>,
  )
  await user.click(screen.getByRole("button", { name: "Edit" }))
  await user.keyboard("{Escape}")
  await settle()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }))
})

test('finalFocus="none" leaves focus alone when the dialog unmounts', async () => {
  const user = userEvent.setup()
  render(<UnmountingDialog finalFocus="none" />)
  await user.click(screen.getByRole("button", { name: "Edit" }))
  await user.click(screen.getByRole("button", { name: "Done" }))
  await settle()
  expect(document.activeElement).toBe(document.body)
})

test("a ConfirmDialog unmounted while open returns focus", async () => {
  const user = userEvent.setup()
  render(
    <Opener>
      {(open, close) =>
        open ? (
          <ConfirmDialog open title="Archive?" confirmLabel="Archive" cancelLabel="Keep" onConfirm={close} />
        ) : null
      }
    </Opener>,
  )
  await user.click(screen.getByRole("button", { name: "Edit" }))
  await user.click(screen.getByRole("button", { name: "Archive" }))
  await settle()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }))
})

test("a Drawer unmounted while open returns focus", async () => {
  const user = userEvent.setup()
  render(
    <Opener>
      {(open, close) =>
        open ? (
          <Drawer open>
            <DrawerBackdrop />
            <DrawerContent>
              <DrawerTitle>Filters</DrawerTitle>
              <Button onClick={close}>Apply</Button>
            </DrawerContent>
          </Drawer>
        ) : null
      }
    </Opener>,
  )
  await user.click(screen.getByRole("button", { name: "Edit" }))
  await user.click(screen.getByRole("button", { name: "Apply" }))
  await settle()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }))
})

function AutoFocusDialog() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Rename</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Rename project</DialogTitle>
          {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the case under test */}
          <Input aria-label="Name" autoFocus />
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}

test("a React autoFocus field inside doesn't break focus return", async () => {
  const user = userEvent.setup()
  render(<AutoFocusDialog />)
  await user.click(screen.getByRole("button", { name: "Rename" }))
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }))
  await user.keyboard("{Escape}")
  await settle()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rename" }))
})

function CustomFinalFocus() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Rename</Button>
      <Button id="next-step">Next step</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent finalFocus="#next-step">
          <DialogTitle>Rename project</DialogTitle>
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}

test("a finalFocus you pass still wins", async () => {
  const user = userEvent.setup()
  render(<CustomFinalFocus />)
  await user.click(screen.getByRole("button", { name: "Rename" }))
  await user.keyboard("{Escape}")
  await settle()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next step" }))
})

const passThrough = /(^|\s)data-ending-style:pointer-events-none!?(\s|$)/

test("closing overlays let presses through: Dialog, ConfirmDialog, FormDialog, CommandDialog and Drawer", () => {
  render(
    <>
      <Dialog defaultOpen>
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Plain</DialogTitle>
        </DialogContent>
      </Dialog>
      <ConfirmDialog defaultOpen title="Archive?" confirmLabel="Archive" onConfirm={() => {}} />
      <FormDialog
        open
        schema={z.object({ name: z.string() })}
        defaultValues={{ name: "" }}
        title="Create"
        submitLabel="Create"
        cancelLabel="Cancel"
        onSubmit={() => {}}
      >
        <FormField name="name" label="Name">
          <Input />
        </FormField>
      </FormDialog>
      <CommandDialog defaultOpen>
        <CommandDialogContent title="Commands">x</CommandDialogContent>
      </CommandDialog>
      <Drawer defaultOpen>
        <DrawerBackdrop />
        <DrawerContent>
          <DrawerTitle>Filters</DrawerTitle>
        </DrawerContent>
      </Drawer>
    </>,
  )
  const parts = document.querySelectorAll(
    [
      "dialog-backdrop",
      "dialog-content",
      "alert-dialog-backdrop",
      "alert-dialog-content",
      "drawer-backdrop",
      "drawer-content",
    ]
      .map((slot) => `[data-slot=${slot}]`)
      .join(", "),
  )
  const slots = [...parts].map((part) => part.getAttribute("data-slot"))
  expect(slots.filter((slot) => slot === "dialog-content")).toHaveLength(3)
  expect(new Set(slots).size).toBe(6)
  for (const part of parts) expect(part.className, part.getAttribute("data-slot")!).toMatch(passThrough)
})
