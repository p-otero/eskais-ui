"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataState, type DataStatus } from "@/components/ui/data-state"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  invitationPanel,
  type InvitationCreated,
  type InvitationLink,
  type InvitationLinkState,
  type InvitationPanelState,
  type InvitationRole,
} from "@/components/ui/invitation-panel-primitive"
import { List, ListItem } from "@/components/ui/list-item"
import { RelativeTime } from "@/components/ui/relative-time"
import { Select } from "@/components/ui/select"
import { useInvitationExpiry } from "@/components/ui/use-invitation-expiry"
import type { Instant } from "@/lib/time"
import { cn } from "@/lib/utils"

/** A pending invitation. It never carries the link: a lost link is revoked and a new one created. */
type Invitation = {
  id: string
  /** The value of one of `roles`. */
  role?: string
  createdBy: string
  expiresAt: Instant
}

/** The panel's visible text. None has a default: pass it in the page's language. */
type InvitationPanelText = {
  create: ReactNode
  /** The role choice's label, when `roles` is given. */
  role?: ReactNode
  createError: ReactNode
  newLink: ReactNode
  /** Under `newLink`, like "Copy it now: it won't be shown again." */
  newLinkDescription?: ReactNode
  copy: ReactNode
  copied: ReactNode
  /** The new link's and each row's expiry, around a live relative time: (time) => <>Expires {time}</>. */
  expiresIn: (time: ReactNode) => ReactNode
  /** Shown, and read, when the new link expires. */
  expired: string
  revoke: ReactNode
  revokeTitle: ReactNode
  revokeDescription?: ReactNode
  /** The confirmation's button; keep it apart from `revoke`, so an agent's press finds this one. */
  revokeConfirm: ReactNode
  /** What a person approves when an agent revokes, like "Revokes the invitation; its link stops working". */
  revokeAgentConfirm: string
  dismiss: ReactNode
  /** The pending list's heading and name. */
  pending: string
  createdBy: (name: string) => string
  emptyTitle: ReactNode
  errorTitle: ReactNode
  retry?: ReactNode
}

/** Names and announcements for screen readers and agents; English by default. */
type InvitationPanelLabels = {
  created: string
  copiedAnnouncement: string
  /** Names the new link's revoke button. */
  revokeNewLink: string
  /** Names a row's revoke button. */
  revokeInvitation: (invitation: { role: string | undefined; createdBy: string }) => string
  cancel?: ReactNode
}

const invitationPanelLabels: InvitationPanelLabels = {
  created: "Invitation link created",
  copiedAnnouncement: "Link copied",
  revokeNewLink: "Revoke new link",
  revokeInvitation: ({ role, createdBy }) =>
    role === undefined ? `Revoke invitation from ${createdBy}` : `Revoke ${role} invitation from ${createdBy}`,
}

type InvitationPanelProps = {
  /** Names the panel for screen readers and agents, like "Invitations". */
  "aria-label": string
  /** Creates an invitation and resolves to its one-time `url`, its `id` and when it expires. */
  onCreate: (request: { role: string | undefined }) => InvitationLink | PromiseLike<InvitationLink>
  /** Revokes an invitation by id, after the confirmation; a returned Promise keeps it pending. */
  onRevoke: (id: string) => unknown
  /** The roles an invitation can grant; with them, the panel shows a role choice. */
  roles?: readonly InvitationRole[]
  defaultRole?: string
  invitations?: readonly Invitation[]
  /** The pending list's load state, for DataState. `success` by default. */
  status?: DataStatus
  error?: unknown
  onRetry?: () => unknown
  text: InvitationPanelText
  labels?: Partial<InvitationPanelLabels>
  /** The locale of the relative expiry times; the page's by default. */
  locale?: string
  className?: string
}

const ignoreRefusal = () => undefined

const noInvitations: readonly Invitation[] = []

const rootAttributes: Record<`data-${string}`, string> = { "data-slot": "invitation-panel" }

function NewLink({
  link,
  url,
  copied,
  text,
  labels,
  onCopy,
  onRevoke,
  onDismiss,
  onExpire,
  locale,
}: {
  locale: string | undefined
  link: InvitationLinkState
  url: string | undefined
  copied: boolean
  text: InvitationPanelText
  labels: InvitationPanelLabels
  onCopy: (event: Event) => void
  onRevoke: (event: Event) => void
  onDismiss: () => void
  onExpire: () => void
}) {
  const headingId = useId()
  const { soon } = useInvitationExpiry(link.expiresAt, onExpire)
  const shown = !link.expired && url !== undefined
  return (
    <section
      data-slot="invitation-panel-link"
      data-expired={link.expired ? "" : undefined}
      aria-labelledby={headingId}
      className="flex flex-col gap-items rounded-surface border border-success-border bg-success-soft/(--glass-opacity) px-inset-item py-inset-item data-expired:border-border data-expired:bg-muted"
    >
      <div className="flex flex-col gap-inline">
        <h3 id={headingId} className="text-title-sm">
          {text.newLink}
        </h3>
        {text.newLinkDescription === undefined ? null : (
          <p className="text-body-sm text-muted-foreground">{text.newLinkDescription}</p>
        )}
      </div>
      {shown ? (
        <div
          data-slot="invitation-panel-url"
          data-agent-hidden=""
          translate="no"
          className="rounded-control border bg-background px-control-x py-inset-item font-mono text-body-sm break-all select-all"
        >
          {url}
        </div>
      ) : (
        <p data-slot="invitation-panel-expired" className="text-body-sm font-medium">
          {text.expired}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-items">
        {shown ? (
          <Button size="sm" onClick={(event) => onCopy(event.nativeEvent)}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? text.copied : text.copy}
          </Button>
        ) : null}
        {link.expired ? null : (
          <span className="text-caption text-muted-foreground">
            {text.expiresIn(<RelativeTime value={link.expiresAt} locale={locale} intervalMs={soon ? 1000 : 30_000} />)}
          </span>
        )}
        <span className="ms-auto flex flex-wrap items-center gap-items">
          {link.expired ? null : (
            <Button
              size="sm"
              variant="outline"
              aria-label={labels.revokeNewLink}
              onClick={(event) => onRevoke(event.nativeEvent)}
            >
              {text.revoke}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            {text.dismiss}
          </Button>
        </span>
      </div>
    </section>
  )
}

function InvitationPanel({
  "aria-label": label,
  onCreate,
  onRevoke,
  roles,
  defaultRole,
  invitations = noInvitations,
  status = "success",
  error,
  onRetry,
  text,
  labels: overrides,
  locale,
  className,
}: InvitationPanelProps) {
  const labels = { ...invitationPanelLabels, ...overrides }
  const [role, setRole] = useState<string | null>(defaultRole ?? roles?.[0]?.value ?? null)
  const roleLabel = (value: string | undefined) => roles?.find((candidate) => candidate.value === value)?.label ?? value
  const agentInvitations = invitations.map((invitation) => ({
    value: invitation.id,
    label: [roleLabel(invitation.role), text.createdBy(invitation.createdBy)].filter(Boolean).join(", "),
  }))
  const handle = usePrimitive(invitationPanel, {
    onCreate,
    onRevoke,
    roles,
    role,
    invitations: agentInvitations,
    createdAnnouncement: labels.created,
    copiedAnnouncement: labels.copiedAnnouncement,
    expiredAnnouncement: text.expired,
  })
  const { api } = handle
  const pendingHeadingId = useId()

  return usePart(
    handle,
    "root",
    {},
    {
      ...rootAttributes,
      "aria-label": label,
      className: cn("flex min-w-0 flex-col gap-group", className),
      children: (state: InvitationPanelState) => (
        <>
          <div data-slot="invitation-panel-create" className="flex flex-wrap items-end gap-items">
            {roles && roles.length > 0 ? (
              <Field className="min-w-40 flex-1">
                <FieldLabel>{text.role}</FieldLabel>
                <Select options={roles} value={role} onValueChange={setRole} />
              </Field>
            ) : null}
            <Button
              loading={state.creating}
              onClick={(event) => {
                const created = api.create(undefined, event.nativeEvent)
                if (created) created.then(undefined, ignoreRefusal)
              }}
            >
              {text.create}
            </Button>
          </div>
          {state.error === null ? null : (
            <Alert data-slot="invitation-panel-error" tone="destructive" live>
              <AlertDescription className="text-foreground">{text.createError}</AlertDescription>
            </Alert>
          )}
          {state.link === null ? null : (
            <NewLink
              key={state.link.id}
              link={state.link}
              url={api.linkUrl()}
              copied={state.copied}
              text={text}
              labels={labels}
              onCopy={(event) => {
                const copied = api.copy(event)
                if (copied) copied.then(undefined, ignoreRefusal)
              }}
              onRevoke={(event) => {
                if (state.link) api.revoke(state.link.id, event)
              }}
              onDismiss={() => api.dismiss()}
              onExpire={() => api.expire()}
              locale={locale}
            />
          )}
          <section
            data-slot="invitation-panel-pending"
            aria-labelledby={pendingHeadingId}
            className="flex flex-col gap-items"
          >
            <h3 id={pendingHeadingId} className="text-title-sm">
              {text.pending}
            </h3>
            <DataState
              status={status}
              data={invitations}
              error={error}
              size="inline"
              {...(onRetry && text.retry !== undefined
                ? { onRetry, labels: { errorTitle: text.errorTitle, retry: text.retry, emptyTitle: text.emptyTitle } }
                : { labels: { errorTitle: text.errorTitle, emptyTitle: text.emptyTitle } })}
            >
              {(rows) => (
                <List aria-label={text.pending}>
                  {rows.map((invitation) => {
                    const roleName = roleLabel(invitation.role)
                    const creator = text.createdBy(invitation.createdBy)
                    return (
                      <ListItem
                        key={invitation.id}
                        id={invitation.id}
                        title={roleName ?? creator}
                        subtitle={
                          <>
                            {roleName === undefined ? null : <>{creator} · </>}
                            {text.expiresIn(<RelativeTime value={invitation.expiresAt} locale={locale} />)}
                          </>
                        }
                        actions={
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={labels.revokeInvitation({ role: roleName, createdBy: invitation.createdBy })}
                            onClick={(event) => api.revoke(invitation.id, event.nativeEvent)}
                          >
                            {text.revoke}
                          </Button>
                        }
                      />
                    )
                  })}
                </List>
              )}
            </DataState>
          </section>
          <ConfirmDialog
            open={state.revoking !== null}
            onOpenChange={(open) => {
              if (!open) api.closeRevoke()
            }}
            tone="destructive"
            title={text.revokeTitle}
            description={text.revokeDescription}
            confirmLabel={text.revokeConfirm}
            agentConfirm={text.revokeAgentConfirm}
            labels={labels.cancel === undefined ? undefined : { cancel: labels.cancel }}
            onConfirm={() => api.confirmRevoke()}
          />
        </>
      ),
    },
  )
}

export { InvitationPanel, invitationPanelLabels }
export type {
  Invitation,
  InvitationCreated,
  InvitationLink,
  InvitationPanelLabels,
  InvitationPanelProps,
  InvitationPanelText,
  InvitationRole,
}
