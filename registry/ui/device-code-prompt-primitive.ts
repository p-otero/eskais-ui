import { announce, definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

type DeviceCodePromptOptions = {
  /** The page where the person enters the code. Kept out of the state while `agentHidden`. */
  verificationUri?: string
  /** The same page with the code filled in; `open` prefers it. */
  verificationUriComplete?: string
  /** Hides the link from agents: it stays out of the state, and `open` and `copyLink` refuse an agent's call. */
  agentHidden?: boolean
  /** Runs after the provider's page opened in a new tab, with the address it opened. */
  onOpen?: (uri: string) => void
  /** Runs after the link reached the clipboard. */
  onCopyLink?: (uri: string) => void
  /** Runs once, when the code expires. */
  onExpire?: () => void
  linkCopiedAnnouncement?: string
  expiredAnnouncement?: string
}

type DeviceCodePromptState = {
  /** The verification page; absent while it's hidden from agents. */
  verificationUri?: string
  linkCopied: boolean
  expired: boolean
}

const COPIED_FOR_MS = 2000

const hiddenFromAgents = "the code and its link are hidden from agents, so a person opens them"

const visibleUri = (options: DeviceCodePromptOptions) =>
  options.agentHidden ? undefined : (options.verificationUri ?? "")

const deviceCodePrompt = definePrimitive({
  name: "device-code-prompt",
  options: {
    verificationUri: "string",
    verificationUriComplete: "string",
    agentHidden: "boolean",
    onOpen: "callback",
    onCopyLink: "callback",
    onExpire: "callback",
    linkCopiedAnnouncement: "string",
    expiredAnnouncement: "string",
  },
  controlled: ["verificationUri", "linkCopied", "expired"],
  state: (options: DeviceCodePromptOptions): DeviceCodePromptState => {
    const verificationUri = visibleUri(options)
    return { ...(verificationUri === undefined ? {} : { verificationUri }), linkCopied: false, expired: false }
  },
  sync: (options) => ({ verificationUri: visibleUri(options) }),
  api: (context) => {
    let copiedTimer: ReturnType<typeof setTimeout> | undefined
    context.onDestroy(() => clearTimeout(copiedTimer))
    const hiddenFromThisCall = (event: Event | undefined) => context.options().agentHidden === true && !event

    const refusal = (action: string, event: Event | undefined) => {
      const call = { event }
      if (hiddenFromThisCall(event)) return unavailable(action, `isn't available: ${hiddenFromAgents}`, call)
      if (context.store.get().expired) return unavailable(action, "isn't available: the code has expired", call)
      if (!context.options().verificationUri) return unavailable(action, "isn't available: there is no link", call)
      return null
    }

    return {
      /** Opens the provider's page in a new tab, with the code filled in when `verificationUriComplete` is set. */
      open(event?: Event) {
        const refused = refusal("open", event)
        if (refused !== null) return refused
        const options = context.options()
        const uri = options.verificationUriComplete ?? options.verificationUri ?? ""
        if (typeof window === "undefined") return unavailable("open", "isn't available outside a browser", { event })
        window.open(uri, "_blank", "noopener,noreferrer")
        options.onOpen?.(uri)
        return true
      },
      /** Writes the verification page's address to the clipboard. Resolves to `"copied"`. */
      copyLink(event?: Event): Promise<"copied" | false> | false {
        const refused = refusal("copyLink", event)
        if (refused !== null) return refused
        const uri = context.options().verificationUri ?? ""
        const call = { event }
        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
        if (!clipboard) return unavailable("copyLink", "isn't available: the page has no clipboard access", call)
        return clipboard.writeText(uri).then(
          () => {
            clearTimeout(copiedTimer)
            context.store.set({ linkCopied: true })
            copiedTimer = setTimeout(() => context.store.set({ linkCopied: false }), COPIED_FOR_MS)
            const { linkCopiedAnnouncement, onCopyLink } = context.options()
            if (linkCopiedAnnouncement) announce(linkCopiedAnnouncement)
            onCopyLink?.(uri)
            return "copied" as const
          },
          () => unavailable("copyLink", "was blocked by the browser", call),
        )
      },
      /** Marks the code expired, once: opening stops, `onExpire` runs and the expiry is announced. */
      expire() {
        if (context.store.get().expired) return
        context.store.set({ expired: true })
        const { onExpire, expiredAnnouncement } = context.options()
        if (expiredAnnouncement) announce(expiredAnnouncement)
        onExpire?.()
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, DeviceCodePromptState>({
      state: (state) => ({ ...state }),
      attrs: (state) => ({
        role: "group",
        "data-expired": state.expired ? "" : undefined,
        "data-link-copied": state.linkCopied ? "" : undefined,
      }),
    }),
  }),
  agent: { actions: ["open", "copyLink"] },
})

export { deviceCodePrompt }
export type { DeviceCodePromptOptions, DeviceCodePromptState }
