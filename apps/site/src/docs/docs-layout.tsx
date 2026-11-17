import { useRef, type CSSProperties, type ReactNode } from "react"

import { DocsBreadcrumb, DocsLayout, DocsPager, DocsToc, useTocItems } from "@/components/ui/docs-layout"
import { Sidebar, SidebarGroup, SidebarItem } from "@/components/ui/sidebar"

import { slug } from "../header"
import { useScrollIntoView } from "../hooks/use-scroll-into-view"
import { docPages, docSections, neighbours } from "../pages"
import { followTo, hrefFor, linkTo } from "../router"

const layoutStyle = { "--docs-top": "var(--site-header)", "--docs-sidebar-width": "var(--docs-sidebar)" }

function DocsSidebar({ route }: { route: string }) {
  const container = useRef<HTMLDivElement>(null)
  useScrollIntoView(container, `a[href="${hrefFor(route)}"]`)
  return (
    <div ref={container} className="w-full">
      <Sidebar label="Documentation" collapsible={false} narrowQuery="(width <= 47.5rem)" className="w-full">
        {docSections.map((section) => (
          <SidebarGroup key={section.name} label={section.name}>
            {section.pages.map((page) => (
              <SidebarItem key={page.route} current={page.route === route} {...linkTo(page.route)}>
                {page.title}
              </SidebarItem>
            ))}
          </SidebarGroup>
        ))}
      </Sidebar>
    </div>
  )
}

const docsHome = "/docs/installation"

// Every crumb but the current page links somewhere else: a component's category opens its section of the
// components index, and a crumb that would only lead back to this page is left out.
function crumbsFor(route: string): { label: string; route: string }[] {
  if (route === "/docs/components")
    return [
      { label: "Docs", route: docsHome },
      { label: "Components", route },
    ]
  const page = docPages.find((candidate) => candidate.route === route)
  if (!page) return []
  const category = page.route.startsWith("/docs/components/")
    ? [{ label: page.section, route: `/docs/components#${slug(page.section)}` }]
    : []
  const parents = [{ label: "Docs", route: docsHome }, ...category].filter((crumb) => crumb.route !== route)
  return [...parents, { label: page.title, route }]
}

function SiteDocsLayout({ route, children }: { route: string; children: ReactNode }) {
  const article = useRef<HTMLDivElement>(null)
  const headings = useTocItems(article, "[data-toc]")
  const { previous, next } = neighbours(route)
  const crumbs = crumbsFor(route)
  return (
    <DocsLayout
      style={layoutStyle as CSSProperties}
      sidebar={<DocsSidebar route={route} />}
      header={
        crumbs.length > 0 && (
          <DocsBreadcrumb
            items={crumbs.map((crumb, index) =>
              index === crumbs.length - 1 ? { label: crumb.label } : { label: crumb.label, ...followTo(crumb.route) },
            )}
          />
        )
      }
      toc={<DocsToc items={headings} title="On this page" />}
    >
      <div ref={article} className="flex min-w-0 flex-col gap-section">
        {children}
      </div>
      <DocsPager
        previous={previous && { title: previous.title, ...linkTo(previous.route) }}
        next={next && { title: next.title, ...linkTo(next.route) }}
      />
    </DocsLayout>
  )
}

export { SiteDocsLayout }
