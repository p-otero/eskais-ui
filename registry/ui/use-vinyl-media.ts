import { useCallback, useSyncExternalStore, type RefObject } from "react"

/** What the scrubber reads from a media element: its time and duration in seconds, and whether it plays. */
type MediaReading = { time: number; duration: number; playing: boolean }

const mediaEvents = ["timeupdate", "durationchange", "loadedmetadata", "play", "pause", "ended", "seeked", "emptied"]
const noMedia = "0|0|0"

function readingOf(snapshot: string): MediaReading {
  const [time = "0", duration = "0", playing = "0"] = snapshot.split("|")
  return { time: Number(time), duration: Number(duration) || 0, playing: playing === "1" }
}

/** Follows an `HTMLMediaElement`'s time, duration and playback through its events; nothing when there is none. */
function useVinylMedia(media: RefObject<HTMLMediaElement | null> | undefined): MediaReading | undefined {
  const subscribe = useCallback(
    (notify: () => void) => {
      const element = media?.current
      if (!element) return () => {}
      for (const name of mediaEvents) element.addEventListener(name, notify)
      return () => {
        for (const name of mediaEvents) element.removeEventListener(name, notify)
      }
    },
    [media],
  )
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const element = media?.current
      if (!element) return noMedia
      const duration = Number.isFinite(element.duration) ? element.duration : 0
      return `${String(element.currentTime)}|${String(duration)}|${element.paused || element.ended ? "0" : "1"}`
    },
    () => noMedia,
  )
  return media ? readingOf(snapshot) : undefined
}

export { useVinylMedia }
export type { MediaReading }
