import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"
import { isStringArray } from "@/lib/narrow"

/** Why the messages or the pause changed: the pause toggle (`trigger-press`), or an agent or your code (`imperative`). */
type LedMatrixChangeReason = "trigger-press" | "imperative"

type LedMatrixOptions = {
  messages?: readonly string[]
  defaultMessages?: readonly string[]
  /** Asks to show other messages; `details.cancel()` keeps the ones shown. */
  onMessagesChange?: (messages: string[], details: ChangeDetails<LedMatrixChangeReason>) => void
  paused?: boolean
  defaultPaused?: boolean
  /** Asks to stop or go on: the pause toggle, an agent's `pause` and `resume`. `details.cancel()` refuses it. */
  onPausedChange?: (paused: boolean, details: ChangeDetails<LedMatrixChangeReason>) => void
  /** `polite` reads each new message to screen readers as it comes up; `off` (the default) leaves it to be found. */
  live?: "off" | "polite"
}

type Call = { reason?: LedMatrixChangeReason; event?: Event | undefined }

function messagesOf(value: unknown): string[] | undefined {
  const list = typeof value === "string" ? [value] : value
  if (!isStringArray(list)) return undefined
  const messages = list.map((message) => message.trim()).filter(Boolean)
  return messages.length ? messages : undefined
}

const sameMessages = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((message, index) => message === b[index])

const ledMatrix = definePrimitive({
  name: "led-matrix",
  options: {
    messages: "list",
    defaultMessages: "list",
    onMessagesChange: "callback",
    paused: "boolean",
    defaultPaused: "boolean",
    onPausedChange: "callback",
    live: "string",
  },
  controlled: ["messages", "paused"],
  state: (options: LedMatrixOptions) => ({
    messages: [...(options.messages ?? options.defaultMessages ?? [])],
    paused: options.paused ?? options.defaultPaused ?? false,
    live: options.live ?? "off",
  }),
  sync: (options) => ({
    ...(options.messages === undefined ? {} : { messages: [...options.messages] }),
    ...(options.paused === undefined ? {} : { paused: options.paused }),
    live: options.live ?? "off",
  }),
  api: (context) => {
    const change = createChange(context)
    const setPaused = (paused: boolean, action: string, { reason = "imperative", event }: Call = {}) => {
      if (context.store.get().paused === paused) return true
      return settled(change("paused", paused, { reason, event }), action, { reason, event })
    }
    return {
      /** Shows these messages from the first, in turn; a single string is one message. */
      setMessages(messages: unknown, event?: Event) {
        const next = messagesOf(messages)
        if (!next) return unavailable("setMessages", "takes a list of messages with text", { event })
        if (sameMessages(next, context.store.get().messages)) return true
        return settled(change("messages", next, { reason: "imperative", event }), "setMessages", { event })
      },
      /** Stops the sign where it is. */
      pause: (call?: Call) => setPaused(true, "pause", call),
      /** Goes on from where the sign stopped. */
      resume: (call?: Call) => setPaused(false, "resume", call),
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "marquee",
      attrs: (state) => ({
        "aria-live": state.live,
        "data-paused": state.paused ? "" : undefined,
      }),
    }),
  }),
  agent: { actions: ["setMessages", "pause", "resume"] },
})

export { ledMatrix }
export type { LedMatrixChangeReason, LedMatrixOptions }
