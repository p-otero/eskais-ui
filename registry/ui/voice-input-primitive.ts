import { announce, createChange, definePrimitive, type ChangeDetails, type ChangeSource } from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"

/** Where a voice input is: the microphone is off, being asked for, heard, the words are being worked on, or it failed. */
type VoiceInputState = "idle" | "requesting" | "listening" | "processing" | "error" | "denied"

/**
 * Why the state should change: the Dictate toggle (`trigger-press`), the cancel button (`close-press`), Escape, or a
 * call from an agent or your code (`imperative`).
 */
type VoiceInputStateChangeReason = "trigger-press" | "close-press" | "escape-key" | "imperative"

type VoiceInputStateDetails = ChangeDetails<VoiceInputStateChangeReason>

type VoiceInputOptions = {
  state?: VoiceInputState
  defaultState?: VoiceInputState
  /**
   * Asks for the next state: `requesting` to start, `processing` to finish and keep what was said, `idle` to discard.
   * The voice input never changes it itself while `state` is passed; `details.cancel()` refuses it.
   */
  onStateChange?: (state: VoiceInputState, details: VoiceInputStateDetails) => void
  /** Read politely when the state becomes each one; a state without text says nothing. */
  announcements?: Partial<Record<VoiceInputState, string>>
  disabled?: boolean
}

const startable = new Set<VoiceInputState>(["idle", "error", "denied"])
const cancelable = new Set<VoiceInputState>(["requesting", "listening", "processing"])

const voiceInput = definePrimitive({
  name: "voice-input",
  options: {
    state: "string",
    defaultState: "string",
    onStateChange: "callback",
    announcements: "value",
    disabled: "boolean",
  },
  controlled: ["state"],
  state: (options: VoiceInputOptions) => ({
    state: options.state ?? options.defaultState ?? "idle",
    disabled: options.disabled ?? false,
  }),
  sync: (options) => ({
    ...(options.state === undefined ? {} : { state: options.state }),
    disabled: options.disabled ?? false,
  }),
  api: (context) => {
    const change = createChange(context)
    let previous = context.store.get().state
    const unsubscribe = context.store.subscribe(() => {
      const { state } = context.store.get()
      if (state === previous) return
      previous = state
      const text = context.options().announcements?.[state]
      if (text) announce(text)
    })
    context.onDestroy(unsubscribe)

    // Workaround: a UI SDK Toggle reports its press without the event; its own details say who pressed it.
    let pressedBy: ChangeSource | undefined
    const request = (action: string, next: VoiceInputState, reason: VoiceInputStateChangeReason, event?: Event) =>
      settled(change("state", next, { reason, event, ...(pressedBy ? { source: pressedBy } : {}) }), action, {
        reason,
        event,
      })
    const refuse = (action: string, reason: VoiceInputStateChangeReason, event?: Event) => {
      const { state, disabled } = context.store.get()
      return unavailable(action, `isn't available while ${disabled ? "disabled" : state}`, { reason, event })
    }

    const api = {
      /** Asks to start listening: `requesting`. From idle, after an error or after a denial (to try again). */
      start(event?: Event, reason: VoiceInputStateChangeReason = "imperative") {
        const { state, disabled } = context.store.get()
        if (disabled || !startable.has(state)) return refuse("start", reason, event)
        return request("start", "requesting", reason, event)
      },
      /** Asks to stop listening and keep what was said: `processing`. */
      confirm(event?: Event, reason: VoiceInputStateChangeReason = "imperative") {
        if (context.store.get().state !== "listening") return refuse("confirm", reason, event)
        return request("confirm", "processing", reason, event)
      },
      /** Asks to stop and discard: `idle`. While asking for the microphone, listening or processing. */
      cancel(event?: Event, reason: VoiceInputStateChangeReason = "imperative") {
        if (!cancelable.has(context.store.get().state)) return refuse("cancel", reason, event)
        const root = context.element("root")
        const focused = root?.contains(root.ownerDocument.activeElement) === true
        if (!request("cancel", "idle", reason, event)) return false
        if (focused) root?.querySelector<HTMLElement>("[data-voice-input-toggle]")?.focus()
        return true
      },
      /** What the Dictate toggle does: start, finish while listening, or give up waiting for the microphone. */
      toggle(event?: Event, source?: ChangeSource) {
        const { state } = context.store.get()
        pressedBy = source
        try {
          if (state === "listening") return api.confirm(event, "trigger-press")
          if (state === "requesting") return api.cancel(event, "trigger-press")
          return api.start(event, "trigger-press")
        } finally {
          pressedBy = undefined
        }
      },
    }
    return api
  },
  slots: (slot) => ({
    root: slot<{}, { state: VoiceInputState; active: boolean; disabled: boolean }>({
      role: "group",
      state: (state) => ({
        state: state.state,
        active: state.state === "requesting" || state.state === "listening" || state.state === "processing",
        disabled: state.disabled,
      }),
      attrs: (state) => ({
        "data-state": state.state,
        "aria-busy": state.state === "requesting" || state.state === "processing" ? "true" : undefined,
        "data-disabled": state.disabled ? "" : undefined,
      }),
      on: {
        keydown: (event, { api, store }) => {
          const keyboard = event as KeyboardEvent
          const { state } = store.get()
          if (keyboard.key !== "Escape" || (state !== "listening" && state !== "requesting")) return
          keyboard.preventDefault()
          keyboard.stopPropagation()
          api.cancel(keyboard, "escape-key")
        },
      },
    }),
  }),
  agent: { actions: ["start", "confirm", "cancel"] },
})

export { voiceInput }
export type { VoiceInputOptions, VoiceInputState, VoiceInputStateChangeReason, VoiceInputStateDetails }
