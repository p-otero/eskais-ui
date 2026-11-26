import { definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

type SecretListItem = { value: string; label: string }

type SecretListOptions = {
  /** Asks to replace a secret's value, like opening a form with a sensitive Input. */
  onReplace?: (id: string) => unknown
  /** Deletes a secret once the confirmation is accepted; a returned Promise keeps the confirmation pending. */
  onDelete?: (id: string) => unknown
  /** The secrets as agents read them: by id, named. */
  secrets?: readonly SecretListItem[]
}

type SecretListState = { deleting: string | null }

const unknownId = (action: string, id: unknown, event: Event | undefined) =>
  unavailable(action, `has no secret with the id ${JSON.stringify(id)}`, { event })

const secretList = definePrimitive({
  name: "secret-list",
  options: { onReplace: "callback", onDelete: "callback", secrets: "value" },
  state: (_options: SecretListOptions): SecretListState => ({ deleting: null }),
  api: (context) => {
    const known = (id: unknown): id is string =>
      typeof id === "string" && (context.options().secrets ?? []).some((secret) => secret.value === id)

    return {
      /** Runs `onReplace` for the secret. */
      replace(id: unknown, event?: Event) {
        if (!known(id)) return unknownId("replace", id, event)
        const { onReplace } = context.options()
        if (!onReplace) return unavailable("replace", "isn't offered: the list has no onReplace", { event })
        onReplace(id)
        return true
      },
      /** Opens the confirmation for the secret; its confirm button needs a person's approval for an agent. */
      delete(id: unknown, event?: Event) {
        if (!known(id)) return unknownId("delete", id, event)
        if (!context.options().onDelete) {
          return unavailable("delete", "isn't offered: the list has no onDelete", { event })
        }
        context.store.set({ deleting: id })
        return true
      },
      confirmDelete() {
        const id = context.store.get().deleting
        if (id === null) return undefined
        return context.options().onDelete?.(id)
      },
      closeDelete() {
        if (context.store.get().deleting !== null) context.store.set({ deleting: null })
      },
      agentItems() {
        return context.options().secrets ?? []
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, SecretListState>({
      state: (state) => ({ ...state }),
      attrs: () => ({ role: "group" }),
    }),
  }),
  agent: { actions: ["replace", "delete"], items: (api) => api.agentItems() },
})

export { secretList }
export type { SecretListItem, SecretListOptions, SecretListState }
