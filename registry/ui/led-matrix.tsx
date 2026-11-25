"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { PauseIcon, PlayIcon } from "lucide-react"
import { useRef, useState, useSyncExternalStore } from "react"

import type { LedColor, LedMatrixMode } from "@/components/ui/led-matrix-engine"
import { ledMatrix, type LedMatrixOptions } from "@/components/ui/led-matrix-primitive"
import { Toggle } from "@/components/ui/toggle"
import { useLedMatrixScene } from "@/components/ui/use-led-matrix-scene"
import { cn, cssVars, type StateClassName } from "@/lib/utils"

type LedMatrixLabels = {
  /** Names the pause toggle, for screen readers, agents and its tooltip. */
  pause: string
}

const ledMatrixLabels: LedMatrixLabels = { pause: "Pause" }

type LedMatrixState = { paused: boolean; color: LedColor }

type LedMatrixProps = LedMatrixOptions & {
  /** The sign's accessible name: "Next departures", "Pharmacy". */
  label: string
  /** The colour of the lit dots. Default `amber`. */
  color?: LedColor
  /** `scroll` (the default) runs each message right to left; `hold` shows it still, a page at a time. */
  mode?: LedMatrixMode
  /** Scroll speed in dots per second. Default 24. */
  speed?: number
  /** How long a held message or page stays, in ms. Default 3000. */
  holdMs?: number
  /** Dots across. Default 96. */
  columns?: number
  /** Dots down. Default 9; 14 or more doubles the 5×7 glyphs. */
  rows?: number
  /** Shows the pause toggle, which motion that starts by itself needs. Default true. */
  controls?: boolean
  labels?: Partial<LedMatrixLabels>
  /** Classes for the housing; a function gets the sign's state. */
  className?: StateClassName<LedMatrixState>
  /** Called with each canvas paint's duration in ms, for measuring. */
  onPaint?: (milliseconds: number) => void
}

const dataAttributes = (values: Record<string, string | undefined>): Record<`data-${string}`, string | undefined> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [`data-${key}`, value]))

/**
 * A bus or pharmacy dot-matrix sign: a board of round LEDs behind smoked glass, with messages that scroll or hold in
 * turn, drawn from its own 5×7 font (Latin-1 and €). It paints a canvas only when a dot changes, and only on screen;
 * under reduced motion a scrolling sign shows its messages a page at a time.
 */
function LedMatrix({
  label,
  messages,
  defaultMessages,
  onMessagesChange,
  paused,
  defaultPaused,
  onPausedChange,
  live,
  color = "amber",
  mode = "scroll",
  speed = 24,
  holdMs = 3000,
  columns = 96,
  rows = 9,
  controls = true,
  labels: ownLabels,
  className,
  onPaint,
}: LedMatrixProps) {
  const labels = { ...ledMatrixLabels, ...ownLabels }
  const handle = usePrimitive(ledMatrix, {
    messages,
    defaultMessages,
    onMessagesChange,
    paused,
    defaultPaused,
    onPausedChange,
    live,
  })
  useSyncExternalStore(handle.instance.subscribe, handle.instance.get, handle.instance.get)
  const board = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [elements] = useState(() => ({ board, canvas }))
  const state = handle.state
  const message = useLedMatrixScene(
    elements,
    { messages: state.messages, columns, rows, mode, speed, holdMs, color, paused: state.paused },
    onPaint,
  )

  const children = (
    <>
      <div ref={board} data-slot="led-matrix-board" style={cssVars({ "--led-columns": columns, "--led-rows": rows })}>
        <canvas ref={canvas} data-slot="led-matrix-dots" aria-hidden="true" />
      </div>
      <p data-slot="led-matrix-text" className="sr-only">
        {state.messages[message] ?? ""}
      </p>
      {controls ? (
        <Toggle
          size="icon"
          aria-label={labels.pause}
          pressed={state.paused}
          onPressedChange={(next, details) =>
            next
              ? handle.api.pause({ reason: "trigger-press", event: details.event })
              : handle.api.resume({ reason: "trigger-press", event: details.event })
          }
          data-led-matrix-pause=""
        >
          {state.paused ? <PlayIcon /> : <PauseIcon />}
        </Toggle>
      ) : null}
    </>
  )

  return usePart(
    handle,
    "root",
    {},
    {
      "aria-label": label,
      ...dataAttributes({ color, mode }),
      children,
      className: cn(
        "relative flex w-full items-center gap-items",
        typeof className === "function" ? className({ paused: state.paused, color }) : className,
      ),
    },
    "div",
  )
}

export { LedMatrix, ledMatrixLabels }
export type { LedColor, LedMatrixLabels, LedMatrixMode, LedMatrixProps, LedMatrixState }
