import { PageLayout } from "@/components/ui/page-layout"

import { Features } from "./bento"
import { Footer } from "./footer"
import { SiteHero } from "./hero"
import { Install } from "./install"
import { QuickStart } from "./quick-start"

function Landing() {
  return (
    <>
      <PageLayout as="main" className="py-0 narrow:py-0">
        <SiteHero />
        <QuickStart />
        <Features />
        <Install />
      </PageLayout>
      <Footer />
    </>
  )
}

export { Landing }
