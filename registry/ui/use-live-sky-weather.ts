import { useEffect, useState, useSyncExternalStore, type RefObject } from "react"

import { createWeatherFeed, type FeedSettings } from "@/components/ui/live-sky-feed"

/** The weather for the sky's place, fetched while the stage is on screen and the page is visible, renewed on a timer. */
function useLiveSkyWeather(stage: RefObject<HTMLElement | null>, settings: FeedSettings | null) {
  const [feed] = useState(createWeatherFeed)
  const snapshot = useSyncExternalStore(feed.subscribe, feed.get, feed.get)
  const location = settings?.location ?? null
  const fetchWeather = settings?.fetchWeather
  const refreshMs = settings?.refreshMs
  const onWeather = settings?.onWeather

  useEffect(() => {
    feed.configure(location && fetchWeather && refreshMs ? { location, fetchWeather, refreshMs, onWeather } : null)
  }, [feed, location, fetchWeather, refreshMs, onWeather])

  useEffect(() => {
    const element = stage.current
    let inView = typeof IntersectionObserver !== "function"
    const update = () => feed.setVisible(inView && document.visibilityState !== "hidden")
    const observer =
      element && typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            inView = entries.some((entry) => entry.isIntersecting)
            update()
          })
        : null
    if (element) observer?.observe(element)
    update()
    document.addEventListener("visibilitychange", update)
    return () => {
      observer?.disconnect()
      document.removeEventListener("visibilitychange", update)
      feed.setVisible(false)
    }
  }, [feed, stage])

  useEffect(() => () => feed.dispose(), [feed])

  return { snapshot, refresh: feed.refresh }
}

export { useLiveSkyWeather }
