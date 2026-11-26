"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { CircleSlashIcon, ClockAlertIcon, MonitorSmartphoneIcon, TriangleAlertIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ApproveButton,
  Countdown,
  PermissionSection,
  type DevicePermission,
} from "@/components/ui/device-approval-parts"
import {
  deviceApproval,
  type DeviceApprovalState,
  type DeviceDecision,
} from "@/components/ui/device-approval-primitive"
import {
  PairingCode,
  type PairingCodeConfirmText,
  type PairingCodeEnterText,
  type PairingCodeLabels,
} from "@/components/ui/pairing-code"
import { useDeviceApprovalExpiry } from "@/components/ui/use-device-approval-expiry"
import { rejectionContent, type RejectionFallback } from "@/lib/rejection-content"
import { cn } from "@/lib/utils"

/** The device asking for access. */
type DeviceInfo = {
  name: string
  /** Free text, like "Desktop" or "Node". */
  kind?: string
  /** Replaces the default device icon. */
  icon?: ReactNode
  /** A line under the name, like where and when it asked. */
  detail?: ReactNode
}

/** The block's visible text. None has a default: pass it in the page's language. */
type DeviceApprovalText = {
  /** Under the device, like "This device asked to connect to your account." */
  description?: ReactNode
  /** Names the pairing code, when `code` is given; "Pairing code" by default. */
  code?: string
  /** The heading over what the device gets. */
  granted: ReactNode
  /** The heading over what it asked for and won't get. */
  withheld: ReactNode
  approve: ReactNode
  deny: ReactNode
  /** What a person approves when an agent approves, like "Gives Studio laptop access to your account". */
  approveAgentConfirm: string
  /**
   * Shown in a live alert when approving or denying fails with something other than a string or a node, which show as
   * they are; a function of the error picks one per failure.
   */
  error: RejectionFallback
  /** The time left, from the milliseconds left and the same as `m:ss`; shown each second and read once a minute. */
  expiresIn?: (remainingMs: number, formatted: string) => string
  /** Shown, and read, once `expiresAt` passes. */
  expired?: string
  /** Shown, and read, once the app accepts the approval. */
  approved?: ReactNode
  denied?: ReactNode
}

/** Names for screen readers and agents; English by default. `codeLabels` holds the inner PairingCode's. */
type DeviceApprovalLabels = {
  /** Names the pairing code; `text.code` wins over it. */
  code: string
}

const deviceApprovalLabels: DeviceApprovalLabels = { code: "Pairing code" }

/** What a consumer's own `actions` can render from. */
type DeviceApprovalActionState = {
  expired: boolean
  /** Whether the codes match, with `code` and `compare`; `null` without a comparison or before an answer. */
  codesMatch: boolean | null
  /** True while the app (`approveBlocked`), the comparison or the expiry stops an approval. */
  approveBlocked: boolean
}

type DeviceApprovalBaseProps = {
  device: DeviceInfo
  /** The pairing code shown on the other screen, rendered with PairingCode. */
  code?: string
  groupSize?: number
  separator?: string
  /** Keeps the code and its comparison from agents; on by default, so an agent never reads or types the code. */
  agentHidden?: boolean
  granted?: readonly DevicePermission[]
  withheld?: readonly DevicePermission[]
  /** A security warning, shown in a warning Alert. */
  warning?: ReactNode
  /** When the request expires; approving stops then. */
  expiresAt?: Date | number
  /** Runs once, when `expiresAt` passes. */
  onExpire?: () => void
  /** Turns Approve off for a reason of the app's, like an account that can't grant any requested permission. */
  approveBlocked?: boolean
  /**
   * Why `approveBlocked` stops approving, in the page's language: shown beside the actions, describing Approve, and the
   * message an agent's `approve` fails with. Without it, nothing shows and an agent reads an English reason.
   */
  approveBlockedReason?: string
  text: DeviceApprovalText
  labels?: Partial<DeviceApprovalLabels>
  /** The inner PairingCode's names (its copy button and the spelled-out code), merged over its English defaults. */
  codeLabels?: Partial<PairingCodeLabels>
  className?: string
}

type DeviceApprovalCompareProps =
  | { compare?: undefined; compareText?: undefined }
  | { compare: "confirm"; compareText: PairingCodeConfirmText; onConfirm?: (matches: boolean) => unknown }
  | { compare: "enter"; compareText: PairingCodeEnterText; onMatchChange?: (matches: boolean) => void }

type DeviceApprovalActionProps =
  | {
      /**
       * Approves the device; a returned Promise keeps the block pending, and a rejection shows in the error alert: a
       * string or a node as it is, anything else through `text.error`.
       */
      onApprove: () => unknown
      onDeny: () => unknown
      actions?: undefined
    }
  | {
      /** Your own actions in place of Approve and Deny. Mark an approve control with `data-agent-confirm`. */
      actions: ReactNode | ((state: DeviceApprovalActionState) => ReactNode)
      onApprove?: undefined
      onDeny?: undefined
    }

type DeviceApprovalProps = DeviceApprovalBaseProps & DeviceApprovalCompareProps & DeviceApprovalActionProps

const rootAttributes: Record<`data-${string}`, string> = { "data-slot": "device-approval" }

const noPermissions: readonly DevicePermission[] = []

const ignoreRefusal = () => undefined

function hasContent(node: ReactNode) {
  return node !== undefined && node !== null && node !== false
}

const appBlockedFallback = "the app doesn't allow approving this request"

function compareBlockedReason(compare: DeviceApprovalProps["compare"], codesMatch: boolean | null) {
  if (compare === "confirm" && codesMatch !== true) return "the person hasn't confirmed that the codes match"
  if (compare === "enter" && codesMatch !== true) return "the typed code doesn't match the device's code"
  return null
}

function DeviceApproval(props: DeviceApprovalProps) {
  const {
    device,
    code,
    groupSize,
    separator,
    agentHidden = true,
    granted = noPermissions,
    withheld = noPermissions,
    warning,
    expiresAt,
    onExpire,
    approveBlocked = false,
    approveBlockedReason,
    text,
    labels: overrides,
    codeLabels,
    className,
  } = props
  const labels = { ...deviceApprovalLabels, ...overrides }
  const nameId = useId()
  const blockedReasonId = useId()
  const [codesMatch, setCodesMatch] = useState<boolean | null>(null)
  const comparing = code !== undefined && props.compare !== undefined
  const compareBlocked = comparing ? compareBlockedReason(props.compare, codesMatch) : null
  const blocked = approveBlocked ? (approveBlockedReason ?? appBlockedFallback) : compareBlocked
  const handle = usePrimitive(deviceApproval, {
    onApprove: props.onApprove,
    onDeny: props.onDeny,
    onExpire,
    approveBlocked: blocked,
    expiredAnnouncement: text.expired,
  })
  const { api } = handle
  const expiry = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt
  useDeviceApprovalExpiry(expiry, () => api.expire())

  const pairing = (() => {
    if (code === undefined) return null
    const shared = { code, label: text.code ?? labels.code, groupSize, separator, agentHidden, labels: codeLabels }
    if (props.compare === "confirm") {
      return (
        <PairingCode
          {...shared}
          compare="confirm"
          text={props.compareText}
          onConfirm={(matches) => {
            setCodesMatch(matches)
            return props.onConfirm?.(matches)
          }}
        />
      )
    }
    if (props.compare === "enter") {
      return (
        <PairingCode
          {...shared}
          compare="enter"
          text={props.compareText}
          onMatchChange={(matches) => {
            setCodesMatch(matches)
            props.onMatchChange?.(matches)
          }}
        />
      )
    }
    return <PairingCode {...shared} />
  })()

  const decidedText = (decided: DeviceDecision | null) => {
    if (decided === "approve") return text.approved
    if (decided === "deny") return text.denied
    return undefined
  }

  return usePart(
    handle,
    "root",
    {},
    {
      ...rootAttributes,
      "aria-labelledby": nameId,
      className: cn("@container flex min-w-0 flex-col gap-group", className),
      children: (state: DeviceApprovalState) => {
        const decision = decidedText(state.decided)
        const undecided = !state.expired && state.decided === null
        const showBlockedReason = approveBlocked && undecided && approveBlockedReason !== undefined
        const actionState: DeviceApprovalActionState = {
          expired: state.expired,
          codesMatch: comparing ? codesMatch : null,
          approveBlocked: state.expired || blocked !== null,
        }
        return (
          <>
            <div data-slot="device-approval-device" className="flex min-w-0 items-start gap-items">
              <span
                aria-hidden="true"
                className="flex size-control shrink-0 items-center justify-center rounded-control border bg-muted text-muted-foreground [&_svg]:size-5"
              >
                {device.icon ?? <MonitorSmartphoneIcon />}
              </span>
              <div className="flex min-w-0 flex-col gap-inline">
                <div className="flex min-w-0 flex-wrap items-center gap-inline">
                  <h2 id={nameId} className="min-w-0 text-title-sm break-words">
                    {device.name}
                  </h2>
                  {device.kind === undefined ? null : <Badge variant="secondary">{device.kind}</Badge>}
                </div>
                {hasContent(device.detail) ? (
                  <div className="text-body-sm text-muted-foreground">{device.detail}</div>
                ) : null}
              </div>
            </div>
            {hasContent(text.description) ? (
              <p className="text-body text-muted-foreground">{text.description}</p>
            ) : null}
            {pairing}
            {hasContent(warning) ? (
              <Alert data-slot="device-approval-warning" tone="warning">
                <TriangleAlertIcon />
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            ) : null}
            {granted.length > 0 || withheld.length > 0 ? (
              <div className="grid min-w-0 gap-group @xl:grid-cols-2">
                <PermissionSection kind="granted" heading={text.granted} permissions={granted} />
                <PermissionSection kind="withheld" heading={text.withheld} permissions={withheld} />
              </div>
            ) : null}
            {state.expired ? (
              <p
                data-slot="device-approval-expired"
                className="flex items-center gap-inline text-body-sm font-medium text-warning-soft-foreground [&_svg]:size-4"
              >
                <ClockAlertIcon />
                {text.expired}
              </p>
            ) : null}
            {!state.expired && expiry !== undefined && text.expiresIn && state.decided === null ? (
              <Countdown expiresAt={expiry} expiresIn={text.expiresIn} />
            ) : null}
            {state.error === null ? null : (
              <Alert data-slot="device-approval-error" tone="destructive" live>
                <AlertDescription className="text-foreground">
                  {rejectionContent(state.error, text.error)}
                </AlertDescription>
              </Alert>
            )}
            {hasContent(decision) ? (
              <Alert
                data-slot="device-approval-decided"
                tone={state.decided === "approve" ? "success" : "neutral"}
                live
              >
                <AlertDescription>{decision}</AlertDescription>
              </Alert>
            ) : null}
            {showBlockedReason ? (
              <p
                id={blockedReasonId}
                data-slot="device-approval-blocked"
                className="flex items-center justify-end gap-inline text-end text-body-sm text-muted-foreground narrow:justify-start narrow:text-start [&_svg]:size-4 [&_svg]:shrink-0"
              >
                <CircleSlashIcon />
                {approveBlockedReason}
              </p>
            ) : null}
            <div
              data-slot="device-approval-actions"
              className="flex flex-wrap items-center justify-end gap-items narrow:flex-col-reverse narrow:items-stretch"
            >
              {props.actions === undefined ? (
                <>
                  <Button
                    variant="outline"
                    className="narrow:w-full"
                    loading={state.pending === "deny"}
                    disabled={state.expired || state.decided !== null || state.pending === "approve"}
                    onClick={(event) => {
                      const result = api.deny(event.nativeEvent)
                      if (result instanceof Promise) result.then(undefined, ignoreRefusal)
                    }}
                  >
                    {text.deny}
                  </Button>
                  <ApproveButton
                    approve={(event) => api.approve(event)}
                    blocked={actionState.approveBlocked || state.decided !== null || state.pending === "deny"}
                    pending={state.pending === "approve"}
                    describedBy={showBlockedReason ? blockedReasonId : undefined}
                    agentConfirm={text.approveAgentConfirm}
                  >
                    {text.approve}
                  </ApproveButton>
                </>
              ) : typeof props.actions === "function" ? (
                props.actions(actionState)
              ) : (
                props.actions
              )}
            </div>
          </>
        )
      },
    },
  )
}

export { DeviceApproval, deviceApprovalLabels }
export type {
  DeviceApprovalActionState,
  DeviceApprovalLabels,
  DeviceApprovalProps,
  DeviceApprovalText,
  DeviceInfo,
  DevicePermission,
}
