"use client"

import {
  Toast as ToastPrimitive,
  ToastAction as ToastActionPrimitive,
  ToastClose as ToastClosePrimitive,
  ToastDescription as ToastDescriptionPrimitive,
  ToastRegion as ToastRegionPrimitive,
  ToastTitle as ToastTitlePrimitive,
  createToaster,
  toast,
} from "@ui-sdk/react/toast"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

// The region is a manual popover in the top layer, so the UA popover box (inset, margin, border, canvas) is reset.
const toastRegionClassName =
  // oxlint-disable-next-line eskais/spacing-tokens -- the offset from the viewport edge pairs with w-[calc(100%-2rem)]
  "fixed inset-auto m-4 w-[calc(100%-2rem)] max-w-88 overflow-visible border-0 bg-transparent p-0 data-[side=bottom]:bottom-0 data-[side=top]:top-0 data-[align=end]:end-0 data-[align=start]:start-0 data-[align=center]:left-1/2 data-[align=center]:mx-0 data-[align=center]:-translate-x-1/2 [&>[data-slot=toast-list]]:m-0 [&>[data-slot=toast-list]]:flex [&>[data-slot=toast-list]]:list-none [&>[data-slot=toast-list]]:flex-col [&>[data-slot=toast-list]]:gap-items [&>[data-slot=toast-list]]:p-0 data-[side=bottom]:[&>[data-slot=toast-list]]:flex-col-reverse"

const toastClassName =
  "flex flex-wrap items-center gap-x-items gap-y-inline rounded-surface border bg-popover/(--glass-opacity) px-inset-surface py-group text-sm text-popover-foreground shadow-surface backdrop-surface outline-none select-none translate-x-(--toast-swipe-x) translate-y-(--toast-swipe-y) transition duration-200 focus-visible:ring-2 focus-visible:ring-ring data-swiping:transition-none data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 data-[type=error]:border-destructive/50 data-[type=success]:border-success/50 data-[type=warning]:border-warning/50 data-[type=info]:border-info/50 motion-reduce:transition-opacity motion-reduce:data-starting-style:scale-100"

function ToastRegion({ className, ...props }: ComponentProps<typeof ToastRegionPrimitive>) {
  return <ToastRegionPrimitive className={cnState(toastRegionClassName, className)} {...props} />
}

function Toast({ className, ...props }: ComponentProps<typeof ToastPrimitive>) {
  return <ToastPrimitive className={cnState(toastClassName, className)} {...props} />
}

function ToastTitle({ className, ...props }: ComponentProps<typeof ToastTitlePrimitive>) {
  return <ToastTitlePrimitive className={cnState("min-w-0 flex-1 font-medium", className)} {...props} />
}

function ToastDescription({ className, ...props }: ComponentProps<typeof ToastDescriptionPrimitive>) {
  return (
    <ToastDescriptionPrimitive className={cnState("order-1 basis-full text-muted-foreground", className)} {...props} />
  )
}

function ToastAction({
  className,
  variant = "default",
  size = "sm",
  ...props
}: ComponentProps<typeof ToastActionPrimitive> & ButtonLook) {
  return <ToastActionPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function ToastClose({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: ComponentProps<typeof ToastClosePrimitive> & ButtonLook) {
  return <ToastClosePrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

type ToastStackProps = Omit<ComponentProps<typeof ToastRegionPrimitive>, "children"> & {
  /** Accessible name of each toast's close button. */
  closeLabel?: string
}

// data-agent-hidden by default: an empty region has no name, which leaves agents an unnamed entry.
function ToastStack({ closeLabel = "Dismiss", ...props }: ToastStackProps) {
  return (
    <ToastRegion data-agent-hidden {...props}>
      {(item) => (
        <Toast>
          <ToastTitle />
          <ToastDescription />
          <ToastAction />
          {item.cancel ? (
            <ToastClose variant="outline" action={item.cancel.onCancel}>
              {item.cancel.label}
            </ToastClose>
          ) : (
            item.dismissible !== false && (
              <ToastClose aria-label={closeLabel} className="size-control-sm px-0">
                <CloseIcon />
              </ToastClose>
            )
          )}
        </Toast>
      )}
    </ToastRegion>
  )
}

export { Toast, ToastAction, ToastClose, ToastDescription, ToastRegion, ToastStack, ToastTitle, createToaster, toast }
export type { ToastStackProps }
