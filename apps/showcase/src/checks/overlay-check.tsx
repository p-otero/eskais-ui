import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger, DrawerBackdrop } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"

// ?demo=overlay-check: the fixture tooling/overlay-check.mjs drives in Chrome. A counter sits under the
// center of the screen, where the dialogs open, to catch a press the closing overlay swallows.
function Counter() {
  const [count, setCount] = useState(0)
  return (
    <Button
      data-testid="counter"
      variant="outline"
      onClick={() => setCount((value) => value + 1)}
      className="fixed inset-0 m-auto h-24 w-64"
    >
      Pressed {count}
    </Button>
  )
}

function UnmountedWhileOpen() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open unmounting dialog</Button>
      {open ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogBackdrop />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unmounting dialog</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

function AutoFocused() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open autofocus dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autofocus dialog</DialogTitle>
          </DialogHeader>
          {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the case under test */}
          <Input aria-label="Name" autoFocus />
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function OverlayCheck() {
  return (
    <div className="flex flex-wrap gap-items p-inset-surface">
      <Counter />
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plain dialog</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>Close dialog</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Drawer>
        <DrawerTrigger>Open drawer</DrawerTrigger>
        <DrawerBackdrop />
        <DrawerContent>
          <DrawerTitle>Plain drawer</DrawerTitle>
          <DrawerClose>Close drawer</DrawerClose>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        trigger="Open confirm"
        title="Archive project?"
        confirmLabel="Archive"
        labels={{ cancel: "Keep" }}
        onConfirm={() => {}}
      />
      <UnmountedWhileOpen />
      <AutoFocused />
    </div>
  )
}

export { OverlayCheck }
