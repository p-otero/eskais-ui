import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react"

import type { GeolocationAccess } from "@/components/ui/live-sky-primitive"
import { roundedLocation, type SkyLocation } from "@/components/ui/live-sky-weather"

const positionMaxAgeMs = 10 * 60_000
const positionTimeoutMs = 20_000

/** Thrown when the browser can't or won't say where the person is. `denied` when they refused access. */
class GeolocationError extends Error {
  override name = "GeolocationError"
  readonly denied: boolean

  constructor(message: string, denied: boolean) {
    super(message)
    this.denied = denied
  }
}

function createGeolocation() {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator
  let access: GeolocationAccess = supported ? "prompt" : "unsupported"
  const listeners = new Set<() => void>()
  const set = (next: GeolocationAccess) => {
    if (next === access) return
    access = next
    for (const listener of listeners) listener()
  }

  const locate = () =>
    new Promise<SkyLocation>((resolve, reject) => {
      if (!supported) {
        reject(new GeolocationError("This browser can't tell where it is.", false))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          set("granted")
          resolve(roundedLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }))
        },
        (failure) => {
          const denied = failure.code === failure.PERMISSION_DENIED
          if (denied) set("denied")
          reject(new GeolocationError(failure.message, denied))
        },
        { maximumAge: positionMaxAgeMs, timeout: positionTimeoutMs, enableHighAccuracy: false },
      )
    })

  return {
    get: () => access,
    set,
    supported,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    locate,
  }
}

function readPermission(onState: (state: PermissionState) => void) {
  const permissions = typeof navigator === "undefined" ? undefined : navigator.permissions
  if (!permissions?.query) return () => undefined
  let status: PermissionStatus | null = null
  let cancelled = false
  const report = () => {
    if (status) onState(status.state)
  }
  permissions.query({ name: "geolocation" }).then(
    (answer) => {
      if (cancelled) return
      status = answer
      report()
      answer.addEventListener("change", report)
    },
    () => undefined,
  )
  return () => {
    cancelled = true
    status?.removeEventListener("change", report)
  }
}

type GeolocationOptions = {
  /** Locate on its own once the person has already allowed it, which shows no prompt. */
  autoLocate: boolean
  onLocated: (location: SkyLocation) => void
}

/** The browser's location permission, read without asking, and `locate()`, which asks only when called. */
function useLiveSkyGeolocation({ autoLocate, onLocated }: GeolocationOptions) {
  const [geolocation] = useState(createGeolocation)
  const access = useSyncExternalStore(geolocation.subscribe, geolocation.get, () => "prompt" as const)
  const located = useEffectEvent(onLocated)

  useEffect(() => {
    if (!geolocation.supported) return
    return readPermission(geolocation.set)
  }, [geolocation])

  useEffect(() => {
    if (!autoLocate || access !== "granted") return
    let current = true
    geolocation.locate().then(
      (found) => {
        if (current) located(found)
      },
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [autoLocate, access, geolocation])

  return { access, locate: geolocation.locate }
}

export { GeolocationError, useLiveSkyGeolocation }
