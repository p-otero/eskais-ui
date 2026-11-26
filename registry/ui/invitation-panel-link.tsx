"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import type { InvitationPanelLabels, InvitationPanelText } from "@/components/ui/invitation-panel"
import type { InvitationLinkState } from "@/components/ui/invitation-panel-primitive"
import { RelativeTime } from "@/components/ui/relative-time"
import { useInvitationExpiry } from "@/components/ui/use-invitation-expiry"

function InvitationNewLink({
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

export { InvitationNewLink }
