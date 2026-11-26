import { useEffect, useEffectEvent, useRef, useSyncExternalStore, type RefObject } from "react"

import { createSkyEngine, type EngineInput, type SkyEngine } from "@/components/ui/live-sky-engine"

/** Runs the sky's renderer in the stage element and hands it each new weather state; it draws nothing while hidden. */
function useLiveSkyScene(
  stage: RefObject<HTMLElement | null>,
  { conditions, location, glass, onFrame, photo, awaitingPhoto }: EngineInput,
) {
  const engine = useRef<SkyEngine | null>(null)
  const reportFrame = useEffectEvent((milliseconds: number) => onFrame?.(milliseconds))

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const created = createSkyEngine(element)
    engine.current = created
    return () => {
      created.dispose()
      engine.current = null
    }
  }, [stage])

  const reportsFrames = onFrame !== undefined
  useEffect(() => {
    engine.current?.update({
      conditions,
      location,
      glass,
      onFrame: reportsFrames ? reportFrame : undefined,
      photo,
      awaitingPhoto,
    })
  }, [conditions, location, glass, photo, awaitingPhoto, reportsFrames])
}

const skyTickMs = 2 * 60_000

let skyNow = Date.now()

function subscribeSkyTime(changed: () => void) {
  const tick = () => {
    if (document.visibilityState === "hidden") return
    skyNow = Date.now()
    changed()
  }
  tick()
  const timer = setInterval(tick, skyTickMs)
  document.addEventListener("visibilitychange", tick)
  return () => {
    clearInterval(timer)
    document.removeEventListener("visibilitychange", tick)
  }
}

const readSkyTime = () => skyNow

/** The time the sky shows: `fixed` when given, else now, moved on every two minutes while the page is visible. */
function useSkyTime(fixed: number | undefined) {
  const now = useSyncExternalStore(subscribeSkyTime, readSkyTime, readSkyTime)
  return fixed ?? now
}

export { useLiveSkyScene, useSkyTime }
