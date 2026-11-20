import { createStickToBottom, definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

type ConversationOptions = {
  /** Whether it follows new messages from the start. `false` opens a thread where the reader left it. */
  initial?: boolean
  /** How close to the end, in pixels, still counts as at the bottom. */
  threshold?: number
  /** Whether there are older messages to load above. */
  hasOlder?: boolean
  /** Loads older messages; add them above in one update, and resolve once they are in state. */
  onLoadOlder?: () => unknown
}

type ConversationMessageItem = { value: string; label: string }

const MESSAGE = '[data-slot="conversation-message"]'
const LOG = '[data-slot="conversation-log"]'

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
}

function textOf(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? ""
}

/** A message as agents read it: its author, then its text, cut to 200 characters. */
function describeMessage(element: Element, index: number): ConversationMessageItem {
  const author = textOf(element.querySelector('[data-slot="conversation-message-author"]'))
  const content = textOf(element.querySelector('[data-slot="conversation-message-content"]')).slice(0, 200)
  const value = element.getAttribute("data-message-id") ?? String(index)
  return { value, label: author ? `${author}: ${content}` : content }
}

// Counts the messages that arrive after the one that was newest, so older messages loaded above never count.
function countArrivals(log: HTMLElement, onArrive: (count: number) => void) {
  const newestOf = () => {
    const all = log.querySelectorAll(MESSAGE)
    return { all, newest: all.item(all.length - 1) as Element | null }
  }
  let last = newestOf().newest
  const observer = new MutationObserver(() => {
    const { all, newest } = newestOf()
    if (newest === last) return
    const index = last?.isConnected ? [...all].indexOf(last) : -1
    const arrived = last === null ? all.length : index === -1 ? 0 : all.length - 1 - index
    last = newest
    if (arrived > 0) onArrive(arrived)
  })
  observer.observe(log, { childList: true, subtree: true })
  return () => observer.disconnect()
}

const conversation = definePrimitive({
  name: "conversation",
  options: { initial: "boolean", threshold: "number", hasOlder: "boolean", onLoadOlder: "action" },
  state: (options: ConversationOptions) => ({
    following: options.initial ?? true,
    atBottom: options.initial ?? true,
    unseen: false,
    newBelow: 0,
    hasOlder: Boolean(options.hasOlder),
    loadingOlder: false,
  }),
  sync: (options) => ({ hasOlder: Boolean(options.hasOlder) }),
  api: (context) => {
    const { store } = context
    const stick = createStickToBottom({
      initial: context.options().initial ?? true,
      threshold: context.options().threshold ?? 48,
    })
    context.onDestroy(
      stick.subscribe(() => {
        const next = stick.get()
        store.set({ ...next, newBelow: next.following ? 0 : store.get().newBelow })
      }),
    )
    return {
      /** Follows the log's end and counts arrivals while the reader is scrolled up. */
      connect(log: HTMLElement) {
        const disconnect = stick.connect(log)
        const stopCounting = countArrivals(log, (count) => {
          if (!stick.get().following) store.set({ newBelow: store.get().newBelow + count })
        })
        return () => {
          stopCounting()
          disconnect()
        }
      },
      /** Scrolls to the newest message and follows again; smooth unless the reader prefers reduced motion. */
      jumpToLatest() {
        stick.scrollToBottom({ behavior: prefersReducedMotion() ? "auto" : "smooth" })
        store.set({ newBelow: 0 })
        return true
      },
      /** Stops following, as if the reader scrolled up. */
      release() {
        stick.release()
      },
      /** Keeps the view in place while `onLoadOlder` adds messages above. */
      loadOlder(event?: Event) {
        const { hasOlder, loadingOlder } = store.get()
        const load = context.options().onLoadOlder
        if (!load) return unavailable("loadOlder", "isn't offered: there is no onLoadOlder", { event })
        if (!hasOlder) return unavailable("loadOlder", "has nothing older to load", { event })
        if (loadingOlder) return unavailable("loadOlder", "isn't available while older messages load", { event })
        store.set({ loadingOlder: true })
        stick.prepend()
        const settle = () => store.set({ loadingOlder: false })
        return new Promise<unknown>((resolve) => resolve(load())).then(
          () => {
            settle()
            return true
          },
          (error: unknown) => {
            settle()
            throw error
          },
        )
      },
      /** The messages on the page, oldest first, as `{ value, label }`. */
      messages(): ConversationMessageItem[] {
        const log = context.element("log")
        return log ? [...log.querySelectorAll(MESSAGE)].map(describeMessage) : []
      },
    }
  },
  slots: (slot) => ({
    root: slot<
      {},
      { following: boolean; atBottom: boolean; newBelow: number; hasOlder: boolean; loadingOlder: boolean }
    >({
      state: (state) => ({
        following: state.following,
        atBottom: state.atBottom,
        newBelow: state.newBelow,
        hasOlder: state.hasOlder,
        loadingOlder: state.loadingOlder,
      }),
      attrs: (state) => ({
        "data-following": state.following ? "" : undefined,
        "data-unseen": state.unseen ? "" : undefined,
      }),
    }),
    log: slot({
      role: "log",
      // The log scrolls, so it takes focus for keyboard scrolling.
      attrs: () => ({ tabindex: "0" }),
      bind: (el, { api }) => api.connect(el),
    }),
    newBelow: slot<{}, { newBelow: number }>({
      role: "button",
      focus: "native",
      present: (state) => !state.following,
      state: (state) => ({ newBelow: state.newBelow }),
      attrs: (state) => ({ type: "button", "data-count": String(state.newBelow) }),
      press: ({ api, el }) => {
        const hadFocus = el !== undefined && el.ownerDocument.activeElement === el
        api.jumpToLatest()
        // The button leaves once following resumes, so focus moves to the log rather than falling to the page.
        if (hadFocus) {
          const log = el.closest('[data-slot="conversation"]')?.querySelector<HTMLElement>(LOG)
          log?.focus({ preventScroll: true })
        }
      },
    }),
    loadOlder: slot<{}, { loadingOlder: boolean }>({
      role: "button",
      focus: "native",
      present: (state) => state.hasOlder,
      state: (state) => ({ loadingOlder: state.loadingOlder }),
      attrs: (state) => ({
        type: "button",
        "aria-busy": state.loadingOlder ? "true" : undefined,
        "data-pending": state.loadingOlder ? "" : undefined,
      }),
      press: ({ api }, event) => void api.loadOlder(event),
    }),
  }),
  agent: { actions: ["jumpToLatest", "loadOlder"], items: (api) => api.messages() },
})

export { conversation, describeMessage }
export type { ConversationMessageItem, ConversationOptions }
