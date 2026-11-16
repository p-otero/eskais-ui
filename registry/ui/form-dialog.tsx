"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import { useState, type ComponentProps, type ReactNode } from "react"

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
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

type ReviewStep<Values> = {
  /** What the person checks before confirming, from the parsed values. */
  render: (values: Values) => ReactNode
  editLabel: ReactNode
  confirmLabel: ReactNode
}

type FormDialogProps<Schema extends StandardSchemaV1> = Omit<
  FormProps<Schema>,
  "onPendingChange" | "onDirtyChange" | "className" | "children"
> &
  Pick<FormActionsProps, "tone" | "confirm" | "secondaryAction"> & {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
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
    reviewStep?: ReviewStep<StandardSchemaV1.InferOutput<Schema>>
    rootErrorTitle?: ReactNode
    className?: string
    /** The fields. */
    children?: ReactNode
  }

function FormDialog<Schema extends StandardSchemaV1>({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
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
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const [review, setReview] = useState<{ values: Output } | null>(null)
  const open = openProp ?? ownOpen
  const guarded = Boolean(confirmDiscard) && dirty

  const setOpen = (next: boolean) => {
    if (!next) {
      setReview(null)
      setAsking(false)
    }
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }

  const requestClose = () => {
    if (pending) return
    if (guarded) setAsking(true)
    else setOpen(false)
  }

  const submit: FormProps<Schema>["onSubmit"] = async (values, helpers) => {
    if (reviewStep && !review) {
      setReview({ values })
      return
    }
    try {
      await onSubmit(values, helpers)
    } catch (error) {
      if (Object.keys(toFormErrors(error)?.fieldErrors ?? {}).length > 0) setReview(null)
      throw error
    }
    setOpen(false)
  }

  const actions = (
    <FormActions
      {...(tone === "destructive" ? { tone, confirm: confirm! } : { confirm })}
      submitLabel={review && reviewStep ? reviewStep.confirmLabel : submitLabel}
      pendingLabel={pendingLabel}
      cancel={cancelLabel}
      onCancel={requestClose}
      secondaryAction={
        review && reviewStep ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setReview(null)}>
            {reviewStep.editLabel}
          </Button>
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
        else setOpen(next)
      }}
      dismissible={!pending && !guarded}
      onDismissAttempt={() => {
        if (!pending && guarded) setAsking(true)
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
          <DialogTitle>{title}</DialogTitle>
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
            cancelLabel={keepEditingLabel}
            onConfirm={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export { FormDialog }
export type { FormDialogProps, ReviewStep }
