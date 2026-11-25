import { useEffect, useReducer, useRef, useState } from "react"

import {
  finalErrors,
  idleEngine,
  reduceEngine,
  runFakeEngine,
  toModelScanProps,
  type EngineErrorCode,
  type EngineEvent,
} from "./fake-engine"

type Glb = ArrayBuffer | string

function useFakeModelScan(
  { model, character }: { model: Glb; character: Glb },
  {
    speed = 1,
    fail: failFirst = false,
    photo,
  }: { speed?: number; fail?: boolean | EngineErrorCode; photo?: "portrait" | "tall" } = {},
) {
  const [state, dispatch] = useReducer(
    (current: typeof idleEngine, event: EngineEvent | "reset") =>
      event === "reset" ? idleEngine : reduceEngine(current, event),
    idleEngine,
  )
  const [fail, setFail] = useState(failFirst)
  const run = useRef<AbortController>(undefined)
  useEffect(() => () => run.current?.abort(), [])
  const start = () => {
    run.current?.abort()
    dispatch("reset")
    const controller = new AbortController()
    run.current = controller
    runFakeEngine(dispatch, { model, character, fail, speed, photo, signal: controller.signal }).catch(
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error
      },
    )
  }
  const cancel = () => {
    run.current?.abort()
    dispatch("reset")
  }
  const running = state.stage === "detect" || state.stage === "fit" || state.stage === "refine"
  const canRetry = !(state.error && finalErrors.includes(state.error.code))
  return { props: toModelScanProps(state), state, start, cancel, fail, setFail, running, canRetry }
}

export { useFakeModelScan }
