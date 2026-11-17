"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { DialogOpenChangeReason } from "@ui-sdk/react/dialog"
import type { VariantProps } from "class-variance-authority"
import { useId, useRef, useState, type ComponentProps, type ReactNode } from "react"
import type { FieldValues } from "react-hook-form"

import { Button, type buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogSize,
} from "@/components/ui/dialog"
import type { FormSubmitHelpers } from "@/components/ui/form"
import {
  StepFormFrame,
  type StepFormLabels,
  type StepFormProps,
  StepForm,
  type FormStep,
  type StepChangeDetails,
  type StepDirection,
} from "@/components/ui/step-form"
import { useFocusFirstStepOnRestart } from "@/components/ui/use-step-dialog-focus"
import { cn } from "@/lib/utils"

type StepDialogLabels = StepFormLabels & {
  /** The button that closes the dialog; "Cancel" by default. */
  cancel?: ReactNode
  /** The button that closes the result step; "Done" by default. */
  done?: ReactNode
}

/**
 * Why the dialog opened or closed: `submit` once `onSubmit` resolved (without a `resultStep`), `done` from the result
 * step's Done button or its `close`, `cancel` from the Cancel button, `escape`, `outside` (a press outside it),
 * `dismiss` for any other dismissal, `trigger` when its trigger opened it, and `imperative` when `open` changed it.
 */
type StepDialogOpenChangeReason =
  | "submit"
  | "done"
  | "cancel"
  | "dismiss"
  | "escape"
  | "outside"
  | "trigger"
  | "imperative"

type StepDialogOpenChangeDetails = {
  reason: StepDialogOpenChangeReason
  /** UI SDK's own reason, when the Dialog reported the change. */
  dialogReason?: DialogOpenChangeReason
}

type StepDialogResultActions = {
  /** Closes the dialog, with the `done` reason. */
  close: () => void
  /** Starts over from the first step with the default values. */
  restart: () => void
}

type StepDialogResultStep<Result> = {
  /** The result's heading, which takes focus when it shows. */
  title: ReactNode
  /** What `onSubmit` resolved with, and the result step's actions. */
  render: (result: Result, actions: StepDialogResultActions) => ReactNode
}

function toReason(open: boolean, reason: DialogOpenChangeReason): StepDialogOpenChangeReason {
  if (open) return reason === "imperative" ? "imperative" : "trigger"
  if (reason === "escape-key") return "escape"
  if (reason === "outside-press") return "outside"
  if (reason === "close-press") return "cancel"
  return "dismiss"
}

type StepDialogProps<Schema extends StandardSchemaV1, Result = unknown> = Omit<
  StepFormProps<Schema>,
  "labels" | "headingLevel" | "onPendingChange" | "className" | "onSubmit"
> & {
  /** Submits every step's values. With a `resultStep`, what it resolves with is the result shown. */
  onSubmit: (
    values: StandardSchemaV1.InferOutput<Schema>,
    helpers: FormSubmitHelpers<StandardSchemaV1.InferInput<Schema> & FieldValues>,
  ) => Result | Promise<Result>
  open?: boolean
  defaultOpen?: boolean
  /** `details.reason` says why: `submit`, `done`, `cancel`, `escape`, `outside`, `dismiss`, or `trigger` when it opens. */
  onOpenChange?: (open: boolean, details: StepDialogOpenChangeDetails) => void
  /** Content of the button that opens the dialog. Omit it when opening through `open`. */
  trigger?: ReactNode
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
  title: ReactNode
  description?: ReactNode
  size?: DialogSize
  labels?: StepDialogLabels
  /** Where focus goes once the dialog closes; the trigger by default. */
  returnFocus?: ComponentProps<typeof DialogContent>["finalFocus"]
  /** Shows what `onSubmit` resolved with inside the dialog, instead of closing it. */
  resultStep?: StepDialogResultStep<Awaited<Result>>
  className?: string
}

type Shown<Result> = { result: Result } | null

// A stable ref callback runs once, when the heading mounts.
const focusOnMount = (node: HTMLElement | null) => node?.focus()

function ResultStep<Result>({
  step,
  result,
  actions,
  doneLabel,
}: {
  step: StepDialogResultStep<Result>
  result: Result
  actions: StepDialogResultActions
  doneLabel: ReactNode
}) {
  const headingId = useId()
  return (
    <>
      <DialogBody>
        <section aria-labelledby={headingId} data-slot="step-dialog-result" className="flex min-w-0 flex-col gap-group">
          <h3
            ref={focusOnMount}
            id={headingId}
            tabIndex={-1}
            data-slot="step-dialog-result-title"
            className="text-title-sm tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {step.title}
          </h3>
          {step.render(result, actions)}
        </section>
      </DialogBody>
      <div
        data-slot="step-dialog-result-actions"
        className="flex shrink-0 flex-wrap items-center justify-end gap-items narrow:flex-col-reverse narrow:items-stretch"
      >
        <Button type="button" onClick={actions.close}>
          {doneLabel}
        </Button>
      </div>
    </>
  )
}

/**
 * A StepForm in a Dialog: the progress and actions stay in view while the step scrolls, Escape, outside presses and
 * Cancel do nothing while submitting, and it closes once `onSubmit` resolves, or shows `resultStep` with what it
 * resolved. It starts from the first step each time it opens.
 */
function StepDialog<Schema extends StandardSchemaV1, Result = unknown>({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  trigger,
  triggerVariant,
  title,
  description,
  size = "md",
  labels,
  returnFocus,
  resultStep,
  onSubmit,
  className,
  ...stepForm
}: StepDialogProps<Schema, Result>) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const [pending, setPending] = useState(false)
  const [shown, setShown] = useState<Shown<Awaited<Result>>>(null)
  const [run, setRun] = useState(0)
  const content = useRef<HTMLDivElement>(null)
  const open = openProp ?? ownOpen

  useFocusFirstStepOnRestart(content, run)

  const setOpen = (next: boolean, details: StepDialogOpenChangeDetails) => {
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next, details)
  }

  const submit: StepFormProps<Schema>["onSubmit"] = async (values, helpers) => {
    const result = await onSubmit(values, helpers)
    if (!resultStep) {
      setOpen(false, { reason: "submit" })
      return
    }
    // The form unmounts before it reports the end of the submit.
    setPending(false)
    setShown({ result })
  }

  const actions: StepDialogResultActions = {
    close: () => setOpen(false, { reason: "done" }),
    restart: () => {
      setShown(null)
      setRun((count) => count + 1)
    },
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (!next && pending) details.cancel()
        else setOpen(next, { reason: toReason(next, details.reason), dialogReason: details.reason })
      }}
      onOpenChangeComplete={(next) => {
        if (!next) setShown(null)
      }}
      dismissible={!pending}
    >
      {trigger === undefined ? null : <DialogTrigger variant={triggerVariant}>{trigger}</DialogTrigger>}
      <DialogBackdrop />
      <DialogContent
        ref={content}
        size={size}
        finalFocus={returnFocus}
        aria-busy={pending || undefined}
        className={cn("overflow-hidden", className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description === undefined ? null : <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {shown && resultStep ? (
          <ResultStep step={resultStep} result={shown.result} actions={actions} doneLabel={labels?.done ?? "Done"} />
        ) : (
          <StepFormFrame
            key={run}
            {...stepForm}
            onSubmit={submit}
            onPendingChange={setPending}
            labels={labels}
            headingLevel={3}
            cancel={labels?.cancel ?? "Cancel"}
            onCancel={() => {
              if (!pending) setOpen(false, { reason: "cancel" })
            }}
            body={DialogBody}
            actionsClassName="shrink-0"
            className="min-h-0 flex-1"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export { StepDialog }
export { StepForm }
export type { FormStep, StepChangeDetails, StepDirection, StepFormLabels, StepFormProps }
export type {
  StepDialogLabels,
  StepDialogOpenChangeDetails,
  StepDialogOpenChangeReason,
  StepDialogProps,
  StepDialogResultActions,
  StepDialogResultStep,
}
