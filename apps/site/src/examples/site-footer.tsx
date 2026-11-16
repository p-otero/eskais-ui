import { SiteFooter } from "@/components/ui/site-footer"

export default function SiteFooterDemo() {
  return (
    <SiteFooter
      className="rounded-surface border bg-card"
      brand="Acme"
      description="A footer with link groups; each group is a navigation landmark named by its title."
      groups={[
        {
          title: "Product",
          links: [
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Docs", href: "#docs" },
            { label: "UI SDK", href: "https://ui-sdk.dev/docs", external: true },
          ],
        },
      ]}
      bottom="Open source under the MIT license."
    />
  )
}
