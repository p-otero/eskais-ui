import { useState } from "react"

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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

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

/** Not linked from the docs: prints what the browser reports about its viewport, to debug the dialog on real phones. */
function ViewportDebug() {
  const report = useViewportReport()
  const { copied, copy } = useCopy(formatReport(report))
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
        Open the sheet, then copy the report or take a screenshot. The values update as the toolbars and the keyboard
        move.
      </p>
      <div className="flex flex-wrap gap-items">
        <Dialog>
          <DialogTrigger variant="default">Open sheet</DialogTrigger>
          <DialogBackdrop />
          <DialogContent data-viewport-debug-sheet="">
            <DialogHeader>
              <DialogTitle>Sample sheet</DialogTitle>
              <DialogDescription>Its bottom edge and its buttons should sit above the toolbar.</DialogDescription>
            </DialogHeader>
            <Rows rows={report.sheet.slice(0, 4)} />
            <Field>
              <FieldLabel>A field, for the keyboard</FieldLabel>
              <Input placeholder="Tap to type" />
            </Field>
            <DialogFooter>
              <DialogClose>Close</DialogClose>
              <Button variant="default" onClick={copy}>
                {copied ? "Copied" : "Copy report"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="outline" onClick={copy}>
          {copied ? "Copied" : "Copy report"}
        </Button>
      </div>
      <section aria-label="Page" className="flex flex-col gap-items">
        <h2 className="text-title-sm">Page</h2>
        <Rows rows={report.page} />
      </section>
      <section aria-label="Sheet" className="flex flex-col gap-items">
        <h2 className="text-title-sm">Sheet (last measured while open)</h2>
        <Rows rows={report.sheet} />
      </section>
    </main>
  )
}

export { ViewportDebug }
