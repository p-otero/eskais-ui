import { createElement, lazy, Suspense, type ComponentType } from "react"

import { Spinner } from "@/components/ui/spinner"

import { guides } from "../guides/meta"
import { findItem } from "../registry"
import { NotFound } from "../not-found"
import { ComponentsIndex } from "./components-index"
import { SiteDocsLayout } from "./docs-layout"
import { ItemPage } from "./item-page"

const guideModules = import.meta.glob<{ default: ComponentType }>("../guides/*.tsx")

const guidePages = new Map(
  guides.map((guide) => {
    const load = guideModules[`../guides/${guide.slug}.tsx`]
    return [guide.slug, load ? lazy(load) : undefined] as const
  }),
)

function Loading() {
  return (
    <div className="flex justify-center py-section">
      <Spinner label="Loading page" />
    </div>
  )
}

function DocsPage({ route }: { route: string }) {
  if (route === "/docs/components") return <ComponentsIndex />
  const component = /^\/docs\/components\/([a-z0-9-]+)$/.exec(route)?.[1]
  if (component) {
    const item = findItem(component)
    return item ? <ItemPage key={item.name} item={item} /> : <NotFound inline />
  }
  const slug = route === "/docs" ? "installation" : route.slice("/docs/".length)
  const guide = guidePages.get(slug)
  return guide ? createElement(guide) : <NotFound inline />
}

function DocsRoutes({ route }: { route: string }) {
  const layoutRoute = route === "/docs" ? "/docs/installation" : route
  return (
    <SiteDocsLayout route={layoutRoute}>
      <Suspense fallback={<Loading />}>
        <DocsPage route={route} />
      </Suspense>
    </SiteDocsLayout>
  )
}

export { DocsRoutes }
