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
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn, cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

const backdropClassName =
  "fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"

const contentClassName =
  "fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-lg flex-col gap-group overflow-y-auto overscroll-contain rounded-floating border border-floating-border bg-popover/(--glass-opacity) p-inset-surface text-popover-foreground shadow-floating backdrop-floating outline-none transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"

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

function DialogContent({ className, ...props }: ComponentProps<typeof DialogContentPrimitive>) {
  return <DialogContentPrimitive className={cnState(contentClassName, className)} {...props} />
}

function DialogHeader({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    { "data-slot": "dialog-header", className: cn("flex flex-col gap-inline", className), ...props },
    render,
  )
}

function DialogFooter({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "dialog-footer",
      className: cn("flex flex-col-reverse gap-items sm:flex-row sm:justify-end", className),
      ...props,
    },
    render,
  )
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogTitlePrimitive>) {
  return <DialogTitlePrimitive className={cnState("text-lg leading-none font-semibold", className)} {...props} />
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
}
