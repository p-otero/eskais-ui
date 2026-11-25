import {
  roundedLocation,
  type SkyLocation,
  type SkyWeather,
  type WeatherFetcher,
} from "@/components/ui/live-sky-weather"

/** Where the weather stands: none asked for yet, the first answer on its way, an answer (maybe being renewed), or a failure. */
type WeatherStatus = "idle" | "loading" | "ready" | "refreshing" | "error"

type WeatherSnapshot = {
  status: WeatherStatus
  weather: SkyWeather | null
  /** The rounded place the weather is for, as `latitude,longitude`. */
  key: string | null
  error: unknown
}

type FeedSettings = {
  location: SkyLocation | null
  fetchWeather: WeatherFetcher
  refreshMs: number
  onWeather?: ((weather: SkyWeather, location: SkyLocation) => void) | undefined
}

const keyOf = (location: SkyLocation | null) => {
  if (!location) return null
  const rounded = roundedLocation(location)
  return `${String(rounded.latitude)},${String(rounded.longitude)}`
}

const noLocationError = () => new Error("The sky has no place to fetch the weather for.")

/** Fetches the weather for one place at a time and renews it every `refreshMs` while `visible`; nothing runs while hidden. */
function createWeatherFeed() {
  let snapshot: WeatherSnapshot = { status: "idle", weather: null, key: null, error: null }
  let settings: FeedSettings | null = null
  let visible = false
  let fetchedAt = 0
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()

  const set = (next: Partial<WeatherSnapshot>) => {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) listener()
  }

  const schedule = () => {
    clearTimeout(timer)
    if (!visible || !settings?.location) return
    const due = Math.max(0, fetchedAt + settings.refreshMs - Date.now())
    timer = setTimeout(() => {
      void refresh().catch(() => undefined)
    }, due)
  }

  function refresh(): Promise<SkyWeather> {
    const current = settings
    const location = current?.location ?? null
    if (!current || !location) return Promise.reject(noLocationError())
    const key = keyOf(location)
    controller?.abort()
    const aborter = new AbortController()
    controller = aborter
    fetchedAt = Date.now()
    set({ status: snapshot.weather && snapshot.key === key ? "refreshing" : "loading", key, error: null })
    schedule()
    return current.fetchWeather(roundedLocation(location), { signal: aborter.signal }).then(
      (weather) => {
        if (aborter.signal.aborted) return weather
        set({ status: "ready", weather, key, error: null })
        current.onWeather?.(weather, location)
        return weather
      },
      (error: unknown) => {
        if (!aborter.signal.aborted) set({ status: "error", error })
        throw error
      },
    )
  }

  return {
    get: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    refresh,
    configure(next: FeedSettings | null) {
      const moved = keyOf(next?.location ?? null) !== keyOf(settings?.location ?? null)
      settings = next
      if (!next?.location) {
        controller?.abort()
        clearTimeout(timer)
        if (snapshot.status !== "idle") set({ status: "idle", weather: null, key: null, error: null })
        return
      }
      if (moved) {
        fetchedAt = 0
        set({ weather: null })
      }
      schedule()
    },
    setVisible(next: boolean) {
      visible = next
      if (visible) schedule()
      else clearTimeout(timer)
    },
    dispose() {
      const answerPending = snapshot.status === "loading" || snapshot.status === "refreshing"
      if (answerPending) fetchedAt = 0
      controller?.abort()
      clearTimeout(timer)
    },
  }
}

type WeatherFeed = ReturnType<typeof createWeatherFeed>

export { createWeatherFeed, keyOf }
export type { FeedSettings, WeatherFeed, WeatherSnapshot, WeatherStatus }
