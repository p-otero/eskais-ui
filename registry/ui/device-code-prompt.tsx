"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { CheckIcon, ClockAlertIcon, ExternalLinkIcon, Link2Icon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { deviceCodePrompt, type DeviceCodePromptState } from "@/components/ui/device-code-prompt-primitive"
import { ExpiryCountdown, type ExpiresInText } from "@/components/ui/expiry-countdown"
import { Link } from "@/components/ui/link"
import { PairingCode, type PairingCodeLabels, type PairingCodeSize } from "@/components/ui/pairing-code"
import { useExpiry } from "@/components/ui/use-expiry"
import { cn } from "@/lib/utils"

/** The prompt's visible text. None has a default: pass it in the page's language. */
type DeviceCodePromptText = {
  /** The sentence around the link to the provider's page: (link) => <>Go to {link} and enter this code.</> */
  instructions: (link: ReactNode) => ReactNode
  /** The button that opens the provider's page in a new tab. */
  open: ReactNode
  /** The time left, shown each second and read once a minute, then at 30, 20 and 10 seconds. */
  expiresIn?: ExpiresInText
  /** Shown, and read, once `expiresAt` passes; the code, the link and Open go away, `actions` stay. */
  expired?: string
}

/** Names and announcements for screen readers and agents; English by default. */
type DeviceCodePromptLabels = {
  prompt: string
  code: string
  copyLink: string
  linkCopied: string
  linkCopiedAnnouncement: string
  /** Read after the link, which opens in a new tab. */
  newTab: string
  /** The code's own copy button and spelling. */
  pairingCode?: Partial<PairingCodeLabels>
}

const deviceCodePromptLabels: DeviceCodePromptLabels = {
  prompt: "Sign-in code",
  code: "Code",
  copyLink: "Copy link",
  linkCopied: "Copied",
  linkCopiedAnnouncement: "Link copied",
  newTab: "(opens in a new tab)",
}

type DeviceCodePromptProps = {
  /** The user code from the provider, with or without separators, in any case. */
  code: string
  /** The provider's page where the person enters the code. */
  verificationUri: string
  /** The same page with the code filled in; Open uses it when given. */
  verificationUriComplete?: string
  /** Characters per visual group; 4 by default. */
  groupSize?: number
  /** Shown between groups and copied with the code; "-" by default. */
  separator?: string
  size?: PairingCodeSize
  /** Adds an icon button beside Open that copies the verification page's address. */
  copyLink?: boolean
  /** When the code expires, as a Date or epoch milliseconds. */
  expiresAt?: Date | number
  /** Runs once, when `expiresAt` passes. */
  onExpire?: () => void
  /** Runs after Open, with the address it opened. */
  onOpen?: (uri: string) => void
  /** Runs once the code, with separators, is on the clipboard. */
  onCopy?: (code: string) => void
  onCopyLink?: (uri: string) => void
  /**
   * Keeps the code and the link from agents: they stay out of the snapshot and queries, and `open`, `copyLink` and
   * the code's `copy` fail an agent's step with why. On by default, since the code signs an account in.
   */
  agentHidden?: boolean
  /** More controls after Open, like a Cancel that abandons the sign-in; they stay once the code expires. */
  actions?: ReactNode
  text: DeviceCodePromptText
  labels?: Partial<DeviceCodePromptLabels>
  /** Names the prompt for screen readers and agents; `labels.prompt` by default. */
  "aria-label"?: string
  className?: string
}

const rootAttributes: Record<`data-${string}`, string> = { "data-slot": "device-code-prompt" }

const scheme = /^https?:\/\//i
const trailingSlash = /\/$/

const withoutScheme = (uri: string) => uri.replace(scheme, "").replace(trailingSlash, "")

const actionsClassName = "flex flex-wrap items-center gap-items narrow:flex-col narrow:items-stretch"

const ignoreRefusal = () => undefined

function DeviceCodePrompt({
  code,
  verificationUri,
  verificationUriComplete,
  groupSize,
  separator,
  size,
  copyLink = false,
  expiresAt,
  onExpire,
  onOpen,
  onCopy,
  onCopyLink,
  agentHidden = true,
  actions,
  text,
  labels: overrides,
  "aria-label": label,
  className,
}: DeviceCodePromptProps) {
  const labels = { ...deviceCodePromptLabels, ...overrides }
  const handle = usePrimitive(deviceCodePrompt, {
    verificationUri,
    verificationUriComplete,
    agentHidden,
    onOpen,
    onCopyLink,
    onExpire,
    linkCopiedAnnouncement: labels.linkCopiedAnnouncement,
    expiredAnnouncement: text.expired,
  })
  const { api } = handle
  const expiry = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt
  useExpiry(expiry, () => api.expire())
  const hidden = agentHidden ? "" : undefined

  return usePart(
    handle,
    "root",
    {},
    {
      ...rootAttributes,
      "aria-label": label ?? labels.prompt,
      className: cn("flex min-w-0 flex-col gap-items", className),
      children: (state: DeviceCodePromptState) =>
        state.expired ? (
          <>
            <p
              data-slot="device-code-prompt-expired"
              className="flex items-center gap-inline text-body-sm font-medium text-warning-soft-foreground [&_svg]:size-4"
            >
              <ClockAlertIcon />
              {text.expired}
            </p>
            {actions === undefined || actions === null ? null : (
              <div data-slot="device-code-prompt-actions" className={actionsClassName}>
                {actions}
              </div>
            )}
          </>
        ) : (
          <>
            <p data-slot="device-code-prompt-instructions" className="text-body text-muted-foreground">
              {text.instructions(
                <span data-slot="device-code-prompt-link" data-agent-hidden={hidden}>
                  <Link
                    href={verificationUri}
                    external
                    newTab
                    newTabLabel={labels.newTab}
                    fast={false}
                    translate="no"
                    className="font-medium break-all"
                  >
                    {withoutScheme(verificationUri)}
                  </Link>
                </span>,
              )}
            </p>
            <PairingCode
              code={code}
              label={labels.code}
              groupSize={groupSize}
              separator={separator}
              size={size}
              agentHidden={agentHidden}
              onCopy={onCopy}
              labels={labels.pairingCode}
            />
            {expiry !== undefined && text.expiresIn ? (
              <ExpiryCountdown data-slot="device-code-prompt-countdown" expiresAt={expiry} expiresIn={text.expiresIn} />
            ) : null}
            <div data-slot="device-code-prompt-actions" className={actionsClassName}>
              <span data-agent-hidden={hidden} className="flex items-center gap-inline narrow:w-full">
                <Button className="narrow:flex-1" onClick={(event) => api.open(event.nativeEvent)}>
                  <ExternalLinkIcon />
                  {text.open}
                </Button>
                {copyLink ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground"
                    aria-label={state.linkCopied ? labels.linkCopied : labels.copyLink}
                    onClick={(event) => {
                      const copied = api.copyLink(event.nativeEvent)
                      if (copied) copied.then(undefined, ignoreRefusal)
                    }}
                  >
                    {state.linkCopied ? <CheckIcon /> : <Link2Icon />}
                  </Button>
                ) : null}
              </span>
              {actions}
            </div>
          </>
        ),
    },
  )
}

export { DeviceCodePrompt, deviceCodePromptLabels }
export type { DeviceCodePromptLabels, DeviceCodePromptProps, DeviceCodePromptText }
