import { definePrimitive } from "@ui-sdk/core"
import type { createSliderController } from "@ui-sdk/core/slider"

import { maxWavelength, minWavelength, wavelengthAtHue } from "@/components/ui/prism-picker-optics"
import { settled, unavailable } from "@/lib/action-refusal"

type PrismSlider = Pick<ReturnType<typeof createSliderController<number>>, "getValue" | "setValue">

type PrismPickerOptions = {
  slider?: PrismSlider
  disabled?: boolean
}

type Call = { action: string; event: Event | undefined }

const toWavelength = (slider: PrismSlider, wavelength: number, { action, event }: Call) => {
  if (slider.getValue() === wavelength) return true
  return settled(slider.setValue(wavelength, { reason: "imperative", event }), action, { event })
}

function ready(options: PrismPickerOptions, { action, event }: Call) {
  if (options.disabled) return unavailable(action, "isn't available while the picker is disabled", { event })
  if (!options.slider) return unavailable(action, "isn't available: the dial isn't ready", { event })
  return options.slider
}

/** A prism hue picker's agent surface: the dial is UI SDK's slider, in nanometres; these name a colour by its light. */
const prismPicker = definePrimitive({
  name: "prism-picker",
  options: { slider: "value", disabled: "value" },
  // Not `disabled`: the bridge would hide every action from a disabled part without saying why.
  state: (options: PrismPickerOptions) => ({ inert: Boolean(options.disabled) }),
  sync: (options) => ({ inert: Boolean(options.disabled) }),
  api: (context) => ({
    /** Turns the prism until `nanometres` (380 to 700) leaves through the slit. */
    setWavelength(nanometres: number, event?: Event) {
      const call = { action: "setWavelength", event }
      const slider = ready(context.options(), call)
      if (slider === false) return false
      if (!Number.isFinite(nanometres) || nanometres < minWavelength || nanometres > maxWavelength) {
        return unavailable(
          "setWavelength",
          `takes ${String(minWavelength)} to ${String(maxWavelength)} nm, the visible spectrum, not ${String(nanometres)}`,
          { event },
        )
      }
      return toWavelength(slider, Math.round(nanometres), call)
    },
    /** Turns the prism to the wavelength whose colour has this OKLCH hue, in degrees. */
    setHue(degrees: number, event?: Event) {
      const call = { action: "setHue", event }
      const slider = ready(context.options(), call)
      if (slider === false) return false
      if (!Number.isFinite(degrees))
        return unavailable("setHue", `takes a hue in degrees, not ${String(degrees)}`, { event })
      const wavelength = wavelengthAtHue(degrees)
      if (wavelength === undefined) {
        return unavailable(
          "setHue",
          `can't reach ${String(Math.round(degrees))}°: magentas and purples mix both ends of the spectrum, so no single wavelength shows them`,
          { event },
        )
      }
      return toWavelength(slider, Math.round(wavelength), call)
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-disabled": state.inert ? "" : undefined }),
    }),
  }),
  agent: { actions: ["setWavelength", "setHue"] },
})

export { prismPicker }
export type { PrismPickerOptions, PrismSlider }
