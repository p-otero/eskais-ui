import { useEffect, useRef, useState } from "react"

import { initialModelScan, runFakeModelEngine, type FakeModelScanState } from "./fake-engine"

/** ModelScan's props from the fake engine, with start, cancel and a switch to fail the next run. */
function useFakeModelScan(
  model: string,
  { speed = 1, fail: failFirst = false }: { speed?: number; fail?: boolean } = {},
) {
  const [state, setState] = useState<FakeModelScanState>(initialModelScan)
  const [fail, setFail] = useState(failFirst)
  const stop = useRef<() => void>(undefined)
  useEffect(() => () => stop.current?.(), [])
  const start = () => {
    stop.current?.()
    stop.current = runFakeModelEngine((patch) => setState((current) => ({ ...current, ...patch })), {
      model,
      fail,
      speed,
    })
  }
  const cancel = () => {
    stop.current?.()
    setState(initialModelScan)
  }
  return { state, start, cancel, fail, setFail }
}

export { useFakeModelScan }
