import { announce, createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

/** Why the button armed or disarmed. */
type ConfirmButtonArmedChangeReason =
  | "trigger-press"
  | "timeout"
  | "escape-key"
  | "focus-out"
  | "confirm"
  | "imperative"

/** What confirmed: a second press, a hold, or a call (an agent, a controller). */
type ConfirmButtonConfirmReason = "trigger-press" | "hold" | "imperative"

type ConfirmButtonOptions = {
  armed?: boolean
  defaultArmed?: boolean
  onArmedChange?: (armed: boolean, details: ChangeDetails<ConfirmButtonArmedChangeReason>) => void
  /** Runs the action. Return a Promise to mark the button pending until it settles. */
  onConfirm?: (details: { reason: ConfirmButtonConfirmReason; event?: Event }) => unknown
  /** How long the button stays armed, in milliseconds; 0 keeps it armed until it confirms or disarms otherwise. */
  timeout?: number
  /** Holding a pointer, Enter or Space this long confirms, in milliseconds. A second press always works too. */
  hold?: number
  disabled?: boolean
  /** Read politely once the button arms, so a screen reader hears that the next press confirms. */
  armedAnnouncement?: string
}

const defaultTimeout = 4000

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function"
}

const confirmButton = definePrimitive({
  name: "confirm-button",
  options: {
    armed: "boolean",
    defaultArmed: "boolean",
    onArmedChange: "callback",
    onConfirm: "action",
    timeout: "number",
    hold: "number",
    disabled: "boolean",
    armedAnnouncement: "string",
  },
  controlled: ["armed"],
  state: (options: ConfirmButtonOptions) => ({
    armed: options.armed ?? options.defaultArmed ?? false,
    pending: false,
    holding: false,
    disabled: options.disabled ?? false,
  }),
  sync: (options) => ({
    ...(options.armed === undefined ? {} : { armed: options.armed }),
    disabled: options.disabled ?? false,
  }),
  api: (context) => {
    const change = createChange(context)
    let disarmTimer: ReturnType<typeof setTimeout> | undefined
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    // A hold confirms while the pointer or key is still down; the click its release fires must not arm again.
    let swallowPress = false

    const stopHold = () => {
      clearTimeout(holdTimer)
      holdTimer = undefined
      if (context.store.get().holding) context.store.set({ holding: false })
    }
    context.onDestroy(() => {
      clearTimeout(disarmTimer)
      clearTimeout(holdTimer)
    })

    const blocked = () => {
      const state = context.store.get()
      return state.disabled || state.pending
    }

    const api = {
      arm(event?: Event) {
        if (blocked() || context.store.get().armed) return false
        if (!change("armed", true, { reason: "trigger-press", event })) return false
        const { timeout = defaultTimeout, armedAnnouncement } = context.options()
        clearTimeout(disarmTimer)
        if (timeout > 0) disarmTimer = setTimeout(() => api.disarm("timeout"), timeout)
        if (armedAnnouncement) announce(armedAnnouncement)
        return true
      },
      disarm(reason: ConfirmButtonArmedChangeReason = "imperative", event?: Event) {
        clearTimeout(disarmTimer)
        if (!context.store.get().armed) return false
        return change("armed", false, { reason, event })
      },
      /** Runs `onConfirm` at once, armed or not. Agents call it, and it waits for the person through `allow`. */
      confirm(event?: Event, reason: ConfirmButtonConfirmReason = "imperative") {
        if (blocked()) return false
        stopHold()
        api.disarm("confirm", event)
        const result = context.options().onConfirm?.({ reason, event })
        if (isThenable(result)) {
          context.store.set({ pending: true })
          const settle = () => context.store.set({ pending: false })
          result.then(settle, settle)
        }
        return true
      },
      /** The first press arms, the second confirms. */
      press(event?: Event) {
        if (swallowPress) {
          swallowPress = false
          return false
        }
        return context.store.get().armed ? api.confirm(event, "trigger-press") : api.arm(event)
      },
      startHold(event?: Event) {
        swallowPress = false
        const { hold } = context.options()
        if (!hold || blocked() || holdTimer !== undefined) return false
        context.store.set({ holding: true })
        holdTimer = setTimeout(() => {
          holdTimer = undefined
          swallowPress = true
          api.confirm(event, "hold")
        }, hold)
        return true
      },
      endHold() {
        stopHold()
        // The click a release fires runs in the same task; anything later is a press of its own.
        if (swallowPress)
          setTimeout(() => {
            swallowPress = false
          }, 0)
      },
    }
    return api
  },
  slots: (slot) => ({
    root: slot<{}, { armed: boolean; pending: boolean; holding: boolean }>({
      role: "button",
      focus: "native",
      press: ({ api }, event) => api.press(event),
      state: (state) => ({ armed: state.armed, pending: state.pending, holding: state.holding }),
      attrs: (state) => ({
        type: "button",
        disabled: state.disabled ? "" : undefined,
        "aria-busy": state.pending ? "true" : undefined,
        "data-armed": state.armed ? "" : undefined,
        "data-holding": state.holding ? "" : undefined,
        "data-pending": state.pending ? "" : undefined,
        "data-disabled": state.disabled ? "" : undefined,
      }),
      on: {
        keydown: (event, { api, store }) => {
          const keyboard = event as KeyboardEvent
          if (keyboard.key === "Escape" && store.get().armed) {
            // Only while armed, so Escape still closes a dialog around an idle button.
            keyboard.preventDefault()
            keyboard.stopPropagation()
            api.disarm("escape-key", keyboard)
          } else if ((keyboard.key === "Enter" || keyboard.key === " ") && !keyboard.repeat) {
            api.startHold(keyboard)
          }
        },
        keyup: (_event, { api }) => api.endHold(),
        pointerdown: (event, { api }) => {
          if ((event as PointerEvent).button === 0) api.startHold(event)
        },
        pointerup: (_event, { api }) => api.endHold(),
        pointerleave: (_event, { api }) => api.endHold(),
        pointercancel: (_event, { api }) => api.endHold(),
        focusout: (event, { api }) => {
          api.endHold()
          api.disarm("focus-out", event)
        },
      },
    }),
  }),
  agent: { actions: ["confirm"] },
})

export { confirmButton }
export type { ConfirmButtonArmedChangeReason, ConfirmButtonConfirmReason, ConfirmButtonOptions }
