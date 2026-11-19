import { useRef, type ReactNode } from "react"

import { DocsBreadcrumb, DocsLayout, DocsPager, DocsToc, useTocItems } from "@/components/ui/docs-layout"
import { Sidebar, SidebarGroup, SidebarItem, SidebarTrigger, useSidebarState } from "@/components/ui/sidebar"
import type { SidebarState } from "@/components/ui/sidebar"

import { SiteTopbar, slug } from "../header"
import { useOpenSections } from "../hooks/use-open-sections"
import { useScrollIntoView } from "../hooks/use-scroll-into-view"
import { docPages, docSections, neighbours } from "../pages"
import { followTo, hrefFor, linkTo } from "../router"

// The site's narrow breakpoint, the theme's `narrow:` variant, so the drawer and the stacked layout switch together.
const narrowQuery = "(width <= 47.5rem)"

function DocsSidebar({ route, state }: { route: string; state: SidebarState }) {
  const container = useRef<HTMLDivElement>(null)
  useScrollIntoView(container, `a[href="${hrefFor(route)}"]`)
  const current = docSections.find((section) => section.pages.some((page) => page.route === route))?.name
  const sections = useOpenSections("eskais-site-sections", current, docSections[0]?.name)
  return (
    <div ref={container} className="flex h-full">
      <Sidebar
        label="Documentation"
        {...state.sidebarProps}
        collapse="hide"
        trigger={false}
        narrowQuery={narrowQuery}
        className="bg-transparent"
      >
        {docSections.map((section) => (
          <SidebarGroup
            key={section.name}
            label={section.name}
            collapsible
            open={sections.isOpen(section.name)}
            onOpenChange={(open) => sections.setOpen(section.name, open)}
          >
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
  const crumbs = crumbsFor(route)
  const sidebar = useSidebarState({ storageKey: "eskais-site-sidebar" })
  return (
    <DocsLayout
      topbar={<SiteTopbar trigger={<SidebarTrigger {...sidebar.triggerProps} narrowQuery={narrowQuery} />} />}
      sidebar={<DocsSidebar route={route} state={sidebar} />}
      header={
        crumbs.length > 0 ? (
          <DocsBreadcrumb
            items={crumbs.map((crumb, index) =>
              index === crumbs.length - 1 ? { label: crumb.label } : { label: crumb.label, ...followTo(crumb.route) },
            )}
          />
        ) : undefined
      }
      toc={<DocsToc items={headings} title="On this page" />}
    >
      <div ref={article} className="flex min-w-0 flex-col gap-section">
        {children}
      </div>
    </DocsLayout>
  )
}

/**
 * The previous and next pages. The routes render it inside the page's Suspense boundary, so it appears with the
 * page instead of under its loading spinner, where the page would push it down when it arrives (a layout shift).
 */
function SiteDocsPager({ route }: { route: string }) {
  const { previous, next } = neighbours(route)
  return (
    <DocsPager
      previous={previous && { title: previous.title, ...linkTo(previous.route) }}
      next={next && { title: next.title, ...linkTo(next.route) }}
    />
  )
}

export { SiteDocsLayout, SiteDocsPager }
