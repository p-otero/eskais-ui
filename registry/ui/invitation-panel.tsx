"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { isValidElement, useId, useRef, useState, type ReactNode } from "react"
import type { DefaultValues, FieldValues } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DataState, type DataStatus } from "@/components/ui/data-state"
import { Field, FieldLabel, type FieldLabelPlacement } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { toFormErrors, type FormMessages } from "@/components/ui/form-messages"
import {
  invitationPanel,
  type InvitationCreated,
  type InvitationLink,
  type InvitationPanelState,
  type InvitationRole,
} from "@/components/ui/invitation-panel-primitive"
import { InvitationNewLink } from "@/components/ui/invitation-panel-link"
import { List, ListItem } from "@/components/ui/list-item"
import { RelativeTime } from "@/components/ui/relative-time"
import { Select } from "@/components/ui/select"
import { formatInstant, type Instant } from "@/lib/time"
import { cn } from "@/lib/utils"

/** A pending invitation. It never carries the link: a lost link is revoked and a new one created. */
type Invitation = {
  id: string
  /** The value of one of `roles`. */
  role?: string
  createdBy: string
  expiresAt: Instant
  /** Who it's for, like a name or an email: shown on the row and naming its revoke button. Display only. */
  invitee?: string
}

/** What `onCreate` gets: the chosen role, and the invitee fields' values once they pass the schema. */
type InvitationRequest<Values = undefined> = { role: string | undefined; values: Values }

/** The panel's visible text. None has a default: pass it in the page's language. */
type InvitationPanelText = {
  create: ReactNode
  /** The role choice's label, when `roles` is given. */
  role?: ReactNode
  /**
   * The create alert's text when `onCreate` fails with something other than a string or a node, which show as they
   * are; a function of the error picks one per failure.
   */
  createError: ReactNode | ((error: unknown) => ReactNode)
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
  /**
   * Names a row's revoke button, uniquely: by the invitee when the row has one, else by its role, creator and expiry
   * (`expires`, formatted in the panel's locale).
   */
  revokeInvitation: (invitation: {
    role: string | undefined
    createdBy: string
    invitee: string | undefined
    expires: string
  }) => string
  cancel?: ReactNode
}

const invitationPanelLabels: InvitationPanelLabels = {
  created: "Invitation link created",
  copiedAnnouncement: "Link copied",
  revokeNewLink: "Revoke new link",
  revokeInvitation: ({ role, createdBy, invitee, expires }) => {
    if (invitee !== undefined) return `Revoke invitation for ${invitee}`
    const kind = role === undefined ? "invitation" : `${role} invitation`
    return `Revoke ${kind} from ${createdBy}, expiring ${expires}`
  },
}

type CreateLink<Values> = (request: InvitationRequest<Values>) => InvitationLink | PromiseLike<InvitationLink>

type InvitationFieldsProps<Schema extends StandardSchemaV1> = {
  /**
   * The invitee's fields, as `FormField`s named in `schema`, above the create button. They are a Form: create
   * validates them first, errors show on each field (a thrown `FormServerError` lands on its fields too), sensitive
   * fields stay out of the DOM, and after a link is created they reset.
   */
  fields: ReactNode
  schema: Schema
  defaultValues?: DefaultValues<StandardSchemaV1.InferInput<Schema> & FieldValues>
  messages?: FormMessages
  /** The fields' form's accessible name, like "Invited person". */
  formLabel?: string
  /** Where every field's label sits, unless a field sets its own; `top` by default. */
  labelPlacement?: FieldLabelPlacement
  /** Creates an invitation from the role and the fields' parsed values; resolves to its one-time link. */
  onCreate: CreateLink<StandardSchemaV1.InferOutput<Schema>>
}

type InvitationNoFieldsProps = {
  fields?: undefined
  schema?: undefined
  defaultValues?: undefined
  messages?: undefined
  formLabel?: undefined
  labelPlacement?: undefined
  /** Creates an invitation and resolves to its one-time `url`, its `id` and when it expires. */
  onCreate: CreateLink<undefined>
}

type InvitationPanelProps<Schema extends StandardSchemaV1 = StandardSchemaV1> = {
  /** Names the panel for screen readers and agents, like "Invitations". */
  "aria-label": string
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
} & (InvitationFieldsProps<Schema> | InvitationNoFieldsProps)

const ignoreRefusal = () => undefined

const noInvitations: readonly Invitation[] = []

const rootAttributes: Record<`data-${string}`, string> = { "data-slot": "invitation-panel" }

function hasFields<Schema extends StandardSchemaV1>(
  props: InvitationPanelProps<Schema>,
): props is InvitationPanelProps<Schema> & InvitationFieldsProps<Schema> {
  return props.schema !== undefined
}

function createErrorContent(error: unknown, fallback: InvitationPanelText["createError"]) {
  if (typeof error === "string" || isValidElement(error)) return error
  const message = toFormErrors(error)?.message
  if (typeof message === "string") return message
  return typeof fallback === "function" ? fallback(error) : fallback
}

function InvitationPanel<Schema extends StandardSchemaV1>(props: InvitationPanelProps<Schema>) {
  const {
    "aria-label": label,
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
  } = props
  const labels = { ...invitationPanelLabels, ...overrides }
  const [role, setRole] = useState<string | null>(defaultRole ?? roles?.[0]?.value ?? null)
  const createRow = useRef<HTMLDivElement>(null)
  const roleLabel = (value: string | undefined) => roles?.find((candidate) => candidate.value === value)?.label ?? value
  const agentInvitations = invitations.map((invitation) => ({
    value: invitation.id,
    label: [invitation.invitee, roleLabel(invitation.role), text.createdBy(invitation.createdBy)]
      .filter(Boolean)
      .join(", "),
  }))
  const withFields = hasFields(props) ? props : undefined
  const withoutFields = hasFields(props) ? undefined : props.onCreate
  const handle = usePrimitive(invitationPanel, {
    onCreate: (request) =>
      withoutFields
        ? withoutFields({ role: request.role, values: undefined })
        : Promise.reject(new Error("create goes through the invitee fields' form.")),
    submitFields: withFields === undefined ? undefined : () => createRow.current?.closest("form")?.requestSubmit(),
    selectRole: setRole,
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
      children: (state: InvitationPanelState) => {
        const createControls = (
          <div ref={createRow} data-slot="invitation-panel-create" className="flex flex-wrap items-end gap-items">
            {roles && roles.length > 0 ? (
              <Field className="min-w-40 flex-1">
                <FieldLabel>{text.role}</FieldLabel>
                <Select options={roles} value={role} onValueChange={setRole} />
              </Field>
            ) : null}
            {withFields === undefined ? (
              <Button
                loading={state.creating}
                onClick={(event) => {
                  const created = api.create(undefined, event.nativeEvent)
                  if (typeof created === "object") created.then(undefined, ignoreRefusal)
                }}
              >
                {text.create}
              </Button>
            ) : (
              <Button type="submit" loading={state.creating}>
                {text.create}
              </Button>
            )}
          </div>
        )
        return (
          <>
            {withFields === undefined ? (
              createControls
            ) : (
              <Form
                schema={withFields.schema}
                defaultValues={withFields.defaultValues}
                messages={withFields.messages}
                label={withFields.formLabel}
                labelPlacement={withFields.labelPlacement}
                className="gap-items"
                onSubmit={async (values, helpers) => {
                  await api.createWith((chosen) => withFields.onCreate({ role: chosen, values }))
                  helpers.form.reset()
                }}
              >
                {withFields.fields}
                {createControls}
              </Form>
            )}
            {state.error === null ? null : (
              <Alert data-slot="invitation-panel-error" tone="destructive" live>
                <AlertDescription className="text-foreground">
                  {createErrorContent(state.error, text.createError)}
                </AlertDescription>
              </Alert>
            )}
            {state.link === null ? null : (
              <InvitationNewLink
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
                      const title = invitation.invitee ?? roleName ?? creator
                      const details = [
                        invitation.invitee === undefined ? undefined : roleName,
                        title === creator ? undefined : creator,
                      ]
                        .filter((part) => part !== undefined)
                        .join(" · ")
                      return (
                        <ListItem
                          key={invitation.id}
                          id={invitation.id}
                          title={title}
                          subtitle={
                            <>
                              {details === "" ? null : <>{details} · </>}
                              {text.expiresIn(<RelativeTime value={invitation.expiresAt} locale={locale} />)}
                            </>
                          }
                          actions={
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={labels.revokeInvitation({
                                role: roleName,
                                createdBy: invitation.createdBy,
                                invitee: invitation.invitee,
                                expires: formatInstant(invitation.expiresAt, { locale }),
                              })}
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
        )
      },
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
  InvitationRequest,
  InvitationRole,
}
