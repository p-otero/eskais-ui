# Links, keyboard and long lists

Part of the `eskais-ui` skill.

## Fast links

`Link`, `ButtonLink`, `NavigationMenuLink` and a `CommandItem` with `href` follow a same-origin link on a primary mouse **press** (`pointerdown`), not on release, with `@fast-link/core`. Breadcrumb, Sidebar items, DocsPager, SiteHeader, SiteFooter, MobileNav and MarkdownView links get it through them (DocsToc too, but its in-page anchors stay native). `FastLinkRegion` (or `useFastLink()`, a ref) does the same for plain anchors in prose or rendered HTML.

- Keyboard, touch, pen, modified, middle and right presses, `target="_blank"`, `download`, external and cross-origin links and in-page anchors (`#section`) stay native, and so does a press that starts on a nested button or input.
- **Hash routers.** An `href` that starts with `#/` is a hash route and follows on press too: through `onFollow`, or by setting `location.hash`. Any other `#…` is an in-page anchor. Another router's prefix goes in `data-fast-link-hash-prefix` on any ancestor (`<body data-fast-link-hash-prefix="#!/">`) or `FastLinkRegion hashPrefix`; an empty value (`hashPrefix={false}`) makes every `#…` href an anchor.
- Navigation goes through `onFollow` when it's set (a router), and through `location.assign` otherwise. A `render`ed router link or a link with its own `onClick` acts on the click, so without `onFollow` it stays native rather than navigate twice; pass `onFollow` to route on press.
- Opt out per link with `fast={false}`, per region with `data-no-fast-link` on any ancestor, or for the whole app with `<body data-no-fast-link>`.
- **Navigation only.** A press can't be cancelled by moving the pointer away (WCAG 2.5.2 Pointer Cancellation); that's acceptable for navigation, which Back undoes, and never for an action. Buttons, menu items, `DialogTrigger`s and links that confirm, submit or change something stay on click: give such a link `fast={false}`. A site that must conform to WCAG 2.5.2 strictly sets `data-no-fast-link` on `<body>`.

## Keyboard and long lists

- **Shortcuts.** `useShortcut` registers in UI SDK's shared `shortcuts` (reuse UI SDK's own `shortcut` props on triggers; `useShortcut` is for the rest). Plain keys never fire while typing in an input, textarea or contenteditable, nor during IME composition; a modal pauses page shortcuts. A space makes a sequence (`g i`). A symbol or digit (`?`, `/`, `1`) matches the character typed, whatever Shift, AltGr or Option the layout needed; letters keep exact modifiers. Give each a `description` so `ShortcutsDialog` lists it; `extra` adds rows for keys that aren't registered, like a list's j/k. `formatShortcutSteps(keys)` formats them.
- **Scopes.** `<ShortcutScope name label>` is active while focus is inside (`active="focus"`), or while mounted (`active`), like an open panel. Shortcuts inside take its scope; `scope: null` makes one global.
- **People only.** Shortcuts add nothing for agents: they press the same buttons and menu items by name. Hints are `aria-hidden` `Kbd`; controls get `aria-keyshortcuts` (single steps only). A `Button` with an `aria-label` and a visible hint fails axe's label-content-name-mismatch: put the hint beside it, as `SidePanel` does, or `shortcutHint={false}`.
- **Collections.** `List` (link or button rows), the AgentTaskBoard table and backlog, and `DataTable` give rows one tab stop through `row-navigation` (UI SDK roving focus, no role added): ↓/j and ↑/k move, Home/End and PageUp/PageDown jump, Enter opens (the row's link or button, or `DataTable onRowOpen`), Space or x toggle selection where there is one (`List checkedIds`, `DataTable selectable`). The row moved to scrolls in with the least scrolling. A selectable `List` is a UI SDK Listbox, which moves itself; j/k and the page keys map onto its arrows.
- **Virtualization.** `virtual-rows` (TanStack Virtual) renders rows in document flow between `aria-hidden` gaps, so `ul > li` and `tbody > tr` stay valid; list rows carry `aria-setsize`/`aria-posinset`, table rows `aria-rowindex` under `aria-rowcount`. It scrolls with the nearest scrolling ancestor, else the window: give the list a bounded height (`min-h-0 flex-1 overflow-y-auto` parent, or `className="max-h-96"` on a DataTable). The focused row stays rendered, agents' `select`/`setSelection` take ids that aren't rendered, and the text of unrendered rows sits in `hidden="until-found"` stubs so find in page reaches them. A row list whose children are all elements with a string `id` (`<ListItem id title>`, or a row of your own that takes `id`) virtualizes the same way, its `title` standing in for `itemText`. Cards and grouped lists don't virtualize.
- **Cost.** Measured on a 2,000-row list in the Eskais repository, the first paint takes about 100 ms instead of 800 ms, and j/k reach the next paint in under 16 ms at the 95th percentile on a desktop CPU. Keep `renderItem` cheap: rows are memoized, so scrolling renders only the rows that enter.

## Global search (⌘K)

A search that loads results from the server, opened from the `Topbar` with `mod+k`. Only the triggers go in the Topbar's slots; the `CommandDialog` goes beside the `Topbar`, bound by the same controller:

```tsx
import { useAsyncOptions } from "@ui-sdk/react/async-options"

function AppTopbar() {
  const [search] = useState(() => createCommandDialogController())
  return (
    <>
      <Topbar
        center={
          <CommandDialogTrigger controller={search} shortcut="mod+k">
            <SearchIcon />
            Search the workspace
            <CommandDialogShortcut />
          </CommandDialogTrigger>
        }
        centerCompact={
          <CommandDialogOpenButton controller={search} variant="ghost" size="icon" aria-label="Search the workspace">
            <SearchIcon />
          </CommandDialogOpenButton>
        }
      />
      <GlobalSearch controller={search} />
    </>
  )
}

function GlobalSearch({ controller }: { controller: CommandDialogController }) {
  const results = useAsyncOptions(searchWorkspace, { debounce: 200, immediate: true }) // (query, { signal }) => Promise<{ value, label }[]>
  return (
    <CommandDialog controller={controller}>
      <CommandDialogContent title="Search the workspace">
        <Command
          filter={false}
          status={results.status}
          onQueryChange={(query) => results.setQuery(query)}
          onLoadMore={results.loadMore}
          onAction={(value) => {
            navigate(value)
            controller.close()
          }}
        >
          <CommandInput aria-label="Search the workspace" />
          <CommandStatus>{(state) => (state.loading ? "Searching…" : `${state.count} results`)}</CommandStatus>
          <CommandEmpty>
            {(state) => (state.empty && !state.loading ? `Nothing matches “${state.query}”` : null)}
          </CommandEmpty>
          <CommandList>
            {results.items.map((item) => (
              <CommandItem key={item.value} value={item.value} label={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}
```

- **Never put the dialog in a Topbar slot.** A dialog renders where it is placed (in the browser's top layer), and `center` is hidden on narrow screens once `centerCompact` is set, so a dialog inside it opens with no box. The same goes for any slot you hide with `narrow:hidden`. The triggers can live anywhere: the main trigger's `mod+k` still listens while its slot is hidden.
- Every `options`, `items`, `stages`, `steps` and `columns` prop in the registry takes a readonly array, so `as const` data and `useAsyncOptions` results pass as they are. UI SDK 0.1.0-beta.5's `useAsyncOptions` itself still types its loader's result as a mutable array: return `[...rows]` from a loader whose source is readonly.
- `filter={false}` keeps the server's order; `useAsyncOptions` debounces, aborts stale requests through `signal` and keeps the last results while loading. Pass `status` so the list gets `aria-busy` and `CommandStatus` announces counts.
- Each open starts with an empty search (or the `Command`'s `defaultQuery`) on the first page: `CommandDialogContent` remounts its `Command`. A `query` you control is yours to reset.
- One Escape closes the dialog whatever the search holds. `<CommandDialog escapeKey="clear">` keeps UI SDK's order instead: clear the search, go back a page, then close. A `dismissible={false}` dialog leaves Escape to the search.
- The dialog returns focus to the trigger that opened it, and `onOpenChange` on `CommandDialog` reports both ways. `shortcut` is opt-in and only listens while the trigger is mounted.
- **Go to a page from the palette.** `<CommandItem value="ideas" href="#/ideas">` is a link command: Enter, a click, its `shortcut` and a mouse press (fast links, `#/…` hash routes and same-origin paths) follow it, and it never runs `Command onAction`, which stays for actions. Pass `onFollow={() => { controller.close(); router.push("/ideas") }}` to route on the client and close the palette first; without it a hash route sets `location.hash` and a path loads with `location.assign`. Modified clicks stay native (a new tab); `fast={false}` waits for the click.
- Outside a Topbar, prefer one trigger whose text goes `narrow:sr-only`. For a second way in, like a `Topbar`'s `centerCompact` icon, use `CommandDialogOpenButton` as above: it opens through the controller, gets focus back on close, and is hidden from agents, who open the dialog by its main trigger's name. Not a second `CommandDialogTrigger`: in UI SDK 0.1.0-beta.5 that drops the dialog's agent label.

## Application shell

`Shell` builds the frame from one list of routes: the sidebar, the bottom bar on narrow screens, its More sheet and the palette's Go to group.

- **Bottom bar.** Routes with `mobile` take its four slots and More opens the rest. `mobile: { order }` orders the bar apart from the sidebar: by `order`, then by the routes' place in the list, `true` counting as order 0.
- **Placements.** `placements` on a route, a subset of `"sidebar"`, `"mobile"`, `"more"` and `"palette"`, limits where it shows; without it a route shows everywhere it would. `["sidebar"]` makes a sidebar-only route; leave out `"palette"` or `"more"` to keep it out of just that. `placements` decides over `mobile`: without `"mobile"` the route never takes a bar slot, even with `mobile` set, and listing `"mobile"` gives it one as `mobile: true` does. Keep a route reachable somewhere on narrow screens: the sidebar's drawer, the bar or More.
- **Palette.** Each open starts empty and one Escape closes it, focus back on the trigger. `searchQuery`/`onSearchQueryChange` control the search, `defaultSearchQuery` starts each open, and `commandGroups` with `onCommand` add your commands.
- **Sidebar.** `sidebarHeader` (a brand, a workspace switcher, a caption) and `sidebarFooter` (an account, a plan) go above and below the routes; the header hides while the sidebar is a rail. `sidebarShortcut="mod+b"` (off by default) presses the topbar's sidebar trigger: it collapses or expands the sidebar on wide screens and opens the drawer on narrow ones. Inside the Shell, `useShellSidebar()` returns `{ collapsed, setCollapsed, controller }`. To hold that state above the Shell, call `useSidebarState({ storageKey })` yourself and pass it as `sidebar`.
