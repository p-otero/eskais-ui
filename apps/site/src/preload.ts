import type { ComponentType } from "react"

type Module = { default: ComponentType }
// React's `use` returns a promise's value at once when the promise carries `status: "fulfilled"` and `value`, so a
// page whose code a preload already fetched renders without suspending. A lazy() component would suspend once anyway,
// and React then holds the fallback on screen for about 300 ms before it shows the content.
type Tracked = Promise<Module> & { status?: "pending" | "fulfilled" | "rejected"; value?: Module; reason?: unknown }

const exampleModules = import.meta.glob<Module>("./examples/*.tsx")
const guideModules = import.meta.glob<Module>("./guides/*.tsx")
const loaded = new Map<string, Promise<Module>>()

function track(key: string, load: (() => Promise<Module>) | undefined) {
  const cached = loaded.get(key)
  if (cached || !load) return cached
  const promise = load() as Tracked
  promise.status = "pending"
  promise.then(
    (value) => {
      promise.status = "fulfilled"
      promise.value = value
    },
    (reason: unknown) => {
      promise.status = "rejected"
      promise.reason = reason
    },
  )
  loaded.set(key, promise)
  return promise as Promise<Module>
}

/** An item's example module, loaded once; read it with `use`. */
const loadExample = (name: string) => track(`example:${name}`, exampleModules[`./examples/${name}.tsx`])

/** A guide's page module, loaded once; read it with `use`. */
const loadGuide = (slug: string) => track(`guide:${slug}`, guideModules[`./guides/${slug}.tsx`])

const startedChunks = new Set<string>()

/** Starts loading what `route` renders: the docs chunk and the item's example or the guide. Safe to call often. */
function preloadRoute(route: string) {
  const path = route.split("#")[0] ?? route
  if (startedChunks.has(path)) return
  startedChunks.add(path)
  if (path === "/") {
    void import("./landing/landing")
    return
  }
  if (!path.startsWith("/docs")) return
  void import("./docs/docs-routes")
  const component = /^\/docs\/components\/([a-z0-9-]+)$/.exec(path)?.[1]
  if (component) {
    void loadExample(component)
    return
  }
  void loadGuide(path === "/docs" ? "installation" : path.slice("/docs/".length))
}

/**
 * The guide `route` shows, once it has loaded; undefined for other pages. A component page isn't waited for: its
 * title shows before its example.
 */
function routeGuide(route: string) {
  const path = route.split("#")[0] ?? route
  if (!path.startsWith("/docs") || path.startsWith("/docs/components")) return undefined
  return loadGuide(path === "/docs" ? "installation" : path.slice("/docs/".length))
}

export { loadExample, loadGuide, preloadRoute, routeGuide }
