import { announce, definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"
import { toTime, type Instant } from "@/lib/time"

/** What `onCreate` resolves to. `url` is the secret: the panel shows it once and never stores it in state. */
type InvitationLink = { id: string; url: string; expiresAt: Instant }

/** What `create` resolves to: never the URL. */
type InvitationCreated = { id: string; expiresAt: number }

/** The new link as agents and state see it: its id and expiry, never its URL. */
type InvitationLinkState = { id: string; expiresAt: number; expired: boolean }

type InvitationRole = { value: string; label: string }

type InvitationPanelOptions = {
  onCreate?: (request: { role: string | undefined }) => InvitationLink | PromiseLike<InvitationLink>
  /** With invitee fields: submits their form, which validates them and then calls `createWith`. */
  submitFields?: () => void
  /** Moves the role choice to the role `create(role)` asked for, so a person sees what is being created. */
  selectRole?: (role: string) => void
  /** Revokes an invitation, pending or the new link, once the confirmation is accepted. */
  onRevoke?: (id: string) => unknown
  roles?: readonly InvitationRole[]
  /** The role the role choice holds; `create(role)` overrides it. */
  role?: string | null
  /** The pending invitations as agents read them, by id. */
  invitations?: readonly InvitationRole[]
  createdAnnouncement?: string
  copiedAnnouncement?: string
  expiredAnnouncement?: string
}

type InvitationPanelState = {
  link: InvitationLinkState | null
  creating: boolean
  copied: boolean
  error: unknown
  revoking: string | null
}

const COPIED_FOR = 2000

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof value.then === "function"

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0

const invitationPanel = definePrimitive({
  name: "invitation-panel",
  options: {
    onCreate: "callback",
    submitFields: "callback",
    selectRole: "callback",
    onRevoke: "callback",
    roles: "value",
    role: "value",
    invitations: "value",
    createdAnnouncement: "string",
    copiedAnnouncement: "string",
    expiredAnnouncement: "string",
  },
  controlled: ["link", "creating", "copied"],
  state: (_options: InvitationPanelOptions): InvitationPanelState => ({
    link: null,
    creating: false,
    copied: false,
    error: null,
    revoking: null,
  }),
  api: (context) => {
    let heldUrl: string | undefined
    let requestedRole: string | undefined
    let copiedTimer: ReturnType<typeof setTimeout> | undefined
    let destroyed = false
    const forgetLink = () => {
      heldUrl = undefined
      clearTimeout(copiedTimer)
    }
    context.onDestroy(() => {
      destroyed = true
      forgetLink()
    })

    const pickRole = (role: unknown, call: { event?: Event | undefined }) => {
      const { roles, role: chosen } = context.options()
      if (!roles || roles.length === 0) return { role: undefined }
      if (role === undefined || role === null) {
        if (chosen) return { role: chosen }
        return { refusal: unavailable("create", "needs a role", call) }
      }
      const match = roles.find(
        (candidate) => candidate.value === role || (typeof role === "string" && sameName(candidate.label, role)),
      )
      if (match) return { role: match.value }
      const names = roles.map((candidate) => candidate.label).join(", ")
      return { refusal: unavailable("create", `takes one of these roles: ${names}`, call) }
    }

    const startCreating = (
      run: (role: string | undefined) => InvitationLink | PromiseLike<InvitationLink>,
      role: string | undefined,
    ): Promise<InvitationCreated> => {
      forgetLink()
      context.store.set({ creating: true, error: null, copied: false, link: null })
      let request: InvitationLink | PromiseLike<InvitationLink>
      try {
        request = run(role)
      } catch (error) {
        context.store.set({ creating: false, error })
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
      return Promise.resolve(request).then(
        (link) => {
          const expiresAt = toTime(link.expiresAt)
          if (destroyed) return { id: link.id, expiresAt }
          heldUrl = link.url
          context.store.set({
            creating: false,
            link: { id: link.id, expiresAt, expired: expiresAt <= Date.now() },
          })
          const { createdAnnouncement } = context.options()
          if (createdAnnouncement) announce(createdAnnouncement)
          return { id: link.id, expiresAt }
        },
        (error: unknown) => {
          if (!destroyed) context.store.set({ creating: false, error })
          throw error
        },
      )
    }

    const api = {
      /**
       * Asks `onCreate` for a new one-time link, with `role` (a role's value or label) or the role choice's. Resolves
       * to `{ id, expiresAt }`; the URL only ever reaches the screen, once, and the clipboard through `copy`. With
       * invitee fields it submits their form instead and returns `true`: the link appears once they pass the schema,
       * and otherwise their errors show on the fields.
       */
      create(role?: unknown, event?: Event): Promise<InvitationCreated> | boolean {
        const call = { event }
        if (context.store.get().creating) {
          return unavailable("create", "isn't available while an invitation is being created", call)
        }
        const picked = pickRole(role, call)
        if ("refusal" in picked) return false
        const { onCreate, submitFields, selectRole } = context.options()
        if (!onCreate) return unavailable("create", "isn't available: the panel has no onCreate", call)
        if (!submitFields) return startCreating((chosen) => onCreate({ role: chosen }), picked.role)
        requestedRole = picked.role
        if (picked.role !== undefined) selectRole?.(picked.role)
        submitFields()
        return true
      },
      /** Creates from the invitee fields' form once they pass its schema: `run` calls `onCreate` with their values. */
      createWith(
        run: (role: string | undefined) => InvitationLink | PromiseLike<InvitationLink>,
      ): Promise<InvitationCreated> {
        const role = requestedRole
        requestedRole = undefined
        if (context.store.get().creating) {
          return Promise.reject(new Error("create isn't available while an invitation is being created."))
        }
        const picked = pickRole(role, {})
        if ("refusal" in picked) return Promise.reject(new Error("create needs a role."))
        return startCreating(run, picked.role)
      },
      /** Writes the new link to the clipboard. Resolves to `"copied"`, never to the link. */
      copy(event?: Event): Promise<"copied" | false> | false {
        const call = { event }
        const { link } = context.store.get()
        if (!link || heldUrl === undefined) {
          return unavailable(
            "copy",
            "isn't available: no new link is held, and a link shows only once. Create a new one",
            call,
          )
        }
        if (link.expired || link.expiresAt <= Date.now()) {
          api.expire()
          return unavailable("copy", "isn't available: the link has expired. Create a new one", call)
        }
        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
        if (!clipboard) return unavailable("copy", "isn't available: the page has no clipboard access", call)
        return clipboard.writeText(heldUrl).then(
          () => {
            clearTimeout(copiedTimer)
            context.store.set({ copied: true })
            copiedTimer = setTimeout(() => context.store.set({ copied: false }), COPIED_FOR)
            const { copiedAnnouncement } = context.options()
            if (copiedAnnouncement) announce(copiedAnnouncement)
            return "copied" as const
          },
          () => unavailable("copy", "was blocked by the browser", call),
        )
      },
      /**
       * Asks to revoke an invitation by id, pending or the new link: it opens the confirmation, whose confirm button
       * needs a person's approval for an agent.
       */
      revoke(id: unknown, event?: Event) {
        const call = { event }
        const { link } = context.store.get()
        const known =
          typeof id === "string" &&
          (link?.id === id || (context.options().invitations ?? []).some((invitation) => invitation.value === id))
        if (!known) return unavailable("revoke", `has no invitation with the id ${JSON.stringify(id)}`, call)
        context.store.set({ revoking: id })
        return true
      },
      /** Runs `onRevoke` for the invitation being confirmed; a revoked new link is forgotten. */
      confirmRevoke() {
        const id = context.store.get().revoking
        if (id === null) return undefined
        const forgetIfNew = () => {
          if (context.store.get().link?.id !== id) return
          forgetLink()
          context.store.set({ link: null, copied: false })
        }
        const result = context.options().onRevoke?.(id)
        if (isThenable(result)) return Promise.resolve(result).then(forgetIfNew)
        forgetIfNew()
        return undefined
      },
      closeRevoke() {
        if (context.store.get().revoking !== null) context.store.set({ revoking: null })
      },
      /** Drops the new link and its URL. */
      dismiss() {
        forgetLink()
        if (context.store.get().link !== null) context.store.set({ link: null, copied: false })
        return true
      },
      /** Marks the new link expired and drops its URL. */
      expire() {
        const { link } = context.store.get()
        forgetLink()
        if (!link || link.expired) return
        context.store.set({ link: { ...link, expired: true }, copied: false })
        const { expiredAnnouncement } = context.options()
        if (expiredAnnouncement) announce(expiredAnnouncement)
      },
      agentItems() {
        return context.options().invitations ?? []
      },
      /** The new link's URL, for the one place that shows it; never put it in state, attributes or announcements. */
      linkUrl() {
        return heldUrl
      },
    }
    return api
  },
  slots: (slot) => ({
    root: slot<{}, InvitationPanelState>({
      state: (state) => ({ ...state }),
      attrs: (state) => ({
        role: "group",
        "aria-busy": state.creating ? "true" : undefined,
        "data-creating": state.creating ? "" : undefined,
        "data-has-link": state.link && !state.link.expired ? "" : undefined,
      }),
    }),
  }),
  agent: {
    actions: ["create", "copy", "revoke", "dismiss"],
    items: (api) => api.agentItems(),
  },
})

export { invitationPanel }
export type {
  InvitationCreated,
  InvitationLink,
  InvitationLinkState,
  InvitationPanelOptions,
  InvitationPanelState,
  InvitationRole,
}
