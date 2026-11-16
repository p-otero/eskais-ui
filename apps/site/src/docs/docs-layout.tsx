import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"

import { DocsBreadcrumb, DocsLayout, DocsPager, DocsToc, useTocItems } from "@/components/ui/docs-layout"
import { Sidebar, SidebarGroup, SidebarItem } from "@/components/ui/sidebar"

import { docPages, docSections, neighbours } from "../pages"
import { hrefFor, linkTo } from "../router"

const layoutStyle = { "--docs-top": "var(--site-header)", "--docs-sidebar-width": "var(--docs-sidebar)" }

function DocsSidebar({ route }: { route: string }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    container.current?.querySelector(`a[href="${hrefFor(route)}"]`)?.scrollIntoView({ block: "nearest" })
  }, [route])
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

function SiteDocsLayout({ route, children }: { route: string; children: ReactNode }) {
  const article = useRef<HTMLDivElement>(null)
  const headings = useTocItems(article, "[data-toc]")
  const { previous, next } = neighbours(route)
  const current = docPages.find((page) => page.route === route)
  return (
    <DocsLayout
      style={layoutStyle as CSSProperties}
      sidebar={<DocsSidebar route={route} />}
      header={
        current && (
          <DocsBreadcrumb
            items={[
              { label: "Docs", ...linkTo("/docs/installation") },
              { label: current.section },
              { label: current.title },
            ]}
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
