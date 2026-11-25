import { definePrimitive } from "@ui-sdk/core"
import type { createSliderController } from "@ui-sdk/core/slider"

import { minutesPerDay, type SolarDay } from "@/components/ui/sun-arc-solar"
import { settled, unavailable } from "@/lib/action-refusal"

type SunArcSlider = Pick<ReturnType<typeof createSliderController<number>>, "getValue" | "setValue">

type SunArcOptions = {
  slider?: SunArcSlider
  disabled?: boolean
  day?: SolarDay
}

type Call = { action: string; event: Event | undefined }

const clockPattern = /^(\d{1,2}):(\d{2})$/

function minutesOf(time: unknown) {
  if (typeof time === "number") return Number.isFinite(time) ? time : undefined
  if (typeof time !== "string") return undefined
  const match = clockPattern.exec(time.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined
}

function ready(options: SunArcOptions, { action, event }: Call) {
  if (options.disabled) return unavailable(action, "isn't available while the picker is disabled", { event })
  if (!options.slider) return unavailable(action, "isn't available: the arc isn't ready", { event })
  return options.slider
}

function toMinutes(slider: SunArcSlider, minutes: number, { action, event }: Call) {
  if (slider.getValue() === minutes) return true
  return settled(slider.setValue(minutes, { reason: "imperative", event }), action, { event })
}

const polarReason = (day: SolarDay) =>
  day.kind === "polar-day"
    ? "the sun doesn't set on this day here (polar day)"
    : "the sun doesn't rise on this day here (polar night)"

function toEvent(options: SunArcOptions, which: "sunrise" | "sunset", call: Call) {
  const slider = ready(options, call)
  if (slider === false) return false
  const at = options.day?.[which]
  if (!options.day || at === undefined) {
    return unavailable(
      call.action,
      `isn't available: ${options.day ? polarReason(options.day) : "the day isn't known"}`,
      {
        event: call.event,
      },
    )
  }
  return toMinutes(slider, Math.round(at), call)
}

/** A time-of-day picker's agent surface: the arc is UI SDK's slider in minutes since local midnight. */
const sunArc = definePrimitive({
  name: "sun-arc",
  options: { slider: "value", disabled: "value", day: "value" },
  // Workaround: not `disabled`: the bridge would hide every action from a disabled part without saying why.
  state: (options: SunArcOptions) => ({ inert: Boolean(options.disabled) }),
  sync: (options) => ({ inert: Boolean(options.disabled) }),
  api: (context) => ({
    /** Moves the sun to a local time: minutes since midnight (0 to 1439) or `"HH:MM"` on a 24-hour clock. */
    setTime(time: number | string, event?: Event) {
      const call = { action: "setTime", event }
      const slider = ready(context.options(), call)
      if (slider === false) return false
      const minutes = minutesOf(time)
      if (minutes === undefined || minutes < 0 || minutes >= minutesPerDay) {
        return unavailable(
          "setTime",
          `takes minutes from 0 to 1439 or "HH:MM" on a 24-hour clock, not ${JSON.stringify(time)}`,
          { event },
        )
      }
      return toMinutes(slider, Math.round(minutes), call)
    },
    /** Moves the sun to sunrise; fails in a polar day or night, which has none. */
    sunrise(event?: Event) {
      return toEvent(context.options(), "sunrise", { action: "sunrise", event })
    },
    /** Moves the sun to sunset; fails in a polar day or night, which has none. */
    sunset(event?: Event) {
      return toEvent(context.options(), "sunset", { action: "sunset", event })
    },
    /** Moves the sun to solar noon, its highest point of the day. */
    solarNoon(event?: Event) {
      const call = { action: "solarNoon", event }
      const options = context.options()
      const slider = ready(options, call)
      if (slider === false) return false
      if (!options.day) return unavailable("solarNoon", "isn't available: the day isn't known", { event })
      return toMinutes(slider, Math.round(options.day.noon), call)
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-disabled": state.inert ? "" : undefined }),
    }),
  }),
  agent: { actions: ["setTime", "sunrise", "sunset", "solarNoon"] },
})

export { minutesOf, sunArc }
export type { SunArcOptions, SunArcSlider }
