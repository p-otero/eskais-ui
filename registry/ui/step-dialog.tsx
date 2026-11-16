"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { VariantProps } from "class-variance-authority"
import { useState, type ComponentProps, type ReactNode } from "react"

import type { buttonVariants } from "@/components/ui/button"
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
  StepFormFrame,
  type StepFormLabels,
  type StepFormProps,
  StepForm,
  type FormStep,
  type StepChangeDetails,
  type StepDirection,
} from "@/components/ui/step-form"
import { cn } from "@/lib/utils"

type StepDialogLabels = StepFormLabels & {
  /** The button that closes the dialog; "Cancel" by default. */
  cancel?: ReactNode
}

type StepDialogProps<Schema extends StandardSchemaV1> = Omit<
  StepFormProps<Schema>,
  "labels" | "headingLevel" | "onPendingChange" | "className"
> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Content of the button that opens the dialog. Omit it when opening through `open`. */
  trigger?: ReactNode
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
  title: ReactNode
  description?: ReactNode
  size?: DialogSize
  labels?: StepDialogLabels
  /** Where focus goes once the dialog closes; the trigger by default. */
  returnFocus?: ComponentProps<typeof DialogContent>["finalFocus"]
  className?: string
}

/**
 * A StepForm in a Dialog: the progress and actions stay in view while the step scrolls, Escape, outside presses and
 * Cancel do nothing while submitting, and it closes once `onSubmit` resolves. It starts from the first step each time
 * it opens.
 */
function StepDialog<Schema extends StandardSchemaV1>({
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
  onSubmit,
  className,
  ...stepForm
}: StepDialogProps<Schema>) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const [pending, setPending] = useState(false)
  const open = openProp ?? ownOpen

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }

  const submit: StepFormProps<Schema>["onSubmit"] = async (values, helpers) => {
    await onSubmit(values, helpers)
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (!next && pending) details.cancel()
        else setOpen(next)
      }}
      dismissible={!pending}
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
        <StepFormFrame
          {...stepForm}
          onSubmit={submit}
          onPendingChange={setPending}
          labels={labels}
          headingLevel={3}
          cancel={labels?.cancel ?? "Cancel"}
          onCancel={() => {
            if (!pending) setOpen(false)
          }}
          body={DialogBody}
          actionsClassName="shrink-0"
          className="min-h-0 flex-1"
        />
      </DialogContent>
    </Dialog>
  )
}

export { StepDialog }
export { StepForm }
export type { FormStep, StepChangeDetails, StepDirection, StepFormLabels, StepFormProps }
export type { StepDialogLabels, StepDialogProps }
