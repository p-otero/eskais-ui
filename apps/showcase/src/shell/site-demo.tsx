import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageLayout } from "@/components/ui/page-layout"
import { SiteHeader } from "@/components/ui/site-header"
import { SkipLink } from "@/components/ui/skip-link"

import { SiteActions, SiteBrand, siteItems } from "../sections/site-header"

const features = [
  { title: "Preview every branch", description: "Each push gets its own URL, torn down when the branch merges." },
  {
    title: "Roll back in one click",
    description: "Every deployment stays addressable, so the last good one is a click away.",
  },
  {
    title: "Logs that follow requests",
    description: "Trace a request from the edge to the database without leaving the page.",
  },
  { title: "Budgets per team", description: "Set a monthly ceiling and get warned at 80%, before anything stops." },
  { title: "Secrets with history", description: "Rotate a key and see which deployment used which version." },
  { title: "Regions near users", description: "Pin a service to a region, or let traffic pick the nearest one." },
]

function SiteDemo() {
  return (
    <div className="flex flex-col">
      <SkipLink>Skip to content</SkipLink>
      <SiteHeader label="Main" brand={<SiteBrand />} items={siteItems} actions={<SiteActions />} />
      <PageLayout as="main" width="dense">
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-meta tracking-meta text-muted-foreground uppercase">Deploy platform</p>
          <h1 className="max-w-2xl text-display tracking-tight text-balance">Ship every branch, keep every rollback</h1>
          <p className="max-w-xl text-body text-balance text-muted-foreground">
            Northwind builds, previews and deploys your services, and keeps each version one click away.
          </p>
        </div>
        <div className="grid gap-section md:grid-cols-3">
          {[...features, ...features].map((feature, index) => (
            <Card key={`${feature.title}-${index > 5 ? "b" : "a"}`}>
              <CardHeader>
                <CardTitle headingLevel={2}>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </PageLayout>
    </div>
  )
}

export { SiteDemo }
