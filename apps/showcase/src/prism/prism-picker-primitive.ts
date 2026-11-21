import { definePrimitive } from "@ui-sdk/core"
import type { createSliderController } from "@ui-sdk/core/slider"

import { settled, unavailable } from "@/lib/action-refusal"

import { maxWavelength, minWavelength, purpleMixAtHue, wavelengthAtHue } from "./prism-optics"

type PrismSlider = Pick<ReturnType<typeof createSliderController<number>>, "getValue" | "setValue">

/** Dial positions past the red end are the non-spectral purples, from red (701) to violet (`purpleEnd`). */
const purpleSteps = 100
const purpleEnd = maxWavelength + purpleSteps

type PrismPickerOptions = {
  slider?: PrismSlider
  purples?: boolean
}

const toPosition = (slider: PrismSlider, position: number, action: string, event?: Event) => {
  if (slider.getValue() === position) return true
  return settled(slider.setValue(position, { reason: "imperative", event }), action, { event })
}

const prismPicker = definePrimitive({
  name: "prism-picker",
  options: { slider: "value", purples: "value" },
  state: (options: PrismPickerOptions) => ({ purples: Boolean(options.purples) }),
  sync: (options) => ({ purples: Boolean(options.purples) }),
  api: (context) => ({
    setWavelength(nanometres: number, event?: Event) {
      const slider = context.options().slider
      if (!slider) return unavailable("setWavelength", "isn't available: the dial isn't ready", { event })
      if (!Number.isFinite(nanometres) || nanometres < minWavelength || nanometres > maxWavelength) {
        return unavailable(
          "setWavelength",
          `takes ${String(minWavelength)} to ${String(maxWavelength)} nm, not ${String(nanometres)}`,
          { event },
        )
      }
      return toPosition(slider, Math.round(nanometres), "setWavelength", event)
    },
    setHue(degrees: number, event?: Event) {
      const slider = context.options().slider
      if (!slider) return unavailable("setHue", "isn't available: the dial isn't ready", { event })
      if (!Number.isFinite(degrees))
        return unavailable("setHue", `takes a hue in degrees, not ${String(degrees)}`, { event })
      const wavelength = wavelengthAtHue(degrees)
      if (wavelength !== undefined) return toPosition(slider, Math.round(wavelength), "setHue", event)
      const mix = purpleMixAtHue(degrees)
      if (mix === undefined || !context.options().purples) {
        return unavailable(
          "setHue",
          `can't reach ${String(Math.round(degrees))}°: it's a non-spectral purple, and purples are off`,
          { event },
        )
      }
      return toPosition(slider, maxWavelength + Math.max(1, Math.round(mix * purpleSteps)), "setHue", event)
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-purples": state.purples ? "" : undefined }),
    }),
  }),
  agent: { actions: ["setWavelength", "setHue"] },
})

export { prismPicker, purpleEnd, purpleSteps }
export type { PrismPickerOptions, PrismSlider }
