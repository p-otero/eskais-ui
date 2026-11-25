"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { DialogOpenChangeReason } from "@ui-sdk/react/dialog"
import { useRef, useState, type ComponentProps, type ReactNode } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"

import { Button, type buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
import {
  Form,
  FormActions,
  FormRootError,
  toFormErrors,
  type FormActionsProps,
  type FormProps,
} from "@/components/ui/form"
import { assumeType, isRecord } from "@/lib/narrow"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

/** What `prepare` may return: other values for the review and `onSubmit`, or an error in any shape `onSubmit` throws. */
type ReviewPrepareResult<Values> = { values?: Values; error?: unknown }

type ReviewPrepareContext<Input extends FieldValues> = {
  /** The form's react-hook-form instance: `setValue` or `reset` here changes what the fields show after Edit. */
  form: UseFormReturn<Input>
}

type ReviewState<Values> = {
  values: Values
  /** What the last confirm threw, until the review opens again. */
  error: unknown
  pending: boolean
}

type ReviewStep<Values, Input extends FieldValues = FieldValues> = {
  /** What the person checks before confirming, from the parsed (or prepared) values. */
  render: (values: Values) => ReactNode
  editLabel: ReactNode
  confirmLabel: ReactNode
  /**
   * Runs after validation, before the review, with the submit pending. Returned `{ values }` are reviewed, submitted
   * and written into the form for Edit; they win over fields set through `form`, whose values are otherwise parsed
   * again and reviewed. `{ error }` (or a throw) stays on the fields.
   */
  prepare?: (
    values: Values,
    context: ReviewPrepareContext<Input>,
  ) => Promise<ReviewPrepareResult<Values> | void> | ReviewPrepareResult<Values> | void
  /** `false` hides the edit button, for example once a delivery failed. `true` by default. */
  editable?: boolean | ((state: ReviewState<Values>) => boolean)
  /** The dialog's title while reviewing, or a function of the step for both. The dialog's `title` by default. */
  title?: ReactNode | ((step: "form" | "review") => ReactNode)
}

/**
 * Why the dialog opened or closed: `submit` once `onSubmit` resolved, `cancel` from the Cancel button, `escape`,
 * `outside` (a press outside it), `dismiss` for any other dismissal (a back gesture, a swipe, a parent closing),
 * `trigger` when its trigger opened it, and `imperative` when the `open` prop changed it.
 */
type FormDialogOpenChangeReason = "submit" | "cancel" | "dismiss" | "escape" | "outside" | "trigger" | "imperative"

type FormDialogOpenChangeDetails = {
  reason: FormDialogOpenChangeReason
  /** UI SDK's own reason, when the Dialog reported the change. */
  dialogReason?: DialogOpenChangeReason
}

function toReason(open: boolean, reason: DialogOpenChangeReason): FormDialogOpenChangeReason {
  if (open) return reason === "imperative" ? "imperative" : "trigger"
  if (reason === "escape-key") return "escape"
  if (reason === "outside-press") return "outside"
  if (reason === "close-press") return "cancel"
  return "dismiss"
}

type FormDialogProps<Schema extends StandardSchemaV1> = Omit<
  FormProps<Schema>,
  "onPendingChange" | "onDirtyChange" | "className" | "children"
> &
  Pick<FormActionsProps, "tone" | "confirm" | "secondaryAction"> & {
    open?: boolean
    defaultOpen?: boolean
    /** `details.reason` says why: `submit`, `cancel`, `escape`, `outside`, `dismiss`, or `trigger` when it opens. */
    onOpenChange?: (open: boolean, details: FormDialogOpenChangeDetails) => void
    /** Runs once opening or closing has finished, after the transition, with the same details. */
    onOpenChangeComplete?: (open: boolean, details: FormDialogOpenChangeDetails) => void
    /** Content of the button that opens the dialog. Omit it when opening through `open`. */
    trigger?: ReactNode
    triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
    title: ReactNode
    description?: ReactNode
    size?: DialogSize
    submitLabel: ReactNode
    cancelLabel: ReactNode
    /** What screen readers hear once the submit has been pending for a second. */
    pendingLabel?: string
    /** Where focus goes once the dialog closes; the trigger by default. */
    returnFocus?: ComponentProps<typeof DialogContent>["finalFocus"]
    /** With unsaved changes, closing asks this question first. */
    confirmDiscard?: string
    discardLabel?: string
    keepEditingLabel?: string
    /** Submit validates and shows a review; confirming it runs `onSubmit`. */
    reviewStep?: ReviewStep<StandardSchemaV1.InferOutput<Schema>, StandardSchemaV1.InferInput<Schema> & FieldValues>
    rootErrorTitle?: ReactNode
    className?: string
    children?: ReactNode
  }

function FormDialog<Schema extends StandardSchemaV1>({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onOpenChangeComplete,
  trigger,
  triggerVariant,
  title,
  description,
  size = "md",
  submitLabel,
  cancelLabel,
  pendingLabel,
  secondaryAction,
  returnFocus,
  confirmDiscard,
  discardLabel = "Discard",
  keepEditingLabel = "Keep editing",
  reviewStep,
  rootErrorTitle,
  tone,
  confirm,
  onSubmit,
  className,
  children,
  ...form
}: FormDialogProps<Schema>) {
  type Output = StandardSchemaV1.InferOutput<Schema>
  type Input = StandardSchemaV1.InferInput<Schema> & FieldValues
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const [review, setReview] = useState<{ values: Output; error: unknown } | null>(null)
  const open = openProp ?? ownOpen
  const guarded = Boolean(confirmDiscard) && dirty
  const lastChange = useRef<FormDialogOpenChangeDetails>({ reason: "imperative" })
  const askedBy = useRef<FormDialogOpenChangeDetails>({ reason: "cancel" })

  const setOpen = (next: boolean, details: FormDialogOpenChangeDetails) => {
    if (!next) {
      setReview(null)
      setAsking(false)
    }
    lastChange.current = details
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next, details)
  }

  const ask = (details: FormDialogOpenChangeDetails) => {
    askedBy.current = details
    setAsking(true)
  }

  const requestClose = (details: FormDialogOpenChangeDetails) => {
    if (pending) return
    if (guarded) ask(details)
    else setOpen(false, details)
  }

  const startReview = async (values: Output, instance: UseFormReturn<Input>) => {
    if (!reviewStep?.prepare) return values
    let wrote = false
    const stop = instance.subscribe({
      formState: { values: true },
      callback: () => {
        wrote = true
      },
    })
    // Workaround: React Compiler 1.0 can't compile try/finally.
    const prepared: ReviewPrepareResult<Output> | void = await Promise.resolve(
      reviewStep.prepare(values, { form: instance }),
    ).finally(stop)
    if (prepared && prepared.error !== undefined) throw prepared.error
    if (prepared?.values !== undefined) {
      const setValueByFieldName = assumeType<(name: string, value: unknown, options: { shouldDirty: boolean }) => void>(
        instance.setValue,
      )
      if (isRecord(prepared.values))
        for (const [name, value] of Object.entries(prepared.values))
          setValueByFieldName(name, value, { shouldDirty: true })
      return prepared.values
    }
    if (!wrote) return values
    const result = await form.schema["~standard"].validate(instance.getValues())
    if (result.issues) throw { issues: result.issues }
    return assumeType<Output>(result.value)
  }

  const showSubmitError = (error: unknown) => {
    if (Object.keys(toFormErrors(error)?.fieldErrors ?? {}).length > 0) setReview(null)
    else setReview((current) => current && { ...current, error })
  }

  const submit: FormProps<Schema>["onSubmit"] = async (values, helpers) => {
    if (reviewStep && !review) {
      setReview({ values: await startReview(values, helpers.form), error: undefined })
      return
    }
    const submitted = review ? review.values : values
    // Workaround: React Compiler 1.0 can't compile a conditional inside try.
    try {
      await onSubmit(submitted, helpers)
    } catch (error) {
      showSubmitError(error)
      throw error
    }
    setOpen(false, { reason: "submit" })
  }

  const reviewing = Boolean(review && reviewStep)
  const editable =
    review && typeof reviewStep?.editable === "function"
      ? reviewStep.editable({ values: review.values, error: review.error, pending })
      : reviewStep?.editable !== false
  const stepTitle = reviewStep?.title
  const shownTitle =
    typeof stepTitle === "function"
      ? stepTitle(reviewing ? "review" : "form")
      : reviewing && stepTitle !== undefined
        ? stepTitle
        : title

  const actions = (
    <FormActions
      {...(tone === "destructive" ? { tone, confirm: confirm! } : { confirm })}
      submitLabel={reviewing ? reviewStep!.confirmLabel : submitLabel}
      pendingLabel={pendingLabel}
      cancel={cancelLabel}
      onCancel={() => requestClose({ reason: "cancel" })}
      secondaryAction={
        reviewing ? (
          editable ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setReview(null)}>
              {reviewStep!.editLabel}
            </Button>
          ) : null
        ) : (
          secondaryAction
        )
      }
      className="shrink-0"
    />
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (!next && pending) details.cancel()
        else setOpen(next, { reason: toReason(next, details.reason), dialogReason: details.reason })
      }}
      onOpenChangeComplete={(next) => {
        const details = lastChange.current
        lastChange.current = { reason: "imperative" }
        onOpenChangeComplete?.(next, details)
      }}
      dismissible={!pending && !guarded}
      onDismissAttempt={(attempt) => {
        if (!pending && guarded) ask({ reason: toReason(false, attempt.reason), dialogReason: attempt.reason })
      }}
    >
      {trigger === undefined ? null : <DialogTrigger variant={triggerVariant}>{trigger}</DialogTrigger>}
      <DialogBackdrop />
      <DialogContent
        size={size}
        finalFocus={returnFocus}
        aria-busy={pending || undefined}
        className={cn("overflow-hidden", className)}
      >
        <DialogHeader>
          <DialogTitle>{shownTitle}</DialogTitle>
          {description === undefined ? null : <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Form
          {...form}
          onSubmit={submit}
          onPendingChange={setPending}
          onDirtyChange={setDirty}
          className="min-h-0 flex-1"
        >
          <DialogBody>
            {review && reviewStep ? (
              <div data-slot="form-dialog-review" className="flex flex-col gap-group">
                {reviewStep.render(review.values)}
              </div>
            ) : (
              children
            )}
            <FormRootError title={rootErrorTitle} />
          </DialogBody>
          {actions}
        </Form>
        {confirmDiscard === undefined ? null : (
          <ConfirmDialog
            open={asking}
            onOpenChange={setAsking}
            title={confirmDiscard}
            confirmLabel={discardLabel}
            labels={{ cancel: keepEditingLabel }}
            onConfirm={() => setOpen(false, askedBy.current)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export { FormDialog }
export type {
  FormDialogOpenChangeDetails,
  FormDialogOpenChangeReason,
  FormDialogProps,
  ReviewPrepareContext,
  ReviewPrepareResult,
  ReviewState,
  ReviewStep,
}
