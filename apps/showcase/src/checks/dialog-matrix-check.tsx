import { useState, type ReactNode } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { CommandDialog, CommandDialogContent, CommandDialogTrigger } from "@/components/ui/command-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Field, FieldLabel } from "@/components/ui/field"
import { FormField } from "@/components/ui/form"
import { FormDialog } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"
import { Lightbox } from "@/components/ui/lightbox"
import { ShortcutsDialog, ShortcutsDialogTrigger } from "@/components/ui/shortcuts-dialog"
import { SidePanel } from "@/components/ui/side-panel"
import { StepDialog, type FormStep } from "@/components/ui/step-dialog"

import { screenshots } from "../sections/media-fixtures"

// ?demo=dialog-matrix-check[&content=tall]: every kind of dialog tooling/dialog-mobile-check.mjs opens on each
// device and viewport model, with short content or with content taller than any screen. The page is taller than the
// screen, so the check also sees whether opening one scrolls the page behind it.
const tall = new URLSearchParams(location.search).get("content") === "tall"
const lineCount = tall ? 40 : 2
const lines = Array.from({ length: lineCount }, (_, index) => `Line ${String(index + 1)} of the notes kept with it.`)

function Filler() {
  return (
    <>
      {lines.map((line) => (
        <p key={line} className="text-body-sm text-muted-foreground">
          {line}
        </p>
      ))}
    </>
  )
}

function PlainDialog({ size, label }: { size?: "full"; label: string }) {
  return (
    <Dialog>
      <DialogTrigger>{label}</DialogTrigger>
      <DialogBackdrop />
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>Names must be unique.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>Project name</FieldLabel>
            <Input defaultValue="Apollo" />
          </Field>
          <Filler />
        </DialogBody>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose variant="default">Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// A touch open focuses the content itself, whatever `initialFocus` says, so the heading takes focus as an app's
// own code would move it there once the dialog is in the page (StepDialog's result step does).
const focusOnMount = (node: HTMLElement | null) => {
  requestAnimationFrame(() => node?.focus())
}

function HeadingFocusDialog() {
  return (
    <Dialog>
      <DialogTrigger>Open dialog with heading focus</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release notes</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <h3 ref={focusOnMount} data-matrix-heading="" tabIndex={-1} className="text-title-sm outline-none">
            What changed
          </h3>
          <Filler />
        </DialogBody>
        <DialogFooter>
          <DialogClose variant="default">Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Confirm() {
  return (
    <ConfirmDialog
      trigger="Open confirm"
      title="Archive Apollo?"
      description="The project leaves the board for everyone."
      confirmLabel="Archive"
      onConfirm={() => {}}
    >
      {tall ? <Filler /> : "Two agents are still running on it."}
    </ConfirmDialog>
  )
}

const formSchema = z.object({ title: z.string().min(3), brief: z.string() })

function Form() {
  return (
    <FormDialog
      schema={formSchema}
      defaultValues={{ title: "", brief: "" }}
      trigger="Open form dialog"
      title="New task"
      description="An agent picks it up from the backlog."
      submitLabel="Create task"
      cancelLabel="Cancel"
      onSubmit={() => {}}
    >
      <FormField name="title" label="Task title">
        <Input placeholder="Index the docs" />
      </FormField>
      <Filler />
    </FormDialog>
  )
}

const stepSchema = z.object({ name: z.string().min(3), region: z.string() })

const steps: FormStep<z.input<typeof stepSchema>>[] = [
  {
    id: "project",
    title: "Project",
    description: "A name your team will recognize.",
    render: () => (
      <>
        <FormField name="name" label="Step project name">
          <Input placeholder="Atlas" />
        </FormField>
        <Filler />
      </>
    ),
  },
  { id: "region", title: "Region", render: () => <Filler /> },
  { id: "review", title: "Review", render: () => <Filler /> },
]

function Steps() {
  return (
    <StepDialog
      schema={stepSchema}
      defaultValues={{ name: "", region: "eu" }}
      steps={steps}
      trigger="Open step dialog"
      title="New project"
      labels={{ submit: "Create project" }}
      onSubmit={() => {}}
    />
  )
}

function Palette() {
  return (
    <CommandDialog>
      <CommandDialogTrigger>Open command palette</CommandDialogTrigger>
      <CommandDialogContent>
        <Command>
          <CommandInput aria-label="Run a command" placeholder="Type a command" />
          <CommandList>
            {lines.map((line) => (
              <CommandItem key={line} value={line}>
                {line}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}

const shortcuts = lines.map((line, index) => ({
  keys: `g ${String(index)}`,
  steps: ["G", String(index)],
  description: line,
}))

function Shortcuts() {
  return (
    <ShortcutsDialog shortcut={null} extra={shortcuts}>
      <ShortcutsDialogTrigger>Open shortcuts</ShortcutsDialogTrigger>
    </ShortcutsDialog>
  )
}

function Viewer() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open lightbox
      </Button>
      <Lightbox items={screenshots} index={index} onIndexChange={setIndex} open={open} onOpenChange={setOpen} />
    </>
  )
}

function SideDrawer({ side, label }: { side: "bottom" | "right"; label: string }) {
  return (
    <Drawer side={side}>
      <DrawerTrigger>{label}</DrawerTrigger>
      <DrawerBackdrop />
      <DrawerContent>
        {side === "bottom" && <DrawerHandle />}
        <DrawerHeader>
          <DrawerTitle>Index the docs</DrawerTitle>
          <DrawerDescription>Attempt 2 of 3.</DrawerDescription>
        </DrawerHeader>
        <Field>
          <FieldLabel>Drawer note</FieldLabel>
          <Input />
        </Field>
        <Filler />
        <DrawerFooter>
          <DrawerClose>Close task</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function Panel() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open side panel
      </Button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title="Webhook retries"
        description="Opened two days ago"
        narrow="sheet"
      >
        <Field>
          <FieldLabel>Panel note</FieldLabel>
          <Input />
        </Field>
        <Filler />
      </SidePanel>
    </>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-items">{children}</div>
}

function DialogMatrixCheck() {
  return (
    <main className="flex flex-col gap-section p-inset-surface">
      <Row>
        <PlainDialog label="Open dialog" />
        <PlainDialog size="full" label="Open full dialog" />
        <HeadingFocusDialog />
        <Confirm />
        <Form />
        <Steps />
        <Palette />
        <Shortcuts />
        <Viewer />
        <SideDrawer side="bottom" label="Open bottom drawer" />
        <SideDrawer side="right" label="Open side drawer" />
        <Panel />
      </Row>
      <div aria-hidden="true" className="h-750" />
    </main>
  )
}

export { DialogMatrixCheck }
