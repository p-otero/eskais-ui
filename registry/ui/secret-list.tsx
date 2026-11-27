"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { useId, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox, CheckboxIndicator, type CheckedState } from "@/components/ui/checkbox"
import { CheckboxRow } from "@/components/ui/checkbox-row"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataState, type DataStatus } from "@/components/ui/data-state"
import { ListItem } from "@/components/ui/list-item"
import { RelativeTime } from "@/components/ui/relative-time"
import { SecretFingerprint } from "@/components/ui/secret-fingerprint"
import {
  secretList,
  type SecretListSelectionChangeReason,
  type SecretListState,
} from "@/components/ui/secret-list-primitive"
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
  /** In a `selectable` list, turns its checkbox off; `{ reason }` shows why and describes the checkbox with it. */
  disabled?: boolean | { reason: string }
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
  /** In a `selectable` list, a checkbox above the rows that selects every secret that can be selected. */
  selectAll?: ReactNode
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
  /** Gives each secret a checkbox; agents `select(nameOrId, checked)` and `selectAll(checked)`. */
  selectable?: boolean
  /** The selected ids, to control the selection. */
  selected?: readonly string[]
  defaultSelected?: readonly string[]
  /** The new selected ids; `details.cancel()` keeps the old ones, and an agent's step then fails with why. */
  onSelectedChange?: (ids: string[], details: ChangeDetails<SecretListSelectionChangeReason>) => void
  text: SecretListText
  labels?: Partial<SecretListLabels>
  /** The locale of the relative dates; the page's by default. */
  locale?: string
  className?: string
}

const noSecrets: readonly StoredSecret[] = []

const rootAttributes: Record<`data-${string}`, string> = { "data-slot": "secret-list" }

function forSecret<Value extends ReactNode>(text: SecretText<Value>, secret: StoredSecret | undefined) {
  if (typeof text !== "function") return text
  return secret === undefined ? undefined : text(secret)
}

const disabledReason = (secret: StoredSecret) => (typeof secret.disabled === "object" ? secret.disabled.reason : null)

const isUnselectable = (secret: StoredSecret) => secret.disabled !== undefined && secret.disabled !== false

function selectAllState(secrets: readonly StoredSecret[], selected: readonly string[]): CheckedState {
  const selectable = secrets.filter((secret) => !isUnselectable(secret))
  const count = selectable.filter((secret) => selected.includes(secret.id)).length
  if (count === 0) return false
  return count === selectable.length ? true : "indeterminate"
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

type SecretRowProps = {
  secret: StoredSecret
  text: SecretListText
  labels: SecretListLabels
  locale?: string
  selection?: { checked: boolean; onCheckedChange: (checked: CheckedState, event: Event | undefined) => void }
  onReplace: (event: Event) => void
  onDelete: (event: Event) => void
}

function SecretRow({ secret, text, labels, locale, selection, onReplace, onDelete }: SecretRowProps) {
  const reasonId = useId()
  const reason = selection ? disabledReason(secret) : null
  return (
    <ListItem
      id={secret.id}
      title={secret.name}
      control={
        selection ? (
          <Checkbox
            data-agent-hidden=""
            aria-label={secret.name}
            aria-describedby={reason === null ? undefined : reasonId}
            checked={selection.checked}
            disabled={isUnselectable(secret)}
            onCheckedChange={(next, details) => selection.onCheckedChange(next, details.event)}
          >
            <CheckboxIndicator />
          </Checkbox>
        ) : undefined
      }
      status={
        <StatusPill tone={secret.configured ? "success" : "warning"} dot>
          {secret.configured ? text.configured : text.missing}
        </StatusPill>
      }
      subtitle={
        <span className="flex flex-col gap-inline">
          {secret.description === undefined ? null : <span>{secret.description}</span>}
          <span className="flex flex-wrap items-center gap-x-items">
            {secret.configured ? (
              <SecretFingerprint
                fingerprint={secret.fingerprint ?? null}
                labels={{ fingerprint: labels.fingerprint, none: labels.hidden }}
              />
            ) : null}
            <span className="text-caption">
              <SecretDates secret={secret} text={text} locale={locale} />
            </span>
          </span>
        </span>
      }
      meta={
        reason === null ? undefined : (
          <span id={reasonId} data-slot="secret-list-disabled-reason">
            {reason}
          </span>
        )
      }
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            aria-label={secret.configured ? labels.replaceSecret(secret.name) : labels.setSecret(secret.name)}
            onClick={(event) => onReplace(event.nativeEvent)}
          >
            {secret.configured ? text.replace : (text.set ?? text.replace)}
          </Button>
          {secret.configured ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={labels.deleteSecret(secret.name)}
              onClick={(event) => onDelete(event.nativeEvent)}
            >
              {text.delete}
            </Button>
          ) : null}
        </>
      }
    />
  )
}

function SecretList({
  "aria-label": label,
  secrets = noSecrets,
  status = "success",
  error,
  onRetry,
  onReplace,
  onDelete,
  selectable = false,
  selected,
  defaultSelected,
  onSelectedChange,
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
    selectable,
    unselectable: secrets.filter(isUnselectable).map((secret) => ({ id: secret.id, reason: disabledReason(secret) })),
    selectedIds: selected,
    defaultSelectedIds: defaultSelected,
    onSelectedIdsChange: onSelectedChange,
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
              <div className="flex min-w-0 flex-col gap-inline">
                {selectable && text.selectAll !== undefined ? (
                  <CheckboxRow
                    data-agent-hidden=""
                    className="px-inset-item"
                    label={text.selectAll}
                    checked={selectAllState(rows, state.selectedIds)}
                    disabled={rows.every(isUnselectable)}
                    onCheckedChange={(checked, details) =>
                      api.selectAll(checked === true, { reason: "select-all", event: details.event })
                    }
                  />
                ) : null}
                {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics under Preflight's list-style: none */}
                <ul role="list" aria-label={label} className="flex min-w-0 flex-col">
                  {rows.map((secret) => (
                    <SecretRow
                      key={secret.id}
                      secret={secret}
                      text={text}
                      labels={labels}
                      locale={locale}
                      selection={
                        selectable
                          ? {
                              checked: state.selectedIds.includes(secret.id),
                              onCheckedChange: (checked, event) =>
                                api.select(secret.id, checked === true, { reason: "press", event }),
                            }
                          : undefined
                      }
                      onReplace={(event) => api.replace(secret.id, event)}
                      onDelete={(event) => api.delete(secret.id, event)}
                    />
                  ))}
                </ul>
              </div>
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
