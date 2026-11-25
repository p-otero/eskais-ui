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
  createDialogController,
} from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger, DrawerBackdrop } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"

import { useThirdPartyModal } from "../hooks/use-third-party-modal"

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

function ThirdPartyModal({ onClose }: { onClose: (reason: string) => void }) {
  const ref = useThirdPartyModal(onClose)
  return (
    <dialog
      ref={ref}
      open
      aria-modal="true"
      aria-label="Third-party modal"
      className="fixed inset-x-0 top-0 z-popover m-auto flex w-80 flex-col gap-items rounded-surface border bg-popover p-inset-surface text-popover-foreground"
    >
      <Input aria-label="Coupon" />
      <Button onClick={() => onClose("button")}>Close third-party modal</Button>
    </dialog>
  )
}

function HandOff({ by }: { by: "trigger" | "controller" }) {
  const [first] = useState(() => createDialogController())
  const [second] = useState(() => createDialogController())
  const suffix = by === "controller" ? " by controller" : ""
  const [thirdParty, setThirdParty] = useState(false)
  const [closed, setClosed] = useState("")
  const [later, setLater] = useState(false)
  const closeThirdParty = (reason: string) => {
    setThirdParty(false)
    setClosed(reason)
  }
  return (
    <>
      {by === "controller" ? <Button onClick={() => first.open()}>Open handoff dialog{suffix}</Button> : null}
      <Dialog
        controller={first}
        onOpenChange={(open) => {
          if (open || !later) return
          setLater(false)
          setTimeout(() => setThirdParty(true), 300)
        }}
      >
        {by === "trigger" ? <DialogTrigger>Open handoff dialog</DialogTrigger> : null}
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Handoff dialog{suffix}</DialogTitle>
          </DialogHeader>
          <DialogFooter className="sm:flex-wrap">
            <DialogClose onClick={() => second.open()}>Continue in a dialog{suffix}</DialogClose>
            <DialogClose onClick={() => setThirdParty(true)}>Continue in a third-party modal{suffix}</DialogClose>
            <Button variant="outline" onClick={() => setLater(true)}>
              Then open a third-party modal{suffix}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog controller={second}>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Second dialog{suffix}</DialogTitle>
          </DialogHeader>
          <Input aria-label={`Second field${suffix}`} />
          <DialogFooter>
            <DialogClose>Close second dialog{suffix}</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {thirdParty ? <ThirdPartyModal onClose={closeThirdParty} /> : null}
      <output data-testid={`third-party-closed${suffix.replaceAll(" ", "-")}`}>{closed}</output>
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
      <HandOff by="trigger" />
      <HandOff by="controller" />
    </div>
  )
}

export { OverlayCheck }
