import { Button } from "@/components/ui/button"
import { SiteHeader, type SiteHeaderItem } from "@/components/ui/site-header"

import { Section } from "../section"

const siteItems: SiteHeaderItem[] = [
  { label: "Product", href: "#product", current: true },
  {
    label: "Solutions",
    items: [
      { label: "Startups", href: "#startups", description: "Ship a first version this week." },
      { label: "Platform teams", href: "#platform", description: "One pipeline for every service." },
      { label: "Agencies", href: "#agencies", description: "A workspace per client." },
    ],
  },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#customers" },
  { label: "Integrations", href: "#integrations" },
  { label: "Docs", href: "#docs" },
  { label: "Security", href: "#security" },
  { label: "Changelog", href: "#changelog" },
  {
    label: "Company",
    items: [
      { label: "About", href: "#about" },
      { label: "Careers", href: "#careers", description: "Six open roles, all remote." },
      { label: "Contact", href: "#contact" },
    ],
  },
]

function SiteBrand() {
  return (
    <a
      href="#top"
      className="inline-flex items-center gap-inline rounded-control text-title-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-primary">
        <path fill="currentColor" d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3L18.8 8 12 11.7 5.2 8 12 4.3Z" />
      </svg>
      Northwind
    </a>
  )
}

function SiteActions() {
  return (
    <>
      <Button variant="ghost" className="narrow:hidden">
        Sign in
      </Button>
      <Button>Start free</Button>
    </>
  )
}

function SiteHeaderSection() {
  return (
    <Section
      title="SiteHeader"
      description="A floating pill for public sites: links that don't fit move into More as the bar narrows, a drawer on narrow screens, and a stronger fill once the page scrolls."
    >
      <div className="flex w-full flex-col gap-6">
        <div className="w-full rounded-surface bg-linear-to-br from-muted to-background py-6">
          <SiteHeader label="Marketing" brand={<SiteBrand />} items={siteItems} actions={<SiteActions />} />
        </div>
        <div className="w-full max-w-xl rounded-surface bg-linear-to-br from-muted to-background py-6">
          <SiteHeader
            label="Marketing, narrower"
            brand={<SiteBrand />}
            items={siteItems}
            actions={<Button>Start free</Button>}
          />
        </div>
      </div>
    </Section>
  )
}

export { SiteActions, SiteBrand, SiteHeaderSection, siteItems }
