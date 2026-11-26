"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { BanIcon, CheckIcon } from "lucide-react"
import { useId, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { deviceApprovalApprove } from "@/components/ui/device-approval-primitive"
import { useCountdownAnnouncements, useSecondsLeft } from "@/components/ui/use-device-approval-expiry"
import { cn } from "@/lib/utils"

type DevicePermission = {
  id: string
  label: ReactNode
  description?: ReactNode
  /** Why it's withheld, like "Your role can't grant this". */
  reason?: ReactNode
}

const approveAttributes = (agentConfirm: string): Record<`data-${string}`, string> => ({
  "data-slot": "device-approval-approve",
  "data-agent-confirm": agentConfirm,
})

const ignoreRefusal = () => undefined

function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, "0")
  return hours > 0 ? `${String(hours)}:${String(minutes).padStart(2, "0")}:${rest}` : `${String(minutes)}:${rest}`
}

function hasContent(node: ReactNode) {
  return node !== undefined && node !== null && node !== false
}

const permissionLook = {
  granted: {
    icon: <CheckIcon strokeWidth={2.5} />,
    className: "border-success-border bg-success-soft text-success-soft-foreground",
  },
  withheld: {
    icon: <BanIcon strokeWidth={2.5} />,
    className: "border-warning-border bg-warning-soft text-warning-soft-foreground",
  },
}

function PermissionSection({
  kind,
  heading,
  permissions,
}: {
  kind: "granted" | "withheld"
  heading: ReactNode
  permissions: readonly DevicePermission[]
}) {
  const headingId = useId()
  if (permissions.length === 0) return null
  const look = permissionLook[kind]
  return (
    <section
      data-slot={`device-approval-${kind}`}
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-items"
    >
      <h3 id={headingId} className="text-title-sm">
        {heading}
      </h3>
      <ul aria-labelledby={headingId} className="flex flex-col gap-items">
        {permissions.map((permission) => (
          <li key={permission.id} data-slot="device-approval-permission" className="flex items-start gap-items">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3.5",
                look.className,
              )}
            >
              {look.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body font-medium">{permission.label}</span>
              {hasContent(permission.description) ? (
                <span className="text-body-sm text-muted-foreground">{permission.description}</span>
              ) : null}
              {hasContent(permission.reason) ? (
                <span data-slot="device-approval-reason" className="text-caption text-muted-foreground">
                  {permission.reason}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Countdown({
  expiresAt,
  expiresIn,
}: {
  expiresAt: number
  expiresIn: (remainingMs: number, formatted: string) => string
}) {
  const seconds = useSecondsLeft(expiresAt)
  useCountdownAnnouncements(seconds, (at) => expiresIn(at * 1000, formatRemaining(at)))
  return (
    <p
      role="timer"
      data-slot="device-approval-countdown"
      className="flex items-center gap-inline text-body-sm text-muted-foreground tabular-nums"
    >
      {expiresIn(seconds * 1000, formatRemaining(seconds))}
    </p>
  )
}

function ApproveButton({
  approve,
  blocked,
  pending,
  describedBy,
  agentConfirm,
  children,
}: {
  approve: (event?: Event) => unknown
  blocked: boolean
  pending: boolean
  describedBy?: string
  agentConfirm: string
  children: ReactNode
}) {
  const handle = usePrimitive(deviceApprovalApprove, { approve, blocked, pending })
  const buttonId = useId()
  return usePart(
    handle,
    "root",
    {},
    {
      ...approveAttributes(agentConfirm),
      "aria-labelledby": buttonId,
      className: "contents",
      children: (
        <Button
          id={buttonId}
          aria-describedby={describedBy}
          data-agent-hidden=""
          className="narrow:w-full"
          disabled={blocked}
          focusableWhenDisabled
          loading={pending}
          onClick={(event) => {
            const result = handle.api.approve(event.nativeEvent)
            if (result instanceof Promise) result.then(undefined, ignoreRefusal)
          }}
        >
          <CheckIcon />
          {children}
        </Button>
      ),
    },
    "span",
  )
}

export { ApproveButton, Countdown, PermissionSection }
export type { DevicePermission }
