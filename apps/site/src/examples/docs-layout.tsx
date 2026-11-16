import { useRef } from "react"

import { DocsBreadcrumb, DocsLayout, DocsPager, DocsToc, useTocItems } from "@/components/ui/docs-layout"

export default function DocsLayoutDemo() {
  const article = useRef<HTMLDivElement>(null)
  const items = useTocItems(article, "h4[id]")
  return (
    <div className="w-full rounded-surface border bg-background">
      <DocsLayout
        as="div"
        header={
          <DocsBreadcrumb
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
