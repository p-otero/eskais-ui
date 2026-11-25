"use client"

import {
  createOTPInputController,
  OTPInput,
  OTPInputGroup,
  OTPInputSeparator,
  OTPInputSlot,
  type OTPInputValueChangeReason,
} from "@ui-sdk/react/otp-input"
import { createParts } from "@ui-sdk/react/primitive"
import {
  createSliderController,
  Slider,
  SliderControl,
  SliderThumb,
  SliderTrack,
  type SliderValueChangeDetails,
} from "@ui-sdk/react/slider"
import { Fragment, memo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"

import { digitsPer, safeDial } from "@/components/ui/safe-dial-primitive"
import { cn, cssVars } from "@/lib/utils"

const { Root: SafeDialRoot } = createParts(safeDial, { root: "div" })

type SafeDialLabels = {
  /** Names the dial, a slider over its numbers, for screen readers and agents. */
  dial: string
  /** Names the code field, which takes typed digits too. */
  code: string
}

const safeDialLabels: SafeDialLabels = { dial: "Dial", code: "Combination" }

/** Why the code changed: UI SDK's OTP input reasons, and `cancel()` to keep it as it was. */
type SafeDialChangeDetails = { reason: OTPInputValueChangeReason; event: Event | undefined; cancel: () => void }

type SafeDialState = { disabled: boolean; complete: boolean; value: string }

type SafeDialProps = {
  /** The accessible name of the dial and its code as a whole. */
  label: string
  /** How many numbers the combination has; 4 by default. */
  length?: number
  /** How many numbers the dial carries, from 0; 100 by default, so each number takes two digits. */
  numbers?: number
  /** The code as digits, each number padded to the same width (`"27046133"`). Pass it to control the dial. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string, details: SafeDialChangeDetails) => void
  /** Runs with the whole code when a change fills every number. */
  onComplete?: (value: string) => void
  /** Shows each entered digit as a dot. */
  mask?: boolean
  disabled?: boolean
  /** Submits the code under this name in a form. */
  name?: string
  labels?: Partial<SafeDialLabels>
  /** Classes for the root; a function gets the dial's state. */
  className?: string | ((state: SafeDialState) => string | undefined)
}

const dialRotationMs = 160
const fullTurn = 360

const numberedEvery = (numbers: number) => (numbers > 60 ? 10 : 5)

const DialFace = memo(function DialFace({ numbers }: { numbers: number }) {
  const every = numberedEvery(numbers)
  const ticks = Array.from({ length: numbers }, (_, index) => index)
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- a combination dial's engraved face, not an icon
    <svg data-slot="safe-dial-face" aria-hidden="true" viewBox="-100 -100 200 200">
      {ticks.map((tick) => {
        const angle = (-tick * fullTurn) / numbers
        const major = tick % every === 0
        const middle = !major && tick % (every / 2) === 0
        return (
          <line
            key={tick}
            x1="0"
            y1={major ? -78 : middle ? -82 : -85}
            x2="0"
            y2="-92"
            strokeWidth={major ? 1.6 : 0.8}
            transform={`rotate(${String(angle)})`}
          />
        )
      })}
      {ticks
        .filter((tick) => tick % every === 0)
        .map((tick) => {
          const angle = (-tick * fullTurn) / numbers
          return (
            <text key={tick} x="0" y="-62" transform={`rotate(${String(angle)})`} textAnchor="middle">
              {tick}
            </text>
          )
        })}
    </svg>
  )
})

function pointerAngle(event: ReactPointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - (rect.left + rect.width / 2)
  const y = event.clientY - (rect.top + rect.height / 2)
  return { angle: (Math.atan2(y, x) * 180) / Math.PI, distance: Math.hypot(x, y), radius: rect.width / 2 }
}

const wrapped = (value: number, numbers: number) => ((Math.round(value) % numbers) + numbers) % numbers
const shortest = (from: number, to: number, numbers: number) =>
  ((((to - from) % numbers) + numbers * 1.5) % numbers) - numbers / 2

type Drag = { pointer: number; from: number; start: number; turn: number }

/**
 * A combination dial for a numeric code: turn it to a number and let go, and the number goes into the next place of
 * the code. The dial is UI SDK's slider over its numbers (arrows turn it and wrap round, Enter enters the number,
 * Backspace takes the last one back, digits type straight in), and the code is UI SDK's OTP input.
 */
function SafeDial({
  label,
  length = 4,
  numbers = 100,
  value,
  defaultValue = "",
  onValueChange,
  onComplete,
  mask = false,
  disabled = false,
  name,
  labels: labelOverrides,
  className,
}: SafeDialProps) {
  const labels = { ...safeDialLabels, ...labelOverrides }
  const digits = digitsPer(numbers)
  const maxLength = length * digits
  const [slider] = useState(() => createSliderController<number>())
  const [code] = useState(() => createOTPInputController())
  const [ownCode, setOwnCode] = useState(defaultValue)
  const current = value ?? ownCode
  const [dialed, setDialed] = useState(0)
  const [dragging, setDragging] = useState(false)
  const rotor = useRef<HTMLDivElement>(null)
  const turn = useRef(0)
  const drag = useRef<Drag | null>(null)

  const showTurn = (degrees: number) => {
    turn.current = degrees
    rotor.current?.style.setProperty("--safe-dial-turn", `${degrees.toFixed(2)}deg`)
  }

  const onDial = (next: number, details: SliderValueChangeDetails) => {
    if (details.canceled) return
    if (details.reason !== "drag") showTurn(turn.current + (shortest(dialed, next, numbers) * fullTurn) / numbers)
    setDialed(next)
  }

  const write = (next: string) => code.setValue(next, { reason: "imperative" })

  const enterNumber = (number: number) => {
    const start = current.length >= maxLength ? "" : current.slice(0, Math.floor(current.length / digits) * digits)
    write(start + String(number).padStart(digits, "0"))
  }

  const removeNumber = () => {
    if (current.length === 0) return
    write(current.slice(0, Math.floor((current.length - 1) / digits) * digits))
  }

  const onKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return
    const native = event.nativeEvent
    const up = event.key === "ArrowUp" || event.key === "ArrowRight"
    const down = event.key === "ArrowDown" || event.key === "ArrowLeft"
    const step = event.shiftKey ? 10 : 1
    if ((up && dialed + step > numbers - 1) || (down && dialed - step < 0)) {
      event.preventDefault()
      event.stopPropagation()
      slider.setValue(wrapped(dialed + (up ? step : -step), numbers), { reason: "step-key", event: native })
    } else if (event.key === "Enter") {
      event.preventDefault()
      enterNumber(dialed)
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault()
      removeNumber()
    } else if (/^\d$/.test(event.key)) {
      event.preventDefault()
      write((current.length >= maxLength ? "" : current) + event.key)
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return
    const { angle, distance, radius } = pointerAngle(event)
    if (distance > radius) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, from: angle, start: turn.current, turn: turn.current }
    setDragging(true)
    slider.focus()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current
    if (active?.pointer !== event.pointerId) return
    const { angle, distance } = pointerAngle(event)
    if (distance < 6) return
    const delta = ((((angle - active.from + 180) % fullTurn) + fullTurn) % fullTurn) - 180
    active.from = angle
    active.turn += delta
    showTurn(active.turn)
    const next = wrapped((active.turn * numbers) / fullTurn, numbers)
    if (next !== slider.getValue()) slider.setValue(next, { reason: "drag", event: event.nativeEvent })
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const ended = drag.current
    if (ended?.pointer !== event.pointerId) return
    drag.current = null
    setDragging(false)
    const settledNumber = wrapped((ended.turn * numbers) / fullTurn, numbers)
    showTurn((Math.round((ended.turn * numbers) / fullTurn) * fullTurn) / numbers)
    const turnedANumber = Math.abs(ended.turn - ended.start) >= fullTurn / numbers / 2
    if (turnedANumber && event.type === "pointerup") enterNumber(settledNumber)
  }

  const onCodeChange = (next: string, details: SafeDialChangeDetails) => {
    const parts = next.match(new RegExp(`\\d{${String(digits)}}`, "g")) ?? []
    if (parts.some((part) => Number(part) >= numbers)) {
      details.cancel()
      return
    }
    onValueChange?.(next, details)
    setOwnCode(next)
  }

  const groups = Array.from({ length }, (_, index) => index)
  const complete = current.length >= maxLength
  const state = { disabled, complete, value: current }

  return (
    <SafeDialRoot
      code={code}
      length={length}
      numbers={numbers}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        typeof className === "function" ? className(state) : className,
      )}
    >
      <div
        data-slot="safe-dial-stage"
        data-disabled={disabled ? "" : undefined}
        data-complete={complete ? "" : undefined}
        onKeyDownCapture={onKeyDownCapture}
      >
        <OTPInput
          controller={code}
          value={current}
          onValueChange={(next, details) =>
            onCodeChange(next, { reason: details.reason, event: details.event, cancel: () => details.cancel() })
          }
          onValueCommit={onComplete ? (next) => onComplete(next) : undefined}
          maxLength={maxLength}
          pattern="digits"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          name={name}
          aria-label={labels.code}
          textAlign="center"
        >
          {groups.map((group) => (
            <Fragment key={group}>
              {group > 0 ? <OTPInputSeparator /> : null}
              <OTPInputGroup>
                {Array.from({ length: digits }, (_, digit) => {
                  const index = group * digits + digit
                  return (
                    <OTPInputSlot key={index} index={index}>
                      {(slot) => (slot.char === null ? null : mask ? "•" : slot.char)}
                    </OTPInputSlot>
                  )
                })}
              </OTPInputGroup>
            </Fragment>
          ))}
        </OTPInput>
        <div
          data-slot="safe-dial-dial"
          data-dragging={dragging ? "" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div data-slot="safe-dial-bezel" aria-hidden="true" />
          <div data-slot="safe-dial-index" aria-hidden="true" />
          <div data-slot="safe-dial-steel" aria-hidden="true" />
          <div
            ref={rotor}
            data-slot="safe-dial-rotor"
            aria-hidden="true"
            style={cssVars({ "--safe-dial-turn": "0deg", "--safe-dial-ease": `${String(dialRotationMs)}ms` })}
          >
            <DialFace numbers={numbers} />
            <div data-slot="safe-dial-knob" />
          </div>
          <Slider
            controller={slider}
            value={dialed}
            onValueChange={onDial}
            min={0}
            max={numbers - 1}
            step={1}
            largeStep={10}
            disabled={disabled}
            format={(next: number) => String(next).padStart(digits, "0")}
            className="pointer-events-none absolute inset-0"
          >
            <SliderControl className="absolute inset-0">
              <SliderTrack className="absolute inset-0">
                <SliderThumb aria-label={labels.dial} />
              </SliderTrack>
            </SliderControl>
          </Slider>
        </div>
        <output data-slot="safe-dial-reading" aria-hidden="true">
          {String(dialed).padStart(digits, "0")}
        </output>
      </div>
    </SafeDialRoot>
  )
}

export { SafeDial, safeDialLabels }
export type { SafeDialChangeDetails, SafeDialLabels, SafeDialProps, SafeDialState }
