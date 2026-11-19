import { useEffect, useReducer, useRef, useState } from "react"

import { idleEngine, reduceEngine, runFakeEngine, toModelScanProps, type EngineEvent } from "./fake-engine"

type Glb = ArrayBuffer | string

/** ModelScan's props from the fake engine's events, with start, cancel and a switch to fail the next run. */
function useFakeModelScan(
  { model, character }: { model: Glb; character: Glb },
  { speed = 1, fail: failFirst = false }: { speed?: number; fail?: boolean } = {},
) {
  const [state, dispatch] = useReducer(
    (current: typeof idleEngine, event: EngineEvent | "reset") =>
      event === "reset" ? idleEngine : reduceEngine(current, event),
    idleEngine,
  )
  const [fail, setFail] = useState(failFirst)
  const stop = useRef<() => void>(undefined)
  useEffect(() => () => stop.current?.(), [])
  const start = () => {
    stop.current?.()
    dispatch("reset")
    stop.current = runFakeEngine(dispatch, { model, character, fail, speed })
  }
  const cancel = () => {
    stop.current?.()
    dispatch("reset")
  }
  return { props: toModelScanProps(state), state, start, cancel, fail, setFail }
}

export { useFakeModelScan }
