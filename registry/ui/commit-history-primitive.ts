import {
  createChange,
  createController,
  definePrimitive,
  dispatch,
  type ChangeDetails,
  type ChangeOptions,
} from "@ui-sdk/core"

type CommitHistoryChangeReason = "item-press" | "trigger-press" | "list-navigation" | "imperative"

type CommitLookupEntry = { id: string; hash: string; subject: string; merge: boolean }

/** How the primitive finds commits without holding a copy of a long history. */
type CommitLookup = {
  /** A commit by id, hash (or a prefix of 4 or more characters) or exact subject. */
  find: (ref: string) => CommitLookupEntry | undefined
  /** Every commit as agents list them: the id and the row's accessible name. Built on demand. */
  entries: () => readonly { value: string; label: string }[]
  /** The branches beside the base, as `listBranches` gives them. */
  branches?: () => readonly CommitBranchSummary[]
}

/** A branch as agents read it: where its head is and how far it is from the base. */
type CommitBranchSummary = {
  name: string
  head: string
  ahead: number
  behind: number
  updatedAt: string | undefined
  state: "base" | "active" | "merged" | "stale"
}

type CommitHistoryOptions = {
  lookup?: CommitLookup
  /** Open merges, by id. */
  expanded?: readonly string[]
  defaultExpanded?: readonly string[]
  onExpandedChange?: (expanded: string[], details: ChangeDetails<CommitHistoryChangeReason>) => void
  /** Commits whose details show under their row. */
  details?: readonly string[]
  defaultDetails?: readonly string[]
  onDetailsChange?: (open: string[], details: ChangeDetails<CommitHistoryChangeReason>) => void
  /** `"single"` (default) closes the open details when others open. */
  detailsMode?: "single" | "multiple"
  branch?: string
  branches?: readonly string[]
  onBranchChange?: (branch: string, details: ChangeDetails<CommitHistoryChangeReason>) => void
  onOpenCommit?: (id: string, details: ChangeDetails<CommitHistoryChangeReason>) => void
  onCopyHash?: (hash: string, details: ChangeDetails<"copy"> & { id: string }) => void
  /** The branch in focus in the branches view: its head scrolled to and focused, and filtered to with `filterBranch`. */
  focusedBranch?: string | null
  onFocusedBranchChange?: (branch: string | null, details: ChangeDetails<CommitHistoryChangeReason>) => void
  controller?: CommitHistoryController
}

interface CommitHistoryController {
  expand: (ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) => boolean | undefined
  collapse: (ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) => boolean | undefined
  expandDetails: (ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) => boolean | undefined
  collapseDetails: (ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) => boolean | undefined
  openCommit: (ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) => boolean | undefined
  selectBranch: (name: string, options?: ChangeOptions<CommitHistoryChangeReason>) => boolean | undefined
  focusBranch: (name: string | null, options?: ChangeOptions<CommitHistoryChangeReason>) => boolean | undefined
}

const COPIED_FOR = 2000

function reasonOf(options: unknown): { reason: CommitHistoryChangeReason; event?: Event } {
  if (typeof options !== "object" || options === null) return { reason: "imperative" }
  const { reason = "imperative", event } = options as ChangeOptions<CommitHistoryChangeReason>
  return { reason, event: event instanceof Event ? event : undefined }
}

const list = (value: readonly string[] | undefined) => (value ? [...value] : undefined)

const commitHistory = definePrimitive({
  name: "commit-history",
  options: {
    lookup: "value",
    expanded: "list",
    defaultExpanded: "list",
    onExpandedChange: "callback",
    details: "list",
    defaultDetails: "list",
    onDetailsChange: "callback",
    detailsMode: "string",
    branch: "string",
    branches: "list",
    onBranchChange: "callback",
    onOpenCommit: "callback",
    onCopyHash: "callback",
    focusedBranch: "value",
    onFocusedBranchChange: "callback",
    controller: "value",
  },
  state: (options: CommitHistoryOptions) => ({
    expanded: list(options.expanded ?? options.defaultExpanded) ?? [],
    details: list(options.details ?? options.defaultDetails) ?? [],
    branch: options.branch ?? null,
    focusedBranch: options.focusedBranch ?? null,
    copied: null as string | null,
  }),
  sync: (options) => ({
    ...(options.expanded === undefined ? {} : { expanded: [...options.expanded] }),
    ...(options.details === undefined ? {} : { details: [...options.details] }),
    ...(options.branch === undefined ? {} : { branch: options.branch }),
    ...(options.focusedBranch === undefined ? {} : { focusedBranch: options.focusedBranch }),
  }),
  controlled: ["expanded", "details", "branch", "focusedBranch"],
  api: (context) => {
    const change = createChange(context)
    let timer: ReturnType<typeof setTimeout> | undefined
    context.onDestroy(() => clearTimeout(timer))

    // The agent bridge passes arguments unchecked.
    const find = (ref: unknown) => {
      const entry = typeof ref === "string" ? context.options().lookup?.find(ref) : undefined
      if (!entry) throw new RangeError(`No commit "${String(ref)}". Pass a commit's id, hash or subject.`)
      return entry
    }
    const findMerge = (ref: unknown, action: string) => {
      const entry = find(ref)
      if (!entry.merge) throw new RangeError(`"${entry.subject}" has no merged commits to ${action}.`)
      return entry
    }
    const setExpanded = (next: string[], options?: unknown) => change("expanded", next, reasonOf(options))
    const setDetails = (next: string[], options?: unknown) => change("details", next, reasonOf(options))

    const api = {
      setExpanded(expanded: readonly string[], options?: ChangeOptions<CommitHistoryChangeReason>) {
        return setExpanded([...expanded], options)
      },
      expand(ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { id } = findMerge(ref, "expand")
        const { expanded } = context.store.get()
        return expanded.includes(id) ? true : setExpanded([...expanded, id], options)
      },
      collapse(ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { id } = findMerge(ref, "collapse")
        const { expanded } = context.store.get()
        return expanded.includes(id)
          ? setExpanded(
              expanded.filter((open) => open !== id),
              options,
            )
          : true
      },
      expandDetails(ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { id } = find(ref)
        const { details } = context.store.get()
        if (details.includes(id)) return true
        return setDetails(context.options().detailsMode === "multiple" ? [...details, id] : [id], options)
      },
      collapseDetails(ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { id } = find(ref)
        const { details } = context.store.get()
        return details.includes(id)
          ? setDetails(
              details.filter((open) => open !== id),
              options,
            )
          : true
      },
      toggleDetails(ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { id } = find(ref)
        return context.store.get().details.includes(id)
          ? api.collapseDetails(id, options)
          : api.expandDetails(id, options)
      },
      toggle(ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { id } = findMerge(ref, "expand")
        return context.store.get().expanded.includes(id) ? api.collapse(id, options) : api.expand(id, options)
      },
      openCommit(ref: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { id } = find(ref)
        if (!context.options().onOpenCommit) throw new Error("This history doesn't open commits; use expandDetails.")
        return !dispatch(context, "onOpenCommit", id, reasonOf(options))
      },
      /** Copies the commit's hash where the page has clipboard access, and returns it either way. */
      async copyHash(ref: string, event?: Event) {
        const { id, hash } = find(ref)
        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
        let copied = false
        if (clipboard) {
          try {
            await clipboard.writeText(hash)
            copied = true
          } catch {
            copied = false
          }
        }
        if (copied) {
          clearTimeout(timer)
          context.store.set({ copied: id })
          timer = setTimeout(() => context.store.set({ copied: null }), COPIED_FOR)
          dispatch(context, "onCopyHash", hash, { reason: "copy", event, id })
        }
        return hash
      },
      selectBranch(name: string, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const { branches = [], onBranchChange } = context.options()
        if (!onBranchChange) throw new Error("This history shows one branch.")
        if (typeof name !== "string" || !branches.includes(name)) {
          throw new RangeError(`No branch "${String(name)}". Branches: ${branches.join(", ")}.`)
        }
        return change("branch", name, reasonOf(options))
      },
      /** Scrolls to a branch's head and focuses it, in the branches view; `null` lets go of it. */
      focusBranch(name: string | null, options?: ChangeOptions<CommitHistoryChangeReason>) {
        const branches = context.options().lookup?.branches?.() ?? []
        if (name !== null && !branches.some((branch) => branch.name === name)) {
          const names = branches.map((branch) => branch.name).join(", ") || "none"
          throw new RangeError(`No branch "${String(name)}" in the overview. Branches: ${names}.`)
        }
        return change("focusedBranch", name, reasonOf(options))
      },
      /** The branches beside the base with their heads and how far ahead and behind they are. Reads only. */
      listBranches() {
        return [...(context.options().lookup?.branches?.() ?? [])]
      },
      commits: () => context.options().lookup?.entries() ?? [],
    }
    return api
  },
  slots: (slot) => ({
    root: slot({
      role: "region",
      attrs: (state) => ({
        "data-details-open": state.details.length > 0 ? "" : undefined,
        "data-branch": state.branch ?? undefined,
      }),
    }),
  }),
  agent: {
    actions: [
      "expandDetails",
      "collapseDetails",
      "expand",
      "collapse",
      "copyHash",
      "openCommit",
      "selectBranch",
      "focusBranch",
      "listBranches",
    ],
    items: (api) => api.commits(),
  },
})

function createCommitHistoryController() {
  return createController<CommitHistoryController>()
}

export { commitHistory, createCommitHistoryController }
export type {
  CommitBranchSummary,
  CommitHistoryChangeReason,
  CommitHistoryController,
  CommitHistoryOptions,
  CommitLookup,
  CommitLookupEntry,
}
