"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { LinkIcon, PlugZapIcon, RefreshCwIcon, UnlinkIcon } from "lucide-react"
import { createContext, isValidElement, use, useId, useMemo, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cardVariants } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  connectedAccount,
  type ConnectedAccountAction,
  type ConnectedAccountState,
  type ConnectedAccountStatus,
} from "@/components/ui/connected-account-primitive"
import { DescriptionDetails, DescriptionItem, DescriptionList, DescriptionTerm } from "@/components/ui/description-list"
import { StatusPill } from "@/components/ui/status-pill"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

/** The third-party provider the account lives at. */
type ConnectedAccountProvider = {
  name: string
  /** A mark for the provider, decorative: the name is read beside it. */
  logo?: ReactNode
}

/** One line about the account, like its masked email, plan, connected since, last refresh or expiry. */
type ConnectedAccountFact = {
  id: string
  label: ReactNode
  /** Formatted by you; a RelativeTime keeps a date live. */
  value: ReactNode
}

/** The panel's visible text. None has a default: pass it in the page's language. */
type ConnectedAccountText = {
  /** The status pill's text for each status. */
  status: Record<ConnectedAccountStatus, ReactNode>
  connect: ReactNode
  reconnect: ReactNode
  disconnect: ReactNode
  /** The Cancel shown beside `waiting` while pending, with `onCancel`; leave it out to render your own. */
  cancel?: ReactNode
  disconnectTitle: ReactNode
  disconnectDescription?: ReactNode
  /** The confirmation's button; keep it apart from `disconnect`, so an agent's press finds this one. */
  disconnectConfirm: ReactNode
  /** What a person approves when an agent disconnects, like "Unlinks your account; syncing stops". */
  disconnectAgentConfirm: string
  /**
   * Shown in a live destructive alert when an action fails. A rejection with a string or a React node shows as it
   * is; anything else shows this, which can be a function of the error and the action.
   */
  error: ReactNode | ((error: unknown, action: ConnectedAccountAction) => ReactNode)
}

/** Names for screen readers; English by default. */
type ConnectedAccountLabels = {
  /** The confirmation's button that keeps the account. "Cancel" by default. */
  keepConnected?: ReactNode
}

/** What custom waiting content and `useConnectedAccount` get. */
type ConnectedAccountControls = {
  status: ConnectedAccountStatus
  /** The action being sent, or `null`. */
  pending: ConnectedAccountAction | null
  /** Abandons the pending sign-in through `onCancel`; pass a press's event so a refusal stays quiet. */
  cancel: (event?: Event | { nativeEvent: Event }) => void
}

/** What a consumer's own `actions` can render from. */
type ConnectedAccountActionState = Omit<ConnectedAccountControls, "cancel"> & {
  /** The panel's own buttons for the status, to keep beside yours. */
  buttons: ReactNode
}

type ConnectedAccountProps = {
  provider: ConnectedAccountProvider
  status: ConnectedAccountStatus
  /** A line under the provider's name. */
  description?: ReactNode
  facts?: readonly ConnectedAccountFact[]
  /** Shown while pending, like a DeviceCodePrompt; a function gets `cancel` for a button of its own. */
  waiting?: ReactNode | ((controls: ConnectedAccountControls) => ReactNode)
  /** Shown while disconnected. A returned Promise keeps Connect pending; a rejection shows `text.error`. */
  onConnect?: () => unknown
  /** Shown once the sign-in has expired, and while connected with `reconnectWhenConnected`. */
  onReconnect?: () => unknown
  reconnectWhenConnected?: boolean
  /** Shown while connected or expired, behind a confirmation whose confirm needs a person for an agent. */
  onDisconnect?: () => unknown
  /** Abandons a pending sign-in, like one the person gave up on at the provider. */
  onCancel?: () => unknown
  /** Your own controls: a node replaces the panel's buttons, a function gets them in `buttons` to add to. */
  actions?: ReactNode | ((state: ConnectedAccountActionState) => ReactNode)
  text: ConnectedAccountText
  labels?: ConnectedAccountLabels
  /** The provider name's heading level; 3 by default. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** Names the panel for screen readers and agents; the provider's name by default. */
  "aria-label"?: string
  className?: string
}

const statusTone: Record<ConnectedAccountStatus, Tone> = {
  connected: "success",
  pending: "info",
  expired: "warning",
  disconnected: "neutral",
}

const rootAttributes: Record<`data-${string}`, string> = { "data-slot": "connected-account" }

const headingTag = { 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const

const noFacts: readonly ConnectedAccountFact[] = []

const ignoreRefusal = () => undefined

const ConnectedAccountContext = createContext<ConnectedAccountControls | null>(null)

/** The enclosing ConnectedAccount's status, pending action and `cancel`, for content inside its `waiting`. */
function useConnectedAccount() {
  const controls = use(ConnectedAccountContext)
  if (controls === null) throw new Error("useConnectedAccount must be called inside a ConnectedAccount.")
  return controls
}

function errorContent(error: unknown, action: ConnectedAccountAction | null, fallback: ConnectedAccountText["error"]) {
  if (typeof error === "string" || isValidElement(error)) return error
  if (typeof fallback !== "function") return fallback
  return action === null ? null : fallback(error, action)
}

function settle(result: unknown) {
  if (result instanceof Promise) result.then(undefined, ignoreRefusal)
}

function hasContent(node: ReactNode) {
  return node !== undefined && node !== null && node !== false
}

function nativeEventOf(event: Event | { nativeEvent: Event } | undefined) {
  if (event === undefined || event instanceof Event) return event
  return event.nativeEvent
}

function ConnectedAccount({
  provider,
  status,
  description,
  facts = noFacts,
  waiting,
  onConnect,
  onReconnect,
  reconnectWhenConnected = false,
  onDisconnect,
  onCancel,
  actions,
  text,
  labels,
  headingLevel = 3,
  "aria-label": label,
  className,
}: ConnectedAccountProps) {
  const nameId = useId()
  const handle = usePrimitive(connectedAccount, {
    status,
    onConnect,
    onReconnect,
    onDisconnect,
    onCancel,
    reconnectWhenConnected,
  })
  const { api } = handle
  const Heading = headingTag[headingLevel]

  const { status: liveStatus, pending } = handle.state
  const controls = useMemo<ConnectedAccountControls>(
    () => ({ status: liveStatus, pending, cancel: (event) => settle(api.cancel(nativeEventOf(event))) }),
    [liveStatus, pending, api],
  )

  const panel = usePart(
    handle,
    "root",
    {},
    {
      ...rootAttributes,
      "aria-label": label,
      "aria-labelledby": label === undefined ? nameId : undefined,
      className: cn(cardVariants({ surface: "card" }), "@container min-w-0", className),
      children: (state: ConnectedAccountState) => {
        const busy = state.pending !== null
        const offersReconnect = status === "expired" || (status === "connected" && reconnectWhenConnected)
        const buttons = (
          <>
            {status === "disconnected" && onConnect ? (
              <Button
                className="narrow:w-full"
                loading={state.pending === "connect"}
                disabled={busy}
                onClick={(event) => settle(api.connect(event.nativeEvent))}
              >
                <LinkIcon />
                {text.connect}
              </Button>
            ) : null}
            {(status === "connected" || status === "expired") && onDisconnect ? (
              <Button
                variant="outline"
                className="narrow:w-full"
                disabled={busy}
                onClick={(event) => api.disconnect(event.nativeEvent)}
              >
                <UnlinkIcon />
                {text.disconnect}
              </Button>
            ) : null}
            {offersReconnect && onReconnect ? (
              <Button
                variant={status === "expired" ? "default" : "outline"}
                className="narrow:w-full"
                loading={state.pending === "reconnect"}
                disabled={busy}
                onClick={(event) => settle(api.reconnect(event.nativeEvent))}
              >
                <RefreshCwIcon />
                {text.reconnect}
              </Button>
            ) : null}
          </>
        )
        const footer =
          typeof actions === "function"
            ? actions({ status: state.status, pending: state.pending, buttons })
            : (actions ?? buttons)
        const waitingContent = typeof waiting === "function" ? waiting(controls) : waiting
        const builtInCancel = onCancel !== undefined && hasContent(text.cancel)
        return (
          <>
            <div data-slot="connected-account-header" className="flex min-w-0 items-start gap-items px-inset-surface">
              <span
                aria-hidden="true"
                data-slot="connected-account-logo"
                className="flex size-control shrink-0 items-center justify-center overflow-hidden rounded-control border bg-muted text-muted-foreground [&_svg]:size-5"
              >
                {provider.logo ?? <PlugZapIcon />}
              </span>
              <div className="flex min-w-0 grow flex-col gap-inline">
                <div className="flex min-w-0 flex-wrap items-center gap-x-items gap-y-inline">
                  <Heading id={nameId} className="min-w-0 text-title-sm break-words">
                    {provider.name}
                  </Heading>
                  <StatusPill
                    data-slot="connected-account-status"
                    tone={statusTone[status]}
                    dot
                    pulse={status === "pending"}
                  >
                    {text.status[status]}
                  </StatusPill>
                </div>
                {hasContent(description) ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
              </div>
            </div>
            {facts.length > 0 ? (
              <div data-slot="connected-account-facts" className="px-inset-surface">
                <DescriptionList layout="inline">
                  {facts.map((fact) => (
                    <DescriptionItem key={fact.id}>
                      <DescriptionTerm>{fact.label}</DescriptionTerm>
                      <DescriptionDetails>{fact.value}</DescriptionDetails>
                    </DescriptionItem>
                  ))}
                </DescriptionList>
              </div>
            ) : null}
            {status === "pending" && (hasContent(waitingContent) || builtInCancel) ? (
              <div data-slot="connected-account-waiting" className="flex min-w-0 flex-col gap-items px-inset-surface">
                {waitingContent}
                {builtInCancel ? (
                  <div className="flex justify-end narrow:flex-col narrow:items-stretch">
                    <Button
                      variant="outline"
                      className="narrow:w-full"
                      loading={state.pending === "cancel"}
                      disabled={busy}
                      onClick={(event) => controls.cancel(event)}
                    >
                      {text.cancel}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {state.error === null ? null : (
              <div className="px-inset-surface">
                <Alert data-slot="connected-account-error" tone="destructive" live>
                  <AlertDescription className="text-foreground">
                    {errorContent(state.error, state.failed, text.error)}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            {hasContent(footer) ? (
              <div
                data-slot="connected-account-actions"
                className="flex flex-wrap items-center justify-end gap-items px-inset-surface empty:hidden narrow:flex-col-reverse narrow:items-stretch"
              >
                {footer}
              </div>
            ) : null}
            <ConfirmDialog
              open={state.confirmingDisconnect}
              onOpenChange={(open) => {
                if (!open) api.closeDisconnect()
              }}
              tone="destructive"
              title={text.disconnectTitle}
              description={text.disconnectDescription}
              confirmLabel={text.disconnectConfirm}
              agentConfirm={text.disconnectAgentConfirm}
              labels={labels?.keepConnected === undefined ? undefined : { cancel: labels.keepConnected }}
              renderError={(error) => errorContent(error, "disconnect", text.error)}
              onConfirm={() => api.confirmDisconnect()}
            />
          </>
        )
      },
    },
  )

  return <ConnectedAccountContext value={controls}>{panel}</ConnectedAccountContext>
}

export { ConnectedAccount, useConnectedAccount }
export type {
  ConnectedAccountAction,
  ConnectedAccountActionState,
  ConnectedAccountControls,
  ConnectedAccountFact,
  ConnectedAccountLabels,
  ConnectedAccountProps,
  ConnectedAccountProvider,
  ConnectedAccountStatus,
  ConnectedAccountText,
}
