"use client"

import {
  Dialog,
  DialogBackdrop as DialogBackdropPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  createDialogController,
} from "@ui-sdk/react/dialog"
import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn, cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

const backdropClassName =
  "fixed inset-0 z-overlay bg-overlay transition-opacity duration-dialog ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0"

// Sizes and offsets come from the containing block (the viewport for a top-layer dialog) through %, never viewport units.
const dialogContentVariants = cva(
  [
    "fixed inset-0 z-overlay m-auto flex h-fit max-h-(--dialog-max-height) w-(--dialog-width) min-w-0 flex-col gap-group overflow-y-auto overscroll-contain rounded-floating border border-floating-border bg-popover p-inset-surface text-popover-foreground field-label-surface-popover wrap-anywhere shadow-floating outline-none transition duration-dialog ease-standard data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
  ],
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-lg",
        lg: "max-w-3xl",
        xl: "max-w-6xl",
        full: "h-(--dialog-max-height) max-w-none",
      },
      sheet: {
        true: "narrow:top-auto narrow:mb-0 narrow:h-fit narrow:max-h-(--sheet-max-height) narrow:w-full narrow:max-w-none narrow:rounded-b-none narrow:border-b-0 narrow:data-ending-style:translate-y-full narrow:data-ending-style:scale-100 narrow:data-starting-style:translate-y-full narrow:data-starting-style:scale-100 narrow:motion-reduce:data-ending-style:translate-y-0 narrow:motion-reduce:data-starting-style:translate-y-0",
        false: "",
      },
    },
    defaultVariants: { size: "md", sheet: true },
  },
)

/** The default content look (`md`, a bottom sheet on narrow screens), for an AlertDialog or other content part. */
const contentClassName = dialogContentVariants()

type DialogSize = NonNullable<VariantProps<typeof dialogContentVariants>["size"]>

function DialogTrigger({
  className,
  variant = "outline",
  size,
  ...props
}: ComponentProps<typeof DialogTriggerPrimitive> & ButtonLook) {
  return <DialogTriggerPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function DialogBackdrop({ className, ...props }: ComponentProps<typeof DialogBackdropPrimitive>) {
  return <DialogBackdropPrimitive className={cnState(backdropClassName, className)} {...props} />
}

type DialogContentProps = ComponentProps<typeof DialogContentPrimitive> & {
  /** `sm` 24rem, `md` 32rem (default), `lg` 48rem, `xl` 72rem; `full` fills its container less `--floating-offset`. */
  size?: DialogSize
  /** On narrow screens it rises from the bottom as a full-width sheet; `false` keeps it centered. */
  sheet?: boolean
}

function DialogContent({ className, size = "md", sheet = true, ...props }: DialogContentProps) {
  return (
    <DialogContentPrimitive
      data-size={size}
      data-sheet={sheet ? "" : undefined}
      className={cnState(dialogContentVariants({ size, sheet }), className)}
      {...props}
    />
  )
}

function DialogHeader({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    { "data-slot": "dialog-header", className: cn("flex shrink-0 flex-col gap-inline", className), ...props },
    render,
  )
}

/**
 * The part that scrolls, so the header and footer around it stay in view. It is positioned so the visually hidden
 * inputs inside Select, Checkbox and other controls are clipped by it, instead of overflowing the dialog and scrolling
 * the header away when a field takes focus.
 */
function DialogBody({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "dialog-body",
      className: cn(
        "relative -mx-inset-surface flex min-h-0 min-w-0 flex-1 flex-col gap-group overflow-y-auto overscroll-contain px-inset-surface",
        className,
      ),
      ...props,
    },
    render,
  )
}

function DialogFooter({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "dialog-footer",
      className: cn("flex shrink-0 flex-col-reverse gap-items sm:flex-row sm:justify-end", className),
      ...props,
    },
    render,
  )
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogTitlePrimitive>) {
  return <DialogTitlePrimitive className={cnState("text-title leading-none", className)} {...props} />
}

function DialogDescription({ className, ...props }: ComponentProps<typeof DialogDescriptionPrimitive>) {
  return <DialogDescriptionPrimitive className={cnState("text-sm text-muted-foreground", className)} {...props} />
}

function DialogClose({
  className,
  variant = "outline",
  size,
  ...props
}: ComponentProps<typeof DialogClosePrimitive> & ButtonLook) {
  return <DialogClosePrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

export {
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
  backdropClassName,
  contentClassName,
  createDialogController,
  dialogContentVariants,
}
export type { DialogContentProps, DialogSize }
