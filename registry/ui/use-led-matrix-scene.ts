import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react"

import { createLedMatrixEngine, type LedMatrixSettings } from "@/components/ui/led-matrix-engine"

type LedMatrixElements = {
  board: RefObject<HTMLElement | null>
  canvas: RefObject<HTMLCanvasElement | null>
}

type Engine = ReturnType<typeof createLedMatrixEngine>

/**
 * Runs the sign's engine on the canvas while it's mounted and returns the index of the message on it. It paints only
 * when a dot changes, and stops while the sign is paused, off screen or in a hidden tab.
 */
function useLedMatrixScene(
  elements: LedMatrixElements,
  settings: LedMatrixSettings,
  onPaint?: (milliseconds: number) => void,
) {
  const [message, setMessage] = useState(0)
  const engine = useRef<Engine | null>(null)
  const latest = useEffectEvent(() => settings)
  const painted = useEffectEvent((milliseconds: number) => onPaint?.(milliseconds))

  useEffect(() => {
    const board = elements.board.current
    const canvas = elements.canvas.current
    if (!board || !canvas) return
    const created = createLedMatrixEngine(canvas, board, { onMessage: setMessage, onPaint: painted })
    created.set(latest())
    engine.current = created
    return () => {
      created.destroy()
      engine.current = null
    }
  }, [elements])

  const { messages, columns, rows, mode, speed, holdMs, color, paused } = settings
  useLayoutEffect(() => {
    engine.current?.set({ messages, columns, rows, mode, speed, holdMs, color, paused })
  }, [messages, columns, rows, mode, speed, holdMs, color, paused])

  return message
}

export { useLedMatrixScene }
