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

import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { backdropClassName, contentClassName, useFocusReturn } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import type { Tone } from "@/lib/tone"
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

type ConfirmDialogLabels = {
  /** The button that closes without confirming. "Cancel" by default; pass it in the page's language. */
  cancel?: ReactNode
}

type ConfirmDialogProps = ConfirmTone & {
  title: ReactNode
  description?: ReactNode
  /**
   * A callout under the description, like "Three agents are still running on it": an Alert in the dialog's tone
   * (`destructive`, or `info` for the default tone), read as part of the description. Text, or AlertTitle and
   * AlertDescription parts.
   */
  children?: ReactNode
  /** The callout's tone, when the dialog's doesn't fit. */
  calloutTone?: Tone
  confirmLabel: ReactNode
  labels?: ConfirmDialogLabels
  /** @deprecated Use `labels.cancel`. */
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
  children,
  calloutTone,
  confirmLabel,
  labels,
  cancelLabel,
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
  const focus = useFocusReturn(undefined)
  const cancel = labels?.cancel ?? cancelLabel ?? "Cancel"
  const callout =
    children === undefined || children === null ? null : (
      <Alert data-slot="confirm-dialog-callout" tone={calloutTone ?? (destructive ? "destructive" : "info")}>
        {typeof children === "string" || typeof children === "number" ? (
          <AlertDescription className="text-foreground">{children}</AlertDescription>
        ) : (
          children
        )}
      </Alert>
    )
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
      <AlertDialogContent
        ref={focus.attach}
        className={cn(contentClassName, "max-w-md", className)}
        // oxlint-disable-next-line react/refs -- read when UI SDK calls finalFocus on close, never during render
        finalFocus={focus.finalFocus}
      >
        {focus.wrap(
          <>
            <div className="flex flex-col gap-inline">
              <AlertDialogTitle className="text-title leading-none">{title}</AlertDialogTitle>
              {description === undefined && callout === null ? null : (
                <AlertDialogDescription
                  render={<div />}
                  className="flex flex-col gap-items text-sm text-muted-foreground"
                >
                  {description === undefined ? null : <div>{description}</div>}
                  {callout}
                </AlertDialogDescription>
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
                    <AlertDialogClose className={buttonVariants({ variant: "outline" })}>{cancel}</AlertDialogClose>
                    <button
                      {...props}
                      className={cn(
                        buttonVariants({ variant: destructive ? "destructive" : "default" }),
                        props.className,
                      )}
                    >
                      <Spinner data-show="pending" />
                      {confirmLabel}
                    </button>
                  </div>
                </div>
              )}
            />
          </>,
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmDialog }
export type { ConfirmDialogLabels, ConfirmDialogProps }
