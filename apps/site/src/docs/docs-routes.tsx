import { createElement, Suspense, use } from "react"

import { Spinner } from "@/components/ui/spinner"

import { guides } from "../guides/meta"
import { findItem } from "../registry"
import { NotFound } from "../not-found"
import { loadGuide } from "../preload"
import { ComponentsIndex } from "./components-index"
import { SiteDocsLayout, SiteDocsPager } from "./docs-layout"
import { ItemPage } from "./item-page"

const guideSlugs = new Set(guides.map((guide) => guide.slug))

// Read through `use` from the preload cache: a guide preloaded on hover renders without a fallback.
function Guide({ slug }: { slug: string }) {
  const module = loadGuide(slug)
  return module ? createElement(use(module).default) : <NotFound inline />
}

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
  return guideSlugs.has(slug) ? <Guide slug={slug} /> : <NotFound inline />
}

function DocsRoutes({ route }: { route: string }) {
  const layoutRoute = route === "/docs" ? "/docs/installation" : route
  return (
    <SiteDocsLayout route={layoutRoute}>
      <Suspense fallback={<Loading />}>
        <DocsPage route={route} />
        <SiteDocsPager route={layoutRoute} />
      </Suspense>
    </SiteDocsLayout>
  )
}

export { DocsRoutes }
