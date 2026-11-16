import { Button } from "@/components/ui/button"
import { Link } from "@/components/ui/link"
import { SiteHeader, type SiteHeaderItem } from "@/components/ui/site-header"

const items: SiteHeaderItem[] = [
  { label: "Product", href: "#product", current: true },
  {
    label: "Solutions",
    items: [
      { label: "Startups", href: "#startups", description: "Ship a first version this week." },
      { label: "Platform teams", href: "#platform", description: "One pipeline for every service." },
    ],
  },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#customers" },
  { label: "Docs", href: "#docs" },
  { label: "Changelog", href: "#changelog" },
]

export default function SiteHeaderDemo() {
  return (
    <div className="w-full rounded-surface bg-linear-to-br from-muted to-background py-section">
      <SiteHeader
        label="Example site"
        brand={
          <Link href="#top" variant="plain" className="text-title-sm">
            Northwind
          </Link>
        }
        items={items}
        actions={<Button>Start free</Button>}
      />
    </div>
  )
}
