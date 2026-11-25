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
  /** Points the photo's view; absent without a photo. */
  calibrate?:
    | ((view: { heading: number; fov?: number | undefined; horizon?: number | undefined }) => boolean)
    | undefined
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
    /**
     * Points the photo's view: `heading` in degrees from north (0 to 360), and optionally the horizontal field of view
     * (20 to 130°) and the horizon (0 to 1 down the photo). Only with a photo.
     */
    calibrate(heading: number, fov?: number, horizon?: number, event?: Event) {
      const call = { action: "calibrate", event }
      const handlers = context.options().handlers
      if (!handlers) return unavailable("calibrate", "isn't available: the sky isn't ready", { event })
      if (!handlers.calibrate) return unavailable("calibrate", "isn't available without a photo", call)
      if (!Number.isFinite(heading) || heading < 0 || heading > 360) {
        return unavailable("calibrate", `takes a heading from 0 to 360°, not ${String(heading)}`, call)
      }
      if (fov !== undefined && (!Number.isFinite(fov) || fov < 20 || fov > 130)) {
        return unavailable("calibrate", `takes a field of view from 20 to 130°, not ${String(fov)}`, call)
      }
      if (horizon !== undefined && (!Number.isFinite(horizon) || horizon < 0 || horizon > 1)) {
        return unavailable("calibrate", `takes a horizon from 0 to 1 down the photo, not ${String(horizon)}`, call)
      }
      return handlers.calibrate({ heading: heading % 360, fov, horizon })
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
  agent: { actions: ["setLocation", "geolocate", "refresh", "calibrate"] },
})

export { liveSky }
export type { GeolocationAccess, LiveSkyHandlers, LiveSkyOptions }
