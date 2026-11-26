"use client"

import type { ComponentProps, MouseEvent, ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn, cssVars } from "@/lib/utils"

type AuthStatus = "idle" | "working" | "error" | "success"

type AuthPageAction = {
  label: ReactNode
  /** Starts the ceremony or the request. Set `status` to `working` while it runs. */
  onAction: (event: MouseEvent<HTMLElement>) => unknown
  /** A leading icon, like a `KeyRoundIcon` for a passkey. */
  icon?: ReactNode
  disabled?: boolean
}

type AuthPageRetry = {
  label: ReactNode
  /** Runs the primary action again by default. */
  onRetry?: (event: MouseEvent<HTMLElement>) => unknown
}

type AuthPageProps = Omit<ComponentProps<"div">, "title" | "children"> & {
  /** The brand lockup, above the title. */
  logo?: ReactNode
  title: ReactNode
  description?: ReactNode
  /**
   * `working` marks the primary action pending and announces `workingLabel`; `error` shows `error` in a destructive
   * alert with `retry`; `success` replaces the actions with `success`. `idle` by default.
   */
  status?: AuthStatus
  /** The button that does the page's one job: sign in with a passkey, create the account, recover it. */
  action?: AuthPageAction
  /** Read politely while `status` is `working`, like "Waiting for your passkey". */
  workingLabel?: string
  /** Shown in a live destructive alert while `status` is `error`. */
  error?: ReactNode
  /** The alert's retry button, while `status` is `error`. */
  retry?: AuthPageRetry
  /** A note above the action in any status, like an Alert saying who invited you. */
  alert?: ReactNode
  /** Shown instead of the action and `secondary` while `status` is `success`. */
  success?: ReactNode
  /** Fields or text between the description and the action. */
  children?: ReactNode
  /** Other ways in, under the action: another device, a recovery code, a link to sign in instead. */
  secondary?: ReactNode
  /** Links under the card: terms, privacy, help. */
  footer?: ReactNode
}

const safeAreaPaddingWithRtlSwap =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- no token holds a safe-area inset: each side takes the larger of the inset and its spacing role, and the physical insets swap under rtl
  "ps-[max(var(--gap-group),env(safe-area-inset-left))] pe-[max(var(--gap-group),env(safe-area-inset-right))] rtl:ps-[max(var(--gap-group),env(safe-area-inset-right))] rtl:pe-[max(var(--gap-group),env(safe-area-inset-left))] pt-[max(var(--gap-section),env(safe-area-inset-top))] pb-[max(var(--gap-section),env(safe-area-inset-bottom))]"

function AuthPage({
  logo,
  title,
  description,
  status = "idle",
  action,
  workingLabel,
  error,
  retry,
  alert,
  success,
  children,
  secondary,
  footer,
  className,
  style,
  ...props
}: AuthPageProps) {
  const working = status === "working"
  const succeeded = status === "success"
  const runRetry = retry?.onRetry ?? action?.onAction
  return (
    <div
      data-slot="auth-page"
      data-status={status}
      className={cn(
        "flex min-h-(--auth-page-height) w-full flex-col items-center justify-center gap-group bg-background text-foreground",
        safeAreaPaddingWithRtlSwap,
        className,
      )}
      style={{ ...cssVars({ "--auth-page-height": "100dvh" }), ...style }}
      {...props}
    >
      <main
        data-slot="auth-page-card"
        aria-busy={working || undefined}
        className="flex w-full max-w-(--auth-page-width,26rem) flex-col gap-group rounded-surface border bg-card/(--glass-opacity) p-inset-surface text-card-foreground shadow-surface backdrop-surface"
      >
        <header data-slot="auth-page-header" className="flex flex-col items-center gap-items text-center">
          {logo === undefined ? null : (
            <div data-slot="auth-page-logo" className="flex items-center justify-center">
              {logo}
            </div>
          )}
          <h1 data-slot="auth-page-title" className="text-title tracking-tight text-balance">
            {title}
          </h1>
          {description === undefined ? null : (
            <div data-slot="auth-page-description" className="text-body-sm text-pretty text-muted-foreground">
              {description}
            </div>
          )}
        </header>
        {alert}
        {status === "error" && error !== undefined ? (
          <Alert
            data-slot="auth-page-error"
            tone="destructive"
            live
            action={
              retry === undefined ? undefined : (
                <Button size="sm" variant="outline" onClick={(event) => runRetry?.(event)}>
                  {retry.label}
                </Button>
              )
            }
          >
            <AlertDescription className="text-foreground">{error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
        {succeeded ? (
          <output data-slot="auth-page-success" className="flex flex-col gap-items">
            {success}
          </output>
        ) : (
          <>
            {action === undefined ? null : (
              <Button
                size="lg"
                className="w-full"
                loading={working}
                disabled={action.disabled}
                onClick={(event) => action.onAction(event)}
              >
                {action.icon}
                {action.label}
              </Button>
            )}
            {secondary === undefined ? null : (
              <div data-slot="auth-page-secondary" className="flex flex-col items-stretch gap-items text-body-sm">
                {secondary}
              </div>
            )}
          </>
        )}
        <output data-slot="auth-page-announcer" className="sr-only">
          {working ? workingLabel : null}
        </output>
      </main>
      {footer === undefined ? null : (
        <footer
          data-slot="auth-page-footer"
          className="flex flex-wrap items-center justify-center gap-x-group gap-y-items text-caption text-muted-foreground"
        >
          {footer}
        </footer>
      )}
    </div>
  )
}

export { AuthPage }
export type { AuthPageAction, AuthPageProps, AuthPageRetry, AuthStatus }
