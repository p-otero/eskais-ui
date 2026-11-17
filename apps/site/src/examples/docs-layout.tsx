import { useRef, type CSSProperties } from "react"

import { DocsBreadcrumb, DocsLayout, DocsPager, DocsToc, useTocItems } from "@/components/ui/docs-layout"
import { Sidebar, SidebarGroup, SidebarItem, SidebarTrigger, useSidebarState } from "@/components/ui/sidebar"
import { Topbar } from "@/components/ui/topbar"

const pages = [
  { href: "#installation", label: "Installation" },
  { href: "#theming", label: "Theming", current: true },
  { href: "#tokens", label: "Spacing and tokens" },
]

// The demo scrolls inside its own box, so the sticky columns measure against that box instead of the viewport.
const pane = { "--docs-height": "30rem" } as CSSProperties

export default function DocsLayoutDemo() {
  const article = useRef<HTMLDivElement>(null)
  const items = useTocItems(article, "h4[id]")
  const sidebar = useSidebarState()
  return (
    <div className="h-120 w-full overflow-y-auto rounded-surface border bg-background">
      <DocsLayout
        as="div"
        style={pane}
        topbar={
          <Topbar
            leading={
              <>
                <SidebarTrigger
                  {...sidebar.triggerProps}
                  labels={{
                    open: "Open the example's navigation",
                    collapse: "Collapse the example's sidebar",
                    expand: "Expand the example's sidebar",
                  }}
                />
                <span className="text-title-sm">Acme docs</span>
              </>
            }
          />
        }
        sidebar={
          <Sidebar label="Example docs" {...sidebar.sidebarProps} collapse="hide" trigger={false}>
            <SidebarGroup label="Guides">
              {pages.map((page) => (
                <SidebarItem key={page.href} href={page.href} current={page.current}>
                  {page.label}
                </SidebarItem>
              ))}
            </SidebarGroup>
          </Sidebar>
        }
        header={
          <DocsBreadcrumb
            aria-label="Breadcrumb (example)"
            items={[{ label: "Docs", href: "#docs" }, { label: "Guides", href: "#guides" }, { label: "Theming" }]}
          />
        }
        toc={<DocsToc items={items} title="On this page" aria-label="On this page (example)" />}
      >
        <div ref={article} className="flex flex-col gap-group">
          <h3 className="text-title tracking-tight">Theming</h3>
          <h4 id="demo-tokens" className="text-title-sm">
            Tokens
          </h4>
          <p className="text-body text-muted-foreground">Seeds set the colours; everything else derives from them.</p>
          <h4 id="demo-palettes" className="text-title-sm">
            Palettes
          </h4>
          <p className="text-body text-muted-foreground">A data-palette attribute recolours any subtree.</p>
        </div>
        <DocsPager
          previous={{ href: "#install", title: "Installation" }}
          next={{ href: "#tokens", title: "Spacing and tokens" }}
        />
      </DocsLayout>
    </div>
  )
}
