import { definePrimitive } from "@ui-sdk/core"

import { isValidLocation, type SkyLocation } from "@/components/ui/live-sky-weather"
import { unavailable } from "@/lib/action-refusal"

/** Whether the browser can tell where the person is: not at all, refused, not asked yet, or allowed. */
type GeolocationAccess = "unsupported" | "denied" | "prompt" | "granted"

/** What the sky's actions do, wired by the component. */
type LiveSkyHandlers = {
  setLocation: (location: SkyLocation) => void
  /** Looks a place up by name and shows its sky; absent when the sky has no place search. */
  searchPlace?: ((name: string) => Promise<SkyLocation>) | undefined
  geolocate: () => Promise<SkyLocation>
  refresh: () => Promise<unknown>
}

type LiveSkyOptions = {
  /** The sentence that describes the sky, which agents read as the value. */
  summary?: string
  place?: string
  simulated?: boolean
  hasLocation?: boolean
  geolocation?: GeolocationAccess
  handlers?: LiveSkyHandlers
}

type Call = { action: string; event: Event | undefined }

function ready(options: LiveSkyOptions, { action, event }: Call) {
  if (options.simulated) return unavailable(action, "isn't available while the sky shows simulated weather", { event })
  if (!options.handlers) return unavailable(action, "isn't available: the sky isn't ready", { event })
  return options.handlers
}

const describe = (value: unknown) => (typeof value === "string" ? `"${value}"` : String(value))

function locationFrom(place: unknown, longitude: unknown, name: unknown): SkyLocation | null {
  if (typeof place === "number" && typeof longitude === "number") {
    return { latitude: place, longitude, name: typeof name === "string" ? name : undefined }
  }
  if (typeof place !== "object" || place === null || !("latitude" in place) || !("longitude" in place)) return null
  const { latitude, longitude: east } = place
  if (typeof latitude !== "number" || typeof east !== "number") return null
  const label = "name" in place && typeof place.name === "string" ? place.name : undefined
  return { latitude, longitude: east, name: label }
}

/** The live sky's agent surface: read the summary as the value, and move the sky to a place, to the person, or refresh. */
const liveSky = definePrimitive({
  name: "live-sky",
  options: {
    summary: "value",
    place: "value",
    simulated: "value",
    hasLocation: "value",
    geolocation: "value",
    handlers: "value",
  },
  state: (options: LiveSkyOptions) => ({ value: options.summary ?? "", place: options.place ?? "" }),
  sync: (options) => ({ value: options.summary ?? "", place: options.place ?? "" }),
  api: (context) => ({
    /**
     * Shows the sky over a place: a name to look up (`"A Coruña"`), `{ latitude, longitude, name? }`, or a latitude
     * and longitude in degrees with an optional name. A name resolves to the first match of the place search.
     */
    setLocation(place: SkyLocation | string | number, longitude?: number, name?: string) {
      const call = { action: "setLocation", event: undefined }
      const handlers = ready(context.options(), call)
      if (handlers === false) return false
      if (typeof place === "string") {
        const query = place.trim()
        if (query === "")
          return unavailable("setLocation", "takes a place name or { latitude, longitude }, not an empty name")
        if (!handlers.searchPlace) {
          return unavailable("setLocation", "can't look a place up by name here: pass { latitude, longitude } instead")
        }
        return handlers.searchPlace(query)
      }
      const location = locationFrom(place, longitude, name)
      if (!location || !isValidLocation(location)) {
        return unavailable(
          "setLocation",
          `takes a latitude from -90 to 90 and a longitude from -180 to 180, not ${describe(location?.latitude ?? place)}, ${describe(location?.longitude ?? longitude)}`,
        )
      }
      handlers.setLocation(location)
      return true
    },
    /** Asks the browser where the person is, with their permission, and shows the sky there. */
    geolocate(event?: Event) {
      const call = { action: "geolocate", event }
      const options = context.options()
      const handlers = ready(options, call)
      if (handlers === false) return false
      if (options.geolocation === "unsupported")
        return unavailable("geolocate", "isn't available: this browser can't tell where it is", { event })
      if (options.geolocation === "denied") {
        return unavailable("geolocate", "isn't available: the person denied location access in the browser", { event })
      }
      return handlers.geolocate()
    },
    /** Fetches the weather again now, instead of waiting for the next refresh. */
    refresh(event?: Event) {
      const call = { action: "refresh", event }
      const options = context.options()
      const handlers = ready(options, call)
      if (handlers === false) return false
      if (!options.hasLocation) return unavailable("refresh", "isn't available before the sky has a place", { event })
      return handlers.refresh()
    },
  }),
  slots: (slot) => ({
    root: slot({ role: "group" }),
  }),
  agent: { actions: ["setLocation", "geolocate", "refresh"] },
})

export { liveSky }
export type { GeolocationAccess, LiveSkyHandlers, LiveSkyOptions }
