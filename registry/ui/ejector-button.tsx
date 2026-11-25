"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/react/primitive"
import { createToggleController, Toggle, type TogglePressedChangeReason } from "@ui-sdk/react/toggle"
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"

import { ejectorButton, ejectorRelease, type EjectReason } from "@/components/ui/ejector-button-primitive"
import { ControlTooltip } from "@/components/ui/tooltip"
import { useEjectorDisarmTimer } from "@/components/ui/use-ejector-disarm-timer"
import { cn } from "@/lib/utils"

const { Root: EjectorButtonRoot } = createParts(ejectorButton, { root: "div" })
const { Root: EjectorRelease } = createParts(ejectorRelease, { root: "button" })

/** Why the cover opened or closed: a press on it, the timeout, Escape, an eject that finished, or a call. */
type EjectorArmedChangeReason = "cover-press" | "timeout" | "escape-key" | "eject" | "imperative"

type EjectorArmedChangeDetails = {
  reason: EjectorArmedChangeReason
  event?: Event
  /** Keeps the cover as it is. */
  cancel: () => void
}

type EjectorButtonLabels = {
  /** Names the hinged cover, a toggle pressed while it's open. */
  cover: string
}

const ejectorButtonLabels: EjectorButtonLabels = { cover: "Safety cover" }

type EjectorButtonState = { armed: boolean; pending: boolean; disabled: boolean }

type EjectorButtonProps = {
  /** What the red button does, like "Delete environment": the name of the group and of the button, engraved below. */
  label: string
  /** Sentence an agent must show a person before ejecting, e.g. "Deletes the staging environment and its data". */
  agentConfirm: string
  /** Runs on a press of the red button while the cover is open. A returned Promise keeps it pending until it settles; then the cover closes. */
  onEject: (details: { reason: EjectReason; event?: Event }) => unknown
  /** How long the cover stays open without an eject, in milliseconds; 0 keeps it open. 5000 by default. */
  armTimeoutMs?: number
  /** Whether the cover is open. Pass it to control the ejector. */
  armed?: boolean
  defaultArmed?: boolean
  /** Runs when the cover wants to open or close, with why; `details.cancel()` keeps it as it is. */
  onArmedChange?: (armed: boolean, details: EjectorArmedChangeDetails) => void
  disabled?: boolean
  labels?: Partial<EjectorButtonLabels>
  /** Classes for the root; a function gets the ejector's state. */
  className?: string | ((state: EjectorButtonState) => string | undefined)
}

const defaultArmTimeoutMs = 5000

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function"
}

const coverReason = (reason: TogglePressedChangeReason): EjectorArmedChangeReason =>
  reason === "press" ? "cover-press" : "imperative"

/**
 * A destructive action under the hinged cover of a gear-stick knob, over a leather boot: open the cover (a toggle),
 * then press the red button. The cover closes again after `armTimeoutMs`, on Escape and once the eject finishes.
 * Agents call `arm`, `disarm` and `eject`; `eject` fails with why while the cover is closed, and waits for a person
 * through `allow`, since the button carries `data-agent-confirm`.
 */
function EjectorButton({
  label,
  agentConfirm,
  onEject,
  armTimeoutMs = defaultArmTimeoutMs,
  armed: armedProp,
  defaultArmed = false,
  onArmedChange,
  disabled = false,
  labels: labelOverrides,
  className,
}: EjectorButtonProps) {
  const labels = { ...ejectorButtonLabels, ...labelOverrides }
  const [cover] = useState(createToggleController)
  const [ownArmed, setOwnArmed] = useState(defaultArmed)
  const [pending, setPending] = useState(false)
  const release = useRef<HTMLButtonElement>(null)
  const armed = armedProp ?? ownArmed

  const changeArmed = (next: boolean, reason: EjectorArmedChangeReason, event?: Event) => {
    if (next === armed) return true
    let canceled = false
    onArmedChange?.(next, { reason, event, cancel: () => (canceled = true) })
    if (canceled) return false
    setOwnArmed(next)
    const focusUnderCover = !next && release.current !== null && release.current === document.activeElement
    if (focusUnderCover) cover.focus()
    return true
  }

  useEjectorDisarmTimer(armed && !pending && !disabled, armTimeoutMs, () => changeArmed(false, "timeout"))

  const onCoverChange = (next: boolean, details: ChangeDetails<TogglePressedChangeReason>) => {
    if (!changeArmed(next, coverReason(details.reason), details.event)) details.cancel()
  }

  const eject = (details: { reason: EjectReason; event?: Event }) => {
    const result = onEject(details)
    if (!isThenable(result)) {
      changeArmed(false, "eject", details.event)
      return
    }
    setPending(true)
    const settle = () => {
      setPending(false)
      changeArmed(false, "eject")
    }
    result.then(settle, settle)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !armed || pending) return
    event.preventDefault()
    event.stopPropagation()
    changeArmed(false, "escape-key", event.nativeEvent)
  }

  const state = { armed, pending, disabled }
  return (
    <EjectorButtonRoot
      cover={cover}
      disabled={disabled}
      pending={pending}
      aria-label={label}
      data-armed={armed ? "" : undefined}
      data-pending={pending ? "" : undefined}
      onKeyDown={onKeyDown}
      className={cn(typeof className === "function" ? className(state) : className)}
    >
      <div data-slot="ejector-button-stage">
        <div data-slot="ejector-button-console">
          <span data-slot="ejector-button-boot" aria-hidden="true" />
          <div data-slot="ejector-button-knob">
            <span data-slot="ejector-button-shaft" aria-hidden="true" />
            <span data-slot="ejector-button-knob-base" aria-hidden="true" />
            <span data-slot="ejector-button-knob-side" aria-hidden="true" />
            <div data-slot="ejector-button-knob-top">
              <span data-slot="ejector-button-well" aria-hidden="true" />
              <ControlTooltip label={labels.cover}>
                <Toggle
                  controller={cover}
                  pressed={armed}
                  onPressedChange={onCoverChange}
                  disabled={disabled || pending}
                  aria-label={labels.cover}
                  render={(part) => (
                    <button {...part} data-slot="ejector-button-cover">
                      <span data-slot="ejector-button-cover-top" data-face="">
                        {/* oxlint-disable-next-line eskais/no-inline-icons -- the shift pattern engraved on the knob, not an icon */}
                        <svg viewBox="0 -4 70 68" aria-hidden="true" data-slot="ejector-button-pattern">
                          <path d="M10 10v40M35 10v40M60 10v20M10 30h50" />
                          <text x="10" y="4">
                            1
                          </text>
                          <text x="10" y="62">
                            2
                          </text>
                          <text x="35" y="4">
                            3
                          </text>
                          <text x="35" y="62">
                            4
                          </text>
                          <text x="60" y="4">
                            5
                          </text>
                          <text x="60" y="40">
                            R
                          </text>
                        </svg>
                      </span>
                      <span data-slot="ejector-button-cover-under" data-face="" />
                      <span data-slot="ejector-button-hinge" />
                    </button>
                  )}
                />
              </ControlTooltip>
              <EjectorRelease
                ref={release}
                armed={armed}
                pending={pending}
                disabled={disabled}
                onEject={eject}
                aria-label={label}
                data-agent-confirm={agentConfirm}
              />
            </div>
          </div>
        </div>
      </div>
      <div data-slot="ejector-button-plate" aria-hidden="true">
        <span data-slot="ejector-button-led" />
        <span>{label}</span>
      </div>
    </EjectorButtonRoot>
  )
}

export { EjectorButton, ejectorButtonLabels }
export type {
  EjectorArmedChangeDetails,
  EjectorArmedChangeReason,
  EjectorButtonLabels,
  EjectorButtonProps,
  EjectorButtonState,
}
