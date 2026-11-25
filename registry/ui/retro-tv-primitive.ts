import { definePrimitive } from "@ui-sdk/core"
import type { ToggleController } from "@ui-sdk/core/toggle"

import { settled, unavailable } from "@/lib/action-refusal"

type RetroTvSwitch = Pick<ToggleController, "isPressed" | "setPressed">

type RetroTvOptions = {
  power?: RetroTvSwitch
  disabled?: boolean
}

function switchTo(options: RetroTvOptions, on: boolean, action: string, event: Event | undefined) {
  if (options.disabled) return unavailable(action, "isn't available while the set is disabled", { event })
  if (!options.power) return unavailable(action, "isn't available: the power button isn't ready", { event })
  if (options.power.isPressed() === on) return true
  return settled(options.power.setPressed(on, { reason: "imperative", event }), action, { event })
}

/** A retro TV's agent surface: the power button is UI SDK's toggle, pressed while the set is on. */
const retroTv = definePrimitive({
  name: "retro-tv",
  options: { power: "value", disabled: "value" },
  // Workaround: not `disabled`: the bridge would hide every action from a disabled part without saying why.
  state: (options: RetroTvOptions) => ({ inert: Boolean(options.disabled) }),
  sync: (options) => ({ inert: Boolean(options.disabled) }),
  api: (context) => ({
    /** Turns the set on; `true` when it already is. */
    powerOn(event?: Event) {
      return switchTo(context.options(), true, "powerOn", event)
    },
    /** Turns the set off, with the picture collapsing to a dot; `true` when it already is. */
    powerOff(event?: Event) {
      return switchTo(context.options(), false, "powerOff", event)
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-disabled": state.inert ? "" : undefined }),
    }),
  }),
  agent: { actions: ["powerOn", "powerOff"] },
})

export { retroTv }
export type { RetroTvOptions, RetroTvSwitch }
