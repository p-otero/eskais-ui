import { useEffect, useMemo, useReducer, useRef, useState } from "react"

import type { ModelScanMask } from "@/components/ui/model-scan-mask"

import cel from "./character-cel-outline.glb?url"
import soft from "./character-soft-toon.glb?url"
import maskUrl from "./photo-body-mask.png?url"
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

let decoded: Promise<ModelScanMask> | undefined
// The body photo's person mask, 0–255 bytes row-major, as the engine's coming `mask` event sends it: decoded from the
// PNG, its red channel, on the first run.
const loadMask = () =>
  (decoded ??= fetch(maskUrl)
    .then((response) => response.blob())
    .then((blob) => createImageBitmap(blob))
    .then((bitmap) => {
      const canvas = document.createElement("canvas")
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) throw new Error("No 2D canvas to read the mask.")
      context.drawImage(bitmap, 0, 0)
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      const bytes = new Uint8Array(bitmap.width * bitmap.height)
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = data[i * 4] ?? 0
      return { source: "body" as const, width: bitmap.width, height: bitmap.height, data: bytes }
    }))

/**
 * ModelScan's props from the recorded scan, replayed by its `at` times `slowdown` times slower, with start and
 * cancel. The face's landmarks are placed on the body photo the demo shows.
 */
function useScanReplay({ slowdown = 15, mask: withMask = true }: { slowdown?: number; mask?: boolean } = {}) {
  const [state, dispatch] = useReducer(
    (current: typeof idleScan, event: ScanEvent | "reset" | "start") =>
      // Started at the press, before the recording has loaded: Start goes and Cancel takes its place at once.
      event === "reset" ? idleScan : event === "start" ? { ...idleScan, started: true } : reduceScan(current, event),
    idleScan,
  )
  const [loaded, setLoaded] = useState<ScanRecording>()
  const [mask, setMask] = useState<ModelScanMask>()
  const run = useRef<AbortController>(undefined)
  useEffect(() => () => run.current?.abort(), [])
  const start = () => {
    run.current?.abort()
    dispatch("start")
    const controller = new AbortController()
    run.current = controller
    if (withMask) loadMask().then(setMask, () => undefined)
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
  // The mask comes with the body's landmarks, as the engine's would; none with `mask: false`, for the hull fallback.
  const body = state.landmarks.some((group) => group.source === "body")
  const masks = useMemo(() => (withMask && body && mask ? [mask] : undefined), [withMask, body, mask])
  return { props: { ...props, points, masks }, state, start, cancel, running }
}

export { useScanReplay }
