import {
  capPageSize,
  capPageSizes,
  pageRange,
  pageStatusLabels,
  resolveNavigation,
  totalOf,
  type Navigation,
  type NavigationMode,
  type PageRequest,
  type PageResult,
  type PageSource,
  type PageStatusLabels,
  type SortSpec,
} from "@/lib/page-source"

/** The shape of `url-state`'s adapters; any object with these three methods works. */
type UrlAdapterLike = {
  read(): URLSearchParams
  write(params: URLSearchParams, options: { replace: boolean }): void
  subscribe(callback: () => void): () => void
}

type UrlStateLike<F> = { filter: F; sort: readonly SortSpec[]; page: number; size: number; cursor?: string | null }

/** The shape of `filter-schema`'s `createUrlCodec`. */
type PageCodecLike<F> = {
  decode(params: URLSearchParams): UrlStateLike<F>
  merge(current: URLSearchParams, state: UrlStateLike<F>): URLSearchParams
  owns(name: string): boolean
}

type UrlHistory = "replace" | "push" | "push-page"

type PageControllerOptions<F> = {
  filter?: F
  sort?: readonly SortSpec[]
  /** `"multi"` lets `toggleSort(field, { additive: true })` (Shift+click) add a field. Default `"single"`. */
  sortMode?: "single" | "multi"
  pageSize?: number
  pageSizes?: readonly number[]
  navigation?: NavigationMode
  /** The filter key a search box edits; `setSearch` commits to it after `debounce` ms (250). */
  search?: { key: keyof F & string; debounce?: number }
  /** Keeps the state in the URL. `history: "replace"` (default), `"push"`, or `"push-page"` (push on paging only). */
  url?: { adapter: UrlAdapterLike; codec: PageCodecLike<F>; history?: UrlHistory }
  labels?: Partial<PageStatusLabels>
}

type PageControllerState<F> = {
  filter: F
  sort: readonly SortSpec[]
  size: number
  page: number
  cursor: string | null
  direction: "forward" | "backward"
  /** How many cursor pages lie before this one, for "Showing 41–60". */
  cursorIndex: number
  /** The search box's text, ahead of the debounced filter. */
  searchText: string
  request: PageRequest<F>
}

type PageController<F> = {
  getState(): PageControllerState<F>
  subscribe(listener: () => void): () => void
  readonly pageSizes: readonly number[]
  setFilter(next: F | ((previous: F) => F)): void
  setFilterValue<Key extends keyof F>(key: Key, value: F[Key] | undefined): void
  resetFilters(): void
  setSearch(text: string, options?: { immediate?: boolean }): void
  flushSearch(): void
  setSort(sort: readonly SortSpec[]): void
  toggleSort(field: string, options?: { additive?: boolean; direction?: SortSpec["direction"] }): void
  setPageSize(size: number): void
  setPage(page: number): void
  /** The next page; a cursor source needs the current result for its `nextCursor`. */
  next(result?: PageResult<unknown>): void
  previous(result?: PageResult<unknown>): void
  navigation(result?: PageResult<unknown>, counted?: number): Navigation
  /** "Showing 21–40 of 312" for the live region; `undefined` before the first result. */
  statusText(result: PageResult<unknown> | undefined, counted?: number): string | undefined
  /** Starts following the URL. Returns the cleanup; call it from an effect. */
  connect(): () => void
  /** Drops a pending search commit. */
  dispose(): void
}

function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

function requestOf<F>(state: Omit<PageControllerState<F>, "request">, cursorMode: boolean): PageRequest<F> {
  return {
    filter: state.filter,
    sort: state.sort,
    size: state.size,
    position: cursorMode ? { cursor: state.cursor, direction: state.direction } : { page: state.page },
  }
}

/**
 * The state of one paged view, outside React: filter, sort, size and position, as a `PageRequest`. A new filter,
 * sort or size goes back to the first page; search is debounced; the URL follows when `url` is set.
 */
function createPageController<T, F>(
  source: PageSource<T, F>,
  options: PageControllerOptions<F> = {},
): PageController<F> {
  const { capabilities } = source
  const cursorMode = capabilities.position === "cursor"
  const labels = { ...pageStatusLabels, ...options.labels }
  const pageSizes = capPageSizes(options.pageSizes ?? [10, 25, 50, 100], capabilities)
  const initialFilter = options.filter ?? ({} as F)
  const searchKey = options.search?.key
  const debounce = options.search?.debounce ?? 250
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const searchTextOf = (filter: F) => {
    const value = searchKey === undefined ? undefined : filter[searchKey]
    return typeof value === "string" ? value : ""
  }

  const fromUrl = () => {
    const url = options.url
    if (!url) return undefined
    const params = url.adapter.read()
    if (![...params.keys()].some((key) => url.codec.owns(key))) return undefined
    return url.codec.decode(params)
  }

  const build = (next: Omit<PageControllerState<F>, "request">): PageControllerState<F> => ({
    ...next,
    request: requestOf(next, cursorMode),
  })

  const initialUrl = fromUrl()
  let state = build({
    filter: initialUrl?.filter ?? initialFilter,
    sort: initialUrl?.sort ?? options.sort ?? [],
    size: capPageSize(initialUrl?.size ?? options.pageSize ?? 25, capabilities),
    page: initialUrl?.page ?? 1,
    cursor: initialUrl?.cursor ?? null,
    direction: "forward",
    cursorIndex: 0,
    searchText: searchTextOf(initialUrl?.filter ?? initialFilter),
  })

  const writeUrl = (previous: PageControllerState<F>) => {
    const url = options.url
    if (!url) return
    const current = url.adapter.read()
    const next = url.codec.merge(current, state)
    if (next.toString() === current.toString()) return
    const history = url.history ?? "replace"
    // Only a move to another page of the same results pushes under "push-page"; a new filter resets it in place.
    const paged =
      (previous.page !== state.page || previous.cursor !== state.cursor) &&
      same([previous.filter, previous.sort, previous.size], [state.filter, state.sort, state.size])
    url.adapter.write(next, { replace: history === "replace" || (history === "push-page" && !paged) })
  }

  const set = (patch: Partial<Omit<PageControllerState<F>, "request">>, { url = true } = {}) => {
    const previous = state
    const next = build({ ...state, ...patch })
    if (same(requestOf(next, cursorMode), previous.request) && next.searchText === previous.searchText) return
    state = next
    if (url) writeUrl(previous)
    for (const listener of listeners) listener()
  }

  const firstPage = { page: 1, cursor: null, direction: "forward" as const, cursorIndex: 0 }

  const setFilter = (next: F | ((previous: F) => F)) => {
    const filter = typeof next === "function" ? (next as (previous: F) => F)(state.filter) : next
    if (same(filter, state.filter)) return
    clearTimeout(timer)
    set({ filter, searchText: searchTextOf(filter), ...firstPage })
  }

  const commitSearch = (text: string) => {
    if (searchKey === undefined) return
    const value = text.trim() === "" ? undefined : text
    if (same(state.filter[searchKey], value)) return
    const filter = { ...state.filter }
    if (value === undefined) delete filter[searchKey]
    else filter[searchKey] = value as F[typeof searchKey]
    set({ filter, ...firstPage })
  }

  const controller: PageController<F> = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    pageSizes,
    setFilter,
    setFilterValue(key, value) {
      setFilter((previous) => {
        const next = { ...previous }
        if (value === undefined) delete next[key]
        else next[key] = value
        return next
      })
    },
    resetFilters: () => setFilter(initialFilter),
    setSearch(text, { immediate = false } = {}) {
      if (searchKey === undefined) throw new TypeError("setSearch needs the `search` option.")
      clearTimeout(timer)
      set({ searchText: text }, { url: false })
      if (immediate || debounce <= 0) commitSearch(text)
      else timer = setTimeout(() => commitSearch(text), debounce)
    },
    flushSearch() {
      clearTimeout(timer)
      commitSearch(state.searchText)
    },
    setSort(sort) {
      if (same(sort, state.sort)) return
      set({ sort: [...sort], ...firstPage })
    },
    toggleSort(field, { additive = false, direction } = {}) {
      const current = state.sort.find((spec) => spec.field === field)
      const flipped = direction ?? (current?.direction === "asc" ? "desc" : "asc")
      if (options.sortMode === "multi" && additive) {
        const sort = current
          ? state.sort.map((spec) => (spec.field === field ? { field, direction: flipped } : spec))
          : [...state.sort, { field, direction: direction ?? "asc" }]
        return controller.setSort(sort)
      }
      const only = state.sort.length === 1 && current
      controller.setSort([{ field, direction: direction ?? (only ? flipped : "asc") }])
    },
    setPageSize(size) {
      const capped = capPageSize(size, capabilities)
      if (capped === state.size) return
      set({ size: capped, ...firstPage })
    },
    setPage(page) {
      const whole = Math.max(1, Math.trunc(page))
      if (!cursorMode) set({ page: whole })
      else if (whole === 1) set(firstPage)
    },
    next(result) {
      if (!cursorMode) return set({ page: state.page + 1 })
      const cursor = result?.nextCursor ?? null
      if (cursor === null) return
      set({ cursor, direction: "forward", cursorIndex: state.cursorIndex + 1 })
    },
    previous(result) {
      if (!cursorMode) return set({ page: Math.max(1, state.page - 1) })
      const cursor = result?.prevCursor ?? null
      if (state.cursorIndex <= 1 || cursor === null) return set(firstPage)
      set({ cursor, direction: "backward", cursorIndex: state.cursorIndex - 1 })
    },
    navigation: (result, counted) => resolveNavigation(capabilities, options.navigation, totalOf(result, counted)),
    statusText(result, counted) {
      if (!result) return undefined
      if (result.items.length === 0) return labels.empty
      const offset = cursorMode ? state.cursorIndex * state.size : (state.page - 1) * state.size
      const range = pageRange(offset, result.items.length, totalOf(result, counted))
      return range ? labels.range(range) : labels.empty
    },
    connect() {
      const url = options.url
      if (!url) return () => {}
      const apply = () => {
        const decoded = fromUrl() ?? { filter: initialFilter, sort: options.sort ?? [], page: 1, size: state.size }
        clearTimeout(timer)
        set(
          {
            filter: decoded.filter,
            sort: decoded.sort,
            size: capPageSize(decoded.size, capabilities),
            page: decoded.page,
            cursor: decoded.cursor ?? null,
            searchText: searchTextOf(decoded.filter),
          },
          { url: false },
        )
      }
      apply()
      return url.adapter.subscribe(apply)
    },
    dispose() {
      clearTimeout(timer)
    },
  }
  return controller
}

export { createPageController }
export type { PageCodecLike, PageController, PageControllerOptions, PageControllerState, UrlAdapterLike, UrlHistory }
