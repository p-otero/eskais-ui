import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"

type SecretListItem = { value: string; label: string }

type SecretListSelectionChangeReason = "press" | "select-all" | "imperative"

/** A secret that can't be selected, with why; `reason` is `null` when the list gives none. */
type SecretListUnselectable = { id: string; reason: string | null }

type SecretListOptions = {
  /** Asks to replace a secret's value, like opening a form with a sensitive Input. */
  onReplace?: (id: string) => unknown
  /** Deletes a secret once the confirmation is accepted; a returned Promise keeps the confirmation pending. */
  onDelete?: (id: string) => unknown
  /** The secrets as agents read them: by id, named. */
  secrets?: readonly SecretListItem[]
  /** The ids of secrets with no stored value, which have nothing to delete. */
  missing?: readonly string[]
  /** Whether each secret has a checkbox, and `select` and `selectAll` run. */
  selectable?: boolean
  unselectable?: readonly SecretListUnselectable[]
  selectedIds?: readonly string[]
  defaultSelectedIds?: readonly string[]
  onSelectedIdsChange?: (ids: string[], details: ChangeDetails<SecretListSelectionChangeReason>) => void
}

type SecretListState = {
  deleting: string | null
  /** The secret the confirmation last asked about; it stays while the confirmation closes, so its text holds. */
  confirming: string | null
  selectedIds: readonly string[]
  /** The names of the selected secrets, for agents. */
  selected: readonly string[]
}

type SelectionCall = { reason?: SecretListSelectionChangeReason; event?: Event }

const unknownId = (action: string, id: unknown, event: Event | undefined) =>
  unavailable(action, `has no secret with the id ${JSON.stringify(id)}`, { event })

const namesOf = (secrets: readonly SecretListItem[] | undefined, ids: readonly string[]) =>
  (secrets ?? []).filter((secret) => ids.includes(secret.value)).map((secret) => secret.label)

const secretList = definePrimitive({
  name: "secret-list",
  options: {
    onReplace: "callback",
    onDelete: "callback",
    secrets: "value",
    missing: "value",
    selectable: "boolean",
    unselectable: "value",
    selectedIds: "list",
    defaultSelectedIds: "list",
    onSelectedIdsChange: "callback",
  },
  state: (options: SecretListOptions): SecretListState => {
    const selectedIds = options.selectedIds ?? options.defaultSelectedIds ?? []
    return { deleting: null, confirming: null, selectedIds, selected: namesOf(options.secrets, selectedIds) }
  },
  sync: (options) =>
    options.selectedIds === undefined
      ? {}
      : { selectedIds: options.selectedIds, selected: namesOf(options.secrets, options.selectedIds) },
  controlled: ["selectedIds", "selected"],
  api: (context) => {
    const change = createChange(context)
    const secrets = () => context.options().secrets ?? []
    const known = (id: unknown): id is string =>
      typeof id === "string" && secrets().some((secret) => secret.value === id)
    let awaitingRender: { shown: readonly string[]; next: readonly string[] } | null = null
    const latestSelection = () => {
      const shown = context.store.get().selectedIds
      return awaitingRender !== null && awaitingRender.shown === shown ? awaitingRender.next : shown
    }
    const unselectableReason = (id: string) => (context.options().unselectable ?? []).find((entry) => entry.id === id)
    const findSecret = (nameOrId: string) => {
      const name = nameOrId.toLocaleLowerCase()
      return (
        secrets().find((secret) => secret.value === nameOrId) ??
        secrets().find((secret) => secret.label.toLocaleLowerCase() === name)
      )
    }
    const commit = (next: string[], action: string, call: SelectionCall) => {
      const current = latestSelection()
      if (next.length === current.length && next.every((id) => current.includes(id))) return true
      const shown = context.store.get().selectedIds
      const details = { reason: call.reason ?? "imperative", event: call.event }
      const changed = change("selectedIds", next, details)
      if (changed !== false) {
        awaitingRender = { shown, next }
        if (context.options().selectedIds === undefined) context.store.set({ selected: namesOf(secrets(), next) })
      }
      return settled(changed, action, details)
    }

    return {
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
        if ((context.options().missing ?? []).includes(id)) {
          return unavailable("delete", `isn't available: ${JSON.stringify(id)} has no stored value`, { event })
        }
        context.store.set({ deleting: id, confirming: id })
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
      /** Selects (`checked`, the default) or deselects a secret by its name, in any case, or its id. */
      select(nameOrId: unknown, checked: unknown = true, call: SelectionCall = {}) {
        if (!context.options().selectable)
          return unavailable("select", "isn't available: the list isn't selectable", call)
        if (typeof checked !== "boolean")
          return unavailable("select", "takes true to select and false to deselect", call)
        const secret = typeof nameOrId === "string" ? findSecret(nameOrId) : undefined
        if (!secret) return unavailable("select", `has no secret named ${JSON.stringify(nameOrId)}`, call)
        const blocked = unselectableReason(secret.value)
        if (blocked) {
          const why = blocked.reason === null ? "" : `: ${blocked.reason}`
          return unavailable("select", `isn't available: ${secret.label} can't be selected${why}`, call)
        }
        const current = latestSelection()
        const next = checked ? [...new Set([...current, secret.value])] : current.filter((id) => id !== secret.value)
        return commit(next, "select", call)
      },
      /** Selects or deselects every secret that can be selected; the others stay as they are. */
      selectAll(checked: unknown = true, call: SelectionCall = {}) {
        if (!context.options().selectable) {
          return unavailable("selectAll", "isn't available: the list isn't selectable", call)
        }
        if (typeof checked !== "boolean") {
          return unavailable("selectAll", "takes true to select and false to deselect", call)
        }
        const selectable = secrets()
          .map((secret) => secret.value)
          .filter((id) => !unselectableReason(id))
        if (selectable.length === 0) return unavailable("selectAll", "isn't available: no secret can be selected", call)
        const current = latestSelection()
        const next = checked
          ? [...new Set([...current, ...selectable])]
          : current.filter((id) => !selectable.includes(id))
        return commit(next, "selectAll", call)
      },
      agentItems() {
        return secrets()
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, SecretListState>({
      state: (state) => ({ ...state }),
      attrs: () => ({ role: "group" }),
    }),
  }),
  agent: { actions: ["replace", "delete", "select", "selectAll"], items: (api) => api.agentItems() },
})

export { secretList }
export type {
  SecretListItem,
  SecretListOptions,
  SecretListSelectionChangeReason,
  SecretListState,
  SecretListUnselectable,
}
