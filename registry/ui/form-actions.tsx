"use client"

import { useEffect, type ReactNode } from "react"
import { useFormState } from "react-hook-form"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { errorText, useFormContext, type IssueError } from "@/components/ui/form-context"
import { cn } from "@/lib/utils"

type FormRootErrorProps = {
  /** A heading above the message, in the page's language. */
  title?: ReactNode
  className?: string
}

/** The form's own error: a thrown error, a server message or a schema issue with no field. Focused after a submit. */
function FormRootError({ title, className }: FormRootErrorProps) {
  const { form, messages, setRoot } = useFormContext("FormRootError")
  const { errors } = useFormState({ control: form.control, name: "root" })
  const root = errors.root as (IssueError & Record<string, IssueError | undefined>) | undefined
  const lines = [root?.server, root?.message === undefined ? undefined : root]
    .filter((error): error is IssueError => Boolean(error?.message || error?.type))
    .flatMap((error) => errorText(error, "root", undefined, messages).split("\n"))

  if (lines.length === 0) return null
  return (
    <Alert
      ref={setRoot}
      tone="destructive"
      live
      tabIndex={-1}
      data-slot="form-root-error"
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {title === undefined ? null : <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>
        {lines.length === 1 ? (
          lines[0]
        ) : (
          <ul className="flex list-disc flex-col gap-inline ps-group">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}

type FormActionsTone =
  | { tone?: "default"; confirm?: string }
  | {
      tone: "destructive"
      /** Sentence an agent must show a person before submitting, e.g. "Deletes the project and its files". */
      confirm: string
    }

type FormActionsProps = FormActionsTone & {
  submitLabel: ReactNode
  /** What screen readers hear once the submit has been pending for a second, in the page's language. */
  pendingLabel?: string
  /** The cancel button's text; shown when set. */
  cancel?: ReactNode
  onCancel?: () => void
  /** Another control, like a "Save draft" Button, placed before cancel. */
  secondaryAction?: ReactNode
  /** Disables submit and cancel while something outside the form is busy; the form doesn't submit. */
  disabled?: boolean
  /** Disables only submit, for example until a required upload finishes; the form doesn't submit. */
  submitDisabled?: boolean
  /** Shows the pending look for work the app runs itself (the form's own submit needs nothing); the form doesn't submit. */
  pending?: boolean
  className?: string
}

function FormActions({
  submitLabel,
  pendingLabel,
  cancel,
  onCancel,
  secondaryAction,
  tone = "default",
  confirm,
  disabled = false,
  submitDisabled = false,
  pending: forcedPending = false,
  className,
}: FormActionsProps) {
  const context = useFormContext("FormActions")
  const destructive = tone === "destructive"
  const { setConfirm, setBlocked } = context
  useEffect(() => {
    setConfirm(destructive)
    return () => setConfirm(false)
  }, [destructive, setConfirm])
  const blocked = disabled || submitDisabled || forcedPending
  useEffect(() => {
    setBlocked(blocked)
    return () => setBlocked(false)
  }, [blocked, setBlocked])
  const pending = context.pending || forcedPending

  return (
    <div
      data-slot="form-actions"
      className={cn(
        "flex flex-wrap items-center justify-end gap-items narrow:flex-col-reverse narrow:items-stretch",
        className,
      )}
    >
      {secondaryAction}
      {cancel === undefined ? null : (
        <Button type="button" variant="outline" disabled={pending || disabled} onClick={onCancel}>
          {cancel}
        </Button>
      )}
      <Button
        type="submit"
        variant={destructive ? "destructive" : "default"}
        loading={pending}
        disabled={(disabled || submitDisabled) && !pending}
        pendingAnnouncement={pendingLabel}
        data-agent-confirm={confirm}
      >
        {submitLabel}
      </Button>
    </div>
  )
}

export { FormActions, FormRootError }
export type { FormActionsProps, FormRootErrorProps }
