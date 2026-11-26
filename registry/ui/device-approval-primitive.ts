import { announce, definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

type DeviceDecision = "approve" | "deny"

type DeviceApprovalOptions = {
  /** Approves the device; a returned Promise keeps the block pending, and a rejection shows the error. */
  onApprove?: () => unknown
  /** Denies the device, with the same pending and error handling. */
  onDeny?: () => unknown
  /** Runs once, when the request expires. */
  onExpire?: () => void
  /** Why approving waits, like codes that don't match yet; `null` when nothing stops it. */
  approveBlocked?: string | null
  expiredAnnouncement?: string
}

type DeviceApprovalState = {
  /** The decision being sent. */
  pending: DeviceDecision | null
  /** The decision the app accepted. */
  decided: DeviceDecision | null
  error: unknown
  expired: boolean
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof value.then === "function"

const pastTense: Record<DeviceDecision, string> = { approve: "approved", deny: "denied" }

const deviceApproval = definePrimitive({
  name: "device-approval",
  options: {
    onApprove: "callback",
    onDeny: "callback",
    onExpire: "callback",
    approveBlocked: "value",
    expiredAnnouncement: "string",
  },
  controlled: ["pending", "decided", "expired"],
  state: (_options: DeviceApprovalOptions): DeviceApprovalState => ({
    pending: null,
    decided: null,
    error: null,
    expired: false,
  }),
  api: (context) => {
    let destroyed = false
    context.onDestroy(() => {
      destroyed = true
    })

    const decide = (decision: DeviceDecision, event: Event | undefined): Promise<DeviceDecision> | boolean => {
      const call = { event }
      const { pending, decided, expired } = context.store.get()
      if (decided !== null) {
        return unavailable(decision, `isn't available: the device was already ${pastTense[decided]}`, call)
      }
      if (pending !== null) return unavailable(decision, "isn't available while a decision is being sent", call)
      if (expired) return unavailable(decision, "isn't available: the request has expired", call)
      const options = context.options()
      const blocked = decision === "approve" ? options.approveBlocked : null
      if (blocked) return unavailable(decision, `isn't available: ${blocked}`, call)
      const run = decision === "approve" ? options.onApprove : options.onDeny
      if (!run)
        return unavailable(
          decision,
          `isn't available: the block has no on${decision === "approve" ? "Approve" : "Deny"}`,
          call,
        )
      context.store.set({ pending: decision, error: null })
      let result: unknown
      try {
        result = run()
      } catch (error) {
        context.store.set({ pending: null, error })
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
      if (!isThenable(result)) {
        context.store.set({ pending: null, decided: decision })
        return true
      }
      return Promise.resolve(result).then(
        () => {
          if (!destroyed) context.store.set({ pending: null, decided: decision })
          return decision
        },
        (error: unknown) => {
          if (!destroyed) context.store.set({ pending: null, error })
          throw error
        },
      )
    }

    return {
      /** Approves the device through `onApprove`. The Approve button asks an agent's person first. */
      approve(event?: Event) {
        return decide("approve", event)
      },
      /** Denies the device through `onDeny`. */
      deny(event?: Event) {
        return decide("deny", event)
      },
      /** Marks the request expired, once: approving stops, `onExpire` runs and the expiry is announced. */
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
    root: slot<{}, DeviceApprovalState>({
      state: (state) => ({ ...state }),
      attrs: (state) => ({
        role: "group",
        "aria-busy": state.pending === null ? undefined : "true",
        "data-pending": state.pending ?? undefined,
        "data-decided": state.decided ?? undefined,
        "data-expired": state.expired ? "" : undefined,
      }),
    }),
  }),
  agent: { actions: ["deny"] },
})

type DeviceApprovalApproveOptions = {
  /** The block's `approve`, which decides whether it runs. */
  approve?: (event?: Event) => unknown
  /** Disables the person's button; an agent's step still reaches `approve`, which says why it refuses. */
  blocked?: boolean
  pending?: boolean
}

type DeviceApprovalApproveState = { blocked: boolean; pending: boolean }

const deviceApprovalApprove = definePrimitive({
  name: "device-approval-approve",
  options: { approve: "callback", blocked: "boolean", pending: "boolean" },
  state: (options: DeviceApprovalApproveOptions): DeviceApprovalApproveState => ({
    blocked: options.blocked ?? false,
    pending: options.pending ?? false,
  }),
  sync: (options) => ({ blocked: options.blocked ?? false, pending: options.pending ?? false }),
  api: (context) => ({
    /** Approves the device; an agent's step needs a person, through the button's `data-agent-confirm`. */
    approve(event?: Event) {
      const { approve } = context.options()
      if (!approve) return unavailable("approve", "isn't available: the block renders its own actions", { event })
      return approve(event)
    },
  }),
  slots: (slot) => ({
    root: slot<{}, DeviceApprovalApproveState>({
      state: (state) => ({ ...state }),
      attrs: (state) => ({
        role: "group",
        "data-blocked": state.blocked ? "" : undefined,
        "data-pending": state.pending ? "" : undefined,
      }),
    }),
  }),
  agent: { actions: ["approve"] },
})

export { deviceApproval, deviceApprovalApprove }
export type {
  DeviceApprovalApproveOptions,
  DeviceApprovalApproveState,
  DeviceApprovalOptions,
  DeviceApprovalState,
  DeviceDecision,
}
