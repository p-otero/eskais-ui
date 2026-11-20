import { useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBackdrop,
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
import { SidePanel } from "@/components/ui/side-panel"
import { StepDialog, type FormStep } from "@/components/ui/step-dialog"

import { formatReport, useViewportReport, type Row } from "../hooks/use-viewport-report"

const safeAreaPadding =
  "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-group gap-y-inline text-caption">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }
  return { copied, copy }
}

type Report = ReturnType<typeof useViewportReport>
type Copy = ReturnType<typeof useCopy>

// The rows that say whether the open dialog fits: which one, its edges, and how far past the visible part it goes.
function Fit({ report }: { report: Report }) {
  return <Rows rows={report.sheet.slice(0, 4)} />
}

function CopyButton({ copy, variant = "default" }: { copy: Copy; variant?: "default" | "outline" }) {
  return (
    <Button variant={variant} onClick={copy.copy}>
      {copy.copied ? "Copied" : "Copy report"}
    </Button>
  )
}

function SampleSheet({ report, copy }: { report: Report; copy: Copy }) {
  return (
    <Dialog>
      <DialogTrigger variant="default">Open sheet</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sample sheet</DialogTitle>
          <DialogDescription>Its bottom edge and its buttons should sit above the toolbar.</DialogDescription>
        </DialogHeader>
        <Fit report={report} />
        <Field>
          <FieldLabel>A field, for the keyboard</FieldLabel>
          <Input placeholder="Tap to type" />
        </Field>
        <DialogFooter>
          <DialogClose>Close</DialogClose>
          <CopyButton copy={copy} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const stepSchema = z.object({ name: z.string().min(3), region: z.string() })

// The same steps as the StepDialog docs demo, with the measurements under each.
function useSteps(report: Report, copy: Copy): FormStep<z.input<typeof stepSchema>>[] {
  const measured = (
    <>
      <Fit report={report} />
      <CopyButton copy={copy} variant="outline" />
    </>
  )
  return [
    {
      id: "project",
      title: "Project",
      description: "A name your team will recognize.",
      render: () => (
        <>
          <FormField name="name" label="Project name">
            <Input placeholder="Atlas" />
          </FormField>
          {measured}
        </>
      ),
    },
    { id: "region", title: "Region", render: () => measured },
    { id: "review", title: "Review", render: () => measured },
  ]
}

function SampleStepDialog({ report, copy }: { report: Report; copy: Copy }) {
  return (
    <StepDialog
      schema={stepSchema}
      defaultValues={{ name: "", region: "eu" }}
      steps={useSteps(report, copy)}
      trigger="Open StepDialog"
      title="New project"
      labels={{ submit: "Create project" }}
      onSubmit={() => {}}
    />
  )
}

const formSchema = z.object({ title: z.string().min(3) })

function SampleFormDialog({ report, copy }: { report: Report; copy: Copy }) {
  return (
    <FormDialog
      schema={formSchema}
      defaultValues={{ title: "" }}
      trigger="Open FormDialog"
      title="New task"
      description="An agent picks it up from the backlog."
      submitLabel="Create task"
      cancelLabel="Cancel"
      onSubmit={() => {}}
    >
      <FormField name="title" label="Title">
        <Input placeholder="Index the docs" />
      </FormField>
      <Fit report={report} />
      <CopyButton copy={copy} variant="outline" />
    </FormDialog>
  )
}

function SampleDrawer({ report, copy }: { report: Report; copy: Copy }) {
  return (
    <Drawer side="bottom">
      <DrawerTrigger>Open bottom Drawer</DrawerTrigger>
      <DrawerBackdrop />
      <DrawerContent>
        <DrawerHandle />
        <DrawerHeader>
          <DrawerTitle>Sample drawer</DrawerTitle>
          <DrawerDescription>UI SDK slides it; its bottom edge should sit above the toolbar.</DrawerDescription>
        </DrawerHeader>
        <Fit report={report} />
        <Field>
          <FieldLabel>A drawer field, for the keyboard</FieldLabel>
          <Input placeholder="Tap to type" />
        </Field>
        <DrawerFooter>
          <DrawerClose>Close</DrawerClose>
          <CopyButton copy={copy} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function SampleSidePanel({ report, copy }: { report: Report; copy: Copy }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open SidePanel sheet
      </Button>
      {/* A sheet on narrow screens; wider, the panel shows beside the page instead. */}
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title="Sample panel"
        description="A sheet on a phone"
        narrow="sheet"
      >
        <Fit report={report} />
        <Field>
          <FieldLabel>A panel field, for the keyboard</FieldLabel>
          <Input placeholder="Tap to type" />
        </Field>
        <CopyButton copy={copy} />
      </SidePanel>
    </>
  )
}

/** Not linked from the docs: prints what the browser reports about its viewport, to debug dialogs on real phones. */
function ViewportDebug() {
  const report = useViewportReport()
  const copy = useCopy(formatReport(report))
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-col gap-group px-group py-section outline-none"
    >
      <meta name="robots" content="noindex" />
      {/* Fills the containing block of a fixed element, where a dialog lays out, and reads the safe areas. */}
      <div
        id="viewport-debug-probe"
        aria-hidden="true"
        className="pointer-events-none invisible fixed inset-0"
        style={{ padding: safeAreaPadding }}
      />
      <h1 className="text-display-sm tracking-tight">Viewport diagnostics</h1>
      <p className="text-body-sm text-muted-foreground">
        Open a dialog, then copy the report or take a screenshot. The values update as the toolbars and the keyboard
        move, and describe the dialog on top.
      </p>
      <div className="flex flex-wrap gap-items">
        <SampleSheet report={report} copy={copy} />
        <SampleStepDialog report={report} copy={copy} />
        <SampleFormDialog report={report} copy={copy} />
        <SampleDrawer report={report} copy={copy} />
        <SampleSidePanel report={report} copy={copy} />
        <CopyButton copy={copy} variant="outline" />
      </div>
      <section aria-label="Page" className="flex flex-col gap-items">
        <h2 className="text-title-sm">Page</h2>
        <Rows rows={report.page} />
      </section>
      <section aria-label="Dialog" className="flex flex-col gap-items">
        <h2 className="text-title-sm">Dialog (last measured while open)</h2>
        <Rows rows={report.sheet} />
      </section>
      {/* Taller than any screen, as a docs page is, so Safari's toolbars collapse as you scroll and the page can lock. */}
      <p aria-hidden="true" className="h-750 text-caption text-muted-foreground">
        Scroll down to collapse the toolbars, then scroll back and open a dialog.
      </p>
    </main>
  )
}

export { ViewportDebug }
