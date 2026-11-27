"use client"

import { LockIcon } from "lucide-react"
import { memo, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { SafeDial, safeDialLabels, type SafeDialChangeDetails, type SafeDialLabels } from "@/components/ui/safe-dial"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { useSafeVaultMotion, type SafeVaultStatus } from "@/components/ui/use-safe-vault-motion"
import { useSafeVaultStage } from "@/components/ui/use-safe-vault-stage"
import { cn } from "@/lib/utils"

type SafeVaultLabels = SafeDialLabels & {
  /** Names the region that holds the contents once the vault is unlocked. */
  contents: string
  /** Announced when the vault unlocks. */
  unlocked: string
  /** Announced when the app denies a combination. */
  denied: string
  /** Names the button that locks the vault again. */
  lock: string
}

const safeVaultLabels: SafeVaultLabels = {
  ...safeDialLabels,
  contents: "Vault contents",
  unlocked: "Unlocked",
  denied: "Wrong combination",
  lock: "Lock",
}

/** Why the vault asks for a new status: `lock` from its Lock button, `retry` once a denied code's shake has played. */
type SafeVaultStatusChangeDetails = {
  reason: "lock" | "retry"
  event: Event | undefined
}

type SafeVaultState = {
  status: SafeVaultStatus
  open: boolean
  disabled: boolean
}

type SafeVaultProps = {
  /** The accessible name of the vault and its dial. */
  label: string
  /** Set by the app once it has checked the code from `onComplete`: `denied` shakes the dial and clears the code. */
  status: SafeVaultStatus
  /**
   * Asks the app for a new status: `locked` from the Lock button (shown only with this handler), and `locked` again
   * once a denial has played, so a second wrong code can be denied too.
   */
  onStatusChange?: (status: SafeVaultStatus, details: SafeVaultStatusChangeDetails) => void
  /** Runs with the whole code when the last number is entered: check it and set `status`. */
  onComplete?: (code: string) => void
  /** The code as digits, each number padded to the same width. Pass it to control the code. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string, details: SafeDialChangeDetails) => void
  /** How many numbers the combination has; 4 by default. */
  length?: number
  /** How many numbers the dial carries, from 0; 100 by default. */
  numbers?: number
  mask?: boolean
  disabled?: boolean
  name?: string
  /** What the vault holds. It isn't in the page until `status` is `unlocked`, and can't be used until the door is open. */
  children?: ReactNode
  labels?: Partial<SafeVaultLabels>
  /** Classes for the root; a function gets the vault's state. */
  className?: string | ((state: SafeVaultState) => string | undefined)
}

const noChange = () => {}

const Plaque = memo(function Plaque({ children }: { children: ReactNode }) {
  return (
    <div data-slot="safe-vault-plaque">
      <div data-slot="safe-vault-plaque-face">
        <ScrollArea className="size-full">
          <ScrollAreaViewport className="max-h-(--safe-vault-plaque-height)">
            <div data-slot="safe-vault-plaque-content">{children}</div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar data-agent-hidden="" />
        </ScrollArea>
      </div>
    </div>
  )
})

/**
 * A safe that opens with a combination: `SafeDial` on its door, and once the app unlocks it the door swings open and
 * the camera moves in to a plaque on the back wall holding `children`. The safe is a three.js scene drawn in a worker
 * after the controls paint; without WebGL the drawn door stays and the contents show under it.
 */
function SafeVault({
  label,
  status,
  onStatusChange,
  onComplete,
  value,
  defaultValue = "",
  onValueChange,
  length = 4,
  numbers = 100,
  mask = false,
  disabled = false,
  name,
  children,
  labels: labelOverrides,
  className,
}: SafeVaultProps) {
  const labels = { ...safeVaultLabels, ...labelOverrides }
  const [ownCode, setOwnCode] = useState(defaultValue)
  const [webgl, setWebgl] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLElement>(null)
  const code = value ?? ownCode

  const clearCode = () => {
    setOwnCode("")
    onValueChange?.("", { reason: "reset", event: undefined, cancel: noChange })
  }

  const { motion, open, setRenderer } = useSafeVaultMotion(status, {
    denialPlayed: () => {
      clearCode()
      onStatusChange?.("locked", { reason: "retry", event: undefined })
    },
    relocked: clearCode,
  })

  useSafeVaultStage(stage, layer, {
    motion,
    numbers,
    onRenderer: (next) => {
      setWebgl(next)
      setRenderer(next)
    },
  })

  const unlocked = status === "unlocked"
  const state: SafeVaultState = { status, open, disabled }
  const announcement = unlocked ? labels.unlocked : status === "denied" ? labels.denied : ""

  return (
    <div
      data-slot="safe-vault"
      data-status={status}
      data-open={open ? "" : undefined}
      data-vault={webgl ? "3d" : "drawn"}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        typeof className === "function" ? className(state) : className,
      )}
    >
      <div ref={stage} data-slot="safe-vault-stage">
        <SafeDial
          label={label}
          length={length}
          numbers={numbers}
          value={code}
          onValueChange={(next, details) => {
            setOwnCode(next)
            onValueChange?.(next, details)
          }}
          onComplete={onComplete}
          mask={mask}
          disabled={disabled || unlocked}
          name={name}
          labels={{ dial: labels.dial, code: labels.code }}
          className="absolute inset-0 rounded-none border-0 bg-transparent shadow-none"
        />
        {unlocked && onStatusChange ? (
          <div data-slot="safe-vault-lock">
            <Button
              variant="secondary"
              size="icon"
              aria-label={labels.lock}
              onClick={(event) => onStatusChange("locked", { reason: "lock", event: event.nativeEvent })}
            >
              <LockIcon />
            </Button>
          </div>
        ) : null}
      </div>
      <section
        ref={layer}
        data-slot="safe-vault-contents"
        aria-label={labels.contents}
        hidden={!unlocked}
        inert={!open}
      >
        <Plaque>{unlocked ? children : null}</Plaque>
      </section>
      <output className="sr-only">{announcement}</output>
    </div>
  )
}

export { SafeVault, safeVaultLabels }
export type { SafeVaultLabels, SafeVaultProps, SafeVaultState, SafeVaultStatus, SafeVaultStatusChangeDetails }
