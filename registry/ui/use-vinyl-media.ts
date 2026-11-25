import { useSyncExternalStore, type RefObject } from "react"

/** What the scrubber reads from a media element: its time and duration in seconds, and whether it plays. */
type MediaReading = { time: number; duration: number; playing: boolean }

const mediaEvents = ["timeupdate", "durationchange", "loadedmetadata", "play", "pause", "ended", "seeked", "emptied"]
const noMedia = "0|0|0"

function readingOf(snapshot: string): MediaReading {
  const [time = "0", duration = "0", playing = "0"] = snapshot.split("|")
  return { time: Number(time), duration: Number(duration) || 0, playing: playing === "1" }
}

type MediaRef = RefObject<HTMLMediaElement | null>

const subscribers = new WeakMap<MediaRef, (notify: () => void) => () => void>()

function subscriberFor(media: MediaRef) {
  const known = subscribers.get(media)
  if (known) return known
  const subscribe = (notify: () => void) => {
    const element = media.current
    if (!element) return () => {}
    for (const name of mediaEvents) element.addEventListener(name, notify)
    return () => {
      for (const name of mediaEvents) element.removeEventListener(name, notify)
    }
  }
  subscribers.set(media, subscribe)
  return subscribe
}

const subscribeToNothing = () => () => {}

function snapshotOf(media: MediaRef | undefined) {
  const element = media?.current
  if (!element) return noMedia
  const duration = Number.isFinite(element.duration) ? element.duration : 0
  return `${String(element.currentTime)}|${String(duration)}|${element.paused || element.ended ? "0" : "1"}`
}

/** Follows an `HTMLMediaElement`'s time, duration and playback through its events; nothing when there is none. */
function useVinylMedia(media: MediaRef | undefined): MediaReading | undefined {
  const snapshot = useSyncExternalStore(
    media ? subscriberFor(media) : subscribeToNothing,
    () => snapshotOf(media),
    () => noMedia,
  )
  return media ? readingOf(snapshot) : undefined
}

export { useVinylMedia }
export type { MediaReading }
