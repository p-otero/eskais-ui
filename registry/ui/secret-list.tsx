"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataState, type DataStatus } from "@/components/ui/data-state"
import { List, ListItem } from "@/components/ui/list-item"
import { RelativeTime } from "@/components/ui/relative-time"
import { secretList, type SecretListState } from "@/components/ui/secret-list-primitive"
import { StatusPill } from "@/components/ui/status-pill"
import type { Instant } from "@/lib/time"
import { cn } from "@/lib/utils"

/** A stored secret as the list shows it. It never carries the value: only a fingerprint, like its last four. */
type StoredSecret = {
  id: string
  name: string
  /** Whether a value is stored; a missing secret shows its status and offers `replace` to set it. */
  configured: boolean
  /** A few characters the server derives, like the last four, shown after the mask. */
  fingerprint?: string
  description?: ReactNode
  createdAt?: Instant
  updatedAt?: Instant
  /** `null` when it was never used. */
  lastUsedAt?: Instant | null
}

/** Text that can name the secret it's about: a node, or a function of the secret. */
type SecretText<Value extends ReactNode = ReactNode> = Value | ((secret: StoredSecret) => Value)

/** The list's visible text. None has a default: pass it in the page's language. */
type SecretListText = {
  configured: ReactNode
  missing: ReactNode
  /** The button of a configured secret, which overwrites its value. */
  replace: ReactNode
  /** The button of a missing secret, which stores its first value, like "Set"; `replace` until you pass it. */
  set?: ReactNode
  /** Shown on configured secrets only: a missing one has nothing to delete. */
  delete: ReactNode
  deleteTitle: SecretText
  deleteDescription?: SecretText
  /** The confirmation's button; keep it apart from `delete`, so an agent's press finds this one. */
  deleteConfirm: SecretText
  /** What a person approves when an agent deletes, like "Deletes the OpenAI key; anything using it stops working". */
  deleteAgentConfirm: SecretText<string>
  /** Each date, around a live relative time: (time) => <>Updated {time}</>. */
  created?: (time: ReactNode) => ReactNode
  updated?: (time: ReactNode) => ReactNode
  lastUsed?: (time: ReactNode) => ReactNode
  neverUsed?: ReactNode
  emptyTitle: ReactNode
  emptyDescription?: ReactNode
  errorTitle: ReactNode
  retry?: ReactNode
}

/** Names for screen readers and agents; English by default. */
type SecretListLabels = {
  /** Read in place of the mask, from the fingerprint. */
  fingerprint: (fingerprint: string) => string
  /** Read in place of the mask of a configured secret with no fingerprint. */
  hidden: string
  replaceSecret: (name: string) => string
  /** Names the button of a missing secret; it holds the `set` text. */
  setSecret: (name: string) => string
  deleteSecret: (name: string) => string
  cancel?: ReactNode
}

const secretListLabels: SecretListLabels = {
  fingerprint: (fingerprint) => `Hidden value ending in ${fingerprint}`,
  hidden: "Hidden value",
  replaceSecret: (name) => `Replace ${name}`,
  setSecret: (name) => `Set ${name}`,
  deleteSecret: (name) => `Delete ${name}`,
}

type SecretListProps = {
  /** Names the list for screen readers and agents, like "API keys". */
  "aria-label": string
  secrets?: readonly StoredSecret[]
  /** The list's load state, for DataState. `success` by default. */
  status?: DataStatus
  error?: unknown
  onRetry?: () => unknown
  /** Asks to replace or set a secret's value, like opening a dialog with a sensitive Input. */
  onReplace: (id: string) => unknown
  /** Deletes a secret after the confirmation; a returned Promise keeps it pending. */
  onDelete: (id: string) => unknown
  text: SecretListText
  labels?: Partial<SecretListLabels>
  /** The locale of the relative dates; the page's by default. */
  locale?: string
  className?: string
}

const noSecrets: readonly StoredSecret[] = []

const rootAttributes: Record<`data-${string}`, string> = { "data-slot": "secret-list" }

const MASK = "••••"

function forSecret<Value extends ReactNode>(text: SecretText<Value>, secret: StoredSecret | undefined) {
  if (typeof text !== "function") return text
  return secret === undefined ? undefined : text(secret)
}

function MaskedValue({ secret, labels }: { secret: StoredSecret; labels: SecretListLabels }) {
  if (!secret.configured) return null
  const fingerprint = secret.fingerprint
  return (
    <span data-slot="secret-list-mask" className="font-mono text-foreground">
      <span aria-hidden="true">{fingerprint === undefined ? `${MASK}${MASK}` : `${MASK} ${fingerprint}`}</span>
      <span className="sr-only">{fingerprint === undefined ? labels.hidden : labels.fingerprint(fingerprint)}</span>
    </span>
  )
}

function SecretDates({ secret, text, locale }: { secret: StoredSecret; text: SecretListText; locale?: string }) {
  const time = (value: Instant) => <RelativeTime value={value} locale={locale} formatStyle="short" />
  const parts: { key: string; node: ReactNode }[] = []
  if (secret.updatedAt !== undefined && text.updated)
    parts.push({ key: "updated", node: text.updated(time(secret.updatedAt)) })
  if (secret.createdAt !== undefined && text.created)
    parts.push({ key: "created", node: text.created(time(secret.createdAt)) })
  if (secret.lastUsedAt !== undefined && secret.lastUsedAt !== null && text.lastUsed)
    parts.push({ key: "used", node: text.lastUsed(time(secret.lastUsedAt)) })
  else if (secret.lastUsedAt === null && text.neverUsed !== undefined) parts.push({ key: "used", node: text.neverUsed })
  return parts.map((part, index) => (
    <span key={part.key} data-slot={`secret-list-${part.key}`}>
      {index > 0 ? " · " : null}
      {part.node}
    </span>
  ))
}

function SecretList({
  "aria-label": label,
  secrets = noSecrets,
  status = "success",
  error,
  onRetry,
  onReplace,
  onDelete,
  text,
  labels: overrides,
  locale,
  className,
}: SecretListProps) {
  const labels = { ...secretListLabels, ...overrides }
  const handle = usePrimitive(secretList, {
    onReplace,
    onDelete,
    secrets: secrets.map((secret) => ({ value: secret.id, label: secret.name })),
    missing: secrets.filter((secret) => !secret.configured).map((secret) => secret.id),
  })
  const { api } = handle
  const confirming = (state: SecretListState) => secrets.find((secret) => secret.id === state.confirming)
  return usePart(
    handle,
    "root",
    {},
    {
      ...rootAttributes,
      "aria-label": label,
      className: cn("flex min-w-0 flex-col", className),
      children: (state: SecretListState) => (
        <>
          <DataState
            status={status}
            data={secrets}
            error={error}
            size="inline"
            {...(onRetry && text.retry !== undefined
              ? {
                  onRetry,
                  labels: {
                    errorTitle: text.errorTitle,
                    retry: text.retry,
                    emptyTitle: text.emptyTitle,
                    emptyDescription: text.emptyDescription,
                  },
                }
              : {
                  labels: {
                    errorTitle: text.errorTitle,
                    emptyTitle: text.emptyTitle,
                    emptyDescription: text.emptyDescription,
                  },
                })}
          >
            {(rows) => (
              <List aria-label={label}>
                {rows.map((secret) => (
                  <ListItem
                    key={secret.id}
                    id={secret.id}
                    title={secret.name}
                    status={
                      <StatusPill tone={secret.configured ? "success" : "warning"} dot>
                        {secret.configured ? text.configured : text.missing}
                      </StatusPill>
                    }
                    subtitle={
                      <span className="flex flex-col gap-inline">
                        {secret.description === undefined ? null : <span>{secret.description}</span>}
                        <span className="flex flex-wrap items-center gap-x-items">
                          <MaskedValue secret={secret} labels={labels} />
                          <span className="text-caption">
                            <SecretDates secret={secret} text={text} locale={locale} />
                          </span>
                        </span>
                      </span>
                    }
                    actions={
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={
                            secret.configured ? labels.replaceSecret(secret.name) : labels.setSecret(secret.name)
                          }
                          onClick={(event) => api.replace(secret.id, event.nativeEvent)}
                        >
                          {secret.configured ? text.replace : (text.set ?? text.replace)}
                        </Button>
                        {secret.configured ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={labels.deleteSecret(secret.name)}
                            onClick={(event) => api.delete(secret.id, event.nativeEvent)}
                          >
                            {text.delete}
                          </Button>
                        ) : null}
                      </>
                    }
                  />
                ))}
              </List>
            )}
          </DataState>
          <ConfirmDialog
            open={state.deleting !== null}
            onOpenChange={(open) => {
              if (!open) api.closeDelete()
            }}
            tone="destructive"
            title={forSecret(text.deleteTitle, confirming(state))}
            description={forSecret(text.deleteDescription, confirming(state))}
            confirmLabel={forSecret(text.deleteConfirm, confirming(state))}
            agentConfirm={forSecret(text.deleteAgentConfirm, confirming(state)) ?? ""}
            labels={labels.cancel === undefined ? undefined : { cancel: labels.cancel }}
            onConfirm={() => api.confirmDelete()}
          />
        </>
      ),
    },
  )
}

export { SecretList, secretListLabels }
export type { SecretListLabels, SecretListProps, SecretListText, SecretText, StoredSecret }
