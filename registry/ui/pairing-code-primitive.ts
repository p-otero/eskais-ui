import { announce, definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

/** How a person checks the code against the one on the other screen. */
type PairingCodeCompare = "confirm" | "enter"

type PairingCodeOptions = {
  /** The code as `copy` writes it, with separators. Kept out of the state, so agents read it only through `code`. */
  copyText?: string
  /** Hides the code from agents: `code` stays out of the state, and `copy` and `confirm` refuse an agent's call. */
  agentHidden?: boolean
  compare?: PairingCodeCompare
  /** Runs after the code reaches the clipboard. */
  onCopy?: (code: string) => void
  /** Runs when a person says whether the codes match, in `confirm` mode. */
  onConfirm?: (matches: boolean) => unknown
  copiedAnnouncement?: string
}

type PairingCodeState = {
  /** The code, with separators; absent while it's hidden from agents. */
  code?: string
  copied: boolean
  /** The answer given in `confirm` mode, or whether the typed code matches in `enter` mode; `null` until then. */
  matches: boolean | null
}

const COPIED_FOR = 2000

const hiddenFromAgents = "the code is hidden from agents, so a person reads and compares it"

const pairingCode = definePrimitive({
  name: "pairing-code",
  options: {
    copyText: "string",
    agentHidden: "boolean",
    compare: "string",
    onCopy: "callback",
    onConfirm: "callback",
    copiedAnnouncement: "string",
  },
  controlled: ["code", "copied", "matches"],
  state: (options: PairingCodeOptions): PairingCodeState => ({
    ...(options.agentHidden ? {} : { code: options.copyText ?? "" }),
    copied: false,
    matches: null,
  }),
  sync: (options) => (options.agentHidden ? { code: undefined } : { code: options.copyText ?? "" }),
  api: (context) => {
    let copiedTimer: ReturnType<typeof setTimeout> | undefined
    context.onDestroy(() => clearTimeout(copiedTimer))
    const hiddenFromThisCall = (event: Event | undefined) => context.options().agentHidden === true && !event

    const api = {
      /** Writes the code, with separators, to the clipboard. Resolves to `"copied"`. */
      copy(event?: Event): Promise<"copied" | false> | false {
        const call = { event }
        if (hiddenFromThisCall(event)) return unavailable("copy", `isn't available: ${hiddenFromAgents}`, call)
        const { copyText } = context.options()
        if (!copyText) return unavailable("copy", "isn't available: there is no code", call)
        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
        if (!clipboard) return unavailable("copy", "isn't available: the page has no clipboard access", call)
        return clipboard.writeText(copyText).then(
          () => {
            clearTimeout(copiedTimer)
            context.store.set({ copied: true })
            copiedTimer = setTimeout(() => context.store.set({ copied: false }), COPIED_FOR)
            const { copiedAnnouncement, onCopy } = context.options()
            if (copiedAnnouncement) announce(copiedAnnouncement)
            onCopy?.(copyText)
            return "copied" as const
          },
          () => unavailable("copy", "was blocked by the browser", call),
        )
      },
      /** Says whether the code matches the one on the other screen, in `confirm` mode: `true` or `false`. */
      confirm(matches: unknown, event?: Event) {
        const call = { event }
        if (context.options().compare !== "confirm") {
          return unavailable("confirm", "isn't available: this code isn't compared by confirmation", call)
        }
        if (hiddenFromThisCall(event)) return unavailable("confirm", `isn't available: ${hiddenFromAgents}`, call)
        if (typeof matches !== "boolean") {
          return unavailable("confirm", "takes true when the codes match and false when they don't", call)
        }
        context.store.set({ matches })
        context.options().onConfirm?.(matches)
        return true
      },
      /** Records whether the typed code matches, in `enter` mode. */
      setMatches(matches: boolean | null) {
        if (context.store.get().matches !== matches) context.store.set({ matches })
      },
    }
    return api
  },
  slots: (slot) => ({
    root: slot<{}, PairingCodeState>({
      state: (state) => ({ ...state }),
      attrs: (state) => ({
        role: "group",
        "data-copied": state.copied ? "" : undefined,
        "data-matches": state.matches === null ? undefined : String(state.matches),
      }),
    }),
  }),
  agent: { actions: ["copy", "confirm"] },
})

export { pairingCode }
export type { PairingCodeCompare, PairingCodeOptions, PairingCodeState }
