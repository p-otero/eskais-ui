---
name: eskais-perf
description: Keeps screens built with Eskais UI fast. Use when a screen renders long lists or tables, feels slow to type in, scroll or navigate, when adding effects, animations, glass or blur, when React Compiler is on, or when asked to profile or speed up a page in a project that installs @eskais components. Load it with the eskais-ui skill.
---

# Keep Eskais screens fast

Eskais components are already built to stay cheap: rows virtualize, effects live in hooks, motion is transform and opacity on short timings, and glass is opt-in. Most slow screens come from the code around them. Check these in order, then measure.

## Long lists and tables

- **Never map thousands of rows by hand.** Use `List items getItemId renderItem itemText` (rows) or `DataTable`. Past 200 rows they render only the rows in view (`virtualize="auto"`, through the `virtual-rows` item), and keep every row reachable: keyboard (`row-navigation`), agents' `select`/`setSelection` by id, and find in page through `hidden="until-found"` stubs. A `.map()` of 2,000 `ListItem`s loses all three and paints about eight times slower.
- **Give the list a bounded height.** Virtual rows scroll with the nearest scrolling ancestor, else the window: put the list in a `min-h-0 flex-1 overflow-y-auto` parent, or pass `className="max-h-96"` to a `DataTable`. A parent that grows with its content renders every row.
- **Pass `estimateSize`** close to a row's real height in px, so the scrollbar doesn't jump while rows are measured.
- **Keep `renderItem` cheap and stable.** Rows are memoized: scrolling renders only the rows that enter. Read data in the row, don't compute it there; pass callbacks that keep their identity (`renderCardActions` on `AgentTaskBoard`, `renderItem`), or every row re-renders on every parent render. React Compiler memoizes them for you; without it, use `useCallback`.
- **Cards and grouped lists don't virtualize.** A board column or a `ListGroup` of hundreds of cards needs paging or a filter, not more cards.
- **Long pages of sections:** the theme's `content-auto` utility sets `content-visibility: auto` with an intrinsic height (`--intrinsic-height`, 24rem by default), so the browser skips rendering what's off screen.

## Effects stay out of components

- A component renders; side effects live in your handlers (`onConfirm`, `onSearch`, `onSubmit`) or in a hook module (`use-*.ts` next to the component, or `hooks/`). `@eskais/lint-rules` already rejects state set or derived in an effect (`react/set-state-in-effect`, `react/no-deriving-state-in-effects`); to enforce effects in hooks as Eskais does, also extend `node_modules/@p-otero/oxlint-rules/presets/react-agents.json` (`p-otero/no-effect-outside-hooks`, `p-otero/prefer-sync-external-store`).
- Before writing an effect, try in this order: derive the value during render; act in the event handler that caused the change; read an external store with `useSyncExternalStore`; read the latest props inside an effect with `useEffectEvent`.
- Never mirror a prop into state with an effect (`useEffect(() => setX(props.x))`): it renders twice and paints a stale frame between.
- One clock per screen: `useNow()` once, passed down as `now` to `RelativeTime`, `TaskCard` and friends, never one timer per time. `AgentTaskBoard` does this itself and pauses while the page is hidden.
- Remote options: `useAsyncOptions` from `@ui-sdk/react/async-options` debounces, aborts stale requests through `signal` and keeps the last results while loading. Don't add your own debounce or loading state around it.

## React Compiler

Eskais components and hooks compile with `babel-plugin-react-compiler`. Keep your code compilable too, or the compiler skips the whole component and nothing in it is memoized:

- no `try … finally` in a component or hook, no conditional inside a `try`, and no default parameter built with `||` or `&&`; move that work into a plain function outside the component;
- no mutation of props, state or values read during render; no reading or writing `ref.current` during render;
- hooks at the top level, never in a condition or loop.

`@eskais/lint-rules` reports the render-purity ones (`react/purity`, `react/refs`, `react/immutability`, `react/rules-of-hooks`). With the compiler on, a hand-written `useMemo` or `useCallback` in a compiled component is redundant; keep it where the component can't compile.

## Motion

- **Animate `transform` and `opacity`** (and `translate`, `scale`), which the compositor runs without layout. Floating labels move with `translate` and `scale`; popovers, menus and dialogs fade and scale. Never transition `top`, `left`, `width`, `height`, `margin` or `box-shadow` on something large or frequent.
- `Accordion` and `Collapsible` animate their panel's measured height; that's fine for a panel of text, not for a panel holding a long list. Show the list in a `SidePanel` or a page instead.
- Time transitions with the role tokens (`duration-micro` 140ms, `duration-panel` 180ms, `duration-dialog` 200ms, `ease-standard`), never longer: a slow transition reads as a slow app. Never `transition-all` on your own large surfaces; name the properties.
- `prefers-reduced-motion: reduce` collapses transitions in the theme already; add `motion-reduce:` only to swap a movement for a fade.

## Blur and glass

`backdrop-filter` re-renders everything behind the element on every frame it moves or the content under it changes.

- Keep it on small chrome: popovers, menus, toasts, a sidebar, cards in the `glass` theme. `surface-floating` and `backdrop-floating` blur by default; `backdrop-surface` blurs only under `data-theme="glass"`.
- Never put `backdrop-floating`, `backdrop-surface` or your own `backdrop-blur-*` on a large surface that animates, scrolls over moving content or covers most of the viewport. Dialogs and drawers are opaque in every theme for this reason, and for contrast.
- `data-elevation="flat"` on `<html>` or any ancestor drops the floating shadow, blur and translucency, also inside a glass scope: use it for a dense data screen or a low-end device.

## Links

- `Link`, `ButtonLink`, `NavigationMenuLink` and `FastLinkRegion` follow a same-origin link on mouse **press**, not release, so navigation starts sooner. Give them `onFollow` with your router so the press routes on the client instead of reloading.
- **Navigation only.** A press can't be cancelled by moving away (WCAG 2.5.2), so actions stay on `Button`s and menu items, and a link that confirms or changes something gets `fast={false}`. `data-no-fast-link` on an ancestor opts out a region, or the app on `<body>`.

## Loading

- `CodeBlock` loads each language's parser on first use, and `MarkdownView` defers re-parsing (`useDeferredValue`) and memoizes each top-level block: a long note re-renders only what changed. Don't pre-load parsers or re-render the whole document yourself.
- `DataState` keeps the last successful data on screen, `aria-busy`, during a refetch: no flash of a spinner and no layout jump. Pass `placeholderData` for a busy first paint instead of an empty one.
- Split big, rarely opened screens (an editor, a chart page) with `React.lazy` at the route, not inside a list row.

## Budgets and measuring

This section holds the numbers Eskais measures today. More budgets and a measuring harness may be added here later.

| What                                      | Measured                                                      |
| ----------------------------------------- | ------------------------------------------------------------- |
| First paint of a 2,000-row `List`         | about 100 ms virtualized, against about 800 ms with every row |
| j/k in a 2,000-row list to the next paint | under 16 ms at the 95th percentile on a desktop CPU           |
| A frame                                   | 16 ms at 60 Hz: any interaction that misses it shows as jank  |

Those come from a benchmark in the Eskais repository on a production build. Measure your own screen the same way, in a production build (a development build is several times slower and misleads):

1. **React Profiler.** In React DevTools, Profiler tab: record the interaction, then read which components rendered and why ("Record why each component rendered while profiling" in its settings). A row that renders when another row changes means an unstable prop or callback. In code, wrap a subtree in `<Profiler id onRender>` to log `actualDuration`.
2. **Performance panel.** In Chrome DevTools, Performance: set CPU throttling to 4× slowdown, record the interaction, and look for long tasks (over 50 ms), layout and paint after each input, and "Recalculate style" spikes from blur or `transition-all`. The live metrics view shows Interaction to Next Paint for each click and key press.
3. **Rendering tools.** In Chrome DevTools, Rendering: "Paint flashing" shows what repaints while you scroll or animate; a blurred surface that flashes on every frame is a `backdrop-filter` to remove.

Compare before and after on the same machine and build, and keep the change only if the numbers move.
