import { definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

type ConnectedAccountStatus = "connected" | "pending" | "expired" | "disconnected"

type ConnectedAccountAction = "connect" | "reconnect" | "disconnect" | "cancel"

type ConnectedAccountOptions = {
  status?: ConnectedAccountStatus
  /** Starts linking the account; a returned Promise keeps Connect pending, and a rejection shows the error. */
  onConnect?: () => unknown
  /** Signs in again, with the same pending and error handling. */
  onReconnect?: () => unknown
  /** Unlinks the account once the confirmation is accepted; a returned Promise keeps the confirmation pending. */
  onDisconnect?: () => unknown
  /** Abandons a pending link, with the same pending and error handling as Connect. */
  onCancel?: () => unknown
  /** Offers Reconnect while connected too, not only once the sign-in has expired. */
  reconnectWhenConnected?: boolean
}

type ConnectedAccountState = {
  status: ConnectedAccountStatus
  /** The action being sent. */
  pending: ConnectedAccountAction | null
  /** The action whose callback failed, with `error`. */
  failed: ConnectedAccountAction | null
  error: unknown
  confirmingDisconnect: boolean
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof value.then === "function"

const offeredIn: Record<
  ConnectedAccountAction,
  (status: ConnectedAccountStatus, options: ConnectedAccountOptions) => boolean
> = {
  connect: (status) => status === "disconnected",
  reconnect: (status, options) =>
    status === "expired" || (status === "connected" && options.reconnectWhenConnected === true),
  disconnect: (status) => status === "connected" || status === "expired",
  cancel: (status) => status === "pending",
}

const callbackName: Record<ConnectedAccountAction, string> = {
  connect: "onConnect",
  reconnect: "onReconnect",
  disconnect: "onDisconnect",
  cancel: "onCancel",
}

const statusPhrase: Record<ConnectedAccountStatus, string> = {
  connected: "the account is connected",
  pending: "a sign-in is waiting for approval on the provider",
  expired: "the sign-in has expired",
  disconnected: "the account isn't connected",
}

const callbackFor = (action: ConnectedAccountAction, options: ConnectedAccountOptions) => {
  if (action === "connect") return options.onConnect
  if (action === "reconnect") return options.onReconnect
  if (action === "disconnect") return options.onDisconnect
  return options.onCancel
}

const connectedAccount = definePrimitive({
  name: "connected-account",
  options: {
    status: "string",
    onConnect: "callback",
    onReconnect: "callback",
    onDisconnect: "callback",
    onCancel: "callback",
    reconnectWhenConnected: "boolean",
  },
  controlled: ["status", "pending", "confirmingDisconnect"],
  state: (options: ConnectedAccountOptions): ConnectedAccountState => ({
    status: options.status ?? "disconnected",
    pending: null,
    failed: null,
    error: null,
    confirmingDisconnect: false,
  }),
  sync: (options) => ({ status: options.status ?? "disconnected" }),
  api: (context) => {
    let destroyed = false
    context.onDestroy(() => {
      destroyed = true
    })

    const refusal = (action: ConnectedAccountAction, event: Event | undefined) => {
      const call = { event }
      const options = context.options()
      const { status, pending } = context.store.get()
      if (pending !== null) return unavailable(action, `isn't available while ${pending} is running`, call)
      if (!offeredIn[action](status, options))
        return unavailable(action, `isn't available: ${statusPhrase[status]}`, call)
      if (!callbackFor(action, options)) {
        return unavailable(action, `isn't available: the panel has no ${callbackName[action]}`, call)
      }
      return null
    }

    const run = (action: ConnectedAccountAction): Promise<ConnectedAccountAction> | true => {
      const callback = callbackFor(action, context.options())
      context.store.set({ pending: action, failed: null, error: null })
      const fail = (error: unknown) => {
        if (!destroyed) context.store.set({ pending: null, failed: action, error })
      }
      let result: unknown
      try {
        result = callback?.()
      } catch (error) {
        fail(error)
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
      if (!isThenable(result)) {
        context.store.set({ pending: null })
        return true
      }
      return Promise.resolve(result).then(
        () => {
          if (!destroyed) context.store.set({ pending: null })
          return action
        },
        (error: unknown) => {
          fail(error)
          throw error
        },
      )
    }

    const start = (action: ConnectedAccountAction, event: Event | undefined) => refusal(action, event) ?? run(action)

    return {
      /** Starts linking a disconnected account through `onConnect`. */
      connect(event?: Event) {
        return start("connect", event)
      },
      /** Signs in again through `onReconnect`, once the sign-in has expired (or while connected, when offered). */
      reconnect(event?: Event) {
        return start("reconnect", event)
      },
      /** Opens the confirmation; its confirm button needs a person's approval for an agent. */
      disconnect(event?: Event) {
        const refused = refusal("disconnect", event)
        if (refused !== null) return refused
        context.store.set({ confirmingDisconnect: true, failed: null, error: null })
        return true
      },
      /** Abandons a pending sign-in through `onCancel`. */
      cancel(event?: Event) {
        return start("cancel", event)
      },
      /** Runs `onDisconnect` from the confirmation, which shows its pending state and its error. */
      confirmDisconnect() {
        const { onDisconnect } = context.options()
        context.store.set({ pending: "disconnect" })
        const settle = () => {
          if (!destroyed) context.store.set({ pending: null })
        }
        let result: unknown
        try {
          result = onDisconnect?.()
        } catch (error) {
          settle()
          throw error
        }
        if (!isThenable(result)) {
          settle()
          return result
        }
        return Promise.resolve(result).then(settle, (error: unknown) => {
          settle()
          throw error
        })
      },
      closeDisconnect() {
        if (context.store.get().confirmingDisconnect) context.store.set({ confirmingDisconnect: false })
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, ConnectedAccountState>({
      state: (state) => ({ ...state }),
      attrs: (state) => ({
        role: "group",
        "aria-busy": state.pending === null ? undefined : "true",
        "data-status": state.status,
        "data-pending": state.pending ?? undefined,
      }),
    }),
  }),
  agent: { actions: ["connect", "reconnect", "disconnect", "cancel"] },
})

export { connectedAccount }
export type { ConnectedAccountAction, ConnectedAccountOptions, ConnectedAccountState, ConnectedAccountStatus }
