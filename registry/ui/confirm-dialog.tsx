"use client"

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps, ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { backdropClassName, contentClassName } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type AlertDialogRootProps = ComponentProps<typeof AlertDialog>
type ConfirmAction = NonNullable<ComponentProps<typeof AlertDialogClose>["action"]>

type ConfirmTone =
  | { tone?: "default"; agentConfirm?: string }
  | {
      tone: "destructive"
      /** Sentence an agent must show a person before confirming, e.g. "Deletes the project and its files". */
      agentConfirm: string
    }

type ConfirmDialogProps = ConfirmTone & {
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  /** Runs before the dialog closes. A returned Promise keeps it open and pending; a rejection keeps it open. */
  onConfirm: ConfirmAction
  /** Content of the button that opens the dialog. Omit it when opening through `open` or `controller`. */
  trigger?: ReactNode
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
  renderError?: (error: unknown) => ReactNode
  className?: string
} & Pick<
    AlertDialogRootProps,
    "open" | "defaultOpen" | "onOpenChange" | "onOpenChangeComplete" | "controller" | "pendingAnnouncement"
  >

function defaultRenderError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  tone = "default",
  agentConfirm,
  trigger,
  triggerVariant,
  renderError = defaultRenderError,
  className,
  ...root
}: ConfirmDialogProps) {
  const destructive = tone === "destructive"
  return (
    <AlertDialog {...root}>
      {trigger === undefined ? null : (
        <AlertDialogTrigger
          className={buttonVariants({ variant: triggerVariant ?? (destructive ? "destructive" : "outline") })}
        >
          {trigger}
        </AlertDialogTrigger>
      )}
      <AlertDialogBackdrop className={backdropClassName} />
      <AlertDialogContent className={cn(contentClassName, "max-w-md", className)}>
        <div className="flex flex-col gap-inline">
          <AlertDialogTitle className="text-title leading-none">{title}</AlertDialogTitle>
          {description === undefined ? null : (
            <AlertDialogDescription className="text-sm text-muted-foreground">{description}</AlertDialogDescription>
          )}
        </div>
        <AlertDialogClose
          value="confirm"
          action={onConfirm}
          data-tone={tone}
          data-agent-confirm={agentConfirm}
          render={(props, state) => (
            <div className="flex flex-col gap-items">
              <p role="alert" className="text-sm text-destructive empty:hidden">
                {state.error === undefined || state.error === null ? null : renderError(state.error)}
              </p>
              <div className="flex flex-col-reverse gap-items sm:flex-row sm:justify-end">
                <AlertDialogClose className={buttonVariants({ variant: "outline" })}>{cancelLabel}</AlertDialogClose>
                <button
                  {...props}
                  className={cn(buttonVariants({ variant: destructive ? "destructive" : "default" }), props.className)}
                >
                  <svg
                    data-show="pending"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className="animate-spin"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {confirmLabel}
                </button>
              </div>
            </div>
          )}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmDialog }
export type { ConfirmDialogProps }
