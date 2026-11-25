import { definePrimitive } from "@ui-sdk/core"
import type { ToggleController } from "@ui-sdk/core/toggle"

import { settled, unavailable } from "@/lib/action-refusal"

type EjectorCover = Pick<ToggleController, "isPressed" | "setPressed">

type EjectorButtonOptions = {
  /** The hinged cover, UI SDK's toggle: pressed while it's open and the button armed. */
  cover?: EjectorCover
  disabled?: boolean
  pending?: boolean
}

type EjectorCall = { action: string; event: Event | undefined }

function coverTo(options: EjectorButtonOptions, open: boolean, { action, event }: EjectorCall) {
  if (options.disabled) return unavailable(action, "isn't available while the ejector is disabled", { event })
  if (options.pending) return unavailable(action, "isn't available while the eject runs", { event })
  if (!options.cover) return unavailable(action, "isn't available: the cover isn't ready", { event })
  if (options.cover.isPressed() === open) return true
  return settled(options.cover.setPressed(open, { reason: "imperative", event }), action, { event })
}

/** An ejector's agent surface: `arm` opens the hinged cover over the button, `disarm` closes it. */
const ejectorButton = definePrimitive({
  name: "ejector-button",
  options: { cover: "value", disabled: "value", pending: "value" },
  // Workaround: not `disabled`: the bridge would hide every action from a disabled part without saying why.
  state: (options: EjectorButtonOptions) => ({ inert: Boolean(options.disabled) }),
  sync: (options) => ({ inert: Boolean(options.disabled) }),
  api: (context) => ({
    /** Opens the cover, so the button can be pressed; `true` when it's already open. */
    arm(event?: Event) {
      return coverTo(context.options(), true, { action: "arm", event })
    },
    /** Closes the cover over the button; `true` when it's already closed. */
    disarm(event?: Event) {
      return coverTo(context.options(), false, { action: "disarm", event })
    },
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-disabled": state.inert ? "" : undefined }),
    }),
  }),
  agent: { actions: ["arm", "disarm"] },
})

/** What started an eject: a press on the button, or a call (an agent's step, app code). */
type EjectReason = "press" | "imperative"

type EjectorReleaseOptions = {
  armed?: boolean
  pending?: boolean
  disabled?: boolean
  /** Runs the destructive action once the button is pressed while armed. */
  onEject?: (details: { reason: EjectReason; event?: Event }) => unknown
}

/** The red button under the cover: it ejects only while the cover is open. */
const ejectorRelease = definePrimitive({
  name: "ejector-release",
  options: { armed: "boolean", pending: "boolean", disabled: "boolean", onEject: "action" },
  state: (options: EjectorReleaseOptions) => ({
    armed: options.armed ?? false,
    pending: options.pending ?? false,
    inert: options.disabled ?? false,
  }),
  sync: (options) => ({
    armed: options.armed ?? false,
    pending: options.pending ?? false,
    inert: options.disabled ?? false,
  }),
  api: (context) => ({
    /** Runs `onEject` when the cover is open; fails with why when it's closed, disabled or already running. */
    eject(event?: Event, reason: EjectReason = "imperative") {
      const { armed, pending, inert } = context.store.get()
      const call = { reason, event }
      if (inert) return unavailable("eject", "isn't available while the ejector is disabled", call)
      if (pending) return unavailable("eject", "isn't available while the eject runs", call)
      if (!armed) return unavailable("eject", "isn't available while the cover is closed: arm it first", call)
      context.options().onEject?.(call)
      return true
    },
  }),
  slots: (slot) => ({
    root: slot<{}, { armed: boolean; pending: boolean }>({
      role: "button",
      focus: "native",
      press: ({ api }, event) => api.eject(event, "press"),
      state: (state) => ({ armed: state.armed, pending: state.pending }),
      attrs: (state) => ({
        type: "button",
        tabindex: state.armed ? undefined : "-1",
        "aria-busy": state.pending ? "true" : undefined,
        "data-armed": state.armed ? "" : undefined,
        "data-pending": state.pending ? "" : undefined,
        "data-disabled": state.inert ? "" : undefined,
      }),
    }),
  }),
  agent: { actions: ["eject"] },
})

export { ejectorButton, ejectorRelease }
export type { EjectReason, EjectorButtonOptions, EjectorCover, EjectorReleaseOptions }
