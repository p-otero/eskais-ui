import { useEffect, useMemo, useReducer, useRef, useState } from "react"

import cel from "./character-cel-outline.glb?url"
import soft from "./character-soft-toon.glb?url"
import recordingUrl from "./scan-replay.json?url"
import {
  idleScan,
  onBodyPhoto,
  reduceScan,
  replayScan,
  toModelScanProps,
  type ScanEvent,
  type ScanRecording,
} from "./scan-replay"

const glbs: Record<string, string> = { "character-soft-toon.glb": soft, "character-cel-outline.glb": cel }

let recording: Promise<ScanRecording> | undefined
// Fetched on the first run, not bundled: the page doesn't pay for it until someone presses start.
const loadRecording = () =>
  (recording ??= fetch(recordingUrl).then((response) => {
    if (!response.ok) throw new Error(`The scan recording didn't load (${String(response.status)}).`)
    return response.json() as Promise<ScanRecording>
  }))

/**
 * ModelScan's props from the recorded scan, replayed by its `at` times `slowdown` times slower, with start and
 * cancel. The face's landmarks are placed on the body photo the demo shows.
 */
function useScanReplay({ slowdown = 15 }: { slowdown?: number } = {}) {
  const [state, dispatch] = useReducer(
    (current: typeof idleScan, event: ScanEvent | "reset" | "start") =>
      // Started at the press, before the recording has loaded: Start goes and Cancel takes its place at once.
      event === "reset" ? idleScan : event === "start" ? { ...idleScan, started: true } : reduceScan(current, event),
    idleScan,
  )
  const [loaded, setLoaded] = useState<ScanRecording>()
  const run = useRef<AbortController>(undefined)
  useEffect(() => () => run.current?.abort(), [])
  const start = () => {
    run.current?.abort()
    dispatch("start")
    const controller = new AbortController()
    run.current = controller
    loadRecording()
      .then((next) => {
        if (controller.signal.aborted) return
        setLoaded(next)
        // Cancelling rejects the replay with an AbortError: not a failure, so nothing to show.
        return replayScan(next, dispatch, { glb: (file) => glbs[file] ?? file, slowdown, signal: controller.signal })
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error
      })
  }
  const cancel = () => {
    run.current?.abort()
    dispatch("reset")
  }
  const place = useMemo(() => (loaded ? onBodyPhoto(loaded) : undefined), [loaded])
  const props = toModelScanProps(state)
  const points = useMemo(() => place?.(state.landmarks) ?? [], [place, state.landmarks])
  const running = props.stage === "detecting" || props.stage === "building" || props.stage === "refining"
  return { props: { ...props, points }, state, start, cancel, running }
}

export { useScanReplay }
