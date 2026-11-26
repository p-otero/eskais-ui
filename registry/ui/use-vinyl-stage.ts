import { useEffect, useRef, type RefObject } from "react"

import {
  createVinylStage,
  supportsVinylStage,
  type DeckInput,
  type VinylStage,
} from "@/components/ui/vinyl-scrubber-stage"

type VinylStageOptions = DeckInput & { title: string | undefined; subtitle: string | undefined }

/**
 * Puts the WebGL turntable over the drawn one in `host` after the controls have painted, and hands it the position,
 * playback and label text. Without WebGL, on the server and in tests, the drawing stays.
 */
function useVinylStage(
  host: RefObject<HTMLElement | null>,
  { time, duration, playing, title, subtitle }: VinylStageOptions,
) {
  const stage = useRef<VinylStage | null>(null)

  useEffect(() => {
    const element = host.current
    if (!element || !supportsVinylStage()) return
    const created = createVinylStage(element)
    stage.current = created
    return () => {
      created.dispose()
      stage.current = null
    }
  }, [host])

  useEffect(() => {
    stage.current?.update({ time, duration, playing })
  }, [time, duration, playing])

  useEffect(() => {
    stage.current?.label(title, subtitle)
  }, [title, subtitle])
}

export { useVinylStage }
