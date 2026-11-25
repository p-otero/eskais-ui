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
import { useState, type ComponentProps, type ReactNode } from "react"

import { buttonVariants, withPendingSpinner } from "@/components/ui/button"
import { backdropClassName, contentClassName, useFocusReturn } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type AlertDialogRootProps = ComponentProps<typeof AlertDialog>
type PillDialogAction = NonNullable<ComponentProps<typeof AlertDialogClose>["action"]>

type PillDialogLabels = {
  /** The blue pill, which closes without confirming. "Cancel" by default; pass it in the page's language. */
  cancel?: ReactNode
}

/** Which pill closed the dialog, while it animates out: the chosen one grows and the other fades. */
type PillChoice = "cancel" | "confirm"

type PillDialogProps = {
  title: ReactNode
  description?: ReactNode
  /** The red pill's text. */
  confirmLabel: ReactNode
  /** Sentence an agent must show a person before confirming, e.g. "Migrates the production database". */
  agentConfirm: string
  labels?: PillDialogLabels
  /** Runs before the dialog closes. A returned Promise keeps it open and pending; a rejection keeps it open. */
  onConfirm: PillDialogAction
  /** Content of the button that opens the dialog. Omit it when opening through `open` or `controller`. */
  trigger?: ReactNode
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
  /** The trigger can't open the dialog; nor can an agent or a controller. */
  triggerDisabled?: boolean
  /** Work the trigger stands for is running elsewhere: a spinner, `aria-busy`, and the dialog doesn't open. */
  triggerPending?: boolean
  renderError?: (error: unknown) => ReactNode
  className?: string
} & Pick<
  AlertDialogRootProps,
  "open" | "defaultOpen" | "onOpenChange" | "onOpenChangeComplete" | "controller" | "pendingAnnouncement"
>

function defaultRenderError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function Capsule() {
  return (
    <span data-slot="pill-dialog-capsule" aria-hidden="true">
      <span data-slot="pill-dialog-shell" />
    </span>
  )
}

/**
 * A confirm dialog whose answers are two glossy capsules: a blue pill that cancels and a red pill that confirms. Built
 * on UI SDK's AlertDialog, so Escape, the focus trap and focus return behave as in any alert dialog; the chosen pill
 * grows while the other fades as it closes. The red pill carries `data-agent-confirm`.
 */
function PillDialog({
  title,
  description,
  confirmLabel,
  agentConfirm,
  labels,
  onConfirm,
  trigger,
  triggerVariant = "outline",
  triggerDisabled = false,
  triggerPending,
  renderError = defaultRenderError,
  className,
  ...root
}: PillDialogProps) {
  const [choice, setChoice] = useState<PillChoice | undefined>()
  const blocked = trigger !== undefined && (triggerDisabled || triggerPending === true)
  const { attach, finalFocus: returnFocus, wrap } = useFocusReturn(undefined)
  const cancel = labels?.cancel ?? "Cancel"
  return (
    <AlertDialog
      {...root}
      onOpenChange={(open, details) => {
        if (open && blocked) {
          details.cancel()
          return
        }
        root.onOpenChange?.(open, details)
        if (details.canceled) return
        if (open) setChoice(undefined)
        else if (details.returnValue === "confirm" || details.returnValue === "cancel") setChoice(details.returnValue)
      }}
    >
      {trigger === undefined ? null : (
        <AlertDialogTrigger
          disabled={triggerDisabled || triggerPending === true}
          focusableWhenDisabled={triggerPending === true}
          data-pending={triggerPending ? "" : undefined}
          aria-busy={triggerPending || undefined}
          className={buttonVariants({ variant: triggerVariant })}
        >
          {triggerPending === undefined ? trigger : withPendingSpinner(trigger, false, triggerVariant, triggerPending)}
        </AlertDialogTrigger>
      )}
      <AlertDialogBackdrop className={backdropClassName} />
      <AlertDialogContent
        ref={attach}
        data-pill-dialog=""
        data-chosen={choice}
        finalFocus={returnFocus}
        className={cn(contentClassName, "max-w-md text-center", className)}
      >
        {wrap(
          <>
            <div className="flex flex-col gap-inline">
              <AlertDialogTitle className="text-title">{title}</AlertDialogTitle>
              {description === undefined ? null : (
                <AlertDialogDescription className="text-body-sm text-muted-foreground">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
            <AlertDialogClose
              value="confirm"
              action={onConfirm}
              data-agent-confirm={agentConfirm}
              render={(props, state) => (
                <div className="flex flex-col gap-items">
                  <p role="alert" className="text-body-sm text-destructive empty:hidden">
                    {state.error === undefined || state.error === null ? null : renderError(state.error)}
                  </p>
                  <div data-slot="pill-dialog-pills">
                    <AlertDialogClose
                      value="cancel"
                      render={(cancelProps) => (
                        <button {...cancelProps} data-slot="pill-dialog-pill" data-pill="cancel">
                          <Capsule />
                          <span data-slot="pill-dialog-label">{cancel}</span>
                        </button>
                      )}
                    />
                    <button {...props} data-slot="pill-dialog-pill" data-pill="confirm">
                      <Capsule />
                      <span data-slot="pill-dialog-label">
                        <Spinner data-show="pending" />
                        {confirmLabel}
                      </span>
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

export { PillDialog }
export type { PillChoice, PillDialogLabels, PillDialogProps }
