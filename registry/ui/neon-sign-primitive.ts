import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

import { settled } from "@/lib/action-refusal"

type NeonSignOptions = {
  on?: boolean
  defaultOn?: boolean
  /** Asks to switch the sign on or off: an agent's `turnOn` and `turnOff`, or your code. `details.cancel()` refuses it. */
  onOnChange?: (on: boolean, details: ChangeDetails<"imperative">) => void
}

const neonSign = definePrimitive({
  name: "neon-sign",
  options: { on: "boolean", defaultOn: "boolean", onOnChange: "callback" },
  controlled: ["on"],
  state: (options: NeonSignOptions) => ({ on: options.on ?? options.defaultOn ?? true }),
  sync: (options) => (options.on === undefined ? {} : { on: options.on }),
  api: (context) => {
    const change = createChange(context)
    const power = (on: boolean, action: string, event?: Event) => {
      if (context.store.get().on === on) return true
      return settled(change("on", on, { reason: "imperative", event }), action, { event })
    }
    return {
      /** Lights the tubes, with the flicker of a neon striking. */
      turnOn: (event?: Event) => power(true, "turnOn", event),
      /** Switches the tubes off. */
      turnOff: (event?: Event) => power(false, "turnOff", event),
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "status",
      attrs: (state) => ({ "data-state": state.on ? "on" : "off" }),
    }),
  }),
  agent: { actions: ["turnOn", "turnOff"] },
})

export { neonSign }
export type { NeonSignOptions }
